function dedupeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function buildOcrExtraction(normalized) {
  const pages = normalized.pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: dedupeWhitespace(page.text),
    confidence: page.ocrConfidence,
    lowQuality: Boolean(page.lowQuality),
    qualityReason: String(page.qualityReason || ""),
    lines: Array.isArray(page.lines)
      ? page.lines
          .map((line) => ({
            text: dedupeWhitespace(line?.text),
            confidence: Number.isFinite(line?.confidence) ? line.confidence : 0,
            bbox: Array.isArray(line?.bbox) ? line.bbox : [],
          }))
          .filter((line) => line.text)
      : [],
  }));

  const fullText = dedupeWhitespace(pages.map((p) => p.text).join(" "));
  const allLines = pages.flatMap((page) => page.lines || []);
  const avgConfidence =
    pages.length > 0 ? pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length : 0;

  return {
    pages,
    allLines,
    fullText,
    avgConfidence: Number(avgConfidence.toFixed(3)),
    hasText: Boolean(fullText),
  };
}
