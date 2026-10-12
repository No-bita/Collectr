import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ITEM_STATUSES, ITEM_TRANSITIONS, StateConflict } from "../src/domain/states.js";
import { NotFoundError, closeRequest, requestProgress, transitionItem } from "../src/db/request-state.js";
import { handleUpdateRequestItem, handleUpdateRequestStatus } from "../src/api/requests.js";

// node:sqlite needs Node 22.5+. CI also runs Node 20, where this suite is skipped.
let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  /* unsupported runtime */
}
const SKIP = DatabaseSync ? false : "node:sqlite is not available on this Node version (needs 22.5+)";

const v2Dir = fs.existsSync(path.join(process.cwd(), "src", "db", "schema.sql"))
  ? process.cwd()
  : path.join(process.cwd(), "v2");
const migrationsDir = path.join(v2Dir, "migrations");

// D1-style adapter over node:sqlite. batch() is one transaction, like D1.
function adapter(raw) {
  const run = (q) => {
    const sql = typeof q === "string" ? q : q.sql;
    const args = typeof q === "string" ? [] : q.args || [];
    const stmt = raw.prepare(sql);
    if (/^\s*(select|with)/i.test(sql)) {
      const rows = stmt.all(...args).map((r) => ({ ...r }));
      return { rows, results: rows, meta: { changes: 0 }, changes: rows.length };
    }
    const info = stmt.run(...args);
    return { rows: [], results: [], meta: { changes: Number(info.changes) }, changes: Number(info.changes), rowsAffected: Number(info.changes) };
  };
  return {
    async execute(q) {
      return run(q);
    },
    async batch(queries) {
      raw.exec("BEGIN");
      try {
        const out = queries.map(run);
        raw.exec("COMMIT");
        return out;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
  };
}

function setup() {
  const raw = new DatabaseSync(":memory:");
  for (const f of fs.readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort()) {
    raw.exec(fs.readFileSync(path.join(migrationsDir, f), "utf8"));
  }
  raw.exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1', 'a', 'x');
            INSERT INTO firms (id, name) VALUES ('firm_u1', 'One'), ('firm_u2', 'Two');
            INSERT INTO firm_members (firm_id, user_id, role) VALUES ('firm_u1', 'u1', 'owner');
            INSERT INTO contacts (id, user_id, firm_id, name, phone_number) VALUES ('c1', 'u1', 'firm_u1', 'Client', '919999999999');
            INSERT INTO requests (id, user_id, firm_id, contact_id, title, status) VALUES ('r1', 'u1', 'firm_u1', 'c1', 'GST', 'open');`);
  return { raw, db: adapter(raw) };
}

function addItem(raw, id, status, required = 1) {
  raw.prepare("INSERT INTO request_items (id, request_id, firm_id, title, status, required) VALUES (?, 'r1', 'firm_u1', ?, ?, ?)").run(id, id, status, required);
}

const STAFF = { type: "staff", userId: "u1" };
const scope = { firmId: "firm_u1", requestId: "r1" };

async function outcome(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (err) {
    return { ok: false, err };
  }
}

test("transitionItem: every (from, to) pair is allowed or 409", { skip: SKIP }, async () => {
  for (const from of ITEM_STATUSES) {
    for (const to of ITEM_STATUSES) {
      const { raw, db } = setup();
      addItem(raw, "i1", from);
      const res = await outcome(transitionItem(db, "i1", to, STAFF, "because", scope));
      const legal = ITEM_TRANSITIONS[from].includes(to);
      assert.equal(res.ok, legal, `${from} -> ${to}`);
      const row = raw.prepare("SELECT status FROM request_items WHERE id='i1'").get();
      const events = raw.prepare("SELECT count(*) AS n FROM activities WHERE activity_type='item_transition'").get().n;
      if (legal) {
        assert.equal(row.status, to);
        assert.equal(events, 1, `${from} -> ${to} writes one event`);
      } else {
        assert.ok(res.err instanceof StateConflict, `${from} -> ${to}`);
        assert.equal(res.err.status, 409);
        assert.equal(res.err.currentStatus, from);
        assert.equal(row.status, from);
        assert.equal(events, 0, `${from} -> ${to} writes no event`);
      }
    }
  }
});

test("transitionItem: records the edge, actor and reason in the event", { skip: SKIP }, async () => {
  const { raw, db } = setup();
  addItem(raw, "i1", "received");
  await transitionItem(db, "i1", "needs_replacement", STAFF, " blurry scan ", scope);
  const ev = raw.prepare("SELECT user_id, contact_id, request_id, firm_id, metadata FROM activities WHERE activity_type='item_transition'").get();
  assert.deepEqual([ev.user_id, ev.contact_id, ev.request_id, ev.firm_id], ["u1", "c1", "r1", "firm_u1"]);
  assert.deepEqual(JSON.parse(ev.metadata), { itemId: "i1", from: "received", to: "needs_replacement", actor: "staff", reason: "blurry scan" });
});

test("transitionItem: concurrent identical transitions apply once (compare-and-set)", { skip: SKIP }, async () => {
  const { raw, db } = setup();
  addItem(raw, "i1", "received");
  const results = await Promise.all([
    outcome(transitionItem(db, "i1", "accepted", STAFF, null, scope)),
    outcome(transitionItem(db, "i1", "accepted", STAFF, null, scope)),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  const loser = results.find((r) => !r.ok);
  assert.ok(loser.err instanceof StateConflict);
  assert.equal(loser.err.status, 409);
  assert.equal(loser.err.currentStatus, "accepted");
  assert.equal(raw.prepare("SELECT count(*) AS n FROM activities WHERE activity_type='item_transition'").get().n, 1);
});

test("transitionItem: a stale write cannot clobber a newer status", { skip: SKIP }, async () => {
  const { raw, db } = setup();
  addItem(raw, "i1", "received");
  // Staff A accepts while staff B (who read "received") tries needs_replacement.
  const results = await Promise.all([
    outcome(transitionItem(db, "i1", "accepted", STAFF, null, scope)),
    outcome(transitionItem(db, "i1", "needs_replacement", STAFF, "bad", scope)),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].err.currentStatus, "accepted");
  assert.equal(raw.prepare("SELECT status FROM request_items WHERE id='i1'").get().status, "accepted");
  assert.equal(raw.prepare("SELECT count(*) AS n FROM activities WHERE activity_type='item_transition'").get().n, 1);
});

test("transitionItem: the batch fails closed when the row changed after validation", { skip: SKIP }, async () => {
  const { raw, db } = setup();
  addItem(raw, "i1", "received");
  // Move the row between the read and the batch.
  const racing = {
    ...db,
    async batch(q) {
      raw.prepare("UPDATE request_items SET status='under_review' WHERE id='i1'").run();
      return db.batch(q);
    },
  };
  const res = await outcome(transitionItem(racing, "i1", "accepted", STAFF, null, scope));
  assert.ok(res.err instanceof StateConflict);
  assert.equal(res.err.currentStatus, "under_review");
  assert.equal(raw.prepare("SELECT count(*) AS n FROM activities WHERE activity_type='item_transition'").get().n, 0);
});

test("transitionItem: firm and request scope, actor rules", { skip: SKIP }, async () => {
  const { raw, db } = setup();
  addItem(raw, "i1", "missing");
  const other = await outcome(transitionItem(db, "i1", "received", STAFF, null, { firmId: "firm_u2" }));
  assert.ok(other.err instanceof NotFoundError);
  const wrongReq = await outcome(transitionItem(db, "i1", "received", STAFF, null, { firmId: "firm_u1", requestId: "nope" }));
  assert.ok(wrongReq.err instanceof NotFoundError);
  const noFirm = await outcome(transitionItem(db, "i1", "received", STAFF, null, {}));
  assert.ok(noFirm.err instanceof TypeError);
  const clientReview = await outcome(transitionItem(db, "i1", "waived", { type: "client_link" }, "x", scope));
  assert.equal(clientReview.err.status, 409);
  const upload = await transitionItem(db, "i1", "received", { type: "client_link", userId: null }, null, scope);
  assert.equal(upload.status, "received");
  assert.equal(raw.prepare("SELECT user_id FROM activities WHERE activity_type='item_transition'").get().user_id, "u1");
});

test("requestProgress: loads the firm-scoped snapshot", { skip: SKIP }, async () => {
  const { raw, db } = setup();
  addItem(raw, "a", "accepted");
  addItem(raw, "b", "received");
  addItem(raw, "c", "waived", 0);
  const p = await requestProgress(db, "r1", "firm_u1");
  assert.equal(p.total, 3);
  assert.equal(p.counts.accepted, 1);
  assert.equal(p.requiredTotal, 2);
  assert.equal(p.requiredRemaining, 1);
  assert.equal(p.canClose, false);
  assert.equal(await requestProgress(db, "r1", "firm_u2"), null);
});

test("closeRequest: blocked by missing, received or under_review; allowed when accepted or waived", { skip: SKIP }, async () => {
  for (const blocker of ["missing", "received", "under_review", "needs_replacement"]) {
    const { raw, db } = setup();
    addItem(raw, "a", "accepted");
    addItem(raw, "b", blocker);
    const res = await outcome(closeRequest(db, "r1", { firmId: "firm_u1" }));
    assert.equal(res.err?.status, 409, blocker);
    const row = raw.prepare("SELECT status, completed_at FROM requests WHERE id='r1'").get();
    assert.deepEqual([row.status, row.completed_at], ["open", null]);
  }
  const { raw, db } = setup();
  addItem(raw, "a", "accepted");
  addItem(raw, "b", "waived");
  addItem(raw, "c", "missing", 0); // optional never blocks
  const closed = await closeRequest(db, "r1", { firmId: "firm_u1", userId: "u1" });
  assert.equal(closed.status, "closed");
  const row = raw.prepare("SELECT status, completed_at FROM requests WHERE id='r1'").get();
  assert.equal(row.status, "closed");
  assert.ok(row.completed_at);
  assert.equal(raw.prepare("SELECT count(*) AS n FROM activities WHERE activity_type='request_completed'").get().n, 1);
  const again = await outcome(closeRequest(db, "r1", { firmId: "firm_u1" }));
  assert.equal(again.err.status, 409);
});

test("closeRequest: an item that moves after the read still blocks the close", { skip: SKIP }, async () => {
  const { raw, db } = setup();
  addItem(raw, "a", "accepted");
  const racing = {
    ...db,
    async batch(q) {
      addItem(raw, "late", "missing");
      return db.batch(q);
    },
  };
  const res = await outcome(closeRequest(racing, "r1", { firmId: "firm_u1" }));
  assert.equal(res.err.status, 409);
  assert.equal(raw.prepare("SELECT status FROM requests WHERE id='r1'").get().status, "open");
  assert.equal(raw.prepare("SELECT count(*) AS n FROM activities WHERE activity_type='request_completed'").get().n, 0);
});

test("routes: item PATCH and request close use the state module", { skip: SKIP }, async () => {
  const { raw, db } = setup();
  addItem(raw, "a", "accepted");
  addItem(raw, "b", "missing");
  const ctx = (params, body) => {
    let out;
    const vars = { user: { id: "u1" }, firmId: "firm_u1" };
    return {
      env: { DB: db },
      get: (k) => vars[k],
      req: { param: (k) => params[k], json: async () => body },
      json: (payload, status = 200) => ((out = { status, payload }), out),
    };
  };
  const waiveNoReason = await handleUpdateRequestItem(ctx({ requestId: "r1", itemId: "b" }, { status: "waived" }));
  assert.equal(waiveNoReason.status, 409);
  assert.equal(waiveNoReason.payload.currentStatus, "missing");
  const closeEarly = await handleUpdateRequestStatus(ctx({ id: "r1" }, { status: "closed" }));
  assert.equal(closeEarly.status, 409);
  const waive = await handleUpdateRequestItem(ctx({ requestId: "r1", itemId: "b" }, { status: "waived", reason: "Not needed", title: "B2" }));
  assert.equal(waive.status, 200);
  assert.equal(waive.payload.item.status, "waived");
  assert.equal(waive.payload.item.title, "B2");
  const close = await handleUpdateRequestStatus(ctx({ id: "r1" }, { status: "closed" }));
  assert.equal(close.status, 200);
  assert.ok(close.payload.request.completedAt);
});

test("single write path: no UPDATE of request_items.status outside the state module", () => {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".js")) files.push(p);
    }
  };
  walk(path.join(v2Dir, "src"));
  const offenders = files.filter((f) => {
    if (f.endsWith(path.join("db", "request-state.js"))) return false;
    const src = fs.readFileSync(f, "utf8");
    return /UPDATE\s+request_items\s+SET[^`"']*\bstatus\b/i.test(src);
  });
  assert.deepEqual(offenders, []);
});
