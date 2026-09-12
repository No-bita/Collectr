import "./helpers/network-guard.js";
import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

function createMagicLinkMockDb({ tokens = [], cases = [], reqDocs = [], uploadedDocs = [] } = {}) {
  const tokenState = tokens.map(t => ({ ...t }));
  const caseState = cases.map(c => ({ ...c }));
  const docState = reqDocs.map(d => ({ ...d }));
  const uploadState = uploadedDocs.map(u => ({ ...u }));

  return {
    prepare: (rawSql) => {
      let boundArgs = [];
      const sql = rawSql.replace(/\s+/g, " ").trim();
      return {
        bind: (...args) => {
          boundArgs = args;
          return {
            all: async () => {
              if (sql.includes("UPDATE secure_tokens SET fingerprint_hash = ? WHERE token = ?")) {
                const hash = boundArgs[0];
                const tokenVal = boundArgs[1];
                const found = tokenState.find(t => t.token === tokenVal);
                if (found) found.fingerprint_hash = hash;
                return { results: [] };
              }
              if (sql.includes("UPDATE secure_tokens SET status = 'locked' WHERE token = ?")) {
                const tokenVal = boundArgs[0];
                const found = tokenState.find(t => t.token === tokenVal);
                if (found) found.status = "locked";
                return { results: [] };
              }
              if (sql.includes("FROM secure_tokens s") && sql.includes("JOIN loan_cases c")) {
                const tokenVal = boundArgs[0];
                const found = tokenState.find(t => t.token === tokenVal);
                if (!found) return { results: [] };
                const caseObj = caseState.find(c => c.id === found.case_id) || {};
                return {
                  results: [{
                    status: found.status,
                    expires_at: found.expires_at,
                    case_id: found.case_id,
                    fingerprint_hash: found.fingerprint_hash || null,
                    contact_person: caseObj.contact_person || "Borrower",
                    loan_product: caseObj.loan_product || "Working Capital",
                    phone_number: caseObj.phone_number || "919876543210"
                  }]
                };
              }
              if (sql.includes("FROM secure_tokens WHERE token = ?")) {
                const tokenVal = boundArgs[0];
                const found = tokenState.find(t => t.token === tokenVal);
                if (!found) return { results: [] };
                return { results: [{ case_id: found.case_id, status: found.status }] };
              }
              if (sql.includes("FROM required_documents WHERE case_id = ? AND id = ?")) {
                const caseId = boundArgs[0];
                const docId = boundArgs[1];
                const found = docState.filter(d => d.case_id === caseId && d.id === docId);
                return { results: found };
              }
              if (sql.includes("FROM required_documents WHERE case_id = ?")) {
                const caseId = boundArgs[0];
                const found = docState.filter(d => d.case_id === caseId);
                return { results: found };
              }
              if (sql.includes("FROM uploaded_documents WHERE case_id = ?")) {
                const caseId = boundArgs[0];
                const found = uploadState.filter(u => u.case_id === caseId);
                return { results: found };
              }
              if (sql.includes("SELECT contact_person FROM loan_cases WHERE id = ?")) {
                const caseId = boundArgs[0];
                const found = caseState.find(c => c.id === caseId);
                return { results: found ? [found] : [] };
              }
              return { results: [] };
            },
            run: async () => {
              if (sql.includes("UPDATE secure_tokens SET fingerprint_hash = ? WHERE token = ?")) {
                const hash = boundArgs[0];
                const tokenVal = boundArgs[1];
                const found = tokenState.find(t => t.token === tokenVal);
                if (found) found.fingerprint_hash = hash;
                return { success: true };
              }
              if (sql.includes("UPDATE secure_tokens SET status = 'locked' WHERE token = ?")) {
                const tokenVal = boundArgs[0];
                const found = tokenState.find(t => t.token === tokenVal);
                if (found) found.status = "locked";
                return { success: true };
              }
              return { success: true };
            }
          };
        },
        all: async () => ({ results: [] }),
        run: async () => ({ success: true })
      };
    }
  };
}

test("Magic-Link Upload Session Lifecycle & Security Isolation Tests", async (t) => {
  const now = new Date();
  const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const pastExpiry = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const mockDb = createMagicLinkMockDb({
    tokens: [
      { token: "tok_active_1", case_id: "case_101", status: "active", expires_at: futureExpiry, fingerprint_hash: null },
      { token: "tok_expired_2", case_id: "case_102", status: "active", expires_at: pastExpiry, fingerprint_hash: null },
      { token: "tok_locked_3", case_id: "case_103", status: "locked", expires_at: futureExpiry, fingerprint_hash: "known_device_hash" }
    ],
    cases: [
      { id: "case_101", contact_person: "Priya Sharma", loan_product: "ITR Filing", phone_number: "919876543210" },
      { id: "case_102", contact_person: "Rohan Varma", loan_product: "GST Filing", phone_number: "919876543211" },
      { id: "case_103", contact_person: "Amitabh Sen", loan_product: "Working Capital", phone_number: "919876543212" },
      { id: "case_202", contact_person: "Other Tenant Borrower", loan_product: "Personal Loan", phone_number: "919876543299" }
    ],
    reqDocs: [
      { id: "doc_pan_101", case_id: "case_101", document_type: "pan", label: "PAN Card", status: "pending" },
      { id: "doc_gst_101", case_id: "case_101", document_type: "gst", label: "GST Certificate", status: "pending" },
      { id: "doc_salary_202", case_id: "case_202", document_type: "salary_slip", label: "Salary Slip", status: "pending" }
    ],
    uploadedDocs: []
  });

  const env = {
    DB: mockDb,
    CF_ACCOUNT_ID: "mock_cf_acc",
    R2_AK_id: "mock_ak",
    R2_SAK: "mock_sak",
    DOCUMENT_BUCKET: { bucketName: "test-bucket" }
  };

  await t.test("1. Valid active token returns 200 with case metadata, masked phone, and required document checklist", async () => {
    const res = await app.request("https://collectrr.workers.dev/api/session/tok_active_1", {
      method: "GET",
      headers: {
        "CF-Connecting-IP": "203.0.113.195",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)"
      }
    }, env);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "active");
    assert.equal(body.contactPerson, "Priya Sharma");
    assert.equal(body.loanProduct, "ITR Filing");
    assert.equal(body.phoneMasked, "919****3210");
    assert.equal(body.documents.length, 2);
    assert.equal(body.documents[0].type, "pan");
    assert.equal(body.documents[0].status, "pending");
  });

  await t.test("2. Expired token returns 403 Session expired or locked", async () => {
    const res = await app.request("https://collectrr.workers.dev/api/session/tok_expired_2", {
      method: "GET",
      headers: {
        "CF-Connecting-IP": "203.0.113.195",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)"
      }
    }, env);

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error);
  });

  await t.test("3. Non-existent token returns 404 Invalid token", async () => {
    const res = await app.request("https://collectrr.workers.dev/api/session/non_existent_token_999", {
      method: "GET"
    }, env);

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
  });

  await t.test("4. Fingerprint lockout: Device change triggers security lockout and returns 403", async () => {
    // tok_active_1 was bound in Test 1 to IP 203.0.113.195 + iPhone UA.
    // Now simulate access from a different device IP:
    const resDifferentDevice = await app.request("https://collectrr.workers.dev/api/session/tok_active_1", {
      method: "GET",
      headers: {
        "CF-Connecting-IP": "198.51.100.44",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    }, env);

    assert.equal(resDifferentDevice.status, 403);
    const body = await resDifferentDevice.json();
    assert.ok(body.error);
  });

  await t.test("5. Sticky locked token persistence: Subsequent request from original device remains denied (403)", async () => {
    // The token status was locked in Test 4. Even when the original device returns, access must remain denied.
    const resOriginalDevice = await app.request("https://collectrr.workers.dev/api/session/tok_active_1", {
      method: "GET",
      headers: {
        "CF-Connecting-IP": "203.0.113.195",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)"
      }
    }, env);

    assert.equal(resOriginalDevice.status, 403);
    const body = await resOriginalDevice.json();
    assert.ok(body.error);
  });

  await t.test("6. Cross-case document upload authorization: Requesting upload URL for another case's document returns 400", async () => {
    // Fresh active token for case_101
    mockDb.prepare = createMagicLinkMockDb({
      tokens: [
        { token: "tok_active_fresh", case_id: "case_101", status: "active", expires_at: futureExpiry }
      ],
      cases: [
        { id: "case_101", contact_person: "Priya Sharma" }
      ],
      reqDocs: [
        { id: "doc_pan_101", case_id: "case_101", document_type: "pan", label: "PAN Card" },
        { id: "doc_salary_202", case_id: "case_202", document_type: "salary_slip", label: "Salary Slip" }
      ]
    }).prepare;

    const res = await app.request("https://collectrr.workers.dev/api/upload-url/tok_active_fresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requiredDocId: "doc_salary_202", // belongs to case_202, NOT case_101!
        contentType: "application/pdf",
        fileLabel: "SalarySlip.pdf"
      })
    }, env);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("Document requirement not found for this case"));
  });
});
