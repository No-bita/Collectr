/**
 * Central WhatsApp Template Registry & Payload Generator
 * Collectrr v2 - WhatsApp Messaging Module
 */

export const WHATSAPP_TEMPLATES = {
  /**
   * onboarding_first_message
   *
   * Meta template:
   * Language: English (en)
   *
   * Body variables:
   * {{name}}
   * {{caname}}
   *
   * Button:
   * Dynamic URL
   */
  ONBOARDING_FIRST_MESSAGE: {
    id: "onboarding_first_message",
    name: "onboarding_first_message",
    displayName: "ITR Onboarding (with Upload Button)",
    defaultLang: "en",
    category: "UTILITY",
    context: ["direct_outreach", "ca"],
    description:
      "ITR client onboarding message with CA/firm name and document upload button",
    parameters: [
      { key: "client_name", label: "Client Name", defaultField: "contactPerson" },
      { key: "ca_name", label: "CA / Firm Name", defaultField: "firmName" },
    ],

    getPayloads: ({
      phone,
      contactPerson,
      rawToken,
      uploadLink,
      langCode = "en",
      templateParams = [],
    }) => {
      const clientName =
        templateParams?.[0] ||
        contactPerson ||
        "Client";

      const caName =
        templateParams?.[1] ||
        "Collectrr";

      const tokenVal =
        rawToken ||
        "verify";

      return [
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",

          template: {
            name: "onboarding_first_message",

            language: {
              code: langCode || "en",
            },

            components: [
              {
                type: "body",

                parameters: [
                  {
                    type: "text",
                    parameter_name: "name",
                    text: String(clientName),
                  },
                  {
                    type: "text",
                    parameter_name: "caname",
                    text: String(caName),
                  },
                ],
              },

              {
                type: "button",
                sub_type: "url",
                index: "0",

                parameters: [
                  {
                    type: "text",
                    text: String(tokenVal),
                  },
                ],
              },
            ],
          },
        },
      ];
    },
  },

  /**
   * loan_agent_first_outreach
   *
   * Meta template:
   * Language: English (en)
   *
   * Body variables:
   * {{borrower_name}}
   * {{username}}
   * {{user_name}}
   *
   * Button:
   * Dynamic URL
   */
  LOAN_AGENT_FIRST_OUTREACH: {
    id: "loan_agent_first_outreach",
    name: "loan_agent_first_outreach",
    displayName: "Loan Agent Outreach",
    defaultLang: "en",
    category: "UTILITY",
    context: ["loan_agent"],
    description:
      "Loan application outreach with borrower name, agent name, and contact details",
    parameters: [
      { key: "borrower_name", label: "Borrower Name", defaultField: "contactPerson" },
      { key: "username", label: "Agent Name", defaultField: "userName" },
      { key: "user_name", label: "Contact Detail", defaultField: "userPhone" },
    ],

    getPayloads: ({
      phone,
      contactPerson,
      rawToken,
      uploadLink,
      langCode = "en",
      templateParams = [],
    }) => {
      const borrowerName =
        templateParams?.[0] ||
        contactPerson ||
        "Borrower";

      const userName =
        templateParams?.[1] ||
        "Loan Team";

      const contactDetail =
        templateParams?.[2] ||
        userName;

      const tokenVal =
        rawToken ||
        "verify";

      return [
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",

          template: {
            name: "loan_agent_first_outreach",

            language: {
              code: langCode || "en",
            },

            components: [
              {
                type: "body",

                parameters: [
                  {
                    type: "text",
                    parameter_name: "borrower_name",
                    text: String(borrowerName),
                  },
                  {
                    type: "text",
                    parameter_name: "username",
                    text: String(userName),
                  },
                  {
                    type: "text",
                    parameter_name: "user_name",
                    text: String(contactDetail),
                  },
                ],
              },

              {
                type: "button",
                sub_type: "url",
                index: "0",

                parameters: [
                  {
                    type: "text",
                    text: String(tokenVal),
                  },
                ],
              },
            ],
          },
        },
      ];
    },
  },

  /**
   * do_ca
   *
   * Meta template:
   * Language: English (IND) / en_IN
   *
   * This is a completely parameter-free template.
   */
  DO_CA: {
    id: "do_ca",
    name: "do_ca",
    displayName: "Direct Outreach (CA Default)",
    defaultLang: "en_IN",
    category: "MARKETING",
    context: ["direct_outreach", "ca"],
    description:
      "Direct Outreach introductory message for CAs in English (IND)",
    parameters: [],

    getPayloads: ({
      phone,
      langCode = "en_IN",
    }) => [
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",

        template: {
          name: "do_ca",

          language: {
            code: langCode || "en_IN",
          },
        },
      },
    ],
  },
};

/**
 * Builds payload for a custom user-created WhatsApp template.
 *
 * Kept for future dynamic-template support.
 * The three hardcoded production templates above do not depend on this function.
 */
export function buildCustomTemplatePayload(
  tpl,
  {
    phone,
    contactPerson,
    rawToken,
    uploadLink,
    langCode,
    loanProduct,
    amountRequired,
    referenceId,
    templateParams,
  }
) {
  const lang =
    langCode ||
    tpl.language ||
    tpl.defaultLang ||
    "en";

  const components = [];

  let paramMappings =
    tpl.param_mappings ||
    tpl.paramMappings ||
    {};

  if (typeof paramMappings === "string") {
    try {
      paramMappings = JSON.parse(paramMappings);
    } catch (_) {
      paramMappings = {};
    }
  }

  const resolveParamValue = (
    mappingKey,
    fallbackVal = "",
    paramIndex = 0
  ) => {
    if (
      Array.isArray(templateParams) &&
      templateParams.length > paramIndex &&
      templateParams[paramIndex] !== undefined &&
      templateParams[paramIndex] !== ""
    ) {
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
        return amountRequired
          ? String(amountRequired)
          : "";

      case "reference_id":
        return referenceId || "";

      default:
        return fallbackVal || "";
    }
  };

  /**
   * Header parameters
   */
  if (
    (tpl.header_type === "TEXT" ||
      tpl.headerType === "TEXT") &&
    tpl.header_text
  ) {
    const headerParams = Array.isArray(
      paramMappings.header
    )
      ? paramMappings.header
      : [];

    if (headerParams.length > 0) {
      components.push({
        type: "header",

        parameters: headerParams.map(
          (mappingKey) => ({
            type: "text",
            text: resolveParamValue(
              mappingKey,
              contactPerson || "Client"
            ),
          })
        ),
      });
    }
  }

  /**
   * Body parameters
   */
  const bodyText =
    tpl.body_text ||
    tpl.bodyText ||
    "";

  let bodyParamKeys = Array.isArray(
    paramMappings.body
  )
    ? paramMappings.body
    : [];

  if (bodyParamKeys.length === 0) {
    const matches =
      bodyText.match(/\{\{(\d+)\}\}/g) ||
      [];

    bodyParamKeys = matches.map(
      (_, idx) =>
        idx === 0
          ? "contact_person"
          : "upload_link"
    );
  }

  if (bodyParamKeys.length > 0) {
    components.push({
      type: "body",

      parameters: bodyParamKeys.map(
        (mappingKey, idx) => ({
          type: "text",

          text: resolveParamValue(
            mappingKey,
            idx === 0
              ? contactPerson || "Client"
              : uploadLink || "",
            idx
          ),
        })
      ),
    });
  }

  /**
   * Dynamic URL button
   */
  const buttonType = String(
    tpl.button_type ||
      tpl.buttonType ||
      "none"
  ).toLowerCase();

  if (
    buttonType === "dynamic_url" ||
    (
      buttonType === "url" &&
      Array.isArray(paramMappings.button) &&
      paramMappings.button.length > 0
    )
  ) {
    const buttonParams =
      Array.isArray(paramMappings.button)
        ? paramMappings.button
        : ["raw_token"];

    components.push({
      type: "button",
      sub_type: "url",
      index: "0",

      parameters: [
        {
          type: "text",
          text: resolveParamValue(
            buttonParams[0],
            rawToken || ""
          ),
        },
      ],
    });
  }

  /**
   * Quick reply button
   */
  else if (
    buttonType === "quick_reply" &&
    Array.isArray(paramMappings.button) &&
    paramMappings.button.length > 0
  ) {
    components.push({
      type: "button",
      sub_type: "quick_reply",
      index: "0",

      parameters: [
        {
          type: "payload",
          payload:
            tpl.button_payload ||
            "ACTION_PROCEED",
        },
      ],
    });
  }

  const primaryPayload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",

    template: {
      name: tpl.name,

      language: {
        code: lang,
      },
    },
  };

  if (components.length > 0) {
    primaryPayload.template.components =
      components;

    return [primaryPayload];
  }

  return [primaryPayload];
}

/**
 * Resolve WhatsApp Template Config by Name
 *
 * Hardcoded templates take priority.
 * Custom templates remain supported for future use.
 */
export function getWhatsAppTemplate(
  templateName,
  env,
  customTemplates = []
) {
  const name =
    templateName ||
    "onboarding_first_message";

  if (
    name === "loan_agent_first_outreach"
  ) {
    return WHATSAPP_TEMPLATES
      .LOAN_AGENT_FIRST_OUTREACH;
  }

  if (
    name === "onboarding_first_message"
  ) {
    return WHATSAPP_TEMPLATES
      .ONBOARDING_FIRST_MESSAGE;
  }

  if (name === "do_ca") {
    return WHATSAPP_TEMPLATES.DO_CA;
  }

  /**
   * Future custom-template support
   */
  if (
    Array.isArray(customTemplates) &&
    customTemplates.length > 0
  ) {
    const custom =
      customTemplates.find(
        (template) =>
          template.name === name ||
          template.id === name
      );

    if (custom) {
      return {
        id: custom.id,

        name: custom.name,

        defaultLang:
          custom.language || "en",

        category:
          custom.category || "UTILITY",

        description:
          custom.body_text ||
          custom.name,

        getPayloads: (params) =>
          buildCustomTemplatePayload(
            custom,
            params
          ),
      };
    }
  }

  return WHATSAPP_TEMPLATES
    .ONBOARDING_FIRST_MESSAGE;
}
