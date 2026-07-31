import { getDbClient } from "../db/client.js";

export async function handleSessionRequest(c) {
  const token = c.req.param("token");

  if (!token) {
    return c.json({ error: "Missing token" }, 400);
  }

  const db = getDbClient(c.env);
  
  // Fetch token and case info
  const tokenRes = await db.execute({
    sql: `SELECT s.status, s.expires_at, c.id as case_id, c.contact_person, c.loan_product, c.phone_number 
          FROM secure_tokens s
          JOIN loan_cases c ON s.case_id = c.id
          WHERE s.token = ?`,
    args: [token],
  });

  if (tokenRes.rows.length === 0) {
    return c.json({ error: "Invalid token" }, 404);
  }

  const session = tokenRes.rows[0];

  // Browser Fingerprinting Lock
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const ua = c.req.header("User-Agent") || "unknown";
  const currentFingerprint = btoa(ip + ua).slice(0, 32);

  if (!session.fingerprint_hash) {
    // Lock to first device clicked
    await db.execute({
      sql: "UPDATE secure_tokens SET fingerprint_hash = ? WHERE token = ?",
      args: [currentFingerprint, token]
    });
  } else if (session.fingerprint_hash !== currentFingerprint) {
    await db.execute({
      sql: "UPDATE secure_tokens SET status = 'locked' WHERE token = ?",
      args: [token]
    });
    return c.json({ error: "Security Lockout: Link opened from a different device or network." }, 403);
  }

  // Check expiration
  if (session.status !== "active" || new Date(session.expires_at) < new Date()) {
    return c.json({ error: "Session expired or locked", status: session.status }, 403);
  }

  // Fetch required documents and their upload counts
  const reqDocsRes = await db.execute({
    sql: `SELECT id, document_type, label, status 
          FROM required_documents 
          WHERE case_id = ?`,
    args: [session.case_id],
  });

  // Fetch uploaded documents for this case
  const uploadedRes = await db.execute({
    sql: `SELECT id, required_doc_id, file_label, ocr_status, uploaded_at 
          FROM uploaded_documents 
          WHERE case_id = ?`,
    args: [session.case_id],
  });

  const documents = reqDocsRes.rows.map(r => {
    const uploads = uploadedRes.rows.filter(u => u.required_doc_id === r.id);
    return {
      id: r.id,
      type: r.document_type,
      label: r.label || r.document_type,
      status: r.status, // pending, received, waived
      uploadCount: uploads.length
    };
  });

  return c.json({
    status: "active",
    contactPerson: session.contact_person,
    loanProduct: session.loan_product || "Working Capital",
    phoneMasked: session.phone_number ? (session.phone_number.slice(0, 3) + "****" + session.phone_number.slice(-4)) : "",
    documents
  });
}
