export async function logSystemFailure(db, errorType, leadId, details) {
  try {
    const id = crypto.randomUUID();
    const detailsStr = typeof details === "object" ? JSON.stringify(details) : String(details);
    await db.execute({
      sql: "INSERT INTO system_failures (id, error_type, lead_id, details) VALUES (?, ?, ?, ?)",
      args: [id, errorType, leadId, detailsStr]
    });
  } catch (err) {
    console.error("Failed to write to system_failures:", err);
  }
}
