/**
 * Central WhatsApp Template Registry & Payload Generator
 * Collectrr v2 - Centralized WhatsApp Messaging Engine
 */

export const WHATSAPP_TEMPLATES = {
  // Onboarding First Message Template (Meta ID: 1670134247444760)
  ONBOARDING_FIRST_MESSAGE: {
    id: "onboarding_first_message",
    name: "onboarding_first_message",
    defaultLang: "en",
    category: "UTILITY",
    description: "ITR client onboarding message with CA/firm name and document upload button",
    getPayloads: ({ phone, contactPerson, rawToken, uploadLink, langCode = "en", templateParams = [] }) => {
      const clientName = (templateParams && templateParams[0]) || contactPerson || "Client";
      const caName = (templateParams && templateParams[1]) || "Collectrr";
      const tokenVal = rawToken || "verify";

      return [
        // Variant A: 2 body parameters + 1 dynamic URL button parameter
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: "onboarding_first_message",
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: clientName },
                  { type: "text", text: caName }
                ]
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: tokenVal }
                ]
              }
            ]
          }
        },
        // Variant B: 2 body parameters without button parameter
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: "onboarding_first_message",
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: clientName },
                  { type: "text", text: caName }
                ]
              }
            ]
          }
        }
      ];
    }
  },

  // Loan Agent First Outreach Template (Meta ID: 3362153710629750)
  LOAN_AGENT_FIRST_OUTREACH: {
    id: "loan_agent_first_outreach",
    name: "loan_agent_first_outreach",
    defaultLang: "en",
    category: "UTILITY",
    description: "Loan application outreach with borrower name, agent name, and contact details",
    getPayloads: ({ phone, contactPerson, rawToken, uploadLink, langCode = "en", templateParams = [] }) => {
      const borrowerName = (templateParams && templateParams[0]) || contactPerson || "Borrower";
      const userName = (templateParams && templateParams[1]) || "Loan Team";
      const contactDetail = (templateParams && templateParams[2]) || userName;
      const tokenVal = rawToken || "verify";

      return [
        // Variant A: 3 body parameters + 1 dynamic URL button parameter
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: "loan_agent_first_outreach",
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: borrowerName },
                  { type: "text", text: userName },
                  { type: "text", text: contactDetail }
                ]
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: tokenVal }
                ]
              }
            ]
          }
        },
        // Variant B: 3 body parameters without button parameter
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: "loan_agent_first_outreach",
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: borrowerName },
                  { type: "text", text: userName },
                  { type: "text", text: contactDetail }
                ]
              }
            ]
          }
        }
      ];
    }
  },

  // Fixed Direct Outreach CA Template (en_IN, 0 variables)
  DO_CA: {
    id: "do_ca",
    name: "do_ca",
    defaultLang: "en_IN",
    category: "MARKETING",
    description: "Fixed Direct Outreach template for CAs in English (IND)",
    getPayloads: ({ phone, langCode = "en_IN" }) => [
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "do_ca",
          language: { code: langCode || "en_IN" }
        }
      }
    ]
  }
};

/**
 * Builds payload for a custom user-created WhatsApp template supporting all Meta components
 */
export function buildCustomTemplatePayload(tpl, { phone, contactPerson, rawToken, uploadLink, langCode, loanProduct, amountRequired, referenceId, templateParams }) {
  const lang = langCode || tpl.language || tpl.defaultLang || "en";
  const components = [];

  // Parse parameter mappings if stored as JSON or string
  let paramMappings = tpl.param_mappings || tpl.paramMappings || {};
  if (typeof paramMappings === "string") {
    try {
      paramMappings = JSON.parse(paramMappings);
    } catch (_) {
      paramMappings = {};
    }
  }

  const resolveParamValue = (mappingKey, fallbackVal = "", paramIndex = 0) => {
    if (Array.isArray(templateParams) && templateParams.length > paramIndex && templateParams[paramIndex] !== undefined && templateParams[paramIndex] !== "") {
      return String(templateParams[paramIndex]);
    }

    switch (mappingKey) {
      case "contact_person":
      case "name":
        return contactPerson || "Client";
      case "upload_link":
      case "link":
        return uploadLink || "";
      case "raw_token":
      case "token":
        return rawToken || "";
      case "phone":
        return phone || "";
      case "loan_product":
      case "category":
        return loanProduct || "Verification";
      case "amount_required":
      case "amount":
        return amountRequired ? String(amountRequired) : "";
      case "reference_id":
        return referenceId || "";
      default:
        return fallbackVal || "";
    }
  };

  // 1. Header Component (if TEXT with variables)
  if ((tpl.header_type === "TEXT" || tpl.headerType === "TEXT") && tpl.header_text) {
    const headerParams = Array.isArray(paramMappings.header) ? paramMappings.header : [];
    if (headerParams.length > 0) {
      components.push({
        type: "header",
        parameters: headerParams.map(k => ({
          type: "text",
          text: resolveParamValue(k, contactPerson || "Client")
        }))
      });
    }
  }

  // 2. Body Component Parameters
  const bodyText = tpl.body_text || tpl.bodyText || "";
  // Extract placeholders like {{1}}, {{2}} from bodyText if paramMappings.body is empty
  let bodyParamKeys = Array.isArray(paramMappings.body) ? paramMappings.body : [];
  if (bodyParamKeys.length === 0) {
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    bodyParamKeys = matches.map((_, idx) => (idx === 0 ? "contact_person" : "upload_link"));
  }

  if (bodyParamKeys.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParamKeys.map((k, idx) => ({
        type: "text",
        text: resolveParamValue(k, idx === 0 ? (contactPerson || "Client") : (uploadLink || ""))
      }))
    });
  }

  // 3. Button Component Parameters
  const btnType = String(tpl.button_type || tpl.buttonType || "none").toLowerCase();
  if (btnType === "dynamic_url" || (btnType === "url" && paramMappings.button && paramMappings.button.length > 0)) {
    const btnParams = Array.isArray(paramMappings.button) ? paramMappings.button : ["raw_token"];
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        { type: "text", text: resolveParamValue(btnParams[0], rawToken || "") }
      ]
    });
  } else if (btnType === "quick_reply" && paramMappings.button && paramMappings.button.length > 0) {
    components.push({
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [
        { type: "payload", payload: tpl.button_payload || "ACTION_PROCEED" }
      ]
    });
  }

  const primaryPayload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: tpl.name,
      language: { code: lang }
    }
  };

  if (components.length > 0) {
    primaryPayload.template.components = components;
    return [primaryPayload];
  } else {
    // Parameter-free template on Meta
    return [
      primaryPayload,
      {
        ...primaryPayload,
        template: {
          name: tpl.name,
          language: { code: lang },
          components: []
        }
      }
    ];
  }
}

/**
 * Resolve WhatsApp Template Config by Name or Custom Template List
 */
export function getWhatsAppTemplate(templateName, env, customTemplates = []) {
  const name = templateName || "onboarding_first_message";
  if (name === "loan_agent_first_outreach") {
    return WHATSAPP_TEMPLATES.LOAN_AGENT_FIRST_OUTREACH;
  }
  if (name === "onboarding_first_message") {
    return WHATSAPP_TEMPLATES.ONBOARDING_FIRST_MESSAGE;
  }
  if (name === "do_ca") {
    return WHATSAPP_TEMPLATES.DO_CA;
  }

  // Dynamic template lookup
  if (Array.isArray(customTemplates) && customTemplates.length > 0) {
    const custom = customTemplates.find(t => t.name === name || t.id === name);
    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        defaultLang: custom.language || "en",
        category: custom.category || "UTILITY",
        description: custom.body_text || custom.name,
        getPayloads: (params) => buildCustomTemplatePayload(custom, params)
      };
    }
  }

  return WHATSAPP_TEMPLATES.ONBOARDING_FIRST_MESSAGE;
}


