export function getDbClient(env) {
  const db = env.DB;
  return {
    execute: async (query) => {
      let sql, args;
      if (typeof query === "string") {
        sql = query;
        args = [];
      } else {
        sql = query.sql;
        args = query.args || [];
      }
      
      let stmt = db.prepare(sql);
      if (args && args.length > 0) {
        stmt = stmt.bind(...args);
      }
      const res = await stmt.all();
      return { rows: res.results };
    }
  };
}
