import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export async function handleUploadComplete(c) {
  const token = c.req.param("token");
  const { documentId } = await c.req.json();

  if (!token || !documentId) return c.json({ error: "Missing fields" }, 400);

  const db = getDbClient(c.env);
  
  // 1. Verify token
  const tokenRes = await db.execute({
    sql: "SELECT lead_id FROM secure_tokens WHERE token = ? AND status = 'active'",
    args: [token]
  });

  if (tokenRes.rows.length === 0) return c.json({ error: "Invalid token" }, 403);
  const lead_id = tokenRes.rows[0].lead_id;

  // 2. Mark document as received and update lead's last_updated timestamp
  await db.execute({
    sql: "UPDATE document_requests SET status = 'received' WHERE lead_id = ? AND id = ?",
    args: [lead_id, documentId]
  });

  // Bump the lead's last_updated so "Last Activity" reflects this upload
  await db.execute({
    sql: "UPDATE leads SET last_updated = datetime('now') WHERE id = ?",
    args: [lead_id]
  });

  const docRes = await db.execute({
    sql: "SELECT id, s3_key, document_type FROM document_requests WHERE lead_id = ? AND id = ?",
    args: [lead_id, documentId]
  });

  if (docRes.rows.length === 0 || !docRes.rows[0].s3_key) return c.json({ success: true });

  const s3Key = docRes.rows[0].s3_key;

  // 3. Trigger Gemini OCR natively from Edge (Asynchronously, if possible, or wait)
  // For Cloudflare Workers, we can use c.executionCtx.waitUntil to avoid blocking the response
  const docTypeString = docRes.rows[0].document_type;
  c.executionCtx.waitUntil(runGeminiOcr(s3Key, docTypeString, docRes.rows[0].id, c.env, db));

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

async function runGeminiOcr(s3Key, targetId, docId, env, db) {
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

    // 2. Call Gemini API
    const isBankStatement = String(targetId).startsWith("bank_statement");
    const docTypeLabel = isBankStatement ? "Bank Statement" : (String(targetId).includes("pan") ? "PAN Card" : "Aadhaar Card");
    let extraInstructions = "";
    if (isBankStatement) {
      extraInstructions = "For Bank Statements, ONLY extract 'Statement period start' and 'Statement period end'. DO NOT extract individual transactions or balance information.";
    }

    const promptText = `You are an expert document parser. The user was requested to upload a **${docTypeLabel}**. 
First, verify if the uploaded image is actually a ${docTypeLabel}. 
If it is NOT, set "anomaly" to true and provide an "anomalyReason". 
If it IS the correct document, extract the requested fields. ${extraInstructions} Ensure dates are formatted as DD/MM/YYYY.
Return a rigid JSON structure EXACTLY like this:
{
  "anomaly": boolean,
  "anomalyReason": "string (or null)",
  "fields": {
    "key": "value"
  }
}`;

    // Simple fetch to Gemini REST API since SDK might be heavy for Edge
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
        generationConfig: {
          response_mime_type: "application/json",
        }
      })
    });

    if (!geminiRes.ok) throw new Error("Gemini API error");
    const geminiData = await geminiRes.json();
    let rawText = geminiData.candidates[0].content.parts[0].text;
    
    // Strip markdown formatting if present
    rawText = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    let parsed = {};
    try { parsed = JSON.parse(rawText); } catch(e) {}
    
    const newStatus = parsed.anomaly ? 'flagged' : 'received';

    // 3. Save OCR result to database and update status if flagged
    await db.execute({
      sql: "UPDATE document_requests SET ocr_payload = ?, status = ? WHERE id = ?",
      args: [rawText, newStatus, docId]
    });

    if (parsed.anomaly) {
      // Find lead_id for this doc request
      const leadLookup = await db.execute({
        sql: "SELECT lead_id FROM document_requests WHERE id = ?",
        args: [docId]
      });
      const leadId = leadLookup.rows[0]?.lead_id || null;
      await logSystemFailure(db, "ocr_anomaly", leadId, {
        document_id: docId,
        anomaly_reason: parsed.anomalyReason,
        fields: parsed.fields
      });
    }

  } catch (err) {
    console.error("OCR execution failed on edge:", err);
    // Find lead_id for this doc request
    let leadId = null;
    try {
      const leadLookup = await db.execute({
        sql: "SELECT lead_id FROM document_requests WHERE id = ?",
        args: [docId]
      });
      leadId = leadLookup.rows[0]?.lead_id || null;
    } catch (e) {}
    
    await logSystemFailure(db, "ocr_processing", leadId, err.message || err);
    try {
      await db.execute({
        sql: "UPDATE document_requests SET status = 'failed' WHERE id = ?",
        args: [docId]
      });
    } catch (dbErr) {
      console.error("Failed to update status to failed:", dbErr);
    }
  }
}
