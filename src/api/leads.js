import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";

async function sendWhatsAppMessage(phone, text, env) {
  const url = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("WhatsApp Error:", JSON.stringify(data));
    throw new Error("Failed to send WhatsApp message");
  }
}

async function sendWhatsAppTemplate(phone, templateName, name, token, env) {
  const url = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: name || "Client"
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: token
              }
            ]
          }
        ]
      }
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("WhatsApp Template Error:", JSON.stringify(data));
    throw new Error("Failed to send WhatsApp template message");
  }
}

export async function handleCreateLead(c) {
  const body = await c.req.json();
  let phone = body.phone;
  if (phone && phone.length === 10) {
    phone = "91" + phone;
  }
  const name = body.name || '';
  const requiredDocIds = body.requiredDocIds || [];
  const requiredDocCounts = body.requiredDocCounts || {};
  
  for (const [base, count] of Object.entries(requiredDocCounts)) {
    for (let i = 1; i <= count; i++) {
      requiredDocIds.push(`${base}_${i}`);
    }
  }

  const env = c.env;

  if (!phone || requiredDocIds.length === 0) {
    return c.json({ error: "Phone number and at least one document are required." }, 400);
  }

  try {
    const db = getDbClient(env);

    // Check if phone number already exists
    const existing = await db.execute({
      sql: "SELECT id FROM leads WHERE phone_number = ?",
      args: [phone]
    });
    if (existing.rows.length > 0) {
      return c.json({ error: "A client with this phone number already exists." }, 400);
    }

    const leadId = crypto.randomUUID();
    const token = crypto.randomUUID();
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Schema assumption: We need to alter table if name and firm_name are missing, 
    // but we can just use phone_number for now, or add them.
    // Let's assume we will alter table to add name, needs_follow_up, follow_up_note, last_updated
    await db.execute({
      sql: "INSERT INTO leads (id, phone_number, name, status, created_at, last_updated) VALUES (?, ?, ?, 'In Progress', datetime('now'), datetime('now'))",
      args: [leadId, phone, name]
    });

    await db.execute({
      sql: "INSERT INTO secure_tokens (token, lead_id, expires_at) VALUES (?, ?, ?)",
      args: [token, leadId, expiresAt.toISOString()]
    });

    for (const doc of requiredDocIds) {
      await db.execute({
        sql: "INSERT INTO document_requests (id, lead_id, document_type, status) VALUES (?, ?, ?, 'pending')",
        args: [crypto.randomUUID(), leadId, doc]
      });
    }

    const uploadLink = `${env.FRONTEND_URL}/upload.html?t=${token}`;
    const msg = `Hello ${name}! Your professional has requested documents. Please upload them securely here: ${uploadLink}\n\n*Note: This link expires in 7 days and is locked to your device once clicked.*`;
    
    let whatsappWarning = null;
    try {
      if (env.WHATSAPP_NEW_LEAD_TEMPLATE) {
        await sendWhatsAppTemplate(phone, env.WHATSAPP_NEW_LEAD_TEMPLATE, name, token, env);
      } else {
        await sendWhatsAppMessage(phone, msg, env);
      }
    } catch (waErr) {
      console.error("WhatsApp Delivery Failed:", waErr);
      whatsappWarning = "Lead created, but WhatsApp message could not be sent.";
      await logSystemFailure(db, "whatsapp_delivery", leadId, waErr.message || waErr);
      try {
        await db.execute({
          sql: "UPDATE leads SET whatsapp_delivery_status = 'failed' WHERE id = ?",
          args: [leadId]
        });
      } catch (dbErr) {
        console.error("Failed to update lead whatsapp delivery status in DB:", dbErr);
      }
    }

    return c.json({ success: true, leadId, token, whatsappWarning });
  } catch (err) {
    console.error("Failed to create lead:", err);
    return c.json({ error: "Failed to create request." }, 500);
  }
}

export async function handleGetLeads(c) {
  const db = getDbClient(c.env);
  
  // Fetch all leads with their active tokens
  const leadsRes = await db.execute(`
    SELECT leads.*, secure_tokens.token as upload_token 
    FROM leads 
    LEFT JOIN secure_tokens ON leads.id = secure_tokens.lead_id 
    ORDER BY leads.created_at DESC
  `);
  const leads = leadsRes.rows;

  // Fetch all document requests
  const docsRes = await db.execute("SELECT * FROM document_requests");
  
  // Format to match old app.js expectation
  const formattedLeads = leads.map((row, index) => {
    const leadDocs = docsRes.rows.filter(d => d.lead_id === row.id);
    const requiredDocIds = leadDocs.map(d => d.document_type);
    
    const documentsState = {};
    leadDocs.forEach(d => {
      documentsState[d.document_type] = {
        status: d.status,
        link: d.s3_key ? `/api/documents/${d.s3_key}` : null,
        ocr: d.ocr_payload ? JSON.parse(d.ocr_payload) : null
      };
    });

    // Determine status based on docs
    const allReceived = requiredDocIds.length > 0 && leadDocs.every(d => d.status === 'received');
    const displayStatus = allReceived ? 'Completed' : 'In Progress';

    return {
      rowIndex: index, // Old frontend uses this for identifying rows
      dbId: row.id,
      name: row.name,
      phone: row.phone_number,
      status: displayStatus,
      requiredDocIds,
      documentsState,
      needsFollowUp: row.needs_follow_up === 1,
      followUpNote: row.follow_up_note,
      lastUpdated: row.last_updated ? row.last_updated.replace(' ', 'T') + 'Z' : null,
      token: row.upload_token,
      whatsappDeliveryStatus: row.whatsapp_delivery_status
    };
  });

  const summary = {
    total: formattedLeads.length,
    inProgress: formattedLeads.filter(l => l.status === 'In Progress').length,
    completed: formattedLeads.filter(l => l.status === 'Completed').length,
    followUpDue: formattedLeads.filter(l => l.needsFollowUp).length
  };

  return c.json({ leads: formattedLeads, summary });
}

export async function handleFollowUp(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  try {
    await db.execute({
      sql: "UPDATE leads SET last_updated = datetime('now') WHERE id = ?",
      args: [id]
    });
    return c.json({ success: true });
  } catch(e) {
    return c.json({ error: "Failed to send follow up" }, 500);
  }
}

export async function handleRejectDocument(c) {
  const db = getDbClient(c.env);
  const { leadId, documentId } = await c.req.json();
  
  if (!leadId || !documentId) return c.json({ error: "Missing fields" }, 400);

  try {
    await db.execute({
      sql: "UPDATE document_requests SET status = 'pending', s3_key = NULL, ocr_payload = NULL WHERE lead_id = ? AND document_type = ?",
      args: [leadId, documentId]
    });
    return c.json({ success: true });
  } catch (err) {
    console.error(err);
    return c.json({ error: "Database error" }, 500);
  }
}

export async function handleDocumentCatalog(c) {
  const catalog = [
    { id: 'pan', label: 'PAN Card' },
    { id: 'aadhaar', label: 'Aadhaar Card' },
    { id: 'bank_statement', label: 'Bank Statement (Primary)', allowMultiple: true, maxCount: 12 },
    { id: 'form16', label: 'Form 16' },
    { id: 'itr', label: 'ITR Acknowledgment' }
  ];
  return c.json({ documentCatalog: catalog });
}

export async function handleDeleteLead(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");

  try {
    // Delete documents first
    await db.execute({
      sql: "DELETE FROM document_requests WHERE lead_id = ?",
      args: [id]
    });
    
    // Delete tokens
    await db.execute({
      sql: "DELETE FROM secure_tokens WHERE lead_id = ?",
      args: [id]
    });

    // Delete lead
    await db.execute({
      sql: "DELETE FROM leads WHERE id = ?",
      args: [id]
    });

    return c.json({ success: true });
  } catch (e) {
    console.error("Failed to delete lead:", e);
    return c.json({ error: "Failed to delete lead." }, 500);
  }
}

export async function handleEditLead(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  
  try {
    const body = await c.req.json();
    let { name, phone, requiredDocIds = [], requiredDocCounts = {} } = body;
    
    if (phone && phone.length === 10) phone = "91" + phone;

    const existingDocsRes = await db.execute({
      sql: "SELECT document_type, status FROM document_requests WHERE lead_id = ?",
      args: [id]
    });
    const existingDocs = existingDocsRes.rows;
    
    const incomingBaseTypes = new Set(Object.keys(requiredDocCounts));
    const incomingIds = new Set(requiredDocIds);
    
    for (const doc of existingDocs) {
      const isMulti = doc.document_type.match(/_[0-9]+_[0-9]+$/);
      let isRemoved = false;
      
      if (isMulti) {
        const base = doc.document_type.replace(/_[0-9]+_[0-9]+$/, "");
        if (!incomingBaseTypes.has(base)) {
          isRemoved = true;
        }
      } else {
        if (!incomingIds.has(doc.document_type)) {
          isRemoved = true;
        }
      }
      
      if (isRemoved && doc.status !== 'pending') {
        return c.json({ error: "Cannot remove documents that have already been submitted." }, 400);
      }
    }
    
    await db.execute({
      sql: "UPDATE leads SET name = ?, phone_number = ?, last_updated = datetime('now') WHERE id = ?",
      args: [name, phone, id]
    });
    
    await db.execute({
      sql: "DELETE FROM document_requests WHERE lead_id = ? AND status = 'pending'",
      args: [id]
    });
    
    const currentNonPending = new Set(existingDocs.filter(d => d.status !== 'pending').map(d => d.document_type));
    const docsToInsert = [];
    
    for (const docId of requiredDocIds) {
      if (!currentNonPending.has(docId)) docsToInsert.push(docId);
    }
    
    for (const [base, count] of Object.entries(requiredDocCounts)) {
      for (let i = 1; i <= count; i++) {
        const docId = `${base}_${id}_${i}`;
        if (!currentNonPending.has(docId)) docsToInsert.push(docId);
      }
    }
    
    for (const docId of docsToInsert) {
      await db.execute({
        sql: "INSERT INTO document_requests (id, lead_id, document_type, status) VALUES (?, ?, ?, 'pending')",
        args: [crypto.randomUUID(), id, docId]
      });
    }
    
    return c.json({ success: true });
  } catch(e) {
    console.error("handleEditLead error:", e);
    return c.json({ error: "Failed to update lead" }, 500);
  }
}
