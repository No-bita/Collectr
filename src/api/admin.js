import { getDbClient } from "../db/client.js";

// Fetch failures list for API
export async function handleGetAdminFailures(c) {
  const db = getDbClient(c.env);
  try {
    const res = await db.execute(`
      SELECT sf.*, l.name as lead_name, l.phone_number as lead_phone
      FROM system_failures sf
      LEFT JOIN leads l ON sf.lead_id = l.id
      ORDER BY sf.created_at DESC
      LIMIT 100
    `);
    return c.json({ success: true, failures: res.rows });
  } catch (err) {
    console.error("Failed to fetch failures:", err);
    return c.json({ error: "Failed to load failure logs." }, 500);
  }
}

// Clear single failure
export async function handleDeleteAdminFailure(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  try {
    await db.execute({
      sql: "DELETE FROM system_failures WHERE id = ?",
      args: [id]
    });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Failed to delete failure log." }, 500);
  }
}

// Clear all failures
export async function handleClearAllFailures(c) {
  const db = getDbClient(c.env);
  try {
    await db.execute("DELETE FROM system_failures");
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Failed to clear failure logs." }, 500);
  }
}

// Render HTML Failure Dashboard directly
export async function handleGetAdminDashboard(c) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lekho - Failures & Observability Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --panel: #111827;
      --panel-border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --red: #f87171;
      --red-bg: rgba(248, 113, 113, 0.1);
      --yellow: #fbbf24;
      --yellow-bg: rgba(251, 191, 36, 0.1);
      --green: #34d399;
      --green-bg: rgba(52, 211, 153, 0.1);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem;
      line-height: 1.5;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 1.5rem;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .btn {
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0.625rem 1.25rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-primary {
      background-color: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background-color: var(--primary-hover);
    }

    .btn-danger {
      background-color: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover {
      background-color: rgba(239, 68, 68, 0.3);
    }

    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2.5rem;
    }

    .card {
      background-color: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
    }

    .card-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .card-val {
      font-size: 2.25rem;
      font-weight: 700;
    }

    .card-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
    }

    /* Logs Table */
    .logs-panel {
      background-color: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      overflow: hidden;
    }

    .panel-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-title {
      font-weight: 600;
      font-size: 1.125rem;
    }

    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    th {
      background-color: rgba(255, 255, 255, 0.02);
      padding: 1rem 1.5rem;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--panel-border);
    }

    td {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--panel-border);
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-error {
      background-color: var(--red-bg);
      color: var(--red);
    }

    .badge-warning {
      background-color: var(--yellow-bg);
      color: var(--yellow);
    }

    .code-block {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      background-color: rgba(0, 0, 0, 0.3);
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: #e5e7eb;
      max-height: 150px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .timestamp {
      color: var(--text-muted);
      font-size: 0.8125rem;
    }

    .empty-state {
      padding: 4rem 2rem;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state svg {
      color: rgba(255, 255, 255, 0.1);
      margin-bottom: 1rem;
    }

    .client-info {
      font-weight: 500;
    }
    
    .client-phone {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background-color: var(--primary);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
      font-weight: 500;
      display: none;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { transform: translateY(1rem); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Lekho System Failures</h1>
        <div class="subtitle">Real-time observability and delivery issue tracking</div>
      </div>
      <div style="display: flex; gap: 1rem;">
        <button class="btn btn-primary" onclick="loadFailures()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh Logs
        </button>
        <button class="btn btn-danger" onclick="clearAll()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Clear All Logs
        </button>
      </div>
    </header>

    <div class="summary-grid">
      <div class="card">
        <div class="card-label">Total Errors Logged</div>
        <div class="card-val" id="count-total">0</div>
        <div class="card-sub">Active system failure events</div>
      </div>
      <div class="card" style="border-left: 3px solid var(--red);">
        <div class="card-label">WhatsApp Failures</div>
        <div class="card-val" id="count-whatsapp">0</div>
        <div class="card-sub">Outbound notifications blocked</div>
      </div>
      <div class="card" style="border-left: 3px solid var(--yellow);">
        <div class="card-label">OCR Failures & Anomalies</div>
        <div class="card-val" id="count-ocr">0</div>
        <div class="card-sub">Flagged files or extraction crashes</div>
      </div>
    </div>

    <div class="logs-panel">
      <div class="panel-header">
        <div class="panel-title">Active Failures</div>
        <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); text-transform: none; font-size: 0.75rem;" id="log-status">Updated just now</span>
      </div>
      <div class="table-container">
        <table id="logs-table">
          <thead>
            <tr>
              <th style="width: 15%">Timestamp</th>
              <th style="width: 15%">Category</th>
              <th style="width: 20%">Client Impacted</th>
              <th style="width: 40%">Error Details</th>
              <th style="width: 10%; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody id="logs-body">
            <tr>
              <td colspan="5" class="empty-state">Loading failure logs...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="toast" id="toast">Notification text</div>

  <script>
    function showToast(msg) {
      const toast = document.getElementById("toast");
      toast.textContent = msg;
      toast.style.display = "block";
      setTimeout(() => {
        toast.style.display = "none";
      }, 3000);
    }

    async function loadFailures() {
      document.getElementById("log-status").textContent = "Refreshing...";
      try {
        const res = await fetch("/api/admin/failures");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch logs");
        
        renderLogs(data.failures);
      } catch (err) {
        showToast("Error loading logs: " + err.message);
      }
    }

    function renderLogs(failures) {
      const body = document.getElementById("logs-body");
      
      // Update stats
      document.getElementById("count-total").textContent = failures.length;
      document.getElementById("count-whatsapp").textContent = failures.filter(f => f.error_type === "whatsapp_delivery").length;
      document.getElementById("count-ocr").textContent = failures.filter(f => f.error_type.startsWith("ocr")).length;
      
      if (failures.length === 0) {
        body.innerHTML = \`
          <tr>
            <td colspan="5" class="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem;"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              <div>No system failures logged. All systems operating normally!</div>
            </td>
          </tr>
        \`;
        document.getElementById("log-status").textContent = "No active issues";
        return;
      }

      body.innerHTML = "";
      failures.forEach(f => {
        const tr = document.createElement("tr");
        
        // Timestamp
        const dateCell = document.createElement("td");
        dateCell.className = "timestamp";
        const date = new Date(f.created_at);
        dateCell.textContent = date.toLocaleString();
        tr.appendChild(dateCell);
        
        // Category Badge
        const catCell = document.createElement("td");
        const badge = document.createElement("span");
        if (f.error_type === "whatsapp_delivery") {
          badge.className = "badge badge-error";
          badge.textContent = "WhatsApp";
        } else if (f.error_type === "ocr_anomaly") {
          badge.className = "badge badge-warning";
          badge.textContent = "Anomaly";
        } else {
          badge.className = "badge badge-warning";
          badge.textContent = "OCR Error";
        }
        catCell.appendChild(badge);
        tr.appendChild(catCell);
        
        // Lead/Client
        const clientCell = document.createElement("td");
        if (f.lead_name) {
          clientCell.innerHTML = \`
            <div class="client-info">\${escapeHtml(f.lead_name)}</div>
            <div class="client-phone">\${escapeHtml(f.lead_phone)}</div>
          \`;
        } else {
          clientCell.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No specific client</span>';
        }
        tr.appendChild(clientCell);
        
        // Details Code Block
        const detailsCell = document.createElement("td");
        const pre = document.createElement("pre");
        pre.className = "code-block";
        
        let detailsText = f.details;
        try {
          const parsed = JSON.parse(f.details);
          detailsText = JSON.stringify(parsed, null, 2);
        } catch(e) {}
        
        pre.textContent = detailsText;
        detailsCell.appendChild(pre);
        tr.appendChild(detailsCell);
        
        // Actions
        const actionCell = document.createElement("td");
        actionCell.style.textAlign = "right";
        const btn = document.createElement("button");
        btn.className = "btn btn-danger";
        btn.style.padding = "4px 8px";
        btn.style.fontSize = "0.75rem";
        btn.textContent = "Resolve";
        btn.onclick = () => deleteFailure(f.id);
        actionCell.appendChild(btn);
        tr.appendChild(actionCell);
        
        body.appendChild(tr);
      });

      const now = new Date();
      document.getElementById("log-status").textContent = "Last updated: " + now.toLocaleTimeString();
    }

    async function deleteFailure(id) {
      if (!confirm("Mark this issue as resolved and delete log?")) return;
      try {
        const res = await fetch(\`/api/admin/failures/\${id}\`, { method: "DELETE" });
        if (!res.ok) throw new Error("API failed");
        showToast("Logged issue resolved.");
        loadFailures();
      } catch (err) {
        showToast("Error resolving issue.");
      }
    }

    async function clearAll() {
      if (!confirm("Are you sure you want to permanently clear all failure logs?")) return;
      try {
        const res = await fetch("/api/admin/failures", { method: "DELETE" });
        if (!res.ok) throw new Error("API failed");
        showToast("All system logs cleared.");
        loadFailures();
      } catch(err) {
        showToast("Error clearing logs.");
      }
    }

    function escapeHtml(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    window.onload = loadFailures;
  </script>
</body>
</html>
  `;
  return c.html(html);
}
