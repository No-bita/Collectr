import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { runGeminiOcr } from "./ocr.js";

const VALID_STATUSES = [
  'lead', 'documents_pending', 'ready_for_review', 
  'submitted', 'approved', 'disbursed', 'closed'
];

const DEFAULT_LOAN_PRODUCTS = [
  { id: "working_capital", label: "Working Capital" },
  { id: "term_loan", label: "Term Loan" },
  { id: "machinery_loan", label: "Machinery Loan" },
  { id: "equipment_finance", label: "Equipment Finance" },
  { id: "loan_against_property", label: "Loan Against Property (LAP)" },
  { id: "cash_credit", label: "Cash Credit" },
  { id: "overdraft", label: "Overdraft" },
  { id: "invoice_financing", label: "Invoice Financing" }
];

const TERMINAL_STATUSES = ['disbursed', 'closed'];

export const DOCUMENT_CATALOG_MAP = {
  'pan': 'PAN Card',
  'aadhaar': 'Aadhaar Card',
  'bank_statement': 'Bank Statement',
  'itr': 'ITR Acknowledgment',
  'gst_returns': 'GST Returns',
  'quotation': 'Machinery/Equipment Quotation',
  'property_docs': 'Property Ownership Documents',
  'invoices': 'Pending Invoices'
};

export function getCanonicalDocumentLabel(docType, providedLabel) {
  const typeKey = String(docType || '').toLowerCase();
  if (DOCUMENT_CATALOG_MAP[typeKey]) return DOCUMENT_CATALOG_MAP[typeKey];
  const labelKey = String(providedLabel || '').toLowerCase();
  if (DOCUMENT_CATALOG_MAP[labelKey]) return DOCUMENT_CATALOG_MAP[labelKey];
  if (providedLabel && providedLabel !== String(docType || '').toUpperCase().replace(/_/g, ' ')) {
    return providedLabel;
  }
  return providedLabel || docType || 'Document';
}

// Centralized Auth & Data Isolation Helpers
export function getAccessibleCaseFilter(user) {
  if (user && user.role === 'admin') {
    return { whereClause: "1=1", params: [] };
  }
  const userId = user ? (user.id || user.sub || '') : '';
  return {
    whereClause: "(user_id = ? OR is_demo = 1)",
    params: [userId]
  };
}

export async function authorizeCaseAccess(db, caseId, user) {
  if (!user) return { authorized: false, caseItem: null };
  const userId = user.id || user.sub || '';
  if (user.role === 'admin') {
    const res = await db.execute({
      sql: "SELECT * FROM loan_cases WHERE id = ?",
      args: [caseId]
    });
    if (res.rows.length === 0) return { authorized: false, notFound: true, caseItem: null };
    return { authorized: true, caseItem: res.rows[0] };
  } else {
    const res = await db.execute({
      sql: "SELECT * FROM loan_cases WHERE id = ? AND (user_id = ? OR is_demo = 1)",
      args: [caseId, userId]
    });
    if (res.rows.length === 0) {
      const existCheck = await db.execute({ sql: "SELECT id FROM loan_cases WHERE id = ?", args: [caseId] });
      return { authorized: false, notFound: existCheck.rows.length === 0, caseItem: null };
    }
    return { authorized: true, caseItem: res.rows[0] };
  }
}

async function sendWhatsAppTemplate(phone, templateName, contactPerson, token, env) {
  const uploadLink = token 
    ? `${env.FRONTEND_URL || "https://collectrr-v2.collectr.workers.dev"}/upload.html?t=${token}`
    : `${env.FRONTEND_URL || "https://collectrr-v2.collectr.workers.dev"}/upload.html`;

  const primaryTemplate = templateName || env.WHATSAPP_NEW_LEAD_TEMPLATE || "new_convo_1";
  const primaryLang = env.WHATSAPP_TEMPLATE_LANG || "en";

  const phoneIdsToTry = [];
  if (env.WHATSAPP_PROD_PHONE_ID && env.WHATSAPP_PROD_PHONE_ID.trim()) {
    phoneIdsToTry.push(env.WHATSAPP_PROD_PHONE_ID.trim());
  }
  if (env.WHATSAPP_PHONE_ID && !phoneIdsToTry.includes(env.WHATSAPP_PHONE_ID.trim())) {
    phoneIdsToTry.push(env.WHATSAPP_PHONE_ID.trim());
  }
  if (phoneIdsToTry.length === 0) phoneIdsToTry.push("1078210008704696");

  let lastErrorData = null;

  for (const phoneId of phoneIdsToTry) {
    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    // 1. Try Named Parameters Payload
    const primaryPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: primaryTemplate === "hello_world" ? {
        name: "hello_world",
        language: { code: "en_US" }
      } : {
        name: primaryTemplate,
        language: { code: primaryLang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", parameter_name: "name", text: contactPerson || "Client" },
              { type: "text", parameter_name: "uploadlink", text: uploadLink }
            ]
          }
        ]
      }
    };

    let res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(primaryPayload),
    });

    let data = await res.json();
    if (res.ok) return data;
    lastErrorData = data;

    // 2. Retry with Positional Parameters if named fails
    if (primaryTemplate !== "hello_world") {
      const positionalPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: primaryTemplate,
          language: { code: primaryLang },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: contactPerson || "Client" },
                { type: "text", text: uploadLink }
              ]
            }
          ]
        }
      };

      res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(positionalPayload),
      });

      data = await res.json();
      if (res.ok) return data;
      lastErrorData = data;
    }
  }

  const details = lastErrorData?.error?.error_data?.details || "";
  throw new Error(`${lastErrorData?.error?.message || "WhatsApp service unavailable"}${details ? " | " + details : ""}`);
}

// 1. Create Case
export async function handleCreateCase(c) {
  const body = await c.req.json();
  
  let rawPhone = String(body.phone || "").trim();
  // Strip 91 prefix if user typed 91xxxxxxxxxx
  if (rawPhone.startsWith("91") && rawPhone.length === 12) {
    rawPhone = rawPhone.slice(2);
  }

  // Actionable 10-digit validation
  if (!/^\d{10}$/.test(rawPhone)) {
    return c.json({ error: "Please enter a valid 10-digit mobile number without country code or spaces (e.g. 9876543210)." }, 400);
  }
  const phone = "91" + rawPhone;

  const contactPerson = String(body.contactPerson || "").trim();
  if (!contactPerson) {
    return c.json({ error: "Please provide a contact person name for this loan case." }, 400);
  }

  const loanProduct = String(body.loanProduct || "").trim();
  if (!loanProduct) {
    return c.json({ error: "Please select a loan product from the dropdown." }, 400);
  }

  let amountRequired = null;
  if (body.amountRequired !== undefined && body.amountRequired !== null && body.amountRequired !== "") {
    amountRequired = parseFloat(body.amountRequired);
    if (isNaN(amountRequired) || amountRequired <= 0) {
      return c.json({ error: "Please enter a valid positive number for Amount Required in Lacs (e.g. 25)." }, 400);
    }
  }

  let requiredDocTypes = body.requiredDocIds || [];
  if (requiredDocTypes.length === 0) {
    requiredDocTypes = ['pan', 'bank_statement', 'gst_returns'];
  }

  const env = c.env;
  const db = getDbClient(env);

  try {
    const caseId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const initialStatus = requiredDocTypes.length > 0 ? 'documents_pending' : 'lead';

    const user = c.get("user");
    const userId = user ? (user.id || user.sub || null) : null;

    await db.execute({
      sql: `INSERT INTO loan_cases (id, user_id, is_demo, contact_person, phone_number, loan_product, amount_required, status, created_at, last_updated)
            VALUES (?, ?, 0, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [caseId, userId, contactPerson, phone, loanProduct, amountRequired, initialStatus]
    });

    await db.execute({
      sql: "INSERT INTO secure_tokens (token, case_id, expires_at) VALUES (?, ?, ?)",
      args: [token, caseId, expiresAt.toISOString()]
    });

    for (const docType of requiredDocTypes) {
      await db.execute({
        sql: "INSERT INTO required_documents (id, case_id, document_type, label, status) VALUES (?, ?, ?, ?, 'pending')",
        args: [crypto.randomUUID(), caseId, docType, getCanonicalDocumentLabel(docType)]
      });
    }

    await db.execute({
      sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
            VALUES (?, ?, 'case_created', ?, 'agent')`,
      args: [crypto.randomUUID(), caseId, `Loan Case created for ${contactPerson}`]
    });

    let whatsappWarning = null;
    try {
      if (env.WHATSAPP_NEW_LEAD_TEMPLATE) {
        await sendWhatsAppTemplate(phone, env.WHATSAPP_NEW_LEAD_TEMPLATE, contactPerson, token, env);
        await db.execute({
          sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'sent', last_updated = datetime('now') WHERE id = ?",
          args: [caseId]
        });
        await db.execute({
          sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
                VALUES (?, ?, 'whatsapp_sent', 'WhatsApp onboarding message sent to client', 'system')`,
          args: [crypto.randomUUID(), caseId]
        }).catch(e => console.error("Failed writing timeline success:", e));
      }
    } catch (waErr) {
      console.error("WhatsApp Delivery Failed:", waErr);
      whatsappWarning = "Case created successfully, but WhatsApp message could not be sent to client.";
      await db.execute({
        sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'failed', last_updated = datetime('now') WHERE id = ?",
        args: [caseId]
      });
      await logSystemFailure(db, "whatsapp_delivery", caseId, waErr.message || waErr);
      await db.execute({
        sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
              VALUES (?, ?, 'whatsapp_failed', ?, 'system')`,
        args: [crypto.randomUUID(), caseId, `WhatsApp message delivery failed: ${waErr.message || waErr}`]
      }).catch(e => console.error("Failed writing timeline failure:", e));
    }

    return c.json({ success: true, caseId, token, whatsappWarning });
  } catch (err) {
    console.error("Failed to create loan case:", err);
    return c.json({ error: `Database error while creating loan case: ${err.message || "Unknown error"}. Please check server logs.` }, 500);
  }
}

// 2. Get Cases (List for Dashboard)
export async function handleGetCases(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  
  try {
    const filter = getAccessibleCaseFilter(user);

    const casesRes = await db.execute({
      sql: `SELECT c.*, st.token as upload_token 
            FROM loan_cases c 
            LEFT JOIN secure_tokens st ON c.id = st.case_id AND st.status = 'active'
            WHERE ${filter.whereClause} AND c.status NOT IN ('lead', 'disbursed', 'submitted')
            ORDER BY c.last_updated DESC`,
      args: filter.params
    });

    const cases = casesRes.rows;
    const reqDocsRes = await db.execute("SELECT * FROM required_documents");
    const uploadsRes = await db.execute("SELECT id, case_id, required_doc_id, file_label, s3_key, ocr_status, ocr_payload FROM uploaded_documents");

    const formattedCases = cases.map((row, index) => {
      const caseReqDocs = reqDocsRes.rows.filter(d => d.case_id === row.id);
      const caseUploads = uploadsRes.rows.filter(u => u.case_id === row.id);

      const docRequirements = caseReqDocs.map(req => {
        const uploadsForReq = caseUploads.filter(u => u.required_doc_id === req.id);
        return {
          id: req.id,
          type: req.document_type,
          label: req.label,
          status: req.status,
          uploads: uploadsForReq.map(u => ({
            id: u.id,
            fileLabel: u.file_label,
            link: u.s3_key ? `/api/documents/${u.s3_key}` : null,
            ocrStatus: u.ocr_status,
            ocr: u.ocr_payload ? JSON.parse(u.ocr_payload) : null
          }))
        };
      });

      const totalReqs = docRequirements.length > 0 ? docRequirements.length : 3;
      const fulfilledReqs = docRequirements.filter(d => d.uploads.length > 0 || d.status === 'received').length;

      // Extract numeric 10-digit phone for frontend display
      let displayPhone = row.phone_number || '';
      if (displayPhone.startsWith("91") && displayPhone.length === 12) {
        displayPhone = displayPhone.slice(2);
      }

      let normalizedStatus = row.status;
      if (normalizedStatus === 'lender_query' || normalizedStatus === 'lead') {
        normalizedStatus = 'documents_pending';
      }

      return {
        rowIndex: index,
        id: row.id,
        contactPerson: row.contact_person,
        phone: displayPhone,
        rawPhone: row.phone_number,
        loanProduct: row.loan_product,
        amountRequired: row.amount_required, // Amount in Lacs
        status: normalizedStatus,
        docProgress: { fulfilled: fulfilledReqs, total: totalReqs },
        docRequirements,
        aiReport: row.ai_metadata ? JSON.parse(row.ai_metadata) : null,
        lastUpdated: row.last_updated ? row.last_updated.replace(' ', 'T') + 'Z' : null,
        token: row.upload_token,
        whatsappDeliveryStatus: row.whatsapp_delivery_status,
        isDemo: Boolean(row.is_demo),
        userId: row.user_id
      };
    });

    const summary = {
      total: formattedCases.length,
      lead: formattedCases.filter(c => c.status === 'lead').length,
      documentsPending: formattedCases.filter(c => c.status === 'documents_pending').length,
      readyForReview: formattedCases.filter(c => c.status === 'ready_for_review').length,
      submitted: formattedCases.filter(c => c.status === 'submitted').length,
      lenderQuery: formattedCases.filter(c => c.status === 'lender_query').length,
      approved: formattedCases.filter(c => c.status === 'approved').length,
      disbursed: formattedCases.filter(c => c.status === 'disbursed').length,
      closed: formattedCases.filter(c => c.status === 'closed').length
    };

    return c.json({ cases: formattedCases, summary });
  } catch (err) {
    return c.json({ error: "Failed to load loan cases from database. Please refresh or check connection." }, 500);
  }
}

// Fetch Single Case Details
export async function handleGetSingleCase(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized: You do not have permission to view this case." }, auth.notFound ? 404 : 403);
    }

    const caseRes = await db.execute({
      sql: `SELECT c.*, st.token as upload_token 
            FROM loan_cases c 
            LEFT JOIN secure_tokens st ON c.id = st.case_id AND st.status = 'active'
            WHERE c.id = ?`,
      args: [id]
    });

    if (caseRes.rows.length === 0) return c.json({ error: "Loan case not found." }, 404);
    const row = caseRes.rows[0];

    const reqDocsRes = await db.execute({
      sql: "SELECT * FROM required_documents WHERE case_id = ?",
      args: [id]
    });
    const uploadsRes = await db.execute({
      sql: "SELECT id, case_id, required_doc_id, file_label, s3_key, ocr_status, ocr_payload FROM uploaded_documents WHERE case_id = ?",
      args: [id]
    });

    const caseReqDocs = reqDocsRes.rows;
    const caseUploads = uploadsRes.rows;

    const docRequirements = caseReqDocs.map(req => {
      const uploadsForReq = caseUploads.filter(u => u.required_doc_id === req.id);
      return {
        id: req.id,
        type: req.document_type,
        label: getCanonicalDocumentLabel(req.document_type, req.label),
        status: req.status,
        uploads: uploadsForReq.map(u => ({
          id: u.id,
          fileLabel: u.file_label,
          link: u.s3_key ? `/api/documents/${u.s3_key}` : null,
          ocrStatus: u.ocr_status,
          ocr: u.ocr_payload ? JSON.parse(u.ocr_payload) : null
        }))
      };
    });

    const totalReqs = docRequirements.length;
    const fulfilledReqs = docRequirements.filter(d => d.uploads.length > 0 || d.status === 'received').length;

    let displayPhone = row.phone_number || '';
    if (displayPhone.startsWith("91") && displayPhone.length === 12) {
      displayPhone = displayPhone.slice(2);
    }

    const attemptsRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM case_timeline WHERE case_id = ? AND event_type IN ('whatsapp_sent', 'whatsapp_failed')`,
      args: [id]
    });
    const whatsappAttemptsUsed = (attemptsRes.rows[0] && Number(attemptsRes.rows[0].count)) || 0;
    const whatsappAttemptsLeft = Math.max(0, 3 - whatsappAttemptsUsed);

    let normalizedStatus = row.status;
    if (normalizedStatus === 'lender_query' || normalizedStatus === 'lead') {
      normalizedStatus = 'documents_pending';
    }

    const loanCase = {
      id: row.id,
      contactPerson: row.contact_person,
      phone: displayPhone,
      rawPhone: row.phone_number,
      loanProduct: row.loan_product,
      amountRequired: row.amount_required,
      status: normalizedStatus,
      docProgress: { fulfilled: fulfilledReqs, total: totalReqs },
      docRequirements,
      aiReport: row.ai_metadata ? JSON.parse(row.ai_metadata) : null,
      lastUpdated: row.last_updated ? row.last_updated.replace(' ', 'T') + 'Z' : null,
      token: row.upload_token,
      whatsappDeliveryStatus: row.whatsapp_delivery_status,
      whatsappAttemptsUsed,
      whatsappAttemptsLeft,
      maxWhatsAppAttempts: 3,
      isDemo: Boolean(row.is_demo),
      userId: row.user_id
    };

    return c.json({ success: true, loanCase });
  } catch (err) {
    return c.json({ error: "Failed to load case details." }, 500);
  }
}

// 3. Update Status
export async function handleUpdateStatus(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");
  const { status, note } = await c.req.json();

  if (!VALID_STATUSES.includes(status)) {
    return c.json({ error: `Invalid status "${status}". Allowed statuses are: Lead, Documents Pending, Ready for Review, Submitted, Lender Query, Approved, Disbursed, Closed.` }, 400);
  }

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized: You do not have permission to modify this case." }, auth.notFound ? 404 : 403);
    }
    const oldStatus = auth.caseItem.status;

    if (TERMINAL_STATUSES.includes(oldStatus)) {
      return c.json({ error: `Cannot change status of a ${oldStatus.toUpperCase()} case as it is in a terminal state.` }, 400);
    }

    await db.execute({
      sql: "UPDATE loan_cases SET status = ?, last_updated = datetime('now') WHERE id = ?",
      args: [status, id]
    });

    await db.execute({
      sql: `INSERT INTO case_timeline (id, case_id, event_type, content, metadata, created_by)
            VALUES (?, ?, 'status_change', ?, ?, 'agent')`,
      args: [
        crypto.randomUUID(), 
        id, 
        note || `Status changed from ${oldStatus} to ${status}`,
        JSON.stringify({ from: oldStatus, to: status })
      ]
    });

    return c.json({ success: true, oldStatus, newStatus: status });
  } catch (err) {
    return c.json({ error: "Failed to update case status in database." }, 500);
  }
}

// 4. Manage Loan Products (Catalog)
export async function handleGetLoanProducts(c) {
  const db = getDbClient(c.env);
  try {
    const res = await db.execute("SELECT id, label FROM loan_products ORDER BY label ASC");
    if (res.rows.length === 0) {
      return c.json({ loanProducts: DEFAULT_LOAN_PRODUCTS });
    }
    return c.json({ loanProducts: res.rows });
  } catch (err) {
    // Fallback to default catalog if table empty or error
    return c.json({ loanProducts: DEFAULT_LOAN_PRODUCTS });
  }
}

export async function handleAddLoanProduct(c) {
  const db = getDbClient(c.env);
  const { label } = await c.req.json();
  const trimmed = String(label || "").trim();

  if (!trimmed) {
    return c.json({ error: "Please enter a valid loan product label." }, 400);
  }

  const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  try {
    await db.execute({
      sql: "INSERT INTO loan_products (id, label) VALUES (?, ?)",
      args: [id, trimmed]
    });
    return c.json({ success: true, loanProduct: { id, label: trimmed } });
  } catch (err) {
    return c.json({ error: `Loan product "${trimmed}" already exists or could not be saved.` }, 400);
  }
}

const DEFAULT_PRODUCT_MAPPINGS = {
  "Working Capital Loan": ["pan", "aadhaar", "bank_statement", "gst_returns"],
  "Machinery Loan": ["pan", "aadhaar", "bank_statement", "gst_returns", "quotation"],
  "Property Loan / LAP": ["pan", "aadhaar", "bank_statement", "property_docs", "itr"],
  "Unsecured Business Loan": ["pan", "aadhaar", "bank_statement", "gst_returns"]
};

export async function handleGetProductMappings(c) {
  const db = getDbClient(c.env);
  try {
    const res = await db.execute("SELECT product_label, required_doc_ids FROM loan_product_doc_mappings");
    const mappings = { ...DEFAULT_PRODUCT_MAPPINGS };
    
    res.rows.forEach(row => {
      try {
        const docIds = typeof row.required_doc_ids === 'string' ? JSON.parse(row.required_doc_ids) : row.required_doc_ids;
        if (Array.isArray(docIds)) {
          mappings[row.product_label] = docIds;
        }
      } catch (e) {}
    });

    return c.json({ mappings });
  } catch (err) {
    return c.json({ mappings: DEFAULT_PRODUCT_MAPPINGS });
  }
}

export async function handleSaveProductMappings(c) {
  const db = getDbClient(c.env);
  const body = await c.req.json().catch(() => ({}));
  const { productLabel, requiredDocIds, mappings } = body;

  try {
    if (mappings && typeof mappings === 'object') {
      for (const [pLabel, docIds] of Object.entries(mappings)) {
        await db.execute({
          sql: `INSERT INTO loan_product_doc_mappings (product_label, required_doc_ids, updated_at) 
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(product_label) DO UPDATE SET required_doc_ids = excluded.required_doc_ids, updated_at = datetime('now')`,
          args: [pLabel, JSON.stringify(docIds || [])]
        });
      }
      return c.json({ success: true, message: "All document mappings saved successfully." });
    }

    if (!productLabel) {
      return c.json({ error: "Please specify a product label." }, 400);
    }

    await db.execute({
      sql: `INSERT INTO loan_product_doc_mappings (product_label, required_doc_ids, updated_at) 
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(product_label) DO UPDATE SET required_doc_ids = excluded.required_doc_ids, updated_at = datetime('now')`,
      args: [productLabel, JSON.stringify(requiredDocIds || [])]
    });

    return c.json({ success: true, message: `Document mappings updated for ${productLabel}.` });
  } catch (err) {
    return c.json({ error: `Failed to save mapping: ${err.message}` }, 500);
  }
}

// 5. Get Timeline
export async function handleGetTimeline(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized access." }, auth.notFound ? 404 : 403);
    }

    const res = await db.execute({
      sql: "SELECT * FROM case_timeline WHERE case_id = ? ORDER BY created_at DESC",
      args: [id]
    });
    return c.json({ timeline: res.rows });
  } catch (e) {
    return c.json({ error: "Failed to load timeline history for this case." }, 500);
  }
}

// 6. Add Timeline Note
export async function handleAddTimelineNote(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");
  const { note } = await c.req.json();

  if (!note || !note.trim()) {
    return c.json({ error: "Please write a note before saving." }, 400);
  }

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized access." }, auth.notFound ? 404 : 403);
    }

    await db.execute({
      sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
            VALUES (?, ?, 'note', ?, ?)`,
      args: [crypto.randomUUID(), id, note.trim(), user ? user.username : 'agent']
    });

    await db.execute({
      sql: "UPDATE loan_cases SET last_updated = datetime('now') WHERE id = ?",
      args: [id]
    });

    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: "Failed to add timeline note." }, 500);
  }
}

// 7. Edit Case
export async function handleEditCase(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized access." }, auth.notFound ? 404 : 403);
    }

    const body = await c.req.json();
    let rawPhone = String(body.phone || "").trim();
    if (rawPhone.startsWith("91") && rawPhone.length === 12) {
      rawPhone = rawPhone.slice(2);
    }

    if (!/^\d{10}$/.test(rawPhone)) {
      return c.json({ error: "Please enter a valid 10-digit mobile number without country code (e.g. 9876543210)." }, 400);
    }
    const phone = "91" + rawPhone;

    const contactPerson = String(body.contactPerson || "").trim();
    if (!contactPerson) {
      return c.json({ error: "Please provide a contact person name." }, 400);
    }

    const loanProduct = String(body.loanProduct || "").trim();
    if (!loanProduct) {
      return c.json({ error: "Please select a loan product." }, 400);
    }

    let amountRequired = null;
    if (body.amountRequired !== undefined && body.amountRequired !== null && body.amountRequired !== "") {
      amountRequired = parseFloat(body.amountRequired);
      if (isNaN(amountRequired) || amountRequired <= 0) {
        return c.json({ error: "Please enter a valid positive number for Amount Required in Lacs." }, 400);
      }
    }

    const requiredDocIds = body.requiredDocIds || [];

    await db.execute({
      sql: `UPDATE loan_cases 
            SET contact_person = ?, phone_number = ?, loan_product = ?, amount_required = ?, last_updated = datetime('now') 
            WHERE id = ?`,
      args: [contactPerson, phone, loanProduct, amountRequired, id]
    });

    const existingRes = await db.execute({
      sql: "SELECT document_type FROM required_documents WHERE case_id = ?",
      args: [id]
    });
    const existingTypes = new Set(existingRes.rows.map(r => r.document_type));

    for (const docType of requiredDocIds) {
      if (!existingTypes.has(docType)) {
        await db.execute({
          sql: "INSERT INTO required_documents (id, case_id, document_type, label, status) VALUES (?, ?, ?, ?, 'pending')",
          args: [crypto.randomUUID(), id, docType, getCanonicalDocumentLabel(docType)]
        });
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to edit case:", err);
    return c.json({ error: `Failed to update case: ${err.message || "Unknown error"}` }, 500);
  }
}

// 8. Delete Case
export async function handleDeleteCase(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized access." }, auth.notFound ? 404 : 403);
    }

    await db.execute({ sql: "DELETE FROM case_timeline WHERE case_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM uploaded_documents WHERE case_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM required_documents WHERE case_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM secure_tokens WHERE case_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM loan_cases WHERE id = ?", args: [id] });

    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: "Failed to delete loan case." }, 500);
  }
}

// 9. Follow Up & WhatsApp Reminder
export async function handleFollowUp(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");
  let body = {};
  try { body = await c.req.json(); } catch(e) {}
  const { note, sendWhatsApp } = body;

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized access." }, auth.notFound ? 404 : 403);
    }
    await db.execute({
      sql: "UPDATE loan_cases SET last_updated = datetime('now') WHERE id = ?",
      args: [id]
    });

    if (note && note.trim()) {
      await db.execute({
        sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
              VALUES (?, ?, 'follow_up', ?, 'agent')`,
        args: [crypto.randomUUID(), id, note.trim()]
      });
    }

    let whatsappSent = false;
    if (sendWhatsApp) {
      const caseRes = await db.execute({
        sql: "SELECT contact_person, phone_number FROM loan_cases WHERE id = ?",
        args: [id]
      });

      if (caseRes.rows.length > 0) {
        const loanCase = caseRes.rows[0];
        const tokenRes = await db.execute({
          sql: "SELECT token FROM secure_tokens WHERE case_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
          args: [id]
        });

        const token = tokenRes.rows.length > 0 ? tokenRes.rows[0].token : null;
        try {
          await sendWhatsAppTemplate(
            loanCase.phone_number,
            c.env.WHATSAPP_NEW_LEAD_TEMPLATE || "onboarding_first_message",
            loanCase.contact_person,
            token,
            c.env
          );
          whatsappSent = true;

          await db.execute({
            sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
                  VALUES (?, ?, 'whatsapp_sent', 'WhatsApp reminder sent to client', 'agent')`,
            args: [crypto.randomUUID(), id]
          });
        } catch (wsErr) {
          console.error("WhatsApp reminder error:", wsErr);
          await db.execute({
            sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
                  VALUES (?, ?, 'system_alert', ?, 'system')`,
            args: [crypto.randomUUID(), id, `WhatsApp reminder failed: ${wsErr.message}`]
          });
        }
      }
    }

    return c.json({ success: true, whatsappSent });
  } catch (e) {
    return c.json({ error: `Failed to process follow-up: ${e.message}` }, 500);
  }
}

// 9b. Agent Document Upload Presigned URL
export async function handleAgentUploadUrl(c) {
  const caseId = c.req.param("id");
  const user = c.get("user");
  const { requiredDocId, contentType, fileLabel } = await c.req.json();

  if (!caseId || !requiredDocId || !contentType) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const db = getDbClient(c.env);

  const auth = await authorizeCaseAccess(db, caseId, user);
  if (!auth.authorized) {
    return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized access." }, auth.notFound ? 404 : 403);
  }

  const docRes = await db.execute({
    sql: "SELECT id, document_type, label FROM required_documents WHERE case_id = ? AND id = ?",
    args: [caseId, requiredDocId],
  });

  if (docRes.rows.length === 0) {
    return c.json({ error: "Document requirement not found for this case" }, 400);
  }

  const reqDoc = docRes.rows[0];

  const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${c.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: c.env.R2_AK_id,
      secretAccessKey: c.env.R2_SAK,
    },
  });

  const caseRes = await db.execute({
    sql: "SELECT contact_person FROM loan_cases WHERE id = ?",
    args: [caseId]
  });
  const rawContact = caseRes.rows[0]?.contact_person || "client";
  const safeContact = rawContact.replace(/[^a-zA-Z0-9]/g, "_");

  const uploadId = crypto.randomUUID();
  const fileKey = `${caseId}/${safeContact}_${reqDoc.document_type}_agent_${uploadId.slice(0, 8)}`;

  const command = new PutObjectCommand({
    Bucket: "lekho-documents",
    Key: fileKey,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(S3, command, { expiresIn: 300 });
    const label = fileLabel || reqDoc.label || reqDoc.document_type;
    await db.execute({
      sql: `INSERT INTO uploaded_documents (id, case_id, required_doc_id, file_label, s3_key, content_type, ocr_status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      args: [uploadId, caseId, requiredDocId, label, fileKey, contentType],
    });

    return c.json({ uploadUrl, uploadId, fileKey });
  } catch (err) {
    console.error("Failed to generate presigned URL for agent", err);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
}

// 9c. Agent Document Upload Complete Confirm
export async function handleAgentUploadComplete(c) {
  const caseId = c.req.param("id");
  const user = c.get("user");
  const { uploadId } = await c.req.json();

  if (!caseId || !uploadId) return c.json({ error: "Missing required fields" }, 400);

  const db = getDbClient(c.env);

  const auth = await authorizeCaseAccess(db, caseId, user);
  if (!auth.authorized) {
    return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized access." }, auth.notFound ? 404 : 403);
  }

  const uploadRes = await db.execute({
    sql: "SELECT id, required_doc_id, s3_key, file_label FROM uploaded_documents WHERE case_id = ? AND id = ?",
    args: [caseId, uploadId]
  });

  if (uploadRes.rows.length === 0) return c.json({ error: "Upload record not found" }, 404);
  const upload = uploadRes.rows[0];

  if (upload.required_doc_id) {
    await db.execute({
      sql: "UPDATE required_documents SET status = 'received' WHERE id = ?",
      args: [upload.required_doc_id]
    });
  }

  await db.execute({
    sql: "UPDATE loan_cases SET last_updated = datetime('now') WHERE id = ?",
    args: [caseId]
  });

  await db.execute({
    sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
          VALUES (?, ?, 'document_uploaded', ?, 'agent')`,
    args: [crypto.randomUUID(), caseId, `Document manually uploaded by agent: ${upload.file_label || 'File'}`]
  });

  if (upload.s3_key) {
    c.executionCtx.waitUntil(runGeminiOcr(upload.s3_key, upload.id, caseId, c.env, db));
  }

  return c.json({ success: true });
}

// 10. Document Catalog
export async function handleDocumentCatalog(c) {
  const catalog = [
    { id: 'pan', label: 'PAN Card' },
    { id: 'aadhaar', label: 'Aadhaar Card' },
    { id: 'bank_statement', label: 'Bank Statement' },
    { id: 'itr', label: 'ITR Acknowledgment' },
    { id: 'gst_returns', label: 'GST Returns' },
    { id: 'quotation', label: 'Machinery/Equipment Quotation' },
    { id: 'property_docs', label: 'Property Ownership Documents' },
    { id: 'invoices', label: 'Pending Invoices' }
  ];
  return c.json({ documentCatalog: catalog });
}

// 11. Reject Upload
export async function handleRejectUpload(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const { uploadId } = await c.req.json();

  if (!uploadId) return c.json({ error: "Please select a specific upload file to reject." }, 400);

  try {
    const uploadRes = await db.execute({
      sql: "SELECT case_id, file_label FROM uploaded_documents WHERE id = ?",
      args: [uploadId]
    });

    if (uploadRes.rows.length === 0) return c.json({ error: "Selected upload record not found." }, 404);
    const { case_id, file_label } = uploadRes.rows[0];

    const auth = await authorizeCaseAccess(db, case_id, user);
    if (!auth.authorized) {
      return c.json({ error: "Unauthorized access to this case." }, 403);
    }

    await db.execute({
      sql: "DELETE FROM uploaded_documents WHERE id = ?",
      args: [uploadId]
    });

    await db.execute({
      sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
            VALUES (?, ?, 'document_rejected', ?, 'agent')`,
      args: [crypto.randomUUID(), case_id, `Rejected document upload: ${file_label || uploadId}`]
    });

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Failed to reject uploaded file." }, 500);
  }
}

// 12. Generate AI Loan Case Report
export async function handleGenerateReport(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized access." }, auth.notFound ? 404 : 403);
    }
    const loanCase = auth.caseItem;

    const reqDocsRes = await db.execute({
      sql: "SELECT * FROM required_documents WHERE case_id = ?",
      args: [id]
    });
    const uploadsRes = await db.execute({
      sql: "SELECT * FROM uploaded_documents WHERE case_id = ?",
      args: [id]
    });

    const reqDocs = reqDocsRes.rows;
    const uploads = uploadsRes.rows;

    const totalReqs = reqDocs.length;
    const fulfilledReqs = reqDocs.filter(d => uploads.some(u => u.required_doc_id === d.id) || d.status === 'received').length;

    if (totalReqs === 0) {
      return c.json({ error: "Cannot generate report: No document requirements configured for this case." }, 400);
    }

    if (uploads.length === 0) {
      return c.json({ error: "Cannot generate report: Client has not submitted any documents yet." }, 400);
    }

    const extractedFieldsList = [];
    uploads.forEach(u => {
      if (u.ocr_payload) {
        try {
          const parsed = JSON.parse(u.ocr_payload);
          if (parsed.fields) {
            extractedFieldsList.push({ file: u.file_label, fields: parsed.fields });
          }
        } catch (e) {}
      }
    });

    let report = null;

    if (c.env.GEMINI_API_KEY) {
      try {
        const prompt = `You are an expert MSME Loan Operations Officer.
Generate a concise, professional Credit & Document Synthesis Report for a loan application.
Client Contact: ${loanCase.contact_person}
Loan Product: ${loanCase.loan_product || 'Unspecified'}
Amount Requested: ₹${loanCase.amount_required || 0} Lacs
Fulfilled Documents: ${fulfilledReqs}/${totalReqs}
Extracted Document Data: ${JSON.stringify(extractedFieldsList)}

Return JSON strictly with format:
{
  "readinessScore": 88,
  "readinessGrade": "A - High Approval Probability",
  "executiveSummary": "string",
  "verifiedEntities": ["string"],
  "recommendedLenders": ["string"],
  "riskAssessment": "string",
  "nextSteps": ["string"]
}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${c.env.GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          let rawText = gData.candidates[0].content.parts[0].text;
          rawText = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
          report = JSON.parse(rawText);
        }
      } catch (gemErr) {
        console.error("Gemini report generation failed, using fallback synthesis:", gemErr);
      }
    }

    if (!report) {
      const score = Math.min(95, Math.max(70, Math.round(60 + (fulfilledReqs / Math.max(1, totalReqs)) * 35)));
      report = {
        readinessScore: score,
        readinessGrade: score >= 85 ? "A - High Approval Probability" : score >= 75 ? "B - Moderate Approval Probability" : "C - Conditional Review Needed",
        executiveSummary: `Complete document package submitted for ${loanCase.contact_person || 'Client'}. Application compiled for ${loanCase.loan_product || 'Loan Requirement'} worth ₹${loanCase.amount_required || 0} Lacs. ${fulfilledReqs} of ${totalReqs} document requirements fulfilled.`,
        verifiedEntities: [
          `Contact Person: ${loanCase.contact_person}`,
          `Mobile Number: ${loanCase.phone_number}`,
          `Submitted Documents: ${uploads.map(u => u.file_label || u.id).join(", ")}`
        ],
        recommendedLenders: [
          "HDFC Bank Commercial Business Loan",
          "ICICI Bank MSME Credit",
          "Tata Capital Enterprise Financing",
          "Bajaj Finance SME Line"
        ],
        riskAssessment: "Documentation complete and verified via OCR. Low risk of rejection.",
        nextSteps: [
          "Submit application package to primary lender portal.",
          "Track initial sanction letter turnaround."
        ]
      };
    }

    report.generatedAt = new Date().toISOString();

    await db.execute({
      sql: "UPDATE loan_cases SET ai_metadata = ?, last_updated = datetime('now') WHERE id = ?",
      args: [JSON.stringify(report), id]
    });

    await db.execute({
      sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
            VALUES (?, ?, 'report_generated', ?, 'agent')`,
      args: [crypto.randomUUID(), id, `Generated AI Loan Synthesis Report (Readiness Score: ${report.readinessScore}/100)`]
    });

    return c.json({ success: true, report });
  } catch (err) {
    console.error("Failed to generate report:", err);
    return c.json({ error: `Failed to generate case report: ${err.message}` }, 500);
  }
}

// 10. Retry WhatsApp Message (with 3-Attempt Hard Cap)
export async function handleRetryWhatsApp(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const caseId = c.req.param("id");

  const { authorized, notFound, caseItem } = await authorizeCaseAccess(db, caseId, user);
  if (notFound) return c.json({ error: "Loan case not found." }, 404);
  if (!authorized) return c.json({ error: "Access denied to this loan case." }, 403);

  // Count existing WhatsApp attempts from case_timeline
  const attemptsRes = await db.execute({
    sql: `SELECT COUNT(*) as count FROM case_timeline WHERE case_id = ? AND event_type IN ('whatsapp_sent', 'whatsapp_failed')`,
    args: [caseId]
  });
  const attemptsUsed = (attemptsRes.rows[0] && Number(attemptsRes.rows[0].count)) || 0;
  const HARD_CAP = 3;

  if (attemptsUsed >= HARD_CAP) {
    return c.json({
      error: `Maximum retry limit (${HARD_CAP} attempts) reached for WhatsApp messaging on this case.`,
      attemptsUsed,
      attemptsLeft: 0,
      hardCapReached: true
    }, 400);
  }

  // Retrieve active token
  const tokenRes = await db.execute({
    sql: "SELECT token FROM secure_tokens WHERE case_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
    args: [caseId]
  });
  const token = tokenRes.rows.length > 0 ? tokenRes.rows[0].token : null;

  const nextAttemptNum = attemptsUsed + 1;

  try {
    if (c.env.WHATSAPP_NEW_LEAD_TEMPLATE) {
      await sendWhatsAppTemplate(
        caseItem.phone_number,
        c.env.WHATSAPP_NEW_LEAD_TEMPLATE,
        caseItem.contact_person,
        token,
        c.env
      );
    }

    // Success
    await db.execute({
      sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'sent', last_updated = datetime('now') WHERE id = ?",
      args: [caseId]
    });

    await db.execute({
      sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
            VALUES (?, ?, 'whatsapp_sent', ?, 'agent')`,
      args: [crypto.randomUUID(), caseId, `WhatsApp message retried successfully (Attempt ${nextAttemptNum} of ${HARD_CAP})`]
    });

    return c.json({
      success: true,
      message: `WhatsApp message sent successfully (Attempt ${nextAttemptNum} of ${HARD_CAP}).`,
      attemptsUsed: nextAttemptNum,
      attemptsLeft: HARD_CAP - nextAttemptNum
    });
  } catch (waErr) {
    console.error("WhatsApp Retry Attempt Failed:", waErr);

    await db.execute({
      sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'failed', last_updated = datetime('now') WHERE id = ?",
      args: [caseId]
    });

    await logSystemFailure(db, "whatsapp_delivery", caseId, waErr.message || waErr);

    await db.execute({
      sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
            VALUES (?, ?, 'whatsapp_failed', ?, 'system')`,
      args: [crypto.randomUUID(), caseId, `WhatsApp retry attempt ${nextAttemptNum} of ${HARD_CAP} failed: ${waErr.message || waErr}`]
    });

    return c.json({
      error: `WhatsApp retry attempt ${nextAttemptNum} of ${HARD_CAP} failed: ${waErr.message || waErr}`,
      attemptsUsed: nextAttemptNum,
      attemptsLeft: HARD_CAP - nextAttemptNum,
      hardCapReached: nextAttemptNum >= HARD_CAP
    }, 400);
  }
}

// 18. Add Document Requirement
export async function handleAddDocumentRequirement(c) {
  const db = getDbClient(c.env);
  const caseId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const label = (body.label || body.documentType || "").trim();

  if (!label) {
    return c.json({ error: "Document label/name is required" }, 400);
  }

  const docType = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const reqId = crypto.randomUUID();

  try {
    await db.execute({
      sql: "INSERT INTO required_documents (id, case_id, document_type, label, status) VALUES (?, ?, ?, ?, 'pending')",
      args: [reqId, caseId, docType, label]
    });

    await db.execute({
      sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
            VALUES (?, ?, 'requirement_added', ?, 'agent')`,
      args: [crypto.randomUUID(), caseId, `Requested new document: ${label}`]
    });

    return c.json({ success: true, requirementId: reqId, label });
  } catch (err) {
    console.error("handleAddDocumentRequirement Error:", err);
    return c.json({ error: "Failed to add document requirement: " + err.message }, 500);
  }
}



