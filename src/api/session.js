import { getDbClient } from "../db/client.js";

export async function handleSessionRequest(c) {
  const token = c.req.param("token");

  if (!token) {
    return c.json({ error: "Missing token" }, 400);
  }

  const db = getDbClient(c.env);
  
  // Fetch token and lead info
  const tokenRes = await db.execute({
    sql: `SELECT s.status, s.expires_at, l.id as lead_id, l.phone_number 
          FROM secure_tokens s
          JOIN leads l ON s.lead_id = l.id
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
  
  // Simple hash for fingerprint
  const currentFingerprint = btoa(ip + ua).slice(0, 32);

  if (!session.fingerprint_hash) {
    // First time clicking link, lock it to this device
    await db.execute({
      sql: "UPDATE secure_tokens SET fingerprint_hash = ? WHERE token = ?",
      args: [currentFingerprint, token]
    });
  } else if (session.fingerprint_hash !== currentFingerprint) {
    // Device changed, lock token
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

  // Fetch requested documents
  const docsRes = await db.execute({
    sql: `SELECT id, document_type, status 
          FROM document_requests 
          WHERE lead_id = ?`,
    args: [session.lead_id],
  });

  const documents = docsRes.rows.map(r => ({
    id: r.id,
    type: r.document_type,
    status: r.status, // pending, received, failed
  }));

  // IMPORTANT: We only return the masked phone number and document statuses
  // We NEVER return file URLs or sensitive data to enforce Write-Only architecture
  return c.json({
    status: "active",
    phoneMasked: session.phone_number.slice(0, 3) + "****" + session.phone_number.slice(-4),
    documents
  });
}
