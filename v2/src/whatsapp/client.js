/**
 * Meta WhatsApp Cloud API Client
 * Collectrr v2 - WhatsApp Messaging Module
 *
 * Dedicated strictly to low-level communication with Meta Graph API.
 * Contains ZERO application or case data logic.
 */

function resolvePhoneIds(env) {
  const phoneIds = [];
  if (env?.WHATSAPP_PROD_PHONE_ID && env.WHATSAPP_PROD_PHONE_ID.trim()) {
    phoneIds.push(env.WHATSAPP_PROD_PHONE_ID.trim());
  }
  if (env?.WHATSAPP_PHONE_ID && !phoneIds.includes(env.WHATSAPP_PHONE_ID.trim())) {
    phoneIds.push(env.WHATSAPP_PHONE_ID.trim());
  }
  if (phoneIds.length === 0) {
    phoneIds.push("1073272059211357");
  }
  return phoneIds;
}

/**
 * Dispatch an approved Meta template message.
 * Iterates through available phone IDs, languages, and payloads until successful.
 */
export async function sendWhatsAppTemplate({
  phone,
  templateConfig,
  templateParams = {},
  env,
}) {
  const primaryLang = templateConfig.defaultLang || "en";
  const langCodesToTry = [primaryLang];
  const phoneIdsToTry = resolvePhoneIds(env);

  let lastErrorData = null;
  const attemptedErrors = [];

  for (const phoneId of phoneIdsToTry) {
    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    for (const langCode of langCodesToTry) {
      const payloads = templateConfig.getPayloads({
        phone,
        ...templateParams,
        langCode,
      });

      for (const payload of payloads) {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) return data;

        lastErrorData = data;
        attemptedErrors.push(
          `[${phoneId}/${langCode}/${payload.template?.name}]: ${
            data?.error?.message || res.statusText
          }`
        );
      }
    }
  }

  const details =
    lastErrorData?.error?.error_data?.details ||
    lastErrorData?.error?.message ||
    "";
  throw new Error(
    `${details || "Failed to send WhatsApp template message"} (Attempts: ${attemptedErrors.join(" | ")})`
  );
}

/**
 * Dispatch a free-form WhatsApp text message during the 24h customer window.
 */
export async function sendWhatsAppText(phone, messageText, env) {
  const phoneIdsToTry = resolvePhoneIds(env);

  let lastErrorData = null;
  const attemptedErrors = [];

  for (const phoneId of phoneIdsToTry) {
    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: messageText },
      }),
    });

    const data = await res.json();
    if (res.ok) return data;

    lastErrorData = data;
    attemptedErrors.push(`[${phoneId}]: ${data?.error?.message || res.statusText}`);
  }

  const details =
    lastErrorData?.error?.error_data?.details ||
    lastErrorData?.error?.message ||
    "";
  throw new Error(
    `${details || "Failed to send WhatsApp text message"} (Attempts: ${attemptedErrors.join(" | ")})`
  );
}
