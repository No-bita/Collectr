import { COL } from "../../../sheet-layout.js";
import { resolveDriveFolderId, processMediaToDriveWithPayload, tryTwice } from "../../integrations/drive.service.js";
// import { processMediaToR2WithPayload, tryTwice as tryTwiceR2 } from "../../integrations/r2.service.js";
import { sendMessage } from "../../integrations/whatsapp.service.js";
import { runSarvamOcrOnBuffer } from "./webhook.sarvam-ocr.js";
import { runGeminiOcrOnBuffer } from "./webhook.gemini-ocr.js";
import {
  allRequiredReceived,
  collectionPromptText,
  lastStepForSheet,
  normalizeDocumentsState,
  parseRequiredDocIdsFromRow,
  resolveTargetDocIdForUpload,
} from "../documents/documents.service.js";
import { getUser, padRowToSheet, updateUserRow } from "../leads/leads.repository.js";
import { normalizeUser } from "../leads/leads.service.js";

export async function handleWebhookVerification(mode, token, challenge, verifyToken) {
  if (mode === "subscribe" && token === verifyToken) {
    console.log("Webhook verified");
    return { status: 200, body: challenge };
  }
  return { status: 403, body: "Forbidden" };
}

export async function handleIncomingWebhook(body) {
  try {
    const value = body.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages?.length) {
      return { status: 200 };
    }

    const message = value.messages[0];
    const from = message.from;
    if (!from) {
      console.warn("Webhook: missing message.from", JSON.stringify(message).slice(0, 300));
      return { status: 200 };
    }

    let userData = await getUser(from);
    if (!userData) {
      console.error("Webhook: unknown sender (not in sheet), skipping:", from);
      return { status: 200 };
    }

    const { index } = userData;
    let user = normalizeUser(userData.row);

    if (user.status === "Completed") {
      await sendMessage(
        from,
        "You're all set — we already have your documents. If you need anything, reply here and we'll help.",
      );
      return { status: 200 };
    }

    if (message.type === "document" || message.type === "image") {
      const mediaId = message.document?.id || message.image?.id;
      if (!mediaId) {
        await sendMessage(from, "We could not read that file. Please try again.");
        return { status: 200 };
      }

      const workingRow = padRowToSheet([...userData.row]);
      const requiredIds = parseRequiredDocIdsFromRow(workingRow);
      const state = normalizeDocumentsState(requiredIds, workingRow[COL.documentsState]);

      if (requiredIds.length === 0) {
        await sendMessage(from, "No document checklist is set for this number. Please contact support.");
        return { status: 200 };
      }

      const targetId = resolveTargetDocIdForUpload(workingRow[COL.lastStep] || "", requiredIds, state);
      if (!targetId) {
        await sendMessage(from, collectionPromptText(requiredIds, state));
        return { status: 200 };
      }

      if (state[targetId].status === "received") {
        await sendMessage(from, "We already have this document — no need to send it again.");
        return { status: 200 };
      }

      if (!resolveDriveFolderId()) {
        console.error("GOOGLE_DRIVE_FOLDER_ID missing or invalid — set it in .env");
        await sendMessage(from, "File storage is not configured. Please contact support.");
        return { status: 200 };
      }

      const drivePayload = await tryTwice(() => processMediaToDriveWithPayload(mediaId, from, targetId, message, user.name));
      const now = new Date().toISOString();

      if (!drivePayload?.driveLink) {
        state[targetId] = {
          status: "failed",
          link: "",
          updatedAt: now,
          error: "Drive upload failed after retries",
        };
        workingRow[COL.documentsState] = JSON.stringify(state);
        workingRow[COL.lastUpdated] = now;
        workingRow[COL.status] = allRequiredReceived(requiredIds, state) ? "Completed" : "In Progress";
        workingRow[COL.lastStep] = lastStepForSheet(requiredIds, state);
        await updateUserRow(index, workingRow);
        await sendMessage(from, "We couldn't save your file. Please try sending it again.");
        return { status: 200 };
      }

      /*
      // --- CLOUDFLARE R2 UPLOAD LOGIC (Commented as requested) ---
      // To use R2 instead of Google Drive:
      // 1. Uncomment the import at the top of this file: import { processMediaToR2WithPayload, tryTwice as tryTwiceR2 } from "../../integrations/r2.service.js";
      // 2. Remove/comment the Google Drive block above and uncomment this block.

      if (!process.env.CF_ACCOUNT_ID) {
        console.error("CF_ACCOUNT_ID missing or invalid — set it in .env");
        await sendMessage(from, "File storage is not configured. Please contact support.");
        return { status: 200 };
      }

      const drivePayload = await tryTwiceR2(() => processMediaToR2WithPayload(mediaId, from, targetId, message, user.name));
      const now = new Date().toISOString();

      if (!drivePayload?.driveLink) {
        state[targetId] = {
          status: "failed",
          link: "",
          updatedAt: now,
          error: "R2 upload failed after retries",
        };
        workingRow[COL.documentsState] = JSON.stringify(state);
        workingRow[COL.lastUpdated] = now;
        workingRow[COL.status] = allRequiredReceived(requiredIds, state) ? "Completed" : "In Progress";
        workingRow[COL.lastStep] = lastStepForSheet(requiredIds, state);
        await updateUserRow(index, workingRow);
        await sendMessage(from, "We couldn't save your file. Please try sending it again.");
        return { status: 200 };
      }
      */

      let ocr = null;
      try {
        const ocrConfig = process.env.OCR_DOCUMENTS?.trim() || "pan,aadhaar";
        const ocrEnabledDocs = ocrConfig.split(",").map(d => d.trim()).filter(Boolean);
        
        if (ocrEnabledDocs.includes(targetId)) {
          if (process.env.GEMINI_OCR_ENABLED?.trim() === "true") {
            ocr = await runGeminiOcrOnBuffer({
              buffer: drivePayload.buffer,
              mimeType: drivePayload.mimeType,
              targetId,
            });
          } else if (process.env.SARVAM_OCR_ENABLED?.trim() === "true") {
            ocr = await runSarvamOcrOnBuffer({
              buffer: drivePayload.buffer,
              mimeType: drivePayload.mimeType,
            });
          }
        }
      } catch (err) {
        console.error("Webhook OCR failed:", err?.message || err);
      }

      state[targetId] = {
        status: "received",
        link: drivePayload.driveLink,
        updatedAt: now,
        error: "",
        ...(ocr ? { ocr } : {}),
      };
      workingRow[COL.documentsState] = JSON.stringify(state);
      workingRow[COL.lastUpdated] = now;
      const doneAll = allRequiredReceived(requiredIds, state);
      workingRow[COL.status] = doneAll ? "Completed" : "In Progress";
      workingRow[COL.lastStep] = lastStepForSheet(requiredIds, state);
      await updateUserRow(index, workingRow);

      if (doneAll) {
        await sendMessage(from, "All documents received ✅");
      } else {
        await sendMessage(from, collectionPromptText(requiredIds, state));
      }
      return { status: 200 };
    }

    userData = await getUser(from);
    user = normalizeUser(userData.row);
    if (user.status === "Completed") {
      await sendMessage(from, "You're all set — we already have your documents. If you need anything, reply here.");
      return { status: 200 };
    }

    const outRow = padRowToSheet([...userData.row]);
    const requiredIds = parseRequiredDocIdsFromRow(outRow);
    const state = normalizeDocumentsState(requiredIds, outRow[COL.documentsState]);
    const doneAll = allRequiredReceived(requiredIds, state);

    outRow[COL.lastStep] = lastStepForSheet(requiredIds, state);
    outRow[COL.status] = doneAll ? "Completed" : "In Progress";
    outRow[COL.lastUpdated] = new Date().toISOString();
    outRow[COL.documentsState] = JSON.stringify(state);
    await updateUserRow(userData.index, outRow);

    if (doneAll) {
      await sendMessage(from, "All documents received ✅");
    } else {
      await sendMessage(from, collectionPromptText(requiredIds, state));
    }

    return { status: 200 };
  } catch (err) {
    console.error("Webhook error:", err);
    return { status: 200 };
  }
}
