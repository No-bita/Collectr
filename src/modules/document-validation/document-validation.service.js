import {
  DECISIONS,
  DECISION_POLICY_VERSION,
  DOC_TYPES,
  POLICY,
  REASON_CODES,
} from "./document-validation.policy.js";
import { buildPreprocessingSummary, normalizeInputPayload } from "./document-validation.preprocess.js";
import { buildOcrExtraction } from "./document-validation.ocr.js";
import { classifyDocumentType, extractFields } from "./document-validation.signals.js";
import { enqueueManualReview, listReviewAudit, listReviews, resolveReview } from "./document-validation.review.js";
import { getValidationMetrics, recordValidationMetric } from "./document-validation.metrics.js";

function isSupportedExpectedType(type) {
  return type === DOC_TYPES.AADHAAR || type === DOC_TYPES.PAN;
}

function requiredSignalsMissing(expectedType, matchedSignals) {
  const required = POLICY.requiredSignals[expectedType] || [];
  return required.filter((signal) => !matchedSignals.includes(signal));
}

function buildDecision({
  expectedType,
  classifier,
  fields,
  ocr,
  preprocessing,
}) {
  const reasonCodes = [];
  const evidence = {
    expectedType,
    predictedType: classifier.predictedType,
    classifierConfidence: Number(classifier.confidence.toFixed(4)),
    matchedSignals: classifier.matchedSignals,
    candidateScores: classifier.candidates,
    fields,
    ocr: {
      hasText: ocr.hasText,
      avgConfidence: ocr.avgConfidence,
      pageCount: ocr.pages.length || preprocessing.pageCount,
      lineCount: ocr.allLines.length,
      linesSample: ocr.allLines.slice(0, 25),
    },
    preprocessing,
  };

  if (!isSupportedExpectedType(expectedType)) {
    reasonCodes.push(REASON_CODES.EXPECTED_TYPE_MISSING);
    return {
      decision: DECISIONS.FAIL,
      reasonCodes,
      evidence,
    };
  }

  if (!ocr.hasText) {
    reasonCodes.push(REASON_CODES.OCR_TEXT_MISSING);
    return {
      decision: DECISIONS.MANUAL_REVIEW,
      reasonCodes,
      evidence,
    };
  }

  if (preprocessing.hasLowQualityPages) {
    reasonCodes.push(REASON_CODES.LOW_CLASSIFICATION_CONFIDENCE);
    return {
      decision: DECISIONS.MANUAL_REVIEW,
      reasonCodes,
      evidence,
    };
  }

  const missingSignals = requiredSignalsMissing(expectedType, classifier.matchedSignals);
  const predictedMismatch = classifier.predictedType !== expectedType;
  const mismatchHardFail =
    predictedMismatch && classifier.confidence >= POLICY.classification.passThreshold + POLICY.classification.mismatchFailDelta;

  if (predictedMismatch && mismatchHardFail) {
    reasonCodes.push(REASON_CODES.TYPE_MISMATCH);
    return {
      decision: DECISIONS.FAIL,
      reasonCodes,
      evidence,
    };
  }

  if (expectedType === DOC_TYPES.AADHAAR && !fields.aadhaarNumber && classifier.predictedType === DOC_TYPES.AADHAAR) {
    reasonCodes.push(REASON_CODES.INVALID_ID_FORMAT);
  }
  if (expectedType === DOC_TYPES.PAN && !fields.panNumber && classifier.predictedType === DOC_TYPES.PAN) {
    reasonCodes.push(REASON_CODES.INVALID_ID_FORMAT);
  }

  if (missingSignals.length) {
    reasonCodes.push(REASON_CODES.REQUIRED_SIGNAL_MISSING);
  }

  if (classifier.confidence < POLICY.classification.failThreshold) {
    reasonCodes.push(REASON_CODES.LOW_CLASSIFICATION_CONFIDENCE);
    return {
      decision: DECISIONS.MANUAL_REVIEW,
      reasonCodes,
      evidence,
    };
  }

  if (
    !predictedMismatch &&
    classifier.confidence >= POLICY.classification.passThreshold &&
    missingSignals.length === 0 &&
    !reasonCodes.includes(REASON_CODES.INVALID_ID_FORMAT)
  ) {
    reasonCodes.push(REASON_CODES.STRONG_MATCH);
    return {
      decision: DECISIONS.PASS,
      reasonCodes,
      evidence,
    };
  }

  reasonCodes.push(REASON_CODES.BORDERLINE_MATCH);
  return {
    decision: DECISIONS.MANUAL_REVIEW,
    reasonCodes,
    evidence,
  };
}

export function validateDocumentPayload(body) {
  const startedAt = Date.now();
  const normalized = normalizeInputPayload(body);
  const preprocessing = buildPreprocessingSummary(normalized);
  const ocr = buildOcrExtraction(normalized);
  const classifier = classifyDocumentType(ocr.fullText);
  const fields = extractFields(ocr.fullText, ocr.allLines, normalized.expectedDocumentType);

  const result = buildDecision({
    expectedType: normalized.expectedDocumentType,
    classifier,
    fields,
    ocr,
    preprocessing,
  });

  const latencyMs = Date.now() - startedAt;
  const response = {
    requestId: normalized.requestId || `doc_${Date.now()}`,
    policyVersion: DECISION_POLICY_VERSION,
    decision: result.decision,
    reasonCodes: result.reasonCodes,
    evidence: result.evidence,
    file: normalized.file,
    createdAt: new Date().toISOString(),
    latencyMs,
  };

  if (response.decision === DECISIONS.MANUAL_REVIEW) {
    const review = enqueueManualReview(response);
    response.review = {
      reviewId: review.reviewId,
      status: review.status,
      createdAt: review.createdAt,
    };
  }

  recordValidationMetric({
    decision: response.decision,
    expectedType: normalized.expectedDocumentType || DOC_TYPES.OTHER,
    latencyMs: response.latencyMs,
    ocrConfidence: preprocessing.avgOcrConfidence,
  });

  return response;
}

export function getDecisionPolicy() {
  return {
    policyVersion: DECISION_POLICY_VERSION,
    thresholds: POLICY.classification,
    requiredSignals: POLICY.requiredSignals,
    processingLimits: POLICY.limits,
    decisionOutcomes: DECISIONS,
    reasonCodes: REASON_CODES,
  };
}

export function listManualReviews() {
  return listReviews();
}

export function reviewDecision(reviewId, body) {
  const status = String(body?.status || "").trim().toUpperCase();
  if (!["PASS", "FAIL"].includes(status)) {
    return { error: "status must be PASS or FAIL" };
  }
  const resolved = resolveReview(reviewId, {
    status,
    actor: body?.actor,
    note: body?.note,
  });
  if (!resolved) return { error: "Review item not found." };
  return { payload: resolved };
}

export function getReviewAuditTrail() {
  return listReviewAudit();
}

export function getKpiSnapshot() {
  const m = getValidationMetrics();
  const total = m.totalRequests || 0;
  const passRate = total ? Number((m.decisions.PASS / total).toFixed(4)) : 0;
  const failRate = total ? Number((m.decisions.FAIL / total).toFixed(4)) : 0;
  const reviewRate = total ? Number((m.decisions.MANUAL_REVIEW / total).toFixed(4)) : 0;

  return {
    ...m,
    gates: {
      targetTypePrecision: ">=0.95 (evaluate with labeled batch)",
      targetFalsePassRate: "<=0.05 (evaluate with labeled batch)",
      targetP90LatencyMsSmallFiles: "<=15000",
      targetManualReviewRate: "<=0.25 after threshold tuning",
    },
    rates: {
      passRate,
      failRate,
      reviewRate,
    },
  };
}
