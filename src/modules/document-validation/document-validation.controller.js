import express from "express";
import {
  getDecisionPolicy,
  getKpiSnapshot,
  getReviewAuditTrail,
  listManualReviews,
  reviewDecision,
  validateDocumentPayload,
} from "./document-validation.service.js";
import {
  documentValidationUploadMiddleware,
  validateUploadedDocument,
} from "./document-validation.upload.js";

export const documentValidationRouter = express.Router();

documentValidationRouter.get("/document-validations/policy", (req, res) => {
  res.json(getDecisionPolicy());
});

documentValidationRouter.post("/document-validations/validate", (req, res) => {
  try {
    const out = validateDocumentPayload(req.body);
    return res.status(200).json(out);
  } catch (err) {
    console.error("document-validations.validate:", err);
    return res.status(500).json({ error: "Could not validate document." });
  }
});

documentValidationRouter.post(
  "/document-validations/validate-upload",
  documentValidationUploadMiddleware,
  async (req, res) => {
    const out = await validateUploadedDocument(req.file, req.body);
    if (out.error) return res.status(out.status).json({ error: out.error });
    return res.status(out.status).json(out.payload);
  },
);

documentValidationRouter.get("/document-validations/reviews", (req, res) => {
  res.json({ reviews: listManualReviews() });
});

documentValidationRouter.post("/document-validations/reviews/:reviewId/decision", (req, res) => {
  const out = reviewDecision(req.params.reviewId, req.body);
  if (out.error) return res.status(400).json({ error: out.error });
  return res.json(out.payload);
});

documentValidationRouter.get("/document-validations/review-audit", (req, res) => {
  res.json({ events: getReviewAuditTrail() });
});

documentValidationRouter.get("/document-validations/metrics", (req, res) => {
  res.json(getKpiSnapshot());
});
