import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleSessionRequest } from "./api/session.js";
import { handleUploadUrlRequest } from "./api/upload.js";
import { handleWebhookVerify, handleWebhookEvent } from "./api/webhook.js";
import { handleUploadComplete } from "./api/ocr.js";
import { handleCreateLead, handleGetLeads, handleFollowUp, handleDocumentCatalog, handleDeleteLead, handleRejectDocument, handleEditLead } from "./api/leads.js";
import { basicAuth } from "hono/basic-auth";
import { handleGetAdminDashboard, handleGetAdminFailures, handleDeleteAdminFailure, handleClearAllFailures } from "./api/admin.js";

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
  const key = c.req.path.substring("/api/documents/".length);
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

// Admin Observability & Failures Dashboard (Route Blocked with Basic Auth)
app.use("/dd", async (c, next) => {
  const auth = basicAuth({
    username: c.env.ADMIN_USERNAME || "admin",
    password: c.env.ADMIN_PASSWORD || "admin123",
  });
  return auth(c, next);
});

app.use("/api/admin*", async (c, next) => {
  const auth = basicAuth({
    username: c.env.ADMIN_USERNAME || "admin",
    password: c.env.ADMIN_PASSWORD || "admin123",
  });
  return auth(c, next);
});

app.get("/dd", handleGetAdminDashboard);
app.get("/api/admin/failures", handleGetAdminFailures);
app.delete("/api/admin/failures", handleClearAllFailures);
app.delete("/api/admin/failures/:id", handleDeleteAdminFailure);
app.get("/api/admin/debug-template", async (c) => {
  const token = c.env.WHATSAPP_ACCESS_TOKEN;
  try {
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,accounts&access_token=${token}`);
    const meData = await meRes.json();
    return c.json({ meData });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
