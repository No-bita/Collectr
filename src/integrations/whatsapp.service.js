import fetch from "node-fetch";
import { config } from "../config/env.js";
import { digitsOnly } from "../modules/shared/phone.js";

export async function sendMessage(to, text) {
  const toDigits = digitsOnly(to);
  const res = await fetch(
    `https://graph.facebook.com/${config.WHATSAPP_GRAPH_VERSION}/${config.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toDigits,
        type: "text",
        text: { body: text },
      }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("WhatsApp sendMessage failed:", res.status, JSON.stringify(data));
    return false;
  }
  return true;
}

export async function sendTemplateMessage(to, templateName, languageCode, components) {
  const template = { name: templateName, language: { code: languageCode } };
  if (components?.length) template.components = components;

  const toDigits = digitsOnly(to);
  const res = await fetch(
    `https://graph.facebook.com/${config.WHATSAPP_GRAPH_VERSION}/${config.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toDigits,
        type: "template",
        template,
      }),
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("WhatsApp template API:", res.status, { ...data, to: toDigits });
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return data;
}

function namedTextParameter(parameterName, text, maxLen = 1024) {
  return {
    type: "text",
    parameter_name: String(parameterName || "").trim(),
    text: String(text || "").slice(0, maxLen),
  };
}

function parseBodyParamCount(key, max = 3) {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return 0;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(max, n);
}

export async function sendNewLeadTemplate(phoneDigits, name, firmName, firstDocPrompt) {
  const templateName = process.env.WHATSAPP_NEW_LEAD_TEMPLATE?.trim();
  if (!templateName) {
    console.warn("WHATSAPP_NEW_LEAD_TEMPLATE not set — skipping WhatsApp for new lead");
    return false;
  }

  const lang = process.env.WHATSAPP_NEW_LEAD_TEMPLATE_LANG?.trim() || "en_US";
  const n = parseBodyParamCount("WHATSAPP_NEW_LEAD_BODY_PARAM_COUNT");
  let components = null;
  if (n > 0) {
    const parameters = [];
    if (n >= 1) parameters.push(namedTextParameter("name", (name && String(name).trim()) || "there", 128));
    if (n >= 2) parameters.push(namedTextParameter("firm_name", firmName || "our team", 128));
    if (n >= 3) parameters.push(namedTextParameter("doc", firstDocPrompt || "document", 1024));
    components = [{ type: "body", parameters }];
  }

  try {
    await sendTemplateMessage(phoneDigits, templateName, lang, components);
    return true;
  } catch (err) {
    console.error("New-lead WhatsApp template failed:", err.message || err);
    return false;
  }
}

export async function sendFollowUpTemplate(phoneDigits, name, docLabel, firmName) {
  const templateName = process.env.WHATSAPP_FOLLOW_UP_TEMPLATE?.trim();
  if (!templateName) return false;

  const lang = process.env.WHATSAPP_FOLLOW_UP_TEMPLATE_LANG?.trim() || "en_US";
  const n = parseBodyParamCount("WHATSAPP_FOLLOW_UP_BODY_PARAM_COUNT");
  let components = null;
  if (n > 0) {
    const parameters = [];
    if (n >= 1) {
      parameters.push(namedTextParameter("name", (name && String(name).trim().split(/\s+/)[0]) || "there", 128));
    }
    if (n >= 2) parameters.push(namedTextParameter("doc", docLabel || "document", 256));
    if (n >= 3) parameters.push(namedTextParameter("firm_name", firmName || "our team", 128));
    components = [{ type: "body", parameters }];
  }

  try {
    await sendTemplateMessage(phoneDigits, templateName, lang, components);
    return true;
  } catch (e) {
    console.error("Follow-up WhatsApp template failed:", e.message || e);
    return false;
  }
}
