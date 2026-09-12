export function getDbClient(env) {
  const db = env.DB;
  
  const executeQuery = async (query) => {
    let sql, args;
    if (typeof query === "string") {
      sql = query;
      args = [];
    } else {
      sql = query.sql;
      args = query.args || [];
    }

    try {
      let stmt = db.prepare(sql);
      if (args && args.length > 0) {
        stmt = stmt.bind(...args);
      }
      const res = await stmt.all();
      return { rows: res.results || [] };
    } catch (err) {
      const msg = (err.message || "").toLowerCase();

      const isMissingCol = (col) => {
        return (
          msg.includes(`no such column: ${col}`) ||
          msg.includes(`.${col}`) ||
          msg.includes(`no column named ${col}`) ||
          (msg.includes(col) && (msg.includes("no such column") || msg.includes("no column named")))
        );
      };

      if (msg.includes("no such table: contacts")) {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS contacts (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              contact_person TEXT NOT NULL,
              phone_number TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT unq_user_contact_phone UNIQUE(user_id, phone_number)
            )
          `).run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_user_phone ON contacts(user_id, phone_number)").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("contact_id")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN contact_id TEXT").run();
          await db.prepare("ALTER TABLE case_timeline ADD COLUMN contact_id TEXT").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("wa_phone_number_id")) {
        try {
          await db.prepare("ALTER TABLE users ADD COLUMN wa_phone_number_id TEXT").run();
          await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS unq_users_wa_phone_id ON users(wa_phone_number_id) WHERE wa_phone_number_id IS NOT NULL").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("provider_message_id")) {
        try {
          await db.prepare("ALTER TABLE case_timeline ADD COLUMN provider_message_id TEXT").run();
          await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS unq_timeline_provider_msg ON case_timeline(provider_message_id) WHERE provider_message_id IS NOT NULL").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("template_name")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN template_name TEXT").run();
          await db.prepare("ALTER TABLE case_timeline ADD COLUMN template_name TEXT").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) stmt = stmt.bind(...args);
        const res = await stmt.all();
        return { rows: res.results || [] };
      }

      if (isMissingCol("user_id")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN user_id TEXT").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      if (isMissingCol("is_demo")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN is_demo INTEGER DEFAULT 0").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      if (msg.includes("no such table: loan_product_doc_mappings")) {
        try {
          await db.prepare("CREATE TABLE IF NOT EXISTS loan_product_doc_mappings (product_label TEXT PRIMARY KEY, required_doc_ids JSON NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      if (msg.includes("no such table: message_templates")) {
        try {
          await db.prepare("CREATE TABLE IF NOT EXISTS message_templates (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL UNIQUE, category TEXT DEFAULT 'UTILITY', language TEXT DEFAULT 'en', header_type TEXT DEFAULT 'NONE', header_text TEXT, body_text TEXT NOT NULL, footer_text TEXT, button_type TEXT DEFAULT 'url', button_text TEXT, button_url TEXT, param_mappings JSON, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results || [] };
      }
      throw err;
    }
  };

  return {
    execute: executeQuery
  };
}
