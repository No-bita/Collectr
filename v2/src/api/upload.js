import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getDbClient } from "../db/client.js";

export async function handleUploadUrlRequest(c) {
  const token = c.req.param("token");
  const { requiredDocId, contentType, fileLabel } = await c.req.json();

  if (!token || !requiredDocId || !contentType) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // 1. Validate Token in Database
  const db = getDbClient(c.env);
  const tokenRes = await db.execute({
    sql: "SELECT case_id, status FROM secure_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
    args: [token],
  });

  if (tokenRes.rows.length === 0) {
    return c.json({ error: "Invalid or expired token" }, 403);
  }

  const { case_id, status } = tokenRes.rows[0];
  if (status !== "active") {
    return c.json({ error: "Token is locked or already used" }, 403);
  }

  // 2. Validate Required Document exists for this case
  const docRes = await db.execute({
    sql: "SELECT id, document_type, label FROM required_documents WHERE case_id = ? AND id = ?",
    args: [case_id, requiredDocId],
  });

  if (docRes.rows.length === 0) {
    return c.json({ error: "Document requirement not found for this case" }, 400);
  }

  const reqDoc = docRes.rows[0];

  // 3. Generate Presigned URL for Cloudflare R2
  const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${c.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: c.env.R2_AK_id,
      secretAccessKey: c.env.R2_SAK,
    },
  });

  // Fetch client contact person for naming
  const caseRes = await db.execute({
    sql: "SELECT contact_person FROM loan_cases WHERE id = ?",
    args: [case_id]
  });
  const rawContact = caseRes.rows[0]?.contact_person || "client";
  const safeContact = rawContact.replace(/[^a-zA-Z0-9]/g, "_");

  // Create a new uploaded_documents entry ID
  const uploadId = crypto.randomUUID();
  const fileKey = `${case_id}/${safeContact}_${reqDoc.document_type}_${uploadId.slice(0, 8)}`;

  const command = new PutObjectCommand({
    Bucket: "lekho-documents",
    Key: fileKey,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(S3, command, { expiresIn: 300 }); // 5 minutes
    
    // Insert new uploaded_documents record
    const label = fileLabel || reqDoc.label || reqDoc.document_type;
    await db.execute({
      sql: `INSERT INTO uploaded_documents (id, case_id, required_doc_id, file_label, s3_key, content_type, ocr_status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      args: [uploadId, case_id, requiredDocId, label, fileKey, contentType],
    });

    return c.json({ uploadUrl, uploadId, fileKey });
  } catch (err) {
    console.error("Failed to generate presigned URL", err);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
}
