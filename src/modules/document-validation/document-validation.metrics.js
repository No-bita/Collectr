const metrics = {
  totalRequests: 0,
  decisions: {
    PASS: 0,
    FAIL: 0,
    MANUAL_REVIEW: 0,
  },
  byExpectedType: {},
  avgLatencyMs: 0,
  avgOcrConfidence: 0,
  updatedAt: null,
};

export function recordValidationMetric(input) {
  metrics.totalRequests += 1;
  metrics.decisions[input.decision] = (metrics.decisions[input.decision] || 0) + 1;
  metrics.byExpectedType[input.expectedType] = (metrics.byExpectedType[input.expectedType] || 0) + 1;

  const n = metrics.totalRequests;
  metrics.avgLatencyMs = Number(((metrics.avgLatencyMs * (n - 1) + input.latencyMs) / n).toFixed(2));
  metrics.avgOcrConfidence = Number(
    ((metrics.avgOcrConfidence * (n - 1) + input.ocrConfidence) / n).toFixed(4),
  );
  metrics.updatedAt = new Date().toISOString();
}

export function getValidationMetrics() {
  return JSON.parse(JSON.stringify(metrics));
}
