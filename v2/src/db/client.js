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
      return { rows: res.results };
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("has no column named user_id") || msg.includes("no column named user_id")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN user_id TEXT").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results };
      }
      if (msg.includes("has no column named is_demo") || msg.includes("no column named is_demo")) {
        try {
          await db.prepare("ALTER TABLE loan_cases ADD COLUMN is_demo INTEGER DEFAULT 0").run();
        } catch (_) {}
        let stmt = db.prepare(sql);
        if (args && args.length > 0) {
          stmt = stmt.bind(...args);
        }
        const res = await stmt.all();
        return { rows: res.results };
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
        return { rows: res.results };
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
        return { rows: res.results };
      }
      throw err;
    }
  };

  return {
    execute: executeQuery
  };
}
