import { getDbClient } from "../db/client.js";
import { WHATSAPP_TEMPLATES } from "../config/whatsapp-templates.js";

/**
 * Supported Meta Official Language Codes
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English (en)" },
  { code: "en_IN", name: "English (IND) / en_IN" },
  { code: "en_US", name: "English US (en_US)" },
  { code: "en_GB", name: "English UK (en_GB)" },
  { code: "hi", name: "Hindi (hi)" },
  { code: "mr", name: "Marathi (mr)" },
  { code: "gu", name: "Gujarati (gu)" },
  { code: "ta", name: "Tamil (ta)" },
  { code: "te", name: "Telugu (te)" },
  { code: "kn", name: "Kannada (kn)" },
  { code: "bn", name: "Bengali (bn)" },
  { code: "pa", name: "Punjabi (pa)" }
];

/**
 * Helper to extract variable tokens from template components
 */
export function extractTemplateVariables(bodyText = "", headerText = "", paramMappings = {}) {
  const vars = [];
  if (headerText) {
    const hMatches = headerText.match(/\{\{(\d+)\}\}/g) || [];
    hMatches.forEach((m, idx) => {
      vars.push({
        token: m,
        component: "header",
        index: idx + 1,
        label: paramMappings.header?.[idx] ? paramMappings.header[idx].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : `Header Variable ${idx + 1}`
      });
    });
  }
  if (bodyText) {
    const bMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    bMatches.forEach((m, idx) => {
      let defaultLabel = idx === 0 ? "Target Name" : `Parameter ${idx + 1}`;
      if (paramMappings.body?.[idx]) {
        defaultLabel = paramMappings.body[idx].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
      vars.push({
        token: m,
        component: "body",
        index: idx + 1,
        label: defaultLabel
      });
    });
  }
  return vars;
}

/**
 * GET /api/templates
 * Fetches all available message templates (System Built-in + Custom User Templates)
 */
export async function handleGetTemplates(c) {
  const user = c.get("user");
  const db = getDbClient(c.env);

  const systemTemplates = [
    {
      id: WHATSAPP_TEMPLATES.NEW_CONVO.id,
      name: WHATSAPP_TEMPLATES.NEW_CONVO.name,
      category: WHATSAPP_TEMPLATES.NEW_CONVO.category || "UTILITY",
      language: WHATSAPP_TEMPLATES.NEW_CONVO.defaultLang || "en",
      header_type: "NONE",
      header_text: "",
      body_text: "Hi {{1}}, please upload your requested documents to proceed with your verification using this link: {{2}}",
      footer_text: "Collectrr Verification Portal",
      button_type: "url",
      button_text: "Upload Documents",
      button_url: "{{1}}",
      param_mappings: { body: ["contact_person", "upload_link"], button: ["raw_token"] },
      variables: extractTemplateVariables(
        "Hi {{1}}, please upload your requested documents to proceed with your verification using this link: {{2}}",
        "",
        { body: ["contact_person", "upload_link"] }
      ),
      is_system: true,
      description: WHATSAPP_TEMPLATES.NEW_CONVO.description
    },
    {
      id: WHATSAPP_TEMPLATES.HELLO_WORLD.id,
      name: WHATSAPP_TEMPLATES.HELLO_WORLD.name,
      category: WHATSAPP_TEMPLATES.HELLO_WORLD.category || "UTILITY",
      language: WHATSAPP_TEMPLATES.HELLO_WORLD.defaultLang || "en_US",
      header_type: "NONE",
      header_text: "",
      body_text: "Hello World test template.",
      footer_text: "",
      button_type: "none",
      button_text: "",
      button_url: "",
      param_mappings: { body: [] },
      variables: [],
      is_system: true,
      description: WHATSAPP_TEMPLATES.HELLO_WORLD.description
    }
  ];

  try {
    let customRows = [];
    const res = await db.execute({
      sql: "SELECT id, user_id, name, category, language, header_type, header_text, body_text, footer_text, button_type, button_text, button_url, param_mappings, is_active, created_at FROM message_templates ORDER BY created_at DESC"
    });
    if (res && res.rows) {
      customRows = res.rows.map(row => {
        let mappings = {};
        try {
          mappings = typeof row.param_mappings === 'string' ? JSON.parse(row.param_mappings) : (row.param_mappings || {});
        } catch (_) {}

        return {
          id: row.id,
          name: row.name,
          category: row.category || "UTILITY",
          language: row.language || "en",
          header_type: row.header_type || "NONE",
          header_text: row.header_text || "",
          body_text: row.body_text,
          footer_text: row.footer_text || "",
          button_type: row.button_type || "url",
          button_text: row.button_text || "Upload Documents",
          button_url: row.button_url || "",
          param_mappings: mappings,
          variables: extractTemplateVariables(row.body_text, row.header_text, mappings),
          is_system: false,
          is_active: row.is_active !== 0,
          created_at: row.created_at
        };
      });
    }

    return c.json({
      success: true,
      languages: SUPPORTED_LANGUAGES,
      templates: [...systemTemplates, ...customRows]
    });
  } catch (err) {
    console.error("Error fetching message templates:", err);
    return c.json({
      success: true,
      languages: SUPPORTED_LANGUAGES,
      templates: systemTemplates
    });
  }
}

/**
 * POST /api/admin/templates
 * Creates a new custom message template with full Meta parameters
 */
export async function handleCreateTemplate(c) {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const rawName = String(body.name || "").trim().toLowerCase();
  const name = rawName.replace(/[^a-z0-9_]/g, "_");
  const category = String(body.category || "UTILITY").trim().toUpperCase();
  const language = String(body.language || "en").trim();
  const headerType = String(body.header_type || body.headerType || "NONE").trim().toUpperCase();
  const headerText = String(body.header_text || body.headerText || "").trim();
  const bodyText = String(body.body_text || body.bodyText || "").trim();
  const footerText = String(body.footer_text || body.footerText || "").trim();
  const buttonType = String(body.button_type || body.buttonType || "url").trim().toLowerCase();
  const buttonText = String(body.button_text || body.buttonText || "Upload Documents").trim();
  const paramMappings = body.param_mappings || body.paramMappings || {
    body: (bodyText.match(/\{\{(\d+)\}\}/g) || []).map((_, idx) => (idx === 0 ? "contact_person" : "upload_link")),
    header: [],
    button: buttonType === "dynamic_url" ? ["raw_token"] : []
  };

  if (!name || name.length < 2) {
    return c.json({ error: "Template name must be at least 2 characters (lowercase letters, numbers, underscores)." }, 400);
  }

  if (name === "new_convo_1" || name === "hello_world") {
    return c.json({ error: "Cannot overwrite protected system template identifier." }, 400);
  }

  if (!bodyText) {
    return c.json({ error: "Template body text is required." }, 400);
  }

  if (!language) {
    return c.json({ error: "Target language code is required for WhatsApp template creation." }, 400);
  }

  const db = getDbClient(c.env);
  const id = "tpl_" + crypto.randomUUID().slice(0, 12);
  const userId = user?.id || user?.user_id || "admin";

  const mappingsJson = typeof paramMappings === "string" ? paramMappings : JSON.stringify(paramMappings);

  try {
    await db.execute({
      sql: `INSERT INTO message_templates (id, user_id, name, category, language, header_type, header_text, body_text, footer_text, button_type, button_text, button_url, param_mappings, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(name) DO UPDATE SET
              category = excluded.category,
              language = excluded.language,
              header_type = excluded.header_type,
              header_text = excluded.header_text,
              body_text = excluded.body_text,
              footer_text = excluded.footer_text,
              button_type = excluded.button_type,
              button_text = excluded.button_text,
              button_url = excluded.button_url,
              param_mappings = excluded.param_mappings,
              is_active = 1`,
      args: [id, userId, name, category, language, headerType, headerText, bodyText, footerText, buttonType, buttonText, buttonUrl, mappingsJson]
    });

    return c.json({
      success: true,
      message: "Template configuration saved successfully",
      template: {
        id,
        user_id: userId,
        name,
        category,
        language,
        header_type: headerType,
        header_text: headerText,
        body_text: bodyText,
        footer_text: footerText,
        button_type: buttonType,
        button_text: buttonText,
        button_url: buttonUrl,
        param_mappings: typeof paramMappings === 'string' ? JSON.parse(mappingsJson) : paramMappings,
        is_system: false,
        is_active: true
      }
    }, 200);
  } catch (err) {
    console.error("Error saving template configuration:", err);
    return c.json({ error: "Failed to save message template configuration: " + (err.message || "") }, 500);
  }
}

/**
 * DELETE /api/admin/templates/:id
 * Deletes a custom message template
 */
export async function handleDeleteTemplate(c) {
  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Template ID is required." }, 400);
  }

  if (id === "new_convo_1" || id === "hello_world") {
    return c.json({ error: "Cannot delete built-in system template." }, 400);
  }

  const db = getDbClient(c.env);
  try {
    await db.execute({
      sql: "DELETE FROM message_templates WHERE id = ? OR name = ?",
      args: [id, id]
    });
    return c.json({ success: true, message: "Template removed successfully." });
  } catch (err) {
    console.error("Error deleting template:", err);
    return c.json({ error: "Failed to delete template." }, 500);
  }
}
