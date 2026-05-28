import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getDbClient } from "../db/client.js";

export async function handleUploadUrlRequest(c) {
  const token = c.req.param("token");
  const { documentId, contentType } = await c.req.json();

  if (!token || !documentId || !contentType) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // 1. Validate Token in Database
  const db = getDbClient(c.env);
  const tokenRes = await db.execute({
    sql: "SELECT lead_id, status FROM secure_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
    args: [token],
  });

  if (tokenRes.rows.length === 0) {
    return c.json({ error: "Invalid or expired token" }, 403);
  }

  const { lead_id, status } = tokenRes.rows[0];
  if (status !== "active") {
    return c.json({ error: "Token is locked or already used" }, 403);
  }

  // 2. Validate Document Type exists for this lead
  const docRes = await db.execute({
    sql: "SELECT id, status, document_type FROM document_requests WHERE lead_id = ? AND id = ?",
    args: [lead_id, documentId],
  });

  if (docRes.rows.length === 0) {
    return c.json({ error: "Document type not requested for this lead" }, 400);
  }

  const doc = docRes.rows[0];
  if (doc.status === "received") {
    return c.json({ error: "Document already uploaded" }, 400);
  }

  // 3. Generate Presigned URL for Cloudflare R2
  // Note: R2 expects S3-compatible endpoints
  const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${c.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: c.env.R2_AK_id,
      secretAccessKey: c.env.R2_SAK,
    },
  });

  // Fetch client name for naming convention
  const leadRes = await db.execute({
    sql: "SELECT name FROM leads WHERE id = ?",
    args: [lead_id]
  });
  const clientNameRaw = leadRes.rows.length > 0 && leadRes.rows[0].name ? leadRes.rows[0].name : "Client";
  const clientName = clientNameRaw.replace(/[^a-zA-Z0-9]/g, "_");

  // Unique object key following convention: <client_name>_<document_name>
  const fileKey = `${lead_id}/${clientName}_${doc.document_type}`;

  const command = new PutObjectCommand({
    Bucket: "lekho-documents",
    Key: fileKey,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(S3, command, { expiresIn: 300 }); // 5 minutes
    
    // Save the pending S3 key to the database so we know where to find it later
    await db.execute({
      sql: "UPDATE document_requests SET s3_key = ? WHERE id = ?",
      args: [fileKey, doc.id],
    });

    return c.json({ uploadUrl, fileKey });
  } catch (err) {
    console.error("Failed to generate presigned URL", err);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
}
