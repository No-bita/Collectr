import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleSessionRequest } from "./api/session.js";
import { handleUploadUrlRequest } from "./api/upload.js";
import { handleWebhookVerify, handleWebhookEvent } from "./api/webhook.js";
import { handleUploadComplete } from "./api/ocr.js";
import { handleCreateLead, handleGetLeads, handleFollowUp, handleDocumentCatalog, handleDeleteLead, handleRejectDocument, handleEditLead } from "./api/leads.js";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => c.text("Lekho Edge API Running"));
app.get("/api/session/:token", handleSessionRequest);
app.post("/api/upload-url/:token", handleUploadUrlRequest);
app.post("/api/upload-complete/:token", handleUploadComplete);

// Edge endpoints for the CA Dashboard
app.get("/api/leads", handleGetLeads);
app.post("/api/leads", handleCreateLead);
app.patch("/api/leads/:id", handleEditLead);
app.delete("/api/leads/:id", handleDeleteLead);
app.post("/api/leads/:id/follow-up/send-template", handleFollowUp);
app.get("/api/document-catalog", handleDocumentCatalog);
app.post("/api/reject-document", handleRejectDocument);

app.get("/api/documents/*", async (c) => {
  const key = c.req.param("*");
  try {
    const object = await c.env.DOCUMENT_BUCKET.get(key);
    if (!object) {
      return c.text("File not found", 404);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    // Explicitly set content type as fallback
    if (!headers.get("Content-Type")) {
      headers.set("Content-Type", "application/octet-stream");
    }
    return new Response(object.body, { headers });
  } catch(e) {
    console.error("Error fetching from R2:", e);
    return c.text("Internal Error", 500);
  }
});

// Webhook routes
app.get("/api/webhook", handleWebhookVerify);
app.post("/api/webhook", handleWebhookEvent);

export default app;
