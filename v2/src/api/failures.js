export async function logSystemFailure(db, errorType, caseId, details) {
  try {
    const id = crypto.randomUUID();
    const detailsStr = typeof details === "object" ? JSON.stringify(details) : String(details);
    await db.execute({
      sql: "INSERT INTO system_failures (id, error_type, case_id, details) VALUES (?, ?, ?, ?)",
      args: [id, errorType, caseId, detailsStr]
    });
  } catch (err) {
    console.error("Failed to write to system_failures:", err);
  }
}
