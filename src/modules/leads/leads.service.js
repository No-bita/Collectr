import { COL } from "../../../sheet-layout.js";
import { config, FOLLOW_UP_IDLE_MS } from "../../config/env.js";
import { digitsOnly, normalizePhoneForStorage, samePhone } from "../shared/phone.js";
import {
  allRequiredReceived,
  buildDropOffReminderBody,
  buildEmptyDocEntry,
  collectionPromptText,
  computePendingSummary,
  getDashboardDocumentCatalog,
  hasPendingRequiredDocs,
  labelForDocId,
  lastStepForSheet,
  mergeDocumentsStateForRequiredIds,
  nextPendingCollectionDocId,
  normalizeDocumentsState,
  parseRequiredDocIdsFromRow,
  resolveRequiredDocIdsForApi,
} from "../documents/documents.service.js";
import {
  appendUserRow,
  getAllUsers,
  getUser,
  padRowToSheet,
  sheetsUserMessage,
  updateUserRow,
} from "./leads.repository.js";
import { sendFollowUpTemplate, sendMessage, sendNewLeadTemplate, sendTemplateMessage } from "../../integrations/whatsapp.service.js";

export function computeNeedsFollowUp(status, requiredIds, documentsState, lastUpdatedIso) {
  if (status === "Completed") return false;
  if (!hasPendingRequiredDocs(requiredIds, documentsState)) return false;

  const now = Date.now();
  const s = lastUpdatedIso != null ? String(lastUpdatedIso).trim() : "";
  if (!s) return true;
  const lu = new Date(s).getTime();
  if (Number.isNaN(lu)) return true;
  return now - lu >= FOLLOW_UP_IDLE_MS;
}

function setFollowUpDueColumn(workingRow) {
  const requiredIds = parseRequiredDocIdsFromRow(workingRow);
  const state = normalizeDocumentsState(requiredIds, workingRow[COL.documentsState]);
  const due = computeNeedsFollowUp(
    String(workingRow[COL.status] ?? "").trim() || "In Progress",
    requiredIds,
    state,
    workingRow[COL.lastUpdated] ?? null,
  );
  workingRow[COL.followUpDue] = due ? "Yes" : "No";
}

async function updateRowWithFollowUp(rowIndex, row) {
  const working = padRowToSheet(row);
  setFollowUpDueColumn(working);
  await updateUserRow(rowIndex, working);
}

export function normalizeUser(row) {
  const requiredDocIds = parseRequiredDocIdsFromRow(row);
  const documentsState = normalizeDocumentsState(requiredDocIds, row?.[COL.documentsState]);
  const p = documentsState.pan;
  const a = documentsState.aadhaar;
  const f = documentsState.form16;

  return {
    phone: row?.[COL.phone] || "",
    name: row?.[COL.name] || "",
    firmName: row?.[COL.firmName] || "",
    pan: p?.status === "received",
    aadhaar: a?.status === "received",
    form16: f?.status === "received",
    panStatus: p?.status || "pending",
    aadhaarStatus: a?.status || "pending",
    form16Status: f?.status || "pending",
    status: row?.[COL.status] || "In Progress",
    lastStep: row?.[COL.lastStep] || "",
    lastUpdated: row?.[COL.lastUpdated] || null,
    panLink: p?.link || "",
    aadhaarLink: a?.link || "",
    form16Link: f?.link || "",
    requiredDocIds,
    documentsState,
    pendingSummary: computePendingSummary(requiredDocIds, documentsState),
    followUpLastAt: null,
    followUpNote: "",
    dropOffReminder: buildDropOffReminderBody(requiredDocIds, documentsState),
    needsFollowUp: computeNeedsFollowUp(
      row?.[COL.status] || "In Progress",
      requiredDocIds,
      documentsState,
      row?.[COL.lastUpdated] || null,
    ),
    followUpDueInSheet: (() => {
      const v = String(row?.[COL.followUpDue] ?? "").trim();
      if (v === "Yes" || v === "No") return v;
      return "";
    })(),
  };
}

export async function listLeads() {
  const rows = await getAllUsers();
  const leads = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const u = normalizeUser(row);
    if (!String(u.phone || "").trim() && !String(u.name || "").trim()) continue;

    leads.push({ rowIndex: i, ...u });
  }

  const completed = leads.filter((l) => l.status === "Completed").length;
  const inProgress = leads.length - completed;
  const followUpDue = leads.filter((l) => l.needsFollowUp).length;

  return {
    fetchedAt: new Date().toISOString(),
    documentCatalog: getDashboardDocumentCatalog(),
    summary: {
      total: leads.length,
      inProgress,
      completed,
      followUpDue,
      followUpIdleHours: config.FOLLOW_UP_IDLE_HOURS,
      followUpInitTemplate: config.WHATSAPP_FOLLOW_UP_INIT_TEMPLATE,
    },
    leads,
  };
}

export async function createLead(body) {
  const rawPhone = body?.phone;
  const name = String(body?.name ?? "").trim();
  const firmName = String(body?.firmName ?? "").trim();
  const rawIds = body?.requiredDocIds;
  const canonical = normalizePhoneForStorage(rawPhone);

  if (!name) return { status: 400, error: "Enter the client's name." };
  if (!canonical || canonical.length < 10) {
    return { status: 400, error: "Enter a valid phone number (at least 10 digits)." };
  }

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    const c = body?.requiredDocCounts;
    const hasBankOnly =
      c && typeof c === "object" && c.bank_statement != null && String(c.bank_statement).trim() !== "" &&
      parseInt(String(c.bank_statement), 10) >= 1;
    if (!hasBankOnly) return { status: 400, error: "Select at least one document to collect." };
  }

  const requiredDocIds = resolveRequiredDocIdsForApi(body);
  if (requiredDocIds.length === 0) return { status: 400, error: "Invalid document selection." };

  try {
    const rows = await getAllUsers();
    const duplicate = rows.some(
      (row) => row[COL.phone] != null && String(row[COL.phone]).trim() !== "" && samePhone(row[COL.phone], canonical),
    );
    if (duplicate) return { status: 409, error: "A lead with this phone number already exists." };

    const initialState = {};
    for (const id of requiredDocIds) initialState[id] = buildEmptyDocEntry();
    const stepForRow = lastStepForSheet(requiredDocIds, initialState);
    const nowIso = new Date().toISOString();

    const newRow = padRowToSheet([
      name,
      canonical,
      JSON.stringify(requiredDocIds),
      JSON.stringify(initialState),
      "In Progress",
      nowIso,
      stepForRow,
      "",
      firmName,
    ]);
    setFollowUpDueColumn(newRow);
    await appendUserRow(newRow);

    const firstPrompt = buildDropOffReminderBody(requiredDocIds, initialState);
    const created = await getUser(canonical);
    const createdUser = created ? normalizeUser(created.row) : null;
    const templateFirmName = (createdUser?.firmName && String(createdUser.firmName).trim()) || "our team";
    const whatsappNewLeadSent = await sendNewLeadTemplate(canonical, name, templateFirmName, firstPrompt);

    return { status: 201, payload: { ok: true, whatsappNewLeadSent } };
  } catch (err) {
    console.error("create lead:", err?.response?.data || err);
    return { status: 500, error: sheetsUserMessage(err, "Could not add lead. Try again.") };
  }
}

export async function updateLead(rowIndex, body) {
  if (Number.isNaN(rowIndex) || rowIndex < 0) return { status: 400, error: "Invalid row." };

  const name = String(body?.name ?? "").trim();
  const firmName = String(body?.firmName ?? "").trim();
  if (!name) return { status: 400, error: "Enter the client's name." };

  const rawIds = body?.requiredDocIds;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    const c = body?.requiredDocCounts;
    const hasBankOnly =
      c && typeof c === "object" && c.bank_statement != null && String(c.bank_statement).trim() !== "" &&
      parseInt(String(c.bank_statement), 10) >= 1;
    if (!hasBankOnly) return { status: 400, error: "Select at least one document to collect." };
  }

  const requiredDocIds = resolveRequiredDocIdsForApi(body);
  if (requiredDocIds.length === 0) return { status: 400, error: "Invalid document selection." };

  const canonical = normalizePhoneForStorage(body?.phone);
  if (!canonical || canonical.length < 10) {
    return { status: 400, error: "Enter a valid phone number (at least 10 digits)." };
  }

  try {
    const rows = await getAllUsers();
    if (rowIndex >= rows.length) return { status: 404, error: "Lead not found." };

    const duplicate = rows.some((row, i) => i !== rowIndex && row[COL.phone] != null &&
      String(row[COL.phone]).trim() !== "" && samePhone(row[COL.phone], canonical));
    if (duplicate) return { status: 409, error: "A lead with this phone number already exists." };

    const workingRow = padRowToSheet([...rows[rowIndex]]);
    workingRow[COL.name] = name;
    workingRow[COL.phone] = canonical;
    workingRow[COL.firmName] = firmName;

    const state = mergeDocumentsStateForRequiredIds(requiredDocIds, workingRow[COL.documentsState]);
    const now = new Date().toISOString();
    const doneAll = allRequiredReceived(requiredDocIds, state);

    workingRow[COL.requiredDocIds] = JSON.stringify(requiredDocIds);
    workingRow[COL.documentsState] = JSON.stringify(state);
    workingRow[COL.lastUpdated] = now;
    workingRow[COL.status] = doneAll ? "Completed" : "In Progress";
    workingRow[COL.lastStep] = lastStepForSheet(requiredDocIds, state);

    await updateRowWithFollowUp(rowIndex, workingRow);
    return { status: 200, payload: { ok: true } };
  } catch (err) {
    console.error("patch lead:", err?.response?.data || err);
    return { status: 500, error: sheetsUserMessage(err, "Could not update lead. Try again.") };
  }
}

export async function sendInitFollowUpTemplate(rowIndex) {
  if (Number.isNaN(rowIndex) || rowIndex < 0) return { status: 400, error: "Invalid row." };
  try {
    const rows = await getAllUsers();
    if (rowIndex >= rows.length) return { status: 404, error: "Lead not found." };

    const u = normalizeUser(rows[rowIndex]);
    const due = computeNeedsFollowUp(u.status, u.requiredDocIds, u.documentsState, u.lastUpdated || null);
    if (!due) {
      return {
        status: 409,
        error: "Follow-up is not due yet (pending docs and idle window must apply).",
      };
    }

    const phone = digitsOnly(u.phone || "");
    if (!phone || phone.length < 10) return { status: 400, error: "Invalid phone on this row." };

    try {
      await sendTemplateMessage(
        phone,
        config.WHATSAPP_FOLLOW_UP_INIT_TEMPLATE,
        config.WHATSAPP_FOLLOW_UP_INIT_TEMPLATE_LANG,
        null,
      );
    } catch (err) {
      console.error("follow-up send-template:", err?.message || err);
      return {
        status: 502,
        error: err?.message || "Could not send WhatsApp template. Check template name and Meta app.",
      };
    }

    const workingRow = padRowToSheet([...rows[rowIndex]]);
    const now = new Date().toISOString();
    workingRow[COL.lastUpdated] = now;
    await updateRowWithFollowUp(rowIndex, workingRow);

    const u2 = normalizeUser(workingRow);
    return {
      status: 200,
      payload: {
        ok: true,
        lastUpdated: now,
        templateName: config.WHATSAPP_FOLLOW_UP_INIT_TEMPLATE,
        needsFollowUp: u2.needsFollowUp,
      },
    };
  } catch (err) {
    console.error("follow-up send-template:", err?.response?.data || err);
    return { status: 500, error: sheetsUserMessage(err, "Could not save after send. Try again.") };
  }
}

export async function logFollowUp(rowIndex, body) {
  if (Number.isNaN(rowIndex) || rowIndex < 0) return { status: 400, error: "Invalid row." };
  const note = String(body?.note ?? "").trim().slice(0, 500);
  const sendWhatsApp = Boolean(body?.sendWhatsApp);

  try {
    const rows = await getAllUsers();
    if (rowIndex >= rows.length) return { status: 404, error: "Lead not found." };

    const workingRow = padRowToSheet([...rows[rowIndex]]);
    const now = new Date().toISOString();

    await updateRowWithFollowUp(rowIndex, workingRow);

    const u = normalizeUser(workingRow);
    const phone = digitsOnly(workingRow[COL.phone] || "");
    let whatsappSent = false;
    let whatsappWarning = null;
    let reminderMessage = "";

    if (sendWhatsApp && phone.length >= 10) {
      const greet = u.name ? `Hi ${u.name.split(/\s+/)[0]},` : "Hi,";
      if (u.status === "Completed" || !hasPendingRequiredDocs(u.requiredDocIds, u.documentsState)) {
        reminderMessage = `${greet} we're reaching out from our team. If you need anything, reply here.`;
      } else {
        reminderMessage = buildDropOffReminderBody(u.requiredDocIds, u.documentsState);
      }

      whatsappSent = await sendMessage(phone, reminderMessage);
      if (!whatsappSent) {
        const nextDocId = nextPendingCollectionDocId(u.requiredDocIds, u.documentsState);
        const nextDocLabel = nextDocId ? labelForDocId(nextDocId) : "document";
        const firmName =
          (u.firmName && String(u.firmName).trim()) ||
          process.env.WHATSAPP_FOLLOW_UP_FIRM_NAME?.trim() ||
          process.env.FIRM_NAME?.trim() ||
          "our team";
        if (await sendFollowUpTemplate(phone, u.name || "", nextDocLabel, firmName)) {
          whatsappSent = true;
        } else {
          whatsappWarning =
            "Could not send session message or template. Check Meta template name (WHATSAPP_FOLLOW_UP_TEMPLATE) and 24h window.";
        }
      }
    }

    if (whatsappSent) {
      workingRow[COL.lastUpdated] = new Date().toISOString();
      await updateRowWithFollowUp(rowIndex, workingRow);
    }

    const u2 = normalizeUser(workingRow);
    return {
      status: 200,
      payload: {
        ok: true,
        followUpLastAt: now,
        followUpNote: note,
        reminderMessage,
        whatsappSent,
        whatsappWarning,
        needsFollowUp: u2.needsFollowUp,
        dropOffReminder: u2.dropOffReminder,
      },
    };
  } catch (err) {
    console.error("follow-up:", err?.response?.data || err);
    return { status: 500, error: sheetsUserMessage(err, "Could not save follow-up. Try again.") };
  }
}

export function getLeadDocumentCatalogResponse() {
  return { documentCatalog: getDashboardDocumentCatalog() };
}

export { getUser, getAllUsers, padRowToSheet, updateRowWithFollowUp, collectionPromptText };
