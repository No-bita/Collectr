import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export async function handleUploadComplete(c) {
  const token = c.req.param("token");
  const { uploadId } = await c.req.json();

  if (!token || !uploadId) return c.json({ error: "Missing fields" }, 400);

  const db = getDbClient(c.env);
  
  // 1. Verify token
  const tokenRes = await db.execute({
    sql: "SELECT case_id FROM secure_tokens WHERE token = ? AND status = 'active'",
    args: [token]
  });

  if (tokenRes.rows.length === 0) return c.json({ error: "Invalid token" }, 403);
  const case_id = tokenRes.rows[0].case_id;

  // 2. Fetch upload record
  const uploadRes = await db.execute({
    sql: "SELECT id, required_doc_id, s3_key FROM uploaded_documents WHERE case_id = ? AND id = ?",
    args: [case_id, uploadId]
  });

  if (uploadRes.rows.length === 0) return c.json({ error: "Upload record not found" }, 404);
  const upload = uploadRes.rows[0];

  // Update corresponding required_documents status to 'received'
  if (upload.required_doc_id) {
    await db.execute({
      sql: "UPDATE required_documents SET status = 'received' WHERE id = ?",
      args: [upload.required_doc_id]
    });
  }

  // Update case last_updated timestamp and log timeline event
  await db.execute({
    sql: "UPDATE loan_cases SET last_updated = datetime('now') WHERE id = ?",
    args: [case_id]
  });

  await db.execute({
    sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
          VALUES (?, ?, 'document_uploaded', 'Document uploaded by client', 'system')`,
    args: [crypto.randomUUID(), case_id]
  });

  // 3. Trigger Gemini OCR asynchronously
  if (upload.s3_key) {
    c.executionCtx.waitUntil(runGeminiOcr(upload.s3_key, upload.id, case_id, c.env, db));
  }

  return c.json({ success: true });
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function runGeminiOcr(s3Key, uploadId, caseId, env, db) {
  try {
    // 1. Fetch file from R2
    const S3 = new S3Client({
      region: "auto",
      endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_AK_id,
        secretAccessKey: env.R2_SAK,
      },
    });

    const getRes = await S3.send(new GetObjectCommand({ Bucket: "lekho-documents", Key: s3Key }));
    const arrayBuffer = await getRes.Body.transformToByteArray();
    const base64Data = arrayBufferToBase64(arrayBuffer);
    const mimeType = getRes.ContentType || "image/jpeg";

    const promptText = `You are an expert MSME financial document parser. 
Extract key fields from the uploaded document. 
Identify the document type (PAN, Aadhaar, GST Return, Bank Statement, ITR, etc.).
Check for anomalies or mismatches.
Return a rigid JSON structure EXACTLY like this:
{
  "anomaly": boolean,
  "anomalyReason": "string (or null)",
  "documentType": "string",
  "fields": {
    "key": "value"
  }
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inline_data: { data: base64Data, mime_type: mimeType } },
            { text: promptText }
          ]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!geminiRes.ok) throw new Error("Gemini API error");
    const geminiData = await geminiRes.json();
    let rawText = geminiData.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    let parsed = {};
    try { parsed = JSON.parse(rawText); } catch(e) {}
    
    const ocrStatus = parsed.anomaly ? 'flagged' : 'processed';

    // Save OCR payload to uploaded_documents
    await db.execute({
      sql: "UPDATE uploaded_documents SET ocr_payload = ?, ocr_status = ? WHERE id = ?",
      args: [rawText, ocrStatus, uploadId]
    });

    if (parsed.anomaly) {
      await logSystemFailure(db, "ocr_anomaly", caseId, {
        upload_id: uploadId,
        anomaly_reason: parsed.anomalyReason,
        fields: parsed.fields
      });
    }

    // Check if ALL required_documents for this case now have status='received'
    const pendingDocsRes = await db.execute({
      sql: "SELECT id FROM required_documents WHERE case_id = ? AND status = 'pending'",
      args: [caseId]
    });

    if (pendingDocsRes.rows.length === 0) {
      // Check current case status
      const caseRes = await db.execute({
        sql: "SELECT status FROM loan_cases WHERE id = ?",
        args: [caseId]
      });

      const currentStatus = caseRes.rows[0]?.status;
      if (currentStatus === 'documents_pending') {
        // Auto-transition to 'ready_for_review'!
        await db.execute({
          sql: "UPDATE loan_cases SET status = 'ready_for_review', last_updated = datetime('now') WHERE id = ?",
          args: [caseId]
        });

        await db.execute({
          sql: `INSERT INTO case_timeline (id, case_id, event_type, content, metadata, created_by)
                VALUES (?, ?, 'status_change', 'Status auto-updated to Ready for Review (All required documents received)', ?, 'system')`,
          args: [crypto.randomUUID(), caseId, JSON.stringify({ from: 'documents_pending', to: 'ready_for_review' })]
        });
      }
    }

  } catch (err) {
    console.error("OCR execution failed:", err);
    await logSystemFailure(db, "ocr_processing", caseId, err.message || err);
    await db.execute({
      sql: "UPDATE uploaded_documents SET ocr_status = 'failed' WHERE id = ?",
      args: [uploadId]
    });
  }
}
