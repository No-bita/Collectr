export function getDbClient(env) {
  const db = env?.DB || env;
  if (db && typeof db.execute === "function" && typeof db.prepare !== "function") {
    if (typeof db.batch !== "function") {
      db.batch = async (queries) => {
        const results = [];
        for (const q of queries) {
          results.push(await db.execute(q));
        }
        return results;
      };
    }
    return db;
  }
  
  const executeQuery = async (query) => {
    let sql, args;
    if (typeof query === "string") {
      sql = query;
      args = [];
    } else {
      sql = query.sql;
      args = query.args || [];
    }

    try {
      let stmt = db.prepare(sql);
      if (args && args.length > 0) {
        stmt = stmt.bind(...args);
      }
      const res = await stmt.all();
      return { 
        rows: res.results || [], 
        meta: res.meta, 
        changes: res.meta?.changes ?? (res.results ? res.results.length : 0) 
      };
    } catch (err) {
      const msg = (err.message || "").toLowerCase();

      const isMissingCol = (col) => {
        return (
          msg.includes(`no such column: ${col}`) ||
          msg.includes(`.${col}`) ||
          msg.includes(`no column named ${col}`) ||
          (msg.includes(col) && (msg.includes("no such column") || msg.includes("no column named")))
        );
      };

      if (msg.includes("no such table: contacts")) {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS contacts (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              contact_person TEXT NOT NULL,
              phone_number TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT unq_user_contact_phone UNIQUE(user_id, phone_number)
            )
          `).run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_user_phone ON contacts(user_id, phone_number)").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("contact_id")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN contact_id TEXT").run();
          await db.prepare("ALTER TABLE case_timeline ADD COLUMN contact_id TEXT").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("wa_phone_number_id")) {
        try {
          await db.prepare("ALTER TABLE users ADD COLUMN wa_phone_number_id TEXT").run();
          await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS unq_users_wa_phone_id ON users(wa_phone_number_id) WHERE wa_phone_number_id IS NOT NULL").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("provider_message_id")) {
        try {
          await db.prepare("ALTER TABLE case_timeline ADD COLUMN provider_message_id TEXT").run();
          await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS unq_timeline_provider_msg ON case_timeline(provider_message_id) WHERE provider_message_id IS NOT NULL").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("template_name")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN template_name TEXT").run();
          await db.prepare("ALTER TABLE case_timeline ADD COLUMN template_name TEXT").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("user_id")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN user_id TEXT").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      if (isMissingCol("is_demo")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN is_demo INTEGER DEFAULT 0").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      if (msg.includes("no such table: loan_product_doc_mappings")) {
        try {
          await db.prepare("CREATE TABLE IF NOT EXISTS loan_product_doc_mappings (product_label TEXT PRIMARY KEY, required_doc_ids JSON NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      if (msg.includes("no such table: message_templates")) {
        try {
          await db.prepare("CREATE TABLE IF NOT EXISTS message_templates (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL UNIQUE, category TEXT DEFAULT 'UTILITY', language TEXT DEFAULT 'en', header_type TEXT DEFAULT 'NONE', header_text TEXT, body_text TEXT NOT NULL, footer_text TEXT, button_type TEXT DEFAULT 'url', button_text TEXT, button_url TEXT, param_mappings JSON, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      if (msg.includes("no such table: schedules")) {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS schedules (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              case_id TEXT,
              contact_id TEXT,
              phone_number TEXT NOT NULL,
              template_name TEXT NOT NULL,
              template_params JSON,
              schedule_type TEXT NOT NULL,
              recurrence_interval TEXT,
              timezone TEXT NOT NULL DEFAULT 'UTC',
              status TEXT NOT NULL DEFAULT 'active',
              next_run_utc DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              cancelled_at DATETIME
            )
          `).run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_schedules_user_status ON schedules(user_id, status)").run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(status, next_run_utc)").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      if (msg.includes("no such table: scheduled_occurrences")) {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS scheduled_occurrences (
              id TEXT PRIMARY KEY,
              schedule_id TEXT NOT NULL,
              occurrence_key TEXT NOT NULL,
              scheduled_for_utc DATETIME NOT NULL,
              operational_status TEXT NOT NULL DEFAULT 'pending',
              claimed_at DATETIME,
              attempts INTEGER NOT NULL DEFAULT 0,
              provider_message_id TEXT,
              skip_reason TEXT,
              last_error TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              executed_at DATETIME,
              CONSTRAINT unq_occurrence_schedule_key UNIQUE(schedule_id, occurrence_key)
            )
          `).run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_occurrences_claim ON scheduled_occurrences(operational_status, scheduled_for_utc, claimed_at)").run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_occurrences_schedule ON scheduled_occurrences(schedule_id)").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      throw err;
    }
  };

  const executeBatch = async (queries) => {
    if (db && typeof db.batch === "function") {
      const prepared = queries.map(q => {
        const sql = typeof q === "string" ? q : q.sql;
        const args = typeof q === "string" ? [] : (q.args || []);
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        return stmt;
      });
      return await db.batch(prepared);
    }
    const results = [];
    for (const q of queries) {
      results.push(await executeQuery(q));
    }
    return results;
  };

  return {
    execute: executeQuery,
    batch: executeBatch
  };
}
