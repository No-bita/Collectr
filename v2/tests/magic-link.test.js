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
            run: async () => ({ success: true })
          };
        },
        all: async () => ({ results: [] }),
        run: async () => ({ success: true })
      };
    }
  };
}

test("Legacy Upload Security Isolation Regression", async (t) => {
  const now = new Date();
  const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const mockDb = createMagicLinkMockDb();

  const env = {
    DB: mockDb,
    CF_ACCOUNT_ID: "mock_cf_acc",
    R2_AK_id: "mock_ak",
    R2_SAK: "mock_sak",
    DOCUMENT_BUCKET: { bucketName: "test-bucket" }
  };

  // Session projection, expiry/revocation and network changes are tested against
  // the real client_links schema in link-routes.test.js. This file retains the
  // legacy upload isolation regression until issues #6/#9 replace that endpoint.

  await t.test("Cross-case document upload authorization: Requesting upload URL for another case's document returns 400", async () => {
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
