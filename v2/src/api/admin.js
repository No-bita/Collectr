import { getDbClient } from "../db/client.js";
import { getAccessibleCaseFilter } from "./cases.js";

// Fetch failures list for API
export async function handleGetAdminFailures(c) {
  const db = getDbClient(c.env);
  try {
    const res = await db.execute(`
      SELECT sf.*, c.contact_person as case_contact, c.phone_number as case_phone
      FROM system_failures sf
      LEFT JOIN loan_cases c ON sf.case_id = c.id
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

// Fetch Full Analytics Data for API
export async function handleGetAdminAnalyticsData(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const requestedAgentId = c.req.query("agentId");

  try {
    let filter = getAccessibleCaseFilter(user);

    // If user is admin and requested a specific agent account
    if (user && user.role === "admin" && requestedAgentId && requestedAgentId !== "all") {
      filter = {
        whereClause: "(user_id = ? OR (user_id IS NULL AND ? = 'system'))",
        params: [requestedAgentId, requestedAgentId]
      };
    }

    // Fetch list of all registered agents for filter dropdown (if admin)
    let agentsList = [];
    if (user && user.role === "admin") {
      const agentsRes = await db.execute("SELECT id, username, role FROM users ORDER BY username ASC");
      agentsList = agentsRes.rows || [];
    }

    // 1. Total Case & Pipeline Values
    const totalCasesRes = await db.execute({
      sql: `SELECT COUNT(*) as total_cases, COALESCE(SUM(amount_required), 0) as total_value, COALESCE(AVG(amount_required), 0) as avg_value FROM loan_cases WHERE ${filter.whereClause}`,
      args: filter.params
    });
    const totals = totalCasesRes.rows[0] || { total_cases: 0, total_value: 0, avg_value: 0 };

    // 2. Disbursed Values
    const disbursedRes = await db.execute({
      sql: `SELECT COUNT(*) as count, COALESCE(SUM(amount_required), 0) as value FROM loan_cases WHERE status = 'disbursed' AND (${filter.whereClause})`,
      args: filter.params
    });
    const disbursed = disbursedRes.rows[0] || { count: 0, value: 0 };

    // 3. Status Breakdown
    const statusRes = await db.execute({
      sql: `SELECT status, COUNT(*) as count, COALESCE(SUM(amount_required), 0) as value FROM loan_cases WHERE ${filter.whereClause} GROUP BY status`,
      args: filter.params
    });

    // 4. Product Breakdown
    const productRes = await db.execute({
      sql: `SELECT COALESCE(NULLIF(loan_product, ''), 'Unspecified') as product, COUNT(*) as count, COALESCE(SUM(amount_required), 0) as value FROM loan_cases WHERE ${filter.whereClause} GROUP BY product ORDER BY count DESC`,
      args: filter.params
    });

    // 5. Document & OCR Analytics
    const reqDocsRes = await db.execute({
      sql: `SELECT rd.status, COUNT(*) as count FROM required_documents rd JOIN loan_cases c ON rd.case_id = c.id WHERE ${filter.whereClause} GROUP BY rd.status`,
      args: filter.params
    });
    const uploadsRes = await db.execute({
      sql: `SELECT ud.ocr_status, COUNT(*) as count FROM uploaded_documents ud JOIN loan_cases c ON ud.case_id = c.id WHERE ${filter.whereClause} GROUP BY ud.ocr_status`,
      args: filter.params
    });
    const totalUploadsRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM uploaded_documents ud JOIN loan_cases c ON ud.case_id = c.id WHERE ${filter.whereClause}`,
      args: filter.params
    });
    const totalUploadsCount = totalUploadsRes.rows[0]?.count || 0;

    // 6. Recent Platform Timeline Events (with Agent Account Name)
    const timelineRes = await db.execute({
      sql: `SELECT t.*, c.contact_person, c.phone_number, c.loan_product, COALESCE(u.username, t.created_by, 'system') as agent_name
            FROM case_timeline t
            JOIN loan_cases c ON t.case_id = c.id
            LEFT JOIN users u ON c.user_id = u.id
            WHERE ${filter.whereClause}
            ORDER BY t.created_at DESC
            LIMIT 30`,
      args: filter.params
    });

    // 7. Failures Summary
    const failuresRes = await db.execute("SELECT COUNT(*) as count FROM system_failures");

    return c.json({
      success: true,
      agents: agentsList,
      metrics: {
        totalCases: totals.total_cases,
        totalPipelineValueLacs: totals.total_value,
        avgCaseSizeLacs: totals.avg_value,
        disbursedCases: disbursed.count,
        disbursedValueLacs: disbursed.value,
        conversionRate: totals.total_cases > 0 ? ((disbursed.count / totals.total_cases) * 100).toFixed(1) : 0,
        totalUploads: totalUploadsCount,
        activeFailures: failuresRes.rows[0]?.count || 0
      },
      statusBreakdown: statusRes.rows,
      productBreakdown: productRes.rows,
      documentStats: reqDocsRes.rows,
      ocrStats: uploadsRes.rows,
      recentTimeline: timelineRes.rows
    });
  } catch (err) {
    console.error("Analytics Data Fetch Error:", err);
    return c.json({ error: "Failed to compile analytics data." }, 500);
  }
}

// Render HTML Analytics View Directly
export async function handleGetAdminAnalyticsDashboard(c) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Dashboard — Collectrr</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f4f6f9;
      --surface: #ffffff;
      --border: #e2e6ed;
      --text: #1a1d21;
      --muted: #5c6570;
      --muted-soft: #64748b;
      --accent: #2563eb;
      --accent-ring: rgba(37, 99, 235, 0.15);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --radius-md: 0.75rem;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'IBM Plex Sans', sans-serif; background-color: var(--bg); color: var(--text); min-height: 100vh; padding: 1.5rem; line-height: 1.5; }
    .shell { max-width: 1400px; margin: 0 auto; }
    
    header.dashboard-top {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.5rem; padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);
    }
    .brand-title h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
    .brand-title p { font-size: 0.875rem; color: var(--muted-soft); margin-top: 0.1rem; }
    
    .nav-links { display: flex; gap: 0.75rem; align-items: center; }
    .nav-btn {
      display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem;
      font-family: inherit; font-size: 0.875rem; font-weight: 600; text-decoration: none;
      border-radius: 0.5rem; border: 1px solid var(--border); background: var(--surface); color: var(--text);
      transition: all 0.15s ease; cursor: pointer;
    }
    .nav-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
    .nav-btn.active { background: var(--accent); border-color: var(--accent); color: #ffffff; }
    
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; margin-bottom: 1.75rem; }
    .metric-card {
      background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px);
      border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem;
      box-shadow: 0 2px 4px rgba(15,23,42,0.03); display: flex; flex-direction: column;
    }
    .metric-label { font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .metric-value { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-top: 0.35rem; }
    .metric-sub { font-size: 0.75rem; color: var(--muted-soft); margin-top: 0.25rem; }
    
    .analytics-section { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.75rem; }
    @media (max-width: 900px) { .analytics-section { grid-template-columns: 1fr; } }
    
    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: 0 4px 12px rgba(15,23,42,0.03); }
    .panel-title { font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; }
    
    .bar-list { display: flex; flex-direction: column; gap: 0.875rem; }
    .bar-item { display: flex; flex-direction: column; gap: 0.25rem; }
    .bar-meta { display: flex; justify-content: space-between; font-size: 0.8125rem; font-weight: 500; }
    .bar-track { height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; width: 100%; }
    .bar-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }

    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8125rem; }
    th { background: #f8fafc; padding: 0.75rem 1rem; font-weight: 600; color: var(--muted-soft); border-bottom: 1px solid var(--border); }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #eef1f5; vertical-align: middle; }
    .tag { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: #f1f5f9; color: #475569; }
  </style>
</head>
<body>
  <div class="shell">
    <header class="dashboard-top">
      <div class="brand-title">
        <h1>Collectrr Platform Analytics</h1>
        <p>Real-time loan pipeline metrics, product distribution & agent activity</p>
      </div>
      <div class="nav-links">
        <select id="agentFilterSelect" class="nav-btn" onchange="loadAnalytics()" style="outline: none; cursor: pointer; padding: 0.5rem 0.875rem;">
          <option value="all">All Agent Accounts</option>
        </select>
        <a href="/index.html" class="nav-btn">📊 Loan Cases</a>
        <a href="/admin/analytics" class="nav-btn active">📈 Analytics</a>
        <a href="/dd" class="nav-btn">🛠️ Observability / Failures</a>
      </div>
    </header>

    <div class="metrics-grid">
      <div class="metric-card" style="border-left: 4px solid var(--accent);">
        <div class="metric-label">Total Pipeline Value</div>
        <div class="metric-value" id="val-pipeline">₹0 Lacs</div>
        <div class="metric-sub" id="val-total-cases">0 Loan Cases</div>
      </div>
      <div class="metric-card" style="border-left: 4px solid var(--success);">
        <div class="metric-label">Disbursed Volume</div>
        <div class="metric-value" id="val-disbursed">₹0 Lacs</div>
        <div class="metric-sub" id="val-disbursed-cases">0 Disbursed Cases</div>
      </div>
      <div class="metric-card" style="border-left: 4px solid #8b5cf6;">
        <div class="metric-label">Conversion Rate</div>
        <div class="metric-value" id="val-conversion">0%</div>
        <div class="metric-sub">Disbursed / Total Cases</div>
      </div>
      <div class="metric-card" style="border-left: 4px solid var(--warning);">
        <div class="metric-label">Avg Loan Ticket Size</div>
        <div class="metric-value" id="val-avg-size">₹0 Lacs</div>
        <div class="metric-sub">Average per Loan Case</div>
      </div>
      <div class="metric-card" style="border-left: 4px solid #06b6d4;">
        <div class="metric-label">Total Uploaded Docs</div>
        <div class="metric-value" id="val-uploads">0</div>
        <div class="metric-sub">Uploaded Client Documents</div>
      </div>
    </div>

    <div class="analytics-section">
      <div class="panel">
        <div class="panel-title">
          <span>Pipeline Stage Distribution</span>
          <span style="font-size: 0.75rem; font-weight: 500; color: var(--muted-soft);">By Case Count & Value</span>
        </div>
        <div class="bar-list" id="status-bar-list">
          <p style="color: var(--muted); text-align: center; padding: 1rem;">Loading analytics...</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">
          <span>Loan Type Distribution</span>
          <span style="font-size: 0.75rem; font-weight: 500; color: var(--muted-soft);">Product Share</span>
        </div>
        <div class="bar-list" id="product-bar-list">
          <p style="color: var(--muted); text-align: center; padding: 1rem;">Loading analytics...</p>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">
        <span>Recent Platform Activity Stream</span>
        <button class="nav-btn" style="padding: 0.25rem 0.625rem; font-size: 0.75rem;" onclick="loadAnalytics()">Refresh Data</button>
      </div>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="width: 16%">Timestamp</th>
              <th style="width: 15%">Agent Account</th>
              <th style="width: 18%">Contact Person</th>
              <th style="width: 15%">Loan Type</th>
              <th style="width: 14%">Event Category</th>
              <th style="width: 22%">Activity Details</th>
            </tr>
          </thead>
          <tbody id="timeline-body">
            <tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--muted);">Loading stream...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let agentsPopulated = false;

    async function loadAnalytics() {
      try {
        const token = localStorage.getItem("collectrr_auth");
        if (!token) {
          window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.pathname);
          return;
        }
        const agentSel = document.getElementById("agentFilterSelect");
        const selectedAgent = agentSel ? agentSel.value : "all";

        const res = await fetch("/api/admin/analytics?agentId=" + encodeURIComponent(selectedAgent), {
          headers: { "Authorization": token }
        });
        if (res.status === 401) {
          localStorage.removeItem("collectrr_auth");
          window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.pathname);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load analytics data");

        // Populate Agent Filter Dropdown if admin and not yet populated
        if (data.agents && data.agents.length > 0 && !agentsPopulated && agentSel) {
          agentsPopulated = true;
          const currentVal = agentSel.value;
          agentSel.innerHTML = '<option value="all">All Agent Accounts</option>';
          data.agents.forEach(a => {
            const opt = document.createElement("option");
            opt.value = a.id;
            opt.textContent = a.username + " (" + a.role + ")";
            if (a.id === currentVal) opt.selected = true;
            agentSel.appendChild(opt);
          });
        }

        renderMetrics(data.metrics || {});
        renderStatusList(data.statusBreakdown || [], data.metrics.totalCases || 1);
        renderProductList(data.productBreakdown || [], data.metrics.totalCases || 1);
        renderTimeline(data.recentTimeline || []);
      } catch (err) {
        console.error("Error loading analytics:", err);
      }
    }

    function renderMetrics(m) {
      document.getElementById("val-pipeline").textContent = "₹" + (m.totalPipelineValueLacs || 0).toFixed(1) + " Lacs";
      document.getElementById("val-total-cases").textContent = (m.totalCases || 0) + " Active Loan Cases";
      document.getElementById("val-disbursed").textContent = "₹" + (m.disbursedValueLacs || 0).toFixed(1) + " Lacs";
      document.getElementById("val-disbursed-cases").textContent = (m.disbursedCases || 0) + " Disbursed Cases";
      document.getElementById("val-conversion").textContent = (m.conversionRate || 0) + "%";
      document.getElementById("val-avg-size").textContent = "₹" + (m.avgCaseSizeLacs || 0).toFixed(1) + " Lacs";
      document.getElementById("val-uploads").textContent = m.totalUploads || 0;
    }

    const STATUS_MAP = {
      lead: { label: 'Lead', color: '#94a3b8' },
      documents_pending: { label: 'Docs Pending', color: '#f59e0b' },
      ready_for_review: { label: 'Ready for Review', color: '#0284c7' },
      submitted: { label: 'Submitted to Lender', color: '#9333ea' },
      lender_query: { label: 'Lender Query', color: '#ef4444' },
      approved: { label: 'Approved', color: '#059669' },
      disbursed: { label: 'Disbursed', color: '#10b981' },
      closed: { label: 'Closed', color: '#64748b' }
    };

    function renderStatusList(list, total) {
      const container = document.getElementById("status-bar-list");
      if (!list || list.length === 0) {
        container.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 1rem;">No status data available.</p>';
        return;
      }
      container.innerHTML = "";
      list.forEach(st => {
        const info = STATUS_MAP[st.status] || { label: st.status, color: '#64748b' };
        const pct = Math.round((st.count / total) * 100);
        const item = document.createElement("div");
        item.className = "bar-item";
        item.innerHTML = \`
          <div class="bar-meta">
            <span>\${info.label} (\${st.count})</span>
            <span>₹\${(st.value || 0).toFixed(1)} Lacs (\${pct}%)</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: \${pct}%; background-color: \${info.color};"></div>
          </div>
        \`;
        container.appendChild(item);
      });
    }

    function renderProductList(list, total) {
      const container = document.getElementById("product-bar-list");
      if (!list || list.length === 0) {
        container.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 1rem;">No product data available.</p>';
        return;
      }
      container.innerHTML = "";
      list.forEach(pr => {
        const pct = Math.round((pr.count / total) * 100);
        const item = document.createElement("div");
        item.className = "bar-item";
        item.innerHTML = \`
          <div class="bar-meta">
            <span>\${escapeHtml(pr.product)} (\${pr.count})</span>
            <span>₹\${(pr.value || 0).toFixed(1)} Lacs (\${pct}%)</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: \${pct}%; background-color: #2563eb;"></div>
          </div>
        \`;
        container.appendChild(item);
      });
    }

    function renderTimeline(stream) {
      const body = document.getElementById("timeline-body");
      if (!stream || stream.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--muted);">No recent activity stream logged.</td></tr>';
        return;
      }
      body.innerHTML = "";
      stream.forEach(t => {
        let isoStr = t.created_at || "";
        if (isoStr && !isoStr.endsWith("Z") && !isoStr.includes("+")) {
          isoStr = isoStr.replace(" ", "T") + "Z";
        }
        const formattedTime = isoStr ? new Date(isoStr).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }) : "";

        const tr = document.createElement("tr");
        tr.innerHTML = \`
          <td style="color: var(--muted-soft); font-size: 0.75rem;">\${formattedTime}</td>
          <td><span class="tag" style="background: #e0f2fe; color: #0369a1; font-weight: 600;">\${escapeHtml(t.agent_name || 'system')}</span></td>
          <td><strong>\${escapeHtml(t.contact_person || 'System')}</strong></td>
          <td>\${escapeHtml(t.loan_product || '—')}</td>
          <td><span class="tag">\${escapeHtml(t.event_type)}</span></td>
          <td>\${escapeHtml(t.content)}</td>
        \`;
        body.appendChild(tr);
      });
    }

    function escapeHtml(str) {
      return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        window.location.href = "/admin/analytics";
      } else if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        window.location.href = "/index.html";
      }
    });

    window.onload = loadAnalytics;
  </script>
</body>
</html>
  `;
  return c.html(html);
}

// Render HTML Failure Dashboard directly
export async function handleGetAdminDashboard(c) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collectrr - Failures & Observability Dashboard</title>
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
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Outfit', sans-serif; background-color: var(--bg); color: var(--text); min-height: 100vh; padding: 2rem; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; border-bottom: 1px solid var(--panel-border); padding-bottom: 1.5rem; }
    h1 { font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem; }
    .btn { font-family: inherit; font-size: 0.875rem; font-weight: 500; padding: 0.625rem 1.25rem; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; }
    .btn-primary { background-color: var(--primary); color: white; }
    .btn-danger { background-color: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
    .card { background-color: var(--panel); border: 1px solid var(--panel-border); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; }
    .card-label { font-size: 0.875rem; font-weight: 500; color: var(--text-muted); margin-bottom: 0.5rem; }
    .card-val { font-size: 2.25rem; font-weight: 700; }
    .logs-panel { background-color: var(--panel); border: 1px solid var(--panel-border); border-radius: 16px; overflow: hidden; }
    .panel-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--panel-border); display: flex; justify-content: space-between; align-items: center; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; }
    th { background-color: rgba(255, 255, 255, 0.02); padding: 1rem 1.5rem; font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--panel-border); }
    td { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--panel-border); vertical-align: top; }
    .badge { display: inline-flex; align-items: center; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-error { background-color: var(--red-bg); color: var(--red); }
    .badge-warning { background-color: var(--yellow-bg); color: var(--yellow); }
    .code-block { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; background-color: rgba(0, 0, 0, 0.3); padding: 0.75rem; border-radius: 6px; color: #e5e7eb; max-height: 150px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Collectrr System Failures</h1>
        <div class="subtitle">Real-time observability & failure logs for Loan Cases</div>
      </div>
      <div style="display: flex; gap: 1rem;">
        <a href="/index.html" class="btn btn-primary" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">📁 Loan Cases</a>
        <a href="/admin/analytics" class="btn btn-primary">📈 Platform Analytics</a>
        <button class="btn btn-primary" onclick="loadFailures()">Refresh Logs</button>
        <button class="btn btn-danger" onclick="clearAll()">Clear All Logs</button>
      </div>
    </header>

    <div class="summary-grid">
      <div class="card">
        <div class="card-label">Total Errors</div>
        <div class="card-val" id="count-total">0</div>
      </div>
      <div class="card" style="border-left: 3px solid var(--red);">
        <div class="card-label">WhatsApp Failures</div>
        <div class="card-val" id="count-whatsapp">0</div>
      </div>
      <div class="card" style="border-left: 3px solid var(--yellow);">
        <div class="card-label">OCR Anomalies</div>
        <div class="card-val" id="count-ocr">0</div>
      </div>
    </div>

    <div class="logs-panel">
      <div class="panel-header">
        <div class="panel-title">Active Failures</div>
        <span id="log-status" style="font-size: 0.75rem; color: var(--text-muted);">Updated just now</span>
      </div>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="width: 15%">Timestamp</th>
              <th style="width: 15%">Category</th>
              <th style="width: 20%">Case Contact</th>
              <th style="width: 40%">Error Details</th>
              <th style="width: 10%; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody id="logs-body">
            <tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    async function loadFailures() {
      document.getElementById("log-status").textContent = "Refreshing...";
      try {
        const token = localStorage.getItem("collectrr_auth");
        if (!token) {
          window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.pathname);
          return;
        }
        const res = await fetch("/api/admin/failures", {
          headers: { "Authorization": token }
        });
        if (res.status === 401) {
          localStorage.removeItem("collectrr_auth");
          window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.pathname);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        renderLogs(data.failures || []);
      } catch (err) {
        alert("Error loading logs: " + err.message);
      }
    }

    function renderLogs(failures) {
      document.getElementById("count-total").textContent = failures.length;
      document.getElementById("count-whatsapp").textContent = failures.filter(f => f.error_type === "whatsapp_delivery").length;
      document.getElementById("count-ocr").textContent = failures.filter(f => f.error_type.startsWith("ocr")).length;
      
      const body = document.getElementById("logs-body");
      if (failures.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #9ca3af;">No system failures logged. Systems operational.</td></tr>';
        document.getElementById("log-status").textContent = "No active issues";
        return;
      }

      body.innerHTML = "";
      failures.forEach(f => {
        const tr = document.createElement("tr");
        tr.innerHTML = \`
          <td style="color: #9ca3af;">\${new Date(f.created_at).toLocaleString()}</td>
          <td><span class="badge \${f.error_type === 'whatsapp_delivery' ? 'badge-error' : 'badge-warning'}">\${f.error_type}</span></td>
          <td>\${f.case_contact ? f.case_contact + '<br><small style="color:#9ca3af">' + (f.case_phone||'') + '</small>' : '<em style="color:#9ca3af">System</em>'}</td>
          <td><pre class="code-block">\${escapeHtml(f.details)}</pre></td>
          <td style="text-align: right;"><button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteFailure('\${f.id}')">Resolve</button></td>
        \`;
        body.appendChild(tr);
      });
      document.getElementById("log-status").textContent = "Last updated: " + new Date().toLocaleTimeString();
    }

    async function deleteFailure(id) {
      if (!confirm("Resolve & delete log?")) return;
      const token = localStorage.getItem("collectrr_auth");
      await fetch(\`/api/admin/failures/\${id}\`, { method: "DELETE", headers: { "Authorization": token || "" } });
      loadFailures();
    }

    async function clearAll() {
      if (!confirm("Clear all failure logs?")) return;
      const token = localStorage.getItem("collectrr_auth");
      await fetch("/api/admin/failures", { method: "DELETE", headers: { "Authorization": token || "" } });
      loadFailures();
    }

    function escapeHtml(str) {
      return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    window.onload = loadFailures;
  </script>
</body>
</html>
  `;
  return c.html(html);
}
