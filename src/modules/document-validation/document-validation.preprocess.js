function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeInputPayload(body) {
  const expectedDocumentType = String(body?.expectedDocumentType || "")
    .trim()
    .toLowerCase();
  const requestId = String(body?.requestId || "").trim();
  const source = String(body?.file?.source || "api").trim().toLowerCase();
  const fileName = String(body?.file?.fileName || "").trim();
  const mimeType = String(body?.file?.mimeType || "").trim().toLowerCase();
  const pageCount = Math.max(1, parseInt(String(body?.file?.pageCount || "1"), 10) || 1);
  const sizeBytes = Math.max(0, parseInt(String(body?.file?.sizeBytes || "0"), 10) || 0);

  const pagesInput = Array.isArray(body?.pages) ? body.pages : [];
  const pages = pagesInput.map((page, idx) => ({
    pageNumber: Math.max(1, parseInt(String(page?.pageNumber || idx + 1), 10) || idx + 1),
    text: String(page?.ocr?.text || page?.text || "").trim(),
    ocrConfidence: clamp01(parseFloat(String(page?.ocr?.confidence ?? page?.confidence ?? 0.7))),
    qualityScore: clamp01(parseFloat(String(page?.qualityScore ?? 0.7))),
    preprocessing: {
      deskewApplied: Boolean(page?.preprocessing?.deskewApplied ?? true),
      denoiseApplied: Boolean(page?.preprocessing?.denoiseApplied ?? true),
      orientationCorrected: Boolean(page?.preprocessing?.orientationCorrected ?? true),
      contrastEnhanced: Boolean(page?.preprocessing?.contrastEnhanced ?? true),
    },
    lowQuality: Boolean(page?.lowQuality),
    qualityReason: String(page?.qualityReason || ""),
    lines: Array.isArray(page?.lines)
      ? page.lines.map((line) => ({
          text: String(line?.text || ""),
          confidence: clamp01(parseFloat(String(line?.confidence ?? 0))),
          bbox: Array.isArray(line?.bbox) ? line.bbox : [],
        }))
      : [],
  }));

  return {
    requestId,
    expectedDocumentType,
    file: {
      source,
      fileName,
      mimeType,
      pageCount,
      sizeBytes,
    },
    pages,
  };
}

export function buildPreprocessingSummary(normalized) {
  const pageCount = normalized.pages.length || normalized.file.pageCount || 1;
  if (!normalized.pages.length) {
    return {
      pageCount,
      normalizationApplied: true,
      avgQualityScore: 0,
      avgOcrConfidence: 0,
      processingMode:
        pageCount <= 5 && normalized.file.sizeBytes <= 8 * 1024 * 1024 ? "sync" : "async_recommended",
    };
  }

  let quality = 0;
  let confidence = 0;
  for (const page of normalized.pages) {
    quality += page.qualityScore;
    confidence += page.ocrConfidence;
  }
  const avgQualityScore = quality / normalized.pages.length;
  const avgOcrConfidence = confidence / normalized.pages.length;
  const lowQualityPageCount = normalized.pages.filter((page) => page.lowQuality).length;

  return {
    pageCount,
    normalizationApplied: true,
    avgQualityScore: Number(avgQualityScore.toFixed(3)),
    avgOcrConfidence: Number(avgOcrConfidence.toFixed(3)),
    lowQualityPageCount,
    hasLowQualityPages: lowQualityPageCount > 0,
    processingMode:
      pageCount <= 5 && normalized.file.sizeBytes <= 8 * 1024 * 1024 ? "sync" : "async_recommended",
  };
}
