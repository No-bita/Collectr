import { POLICY, REASON_CODES } from "./document-validation.policy.js";

const reviewQueue = [];
const reviewAudit = [];

function nextReviewId() {
  return `rvw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function trimAudit() {
  if (reviewAudit.length > POLICY.review.maxAuditEvents) {
    reviewAudit.splice(0, reviewAudit.length - POLICY.review.maxAuditEvents);
  }
}

export function enqueueManualReview(payload) {
  if (reviewQueue.length >= POLICY.review.maxQueueSize) {
    reviewQueue.shift();
  }

  const item = {
    reviewId: nextReviewId(),
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payload,
  };
  reviewQueue.push(item);
  reviewAudit.push({
    type: "REVIEW_ENQUEUED",
    at: item.createdAt,
    reviewId: item.reviewId,
    reasonCodes: payload?.reasonCodes || [],
  });
  trimAudit();
  return item;
}

export function listReviews() {
  return reviewQueue.map((item) => ({ ...item }));
}

export function resolveReview(reviewId, action) {
  const item = reviewQueue.find((candidate) => candidate.reviewId === reviewId);
  if (!item) return null;

  const now = new Date().toISOString();
  item.status = action.status;
  item.updatedAt = now;
  item.resolution = {
    status: action.status,
    actor: String(action.actor || "reviewer").trim() || "reviewer",
    note: String(action.note || "").trim().slice(0, 500),
    at: now,
  };

  reviewAudit.push({
    type: "REVIEW_RESOLVED",
    at: now,
    reviewId: item.reviewId,
    resolution: item.resolution.status,
    reasonCode: REASON_CODES.REVIEW_OVERRIDE,
  });
  trimAudit();
  return { ...item };
}

export function listReviewAudit() {
  return reviewAudit.map((event) => ({ ...event }));
}
