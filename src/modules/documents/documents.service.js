import { COL } from "../../../sheet-layout.js";
import { safeParseJSON } from "../shared/json.js";
import {
  DOCUMENT_CATALOG,
  DOCUMENT_IDS,
  MAX_BANK_STATEMENT_SLOTS,
} from "./documents.types.js";

export function getDashboardDocumentCatalog() {
  const out = [];
  for (const d of DOCUMENT_CATALOG) {
    if (/^bank_statement_\d+$/.test(d.id)) {
      if (d.id === "bank_statement_1") {
        out.push({
          id: "bank_statement",
          label: "Bank statement(s)",
          allowMultiple: true,
          maxCount: MAX_BANK_STATEMENT_SLOTS,
        });
      }
      continue;
    }
    out.push({ id: d.id, label: d.label });
  }
  return out;
}

function orderRequiredIdsInCatalog(ids) {
  const set = new Set(ids);
  const ordered = [];
  for (const d of DOCUMENT_CATALOG) {
    if (set.has(d.id)) ordered.push(d.id);
  }
  return ordered;
}

export function sanitizeRequiredDocIds(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== "string" || !DOCUMENT_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function resolveRequiredDocIdsForApi(body) {
  const raw = body?.requiredDocIds;
  const ids = Array.isArray(raw) ? raw : [];
  const countsRaw = body?.requiredDocCounts;
  const hasBankCount =
    countsRaw &&
    typeof countsRaw === "object" &&
    countsRaw.bank_statement != null &&
    String(countsRaw.bank_statement).trim() !== "";

  if (hasBankCount) {
    const n = Math.min(
      MAX_BANK_STATEMENT_SLOTS,
      Math.max(1, parseInt(String(countsRaw.bank_statement), 10) || 0),
    );
    if (n < 1) {
      return orderRequiredIdsInCatalog(sanitizeRequiredDocIds(ids));
    }
    const withoutBankSlots = ids.filter((id) => typeof id === "string" && !/^bank_statement_\d+$/.test(id));
    const singles = sanitizeRequiredDocIds(withoutBankSlots);
    const slots = [];
    for (let i = 1; i <= n; i++) slots.push(`bank_statement_${i}`);
    return orderRequiredIdsInCatalog([...singles, ...slots]);
  }

  return orderRequiredIdsInCatalog(sanitizeRequiredDocIds(ids));
}

export function parseRequiredDocIdsFromRow(row) {
  const parsed = safeParseJSON(row?.[COL.requiredDocIds], null);
  if (!Array.isArray(parsed)) return [];
  const migrated = parsed.map((id) => (id === "bank_statement" ? "bank_statement_1" : id));
  return orderRequiredIdsInCatalog(sanitizeRequiredDocIds(migrated));
}

export function buildEmptyDocEntry() {
  return { status: "pending", link: "", updatedAt: "", error: "" };
}

export function normalizeDocumentsState(requiredIds, rawStateCell) {
  const rawObj = safeParseJSON(rawStateCell, {});
  const state = {};

  for (const id of requiredIds) {
    let cur = rawObj && typeof rawObj[id] === "object" ? { ...rawObj[id] } : null;
    if (!cur || typeof cur.status !== "string") {
      cur = buildEmptyDocEntry();
    }
    if (!["pending", "received", "failed"].includes(cur.status)) cur.status = "pending";
    if (typeof cur.link !== "string") cur.link = "";
    if (cur.updatedAt == null || cur.updatedAt === "") {
      cur.updatedAt = "";
    } else if (typeof cur.updatedAt !== "string") {
      cur.updatedAt = String(cur.updatedAt);
    }
    if (cur.error == null || cur.error === "") {
      cur.error = "";
    } else if (typeof cur.error !== "string") {
      cur.error = String(cur.error);
    }
    state[id] = cur;
  }
  return state;
}

export function mergeDocumentsStateForRequiredIds(requiredDocIds, rawStateCell) {
  const rawObj = safeParseJSON(rawStateCell, {});
  const merged = {};
  for (const id of requiredDocIds) {
    if (rawObj[id] && typeof rawObj[id] === "object") {
      merged[id] = { ...rawObj[id] };
    }
  }
  return normalizeDocumentsState(requiredDocIds, merged);
}

export function labelForDocId(id) {
  const f = DOCUMENT_CATALOG.find((d) => d.id === id);
  return f ? f.label : id;
}

export function computePendingSummary(requiredIds, state) {
  const pending = [];
  const failed = [];
  for (const id of DOCUMENT_CATALOG.map((d) => d.id)) {
    if (!requiredIds.includes(id)) continue;
    const s = state[id];
    if (!s) continue;
    if (s.status === "pending") pending.push(labelForDocId(id));
    if (s.status === "failed") failed.push(labelForDocId(id));
  }
  const parts = [];
  if (pending.length) parts.push(`Pending: ${pending.join(", ")}`);
  if (failed.length) parts.push(`Failed: ${failed.join(", ")}`);
  return parts.join(" · ") || "All required documents received";
}

export function allRequiredReceived(requiredIds, state) {
  return requiredIds.every((id) => state[id]?.status === "received");
}

function catalogIdToLastStepLabel(id) {
  return String(id ?? "").toLowerCase().replace(/\s+/g, "_").toUpperCase();
}

function lastStepToDocId(lastStepStr) {
  if (!lastStepStr || typeof lastStepStr !== "string") return null;
  const t = lastStepStr.trim();
  if (!t || t.toUpperCase() === "DONE") return null;

  const req = t.match(/^REQ_(.+)$/i);
  if (req) {
    let id = String(req[1]).trim().toLowerCase().replace(/\s+/g, "_");
    if (id === "bank_statement") id = "bank_statement_1";
    return DOCUMENT_IDS.has(id) ? id : null;
  }

  const lower = t.toLowerCase();
  if (lower === "bank_statement") return "bank_statement_1";
  return DOCUMENT_IDS.has(lower) ? lower : null;
}

function firstPendingDocIdInOrder(requiredIds, state) {
  for (const d of DOCUMENT_CATALOG) {
    if (!requiredIds.includes(d.id)) continue;
    const st = state[d.id]?.status;
    if (st !== "received") return d.id;
  }
  return null;
}

export function resolveTargetDocIdForUpload(lastStepStr, requiredIds, state) {
  const fromStep = lastStepToDocId(lastStepStr);
  if (fromStep && requiredIds.includes(fromStep)) return fromStep;
  return firstPendingDocIdInOrder(requiredIds, state);
}

export function getNextBotStepAndDoc(requiredIds, state) {
  for (const d of DOCUMENT_CATALOG) {
    if (!requiredIds.includes(d.id)) continue;
    if (state[d.id]?.status === "received") continue;
    return { step: catalogIdToLastStepLabel(d.id), docId: d.id };
  }
  return { step: "DONE", docId: null };
}

export function nextPendingCollectionDocId(requiredIds, documentsState) {
  const nb = getNextBotStepAndDoc(requiredIds, documentsState);
  if (nb.docId) return nb.docId;
  return firstPendingDocIdInOrder(requiredIds, documentsState);
}

export function collectionPromptText(requiredIds, documentsState) {
  const docId = nextPendingCollectionDocId(requiredIds, documentsState);
  const label = docId ? labelForDocId(docId) : "the next required document";
  const raw = process.env.WHATSAPP_COLLECTION_PROMPT?.trim();
  if (raw) {
    return raw.replace(/\{\{DOC\}\}/g, label).replace(/\{DOC\}/g, label).slice(0, 4096);
  }
  return `Please send ${label} as a clear photo or PDF in this chat.`;
}

export function hasPendingRequiredDocs(requiredIds, documentsState) {
  if (!requiredIds?.length) return false;
  for (const id of requiredIds) {
    if (documentsState[id]?.status !== "received") return true;
  }
  return false;
}

export function buildDropOffReminderBody(requiredIds, documentsState) {
  if (!hasPendingRequiredDocs(requiredIds, documentsState)) return "";
  return collectionPromptText(requiredIds, documentsState);
}

export function lastStepForSheet(requiredIds, state) {
  if (allRequiredReceived(requiredIds, state)) return "DONE";
  const wa = getNextBotStepAndDoc(requiredIds, state);
  return wa.docId ? wa.step : "DONE";
}
