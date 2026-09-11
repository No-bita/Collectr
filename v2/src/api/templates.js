import { getDbClient } from "../db/client.js";
import { WHATSAPP_TEMPLATES } from "../whatsapp/templates.js";

/**
 * Supported Meta Official Language Codes
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English (en)" },
  { code: "en_IN", name: "English (IND) / en_IN" },
  { code: "en_US", name: "English US (en_US)" },
  { code: "en_GB", name: "English UK (en_GB)" },
];

/**
 * Helper to extract variable tokens from template components
 */
export function extractTemplateVariables(
  bodyText = "",
  headerText = "",
  paramMappings = {}
) {
  const vars = [];

  if (headerText) {
    const hMatches = headerText.match(/\{\{(\d+)\}\}/g) || [];

    hMatches.forEach((m, idx) => {
      vars.push({
        token: m,
        component: "header",
        index: idx + 1,
        label: paramMappings.header?.[idx]
          ? paramMappings.header[idx]
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())
          : `Header Variable ${idx + 1}`,
      });
    });
  }

  if (bodyText) {
    const bMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];

    bMatches.forEach((m, idx) => {
      let defaultLabel =
        idx === 0 ? "Target Name" : `Parameter ${idx + 1}`;

      if (paramMappings.body?.[idx]) {
        defaultLabel = paramMappings.body[idx]
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
      }

      vars.push({
        token: m,
        component: "body",
        index: idx + 1,
        label: defaultLabel,
      });
    });
  }

  return vars;
}

/**
 * Convert hardcoded WHATSAPP_TEMPLATES configuration
 * into the format expected by the frontend.
 */
function buildSystemTemplates() {
  return Object.values(WHATSAPP_TEMPLATES).map((template) => {
    const bodyText = template.body_text || template.body?.text || "";
    const bodyParameters = template.parameters || template.body?.parameters || [];

    const button = template.button || null;

    return {
      id: template.id,
      name: template.name,
      displayName: template.displayName || template.name,
      category: template.category || "UTILITY",
      language: template.defaultLang || "en",
      context: template.context || ["direct_outreach", "ca", "loan_agent"],

      header_type: "NONE",
      header_text: "",

      body_text: bodyText,

      footer_text: "Collectrr Verification Portal",

      button_type: button ? "url" : "none",
      button_text: button?.text || "",
      button_url: "",

      param_mappings: {
        body: bodyParameters,
        button: button?.parameter
          ? [button.parameter]
          : [],
      },

      parameters: Array.isArray(template.parameters) ? template.parameters : [],

      variables: extractTemplateVariables(
        bodyText,
        "",
        {
          body: bodyParameters,
        }
      ),

      is_system: true,
      is_active: true,

      description: template.description || "",
    };
  });
}

/**
 * GET /api/templates
 *
 * Returns:
 * 1. Hardcoded system templates from WHATSAPP_TEMPLATES
 * 2. Custom templates stored in message_templates
 *
 * Hardcoded templates are intentionally the source of truth
 * for the system templates during the current development phase.
 */
export async function handleGetTemplates(c) {
  const db = getDbClient(c.env);
  const contextQuery = c.req.query("context") || "";

  const systemTemplates = buildSystemTemplates();

  try {
    // Purge any duplicate system templates that were historically saved into the custom message_templates table
    const systemNames = Object.values(WHATSAPP_TEMPLATES).map((t) => (t.name || "").toLowerCase());
    if (systemNames.length > 0) {
      const placeholders = systemNames.map(() => "?").join(", ");
      await db.execute({
        sql: `DELETE FROM message_templates WHERE LOWER(name) IN (${placeholders})`,
        args: systemNames,
      }).catch(() => {});
    }

    let customRows = [];

    const res = await db.execute({
      sql: `
        SELECT
          id,
          user_id,
          name,
          category,
          language,
          header_type,
          header_text,
          body_text,
          footer_text,
          button_type,
          button_text,
          button_url,
          param_mappings,
          is_active,
          created_at
        FROM message_templates
        WHERE is_active = 1
        ORDER BY created_at DESC
      `,
    });

    const seenNames = new Set(systemTemplates.map((t) => (t.name || "").toLowerCase()));

    if (res && res.rows) {
      for (const row of res.rows) {
        const rowName = (row.name || "").toLowerCase();
        // Disallow any custom template that duplicates a system template or another custom template
        if (seenNames.has(rowName)) {
          continue;
        }
        seenNames.add(rowName);

        let mappings = {};

        try {
          mappings =
            typeof row.param_mappings === "string"
              ? JSON.parse(row.param_mappings)
              : row.param_mappings || {};
        } catch (_) {
          mappings = {};
        }

        customRows.push({
          id: row.id,
          name: row.name,
          displayName: row.name,
          category: row.category || "UTILITY",
          language: row.language || "en",
          context: ["direct_outreach", "ca", "loan_agent"],

          header_type: row.header_type || "NONE",
          header_text: row.header_text || "",

          body_text: row.body_text,
          footer_text: row.footer_text || "",

          button_type: row.button_type || "none",
          button_text: row.button_text || "",
          button_url: row.button_url || "",

          param_mappings: mappings,
          parameters: [],

          variables: extractTemplateVariables(
            row.body_text || "",
            row.header_text || "",
            mappings
          ),

          is_system: false,
          is_active: row.is_active !== 0,

          created_at: row.created_at,
        });
      }
    }

    let allTemplates = [
      ...systemTemplates,
      ...customRows,
    ];

    if (contextQuery) {
      allTemplates = allTemplates.filter(t => 
        !t.context || t.context.includes(contextQuery)
      );
    }

    return c.json({
      success: true,
      languages: SUPPORTED_LANGUAGES,
      templates: allTemplates,
    });
  } catch (err) {
    console.error("Error fetching message templates:", err);

    let fallbackTemplates = systemTemplates;
    if (contextQuery) {
      fallbackTemplates = fallbackTemplates.filter(t => 
        !t.context || t.context.includes(contextQuery)
      );
    }

    return c.json({
      success: true,
      languages: SUPPORTED_LANGUAGES,
      templates: fallbackTemplates,
    });
  }
}

/**
 * POST /api/admin/templates
 *
 * Creates or updates a custom application template.
 * Never allows two templates with the same name to be created.
 */
export async function handleCreateTemplate(c) {
  const user = c.get("user");

  const body = await c.req.json().catch(() => ({}));

  const rawName = String(body.name || "")
    .trim()
    .toLowerCase();

  const name = rawName.replace(/[^a-z0-9_]/g, "_");

  const category = String(
    body.category || "UTILITY"
  )
    .trim()
    .toUpperCase();

  const language = String(
    body.language || "en"
  ).trim();

  const headerType = String(
    body.header_type ||
      body.headerType ||
      "NONE"
  )
    .trim()
    .toUpperCase();

  const headerText = String(
    body.header_text ||
      body.headerText ||
      ""
  ).trim();

  const bodyText = String(
    body.body_text ||
      body.bodyText ||
      ""
  ).trim();

  const footerText = String(
    body.footer_text ||
      body.footerText ||
      ""
  ).trim();

  const buttonType = String(
    body.button_type ||
      body.buttonType ||
      "url"
  )
    .trim()
    .toLowerCase();

  const buttonText = String(
    body.button_text ||
      body.buttonText ||
      "Upload Documents"
  ).trim();

  const buttonUrl = String(
    body.button_url ||
      body.buttonUrl ||
      ""
  ).trim();

  const paramMappings =
    body.param_mappings ||
    body.paramMappings || {
      body: (
        bodyText.match(/\{\{(\d+)\}\}/g) || []
      ).map((_, idx) =>
        idx === 0
          ? "contact_person"
          : "upload_link"
      ),

      header: [],

      button:
        buttonType === "dynamic_url"
          ? ["raw_token"]
          : [],
    };

  if (!name || name.length < 2) {
    return c.json(
      {
        error:
          "Template name must be at least 2 characters (lowercase letters, numbers, underscores).",
      },
      400
    );
  }

  /*
   * 1. Prevent custom templates from colliding with
   * any hardcoded system template.
   */
  const isSystemTemplate = Object.values(
    WHATSAPP_TEMPLATES
  ).some(
    (template) =>
      (template.id || "").toLowerCase() === name ||
      (template.name || "").toLowerCase() === name
  );

  if (isSystemTemplate) {
    return c.json(
      {
        error:
          `A template with the name "${name}" already exists as a protected system template.`,
      },
      409
    );
  }

  if (!bodyText) {
    return c.json(
      {
        error:
          "Template body text is required.",
      },
      400
    );
  }

  if (!language) {
    return c.json(
      {
        error:
          "Target language code is required for WhatsApp template creation.",
      },
      400
    );
  }

  const db = getDbClient(c.env);
  const targetId = body.id || body.template_id || null;

  /*
   * 2. Prevent creating duplicate custom templates with the same name.
   */
  const existingRes = await db.execute({
    sql: "SELECT id, name FROM message_templates WHERE LOWER(name) = LOWER(?)",
    args: [name],
  });

  if (existingRes && existingRes.rows && existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    if (!targetId || targetId !== existing.id) {
      return c.json(
        {
          error:
            `A template with the name "${name}" already exists. Template names must be unique.`,
        },
        409
      );
    }
  }

  const id =
    targetId ||
    "tpl_" +
    crypto.randomUUID().slice(0, 12);

  const userId =
    user?.id ||
    user?.user_id ||
    "admin";

  const mappingsJson =
    typeof paramMappings === "string"
      ? paramMappings
      : JSON.stringify(paramMappings);

  try {
    if (targetId) {
      // Update existing template
      await db.execute({
        sql: `
          UPDATE message_templates SET
            category = ?,
            language = ?,
            header_type = ?,
            header_text = ?,
            body_text = ?,
            footer_text = ?,
            button_type = ?,
            button_text = ?,
            button_url = ?,
            param_mappings = ?,
            is_active = 1
          WHERE id = ?
        `,
        args: [
          category,
          language,
          headerType,
          headerText,
          bodyText,
          footerText,
          buttonType,
          buttonText,
          buttonUrl,
          mappingsJson,
          targetId,
        ],
      });
    } else {
      // Strictly insert new unique template (no ON CONFLICT overwrite)
      await db.execute({
        sql: `
          INSERT INTO message_templates (
            id,
            user_id,
            name,
            category,
            language,
            header_type,
            header_text,
            body_text,
            footer_text,
            button_type,
            button_text,
            button_url,
            param_mappings,
            is_active
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            1
          )
        `,
        args: [
          id,
          userId,
          name,
          category,
          language,
          headerType,
          headerText,
          bodyText,
          footerText,
          buttonType,
          buttonText,
          buttonUrl,
          mappingsJson,
        ],
      });
    }

    return c.json(
      {
        success: true,
        message: targetId
          ? "Template updated successfully"
          : "Template configuration saved successfully",

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

          param_mappings:
            typeof paramMappings === "string"
              ? JSON.parse(mappingsJson)
              : paramMappings,

          is_system: false,
          is_active: true,
        },
      },
      200
    );
  } catch (err) {
    console.error(
      "Error saving template configuration:",
      err
    );

    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return c.json(
        {
          error:
            `A template with the name "${name}" already exists. Template names must be unique.`,
        },
        409
      );
    }

    return c.json(
      {
        error:
          "Failed to save message template configuration: " +
          (err.message || ""),
      },
      500
    );
  }
}

/**
 * DELETE /api/admin/templates/:id
 *
 * Deletes custom templates only.
 * Hardcoded system templates cannot be deleted.
 */
export async function handleDeleteTemplate(c) {
  const id = c.req.param("id");

  if (!id) {
    return c.json(
      {
        error: "Template ID is required.",
      },
      400
    );
  }

  const isSystemTemplate = Object.values(
    WHATSAPP_TEMPLATES
  ).some(
    (template) =>
      template.id === id ||
      template.name === id
  );

  if (isSystemTemplate) {
    return c.json(
      {
        error:
          "Cannot delete a built-in system template.",
      },
      400
    );
  }

  const db = getDbClient(c.env);

  try {
    await db.execute({
      sql: `
        DELETE FROM message_templates
        WHERE id = ?
           OR name = ?
      `,
      args: [id, id],
    });

    return c.json({
      success: true,
      message:
        "Template removed successfully.",
    });
  } catch (err) {
    console.error(
      "Error deleting template:",
      err
    );

    return c.json(
      {
        error:
          "Failed to delete template.",
      },
      500
    );
  }
}