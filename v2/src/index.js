import { Hono } from "hono";
import { cors } from "hono/cors";
import { verify } from "hono/jwt";

import { handleLogin, handleRegister } from "./api/auth.js";
import { handleSessionRequest } from "./api/session.js";
import { handleUploadUrlRequest } from "./api/upload.js";
import { handleWebhookVerify, handleWebhookEvent } from "./api/webhook.js";
import { handleUploadComplete } from "./api/ocr.js";
import { 
  handleCreateCase, 
  handleGetCases, 
  handleGetSingleCase,
  handleEditCase, 
  handleDeleteCase, 
  handleUpdateStatus, 
  handleFollowUp, 
  handleGetTimeline, 
  handleAddTimelineNote, 
  handleDocumentCatalog, 
  handleRejectUpload,
  handleGetLoanProducts,
  handleAddLoanProduct,
  handleGenerateReport,
  handleAgentUploadUrl,
  handleAgentUploadComplete,
  handleRetryWhatsApp
} from "./api/cases.js";

import { 
  handleGetAdminDashboard, 
  handleGetAdminFailures, 
  handleDeleteAdminFailure, 
  handleClearAllFailures,
  handleGetAdminAnalyticsData,
  handleGetAdminAnalyticsDashboard
} from "./api/admin.js";

const app = new Hono();

app.use("*", cors());

// Authentication Middleware (JWT)
const authMiddleware = async (c, next) => {
  const isDev = c.env.ENVIRONMENT === "development" || c.req.url.includes("localhost") || c.req.url.includes("127.0.0.1");
  const authHeader = c.req.header("Authorization");

  if (isDev && (!authHeader || authHeader === "Bearer dev_token" || authHeader === "dev_token")) {
    c.set("user", { user_id: "dev-user-1", username: "DevAgent", role: "admin" });
    return next();
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized access. Please log in." }, 401);
  }
  const token = authHeader.split(" ")[1];
  try {
    const secret = c.env.JWT_SECRET || "default_unsafe_secret_for_dev_only";
    const payload = await verify(token, secret, "HS256");
    c.set("user", payload);
    return next();
  } catch (err) {
    return c.json({ error: "Invalid or expired session. Please log in again." }, 401);
  }
};

// Admin Only Middleware
const adminOnlyMiddleware = async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: "Access denied. Admin role required." }, 403);
  }
  return next();
};

// Auth API Endpoints
app.post("/api/auth/login", handleLogin);
app.post("/api/auth/register", handleRegister);

// Health Check
app.get("/", (c) => c.text("Collectrr v2 API Running"));

// Public Client Upload Flow
app.get("/api/session/:token", handleSessionRequest);
app.post("/api/upload-url/:token", handleUploadUrlRequest);
app.post("/api/upload-complete/:token", handleUploadComplete);

// Public Webhook Routes
app.get("/api/webhook", handleWebhookVerify);
app.post("/api/webhook", handleWebhookEvent);

// Protected API Routes (Requires Auth Credentials)
app.use("/api/admin/*", authMiddleware, adminOnlyMiddleware);
app.use("/api/cases", authMiddleware);
app.use("/api/cases/*", authMiddleware);
app.use("/api/loan-products", authMiddleware);
app.use("/api/document-catalog", authMiddleware);
app.use("/api/reject-upload", authMiddleware);

app.get("/api/cases", handleGetCases);
app.get("/api/cases/:id", handleGetSingleCase);
app.post("/api/cases", handleCreateCase);
app.patch("/api/cases/:id", handleEditCase);
app.delete("/api/cases/:id", handleDeleteCase);
app.patch("/api/cases/:id/status", handleUpdateStatus);
app.post("/api/cases/:id/follow-up", handleFollowUp);
app.get("/api/cases/:id/timeline", handleGetTimeline);
app.post("/api/cases/:id/timeline", handleAddTimelineNote);
app.post("/api/cases/:id/agent-upload-url", handleAgentUploadUrl);
app.post("/api/cases/:id/agent-upload-complete", handleAgentUploadComplete);
app.post("/api/cases/:id/generate-report", handleGenerateReport);
app.post("/api/cases/:id/retry-whatsapp", handleRetryWhatsApp);

app.get("/api/loan-products", handleGetLoanProducts);
app.post("/api/loan-products", handleAddLoanProduct);
app.get("/api/document-catalog", handleDocumentCatalog);
app.post("/api/reject-upload", handleRejectUpload);

// Document Proxy
app.get("/api/documents/*", authMiddleware, async (c) => {
  const key = c.req.path.substring("/api/documents/".length);
  try {
    const object = await c.env.DOCUMENT_BUCKET.get(key);
    if (!object) {
      return c.text("File not found", 404);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    if (!headers.get("Content-Type")) {
      headers.set("Content-Type", "application/octet-stream");
    }
    return new Response(object.body, { headers });
  } catch(e) {
    console.error("Error fetching from R2:", e);
    return c.text("Internal Error", 500);
  }
});

// Admin Analytics & Observability
app.get("/admin/analytics", handleGetAdminAnalyticsDashboard);
app.get("/api/admin/analytics", handleGetAdminAnalyticsData);
app.get("/dd", handleGetAdminDashboard);
app.get("/api/admin/failures", handleGetAdminFailures);
app.delete("/api/admin/failures", handleClearAllFailures);
app.delete("/api/admin/failures/:id", handleDeleteAdminFailure);

export default app;
