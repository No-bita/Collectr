import { DOC_TYPES } from "./document-validation.policy.js";

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;

const AADHAAR_KEYWORDS = [
  "aadhaar",
  "uidai",
  "unique identification authority",
  "government of india",
  "आधार",
];
const PAN_KEYWORDS = ["permanent account number", "income tax department", "govt of india", "pan card"];

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function normalizeText(text) {
  const devanagariDigits = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9",
  };
  return String(text || "")
    .replace(/[०-९]/g, (m) => devanagariDigits[m] || m)
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLineText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function cleanName(text) {
  return normalizeLineText(text).replace(/[^A-Za-z\u0900-\u097F.\s]/g, "").replace(/\s+/g, " ").trim();
}

function isLikelyNameToken(token) {
  if (!token) return false;
  const low = token.toLowerCase();
  if (/male|female|gender|dob|address|india|government|uid|aadhaar|year|birth/.test(low)) return false;
  return token.length >= 2 && token.length <= 25;
}

function nameScore(candidate, confidence) {
  const words = candidate.split(/\s+/).filter(Boolean);
  if (!words.length) return -1;
  const lettersOnly = candidate.replace(/[^A-Za-z]/g, "");
  const vowels = (lettersOnly.match(/[aeiou]/gi) || []).length;
  const vowelRatio = lettersOnly.length ? vowels / lettersOnly.length : 0;
  const titleCaseWords = words.filter((w) => /^[A-Z][a-z]+$/.test(w)).length;
  let score = confidence || 0;
  if (words.length >= 2 && words.length <= 5) score += 0.2;
  if (words.length === 1) score -= 0.2;
  if (titleCaseWords >= 2) score += 0.15;
  if (/male|female|gender|dob/i.test(candidate)) score -= 0.4;
  if (vowelRatio < 0.2) score -= 0.25;
  if (candidate.length < 4 || candidate.length > 40) score -= 0.2;
  return score;
}

function lineCenterY(line) {
  const b = Array.isArray(line?.bbox) ? line.bbox : [];
  if (!b.length || !Array.isArray(b[0])) return Number.POSITIVE_INFINITY;
  const ys = b.map((p) => (Array.isArray(p) && Number.isFinite(p[1]) ? p[1] : 0));
  return ys.reduce((a, c) => a + c, 0) / ys.length;
}

function sortLines(lines) {
  return [...lines].sort((a, b) => lineCenterY(a) - lineCenterY(b));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreAadhaar(text) {
  const hits = [];
  let score = 0;

  if (includesAny(text, AADHAAR_KEYWORDS)) {
    hits.push("aadhaar_keyword");
    score += 0.5;
  }

  if (AADHAAR_REGEX.test(text) || text.includes("uidai")) {
    hits.push("aadhaar_number_or_uidai");
    score += 0.4;
  }

  if (text.includes("dob") || text.includes("year of birth")) {
    hits.push("aadhaar_demographic_hint");
    score += 0.1;
  }

  return { type: DOC_TYPES.AADHAAR, score: Math.min(1, score), matchedSignals: hits };
}

function scorePan(text) {
  const hits = [];
  let score = 0;

  if (includesAny(text, PAN_KEYWORDS)) {
    hits.push("pan_keyword");
    score += 0.45;
  }

  if (PAN_REGEX.test(text.toUpperCase())) {
    hits.push("pan_number");
    score += 0.45;
  }

  if (text.includes("father") || text.includes("date of birth")) {
    hits.push("pan_demographic_hint");
    score += 0.1;
  }

  return { type: DOC_TYPES.PAN, score: Math.min(1, score), matchedSignals: hits };
}

export function classifyDocumentType(ocrFullText) {
  const text = normalizeText(ocrFullText);
  const aadhaar = scoreAadhaar(text);
  const pan = scorePan(text);

  const ranked = [aadhaar, pan].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const next = ranked[1];

  if (!top || top.score < 0.25) {
    return {
      predictedType: DOC_TYPES.OTHER,
      confidence: 1 - (top?.score || 0),
      matchedSignals: [],
      candidates: ranked,
    };
  }

  return {
    predictedType: top.type,
    confidence: Math.max(0, Math.min(1, top.score - (next?.score || 0) * 0.35 + 0.25)),
    matchedSignals: top.matchedSignals,
    candidates: ranked,
  };
}

function findAadhaarName(lines) {
  const ordered = sortLines(lines);
  const ignore = [
    "government of india",
    "unique identification authority",
    "uidai",
    "aadhaar",
    "आधार",
    "dob",
    "year of birth",
    "जन्म",
    "male",
    "female",
    "पुरुष",
    "महिला",
    "address",
    "पता",
  ];
  let best = { value: "", confidence: 0, score: -1 };
  for (let i = 0; i < ordered.length; i++) {
    const line = ordered[i];
    const t = normalizeLineText(line.text);
    if (!t) continue;
    const low = t.toLowerCase();
    if (low.includes("name") || t.includes("नाम")) {
      for (let j = i + 1; j < Math.min(ordered.length, i + 6); j++) {
        const candidate = cleanName(ordered[j].text);
        const clow = candidate.toLowerCase();
        if (!candidate) continue;
        if (ignore.some((w) => clow.includes(w))) continue;
        const phraseTokens = candidate.split(/\s+/).filter(isLikelyNameToken);
        if (phraseTokens.length) {
          let merged = [...phraseTokens];
          let confidenceValues = [ordered[j].confidence || 0];
          for (let k = j + 1; k < Math.min(ordered.length, j + 4); k++) {
            const nextToken = cleanName(ordered[k].text);
            if (!isLikelyNameToken(nextToken)) break;
            merged.push(nextToken);
            confidenceValues.push(ordered[k].confidence || 0);
            if (merged.length >= 4) break;
          }
          if (merged.length >= 2) {
            const mergedName = merged.join(" ").replace(/\s+/g, " ").trim();
            const mergedScore = nameScore(mergedName, average(confidenceValues));
            if (mergedScore > best.score) {
              best = {
                value: mergedName,
                confidence: average(confidenceValues),
                score: mergedScore,
              };
            }
          }
        }
        const nextCandidate = j + 1 < ordered.length ? cleanName(ordered[j + 1].text) : "";
        if (candidate.split(/\s+/).length === 1 && nextCandidate && nextCandidate.split(/\s+/).length === 1) {
          const merged = `${candidate} ${nextCandidate}`.trim();
          const mergedScore = nameScore(merged, average([ordered[j].confidence || 0, ordered[j + 1].confidence || 0]));
          if (mergedScore > best.score) {
            best = {
              value: merged,
              confidence: average([ordered[j].confidence || 0, ordered[j + 1].confidence || 0]),
              score: mergedScore,
            };
          }
        }
        if (candidate.length >= 3 && candidate.length <= 40 && candidate.split(/\s+/).length <= 5) {
          const score = nameScore(candidate, ordered[j].confidence || 0);
          if (score > best.score) best = { value: candidate, confidence: ordered[j].confidence || 0, score };
        }
      }
    }
    if (t.length < 3 || t.length > 60) continue;
    if (/\d{4}\s?\d{4}\s?\d{4}/.test(t)) continue;
    if (ignore.some((w) => low.includes(w))) continue;
    const candidate = cleanName(t);
    if (candidate.length < 3 || candidate.length > 40) continue;
    if ((/^[A-Za-z.\s]+$/.test(candidate) || /[\u0900-\u097F]/.test(candidate)) && candidate.split(/\s+/).length <= 5) {
      const score = nameScore(candidate, line.confidence || 0);
      if (score > best.score) best = { value: candidate, confidence: line.confidence || 0, score };
    }
  }
  return best.score >= 0.8 ? { value: best.value, confidence: best.confidence } : { value: "", confidence: 0 };
}

function findPanName(lines) {
  const ordered = sortLines(lines);
  let best = { value: "", confidence: 0, score: -1 };
  for (let i = 0; i < ordered.length; i++) {
    const low = normalizeLineText(ordered[i].text).toLowerCase();
    if (low.includes("name")) {
      for (let j = i + 1; j < Math.min(ordered.length, i + 4); j++) {
        const candidate = cleanName(ordered[j].text);
        if (candidate && candidate.split(/\s+/).length <= 5) {
          const score = nameScore(candidate, ordered[j].confidence || 0);
          if (score > best.score) best = { value: candidate, confidence: ordered[j].confidence || 0, score };
        }
      }
    }
  }
  return best.score >= 0.8 ? { value: best.value, confidence: best.confidence } : { value: "", confidence: 0 };
}

function findAddress(lines) {
  const ordered = sortLines(lines);
  let anchorIndex = -1;
  for (let i = 0; i < ordered.length; i++) {
    const low = normalizeLineText(ordered[i].text).toLowerCase();
    if (low.includes("address") || low.includes("add:") || low.includes("add ") || ordered[i].text.includes("पता")) {
      anchorIndex = i;
      break;
    }
  }

  if (anchorIndex === -1) {
    return { value: "", confidence: 0 };
  }
  const picked = [];
  const confs = [];
  for (let i = anchorIndex + 1; i < Math.min(ordered.length, anchorIndex + 7); i++) {
    const t = normalizeLineText(ordered[i].text);
    if (!t) continue;
    if (/^\d{4}\s?\d{4}\s?\d{4}$/.test(t)) break;
    if (/\d{9,}/.test(t.replace(/\s+/g, ""))) continue;
    if (/permanent account number/i.test(t)) break;
    if (/male|female|gender|dob|जन्म|आधार|aadhaar|uid|government|india/i.test(t)) continue;
    if (t.length < 4) continue;
    picked.push(t);
    confs.push(ordered[i].confidence || 0);
  }
  const compact = picked.join(", ").replace(/\s+/g, " ").trim();
  if (compact.length < 8) return { value: "", confidence: 0 };
  return { value: compact, confidence: average(confs) };
}

export function extractFields(ocrFullText, allLines = [], expectedType = DOC_TYPES.OTHER) {
  const text = normalizeText(ocrFullText);
  const panMatch = text.toUpperCase().match(PAN_REGEX);
  const aadhaarMatch = text.match(AADHAAR_REGEX);
  const lines = Array.isArray(allLines) ? allLines : [];
  const aadhaarName = findAadhaarName(lines);
  const panName = findPanName(lines);
  const address = findAddress(lines);

  return {
    panNumber: panMatch ? panMatch[0] : "",
    aadhaarNumber: aadhaarMatch ? aadhaarMatch[0].replace(/\s+/g, "") : "",
    name:
      expectedType === DOC_TYPES.PAN
        ? panName.value
        : expectedType === DOC_TYPES.AADHAAR
          ? aadhaarName.value
          : panName.value || aadhaarName.value,
    address: address.value,
    fieldConfidence: {
      panNumber: panMatch ? 1 : 0,
      aadhaarNumber: aadhaarMatch ? 1 : 0,
      name:
        expectedType === DOC_TYPES.PAN
          ? panName.confidence
          : expectedType === DOC_TYPES.AADHAAR
            ? aadhaarName.confidence
            : Math.max(panName.confidence, aadhaarName.confidence),
      address: address.confidence,
    },
  };
}
