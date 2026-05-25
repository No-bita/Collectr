export const DOC_TYPES = Object.freeze({
  AADHAAR: "aadhaar",
  PAN: "pan",
  OTHER: "other",
});

export const DECISIONS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

export const REASON_CODES = Object.freeze({
  EXPECTED_TYPE_MISSING: "EXPECTED_TYPE_MISSING",
  OCR_TEXT_MISSING: "OCR_TEXT_MISSING",
  TYPE_MISMATCH: "TYPE_MISMATCH",
  LOW_CLASSIFICATION_CONFIDENCE: "LOW_CLASSIFICATION_CONFIDENCE",
  REQUIRED_SIGNAL_MISSING: "REQUIRED_SIGNAL_MISSING",
  INVALID_ID_FORMAT: "INVALID_ID_FORMAT",
  STRONG_MATCH: "STRONG_MATCH",
  BORDERLINE_MATCH: "BORDERLINE_MATCH",
  REVIEW_OVERRIDE: "REVIEW_OVERRIDE",
});

export const POLICY = Object.freeze({
  classification: {
    passThreshold: 0.82,
    failThreshold: 0.45,
    mismatchFailDelta: 0.18,
  },
  requiredSignals: {
    aadhaar: ["aadhaar_keyword", "aadhaar_number_or_uidai"],
    pan: ["pan_keyword", "pan_number"],
  },
  review: {
    maxQueueSize: 5000,
    maxAuditEvents: 20000,
  },
  limits: {
    maxPagesSync: 5,
    maxFileSizeMbSync: 8,
  },
});

export const DECISION_POLICY_VERSION = "2026-04-ocr-v1";
