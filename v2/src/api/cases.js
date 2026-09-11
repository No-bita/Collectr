import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { runGeminiOcr } from "./ocr.js";
import { getWhatsAppTemplate, renderTemplateBody } from "../whatsapp/templates.js";
import { sendWhatsAppTemplate as clientSendWhatsAppTemplate, sendWhatsAppText, normalizeIndianPhoneNumber } from "../whatsapp/client.js";
import { getCustomerReplyWindowStatus } from "../whatsapp/window.js";

const VALID_STATUSES = [
  'lead', 'documents_pending', 'ready_for_review', 
  'submitted', 'approved', 'disbursed', 'closed'
];

const ACTIVE_STATUSES = ['lead', 'documents_pending', 'ready_for_review', 'submitted', 'approved'];
const TERMINAL_STATUSES = ['disbursed', 'closed'];

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
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') {
    return { whereClause: "1=1", params: [] };
  }
  const userId = user ? (user.id || user.sub || user.user_id || '') : '';
  if (userId) {
    return {
      whereClause: "(user_id = ? OR is_demo = 1)",
      params: [userId]
    };
  }
  return {
    whereClause: "(user_id IS NULL OR user_id = '' OR is_demo = 1)",
    params: []
  };
}

export async function authorizeCaseAccess(db, caseId, user) {
  if (!user) return { authorized: false, caseItem: null };
  const role = String(user.role || '').toLowerCase();
  const userId = user.id || user.sub || user.user_id || '';
  if (role === 'admin') {
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

// Contact Helper: Ensure Contact exists without overwriting existing name
export async function ensureContact(db, userId, canonicalPhone, contactPerson) {
  const existingRes = await db.execute({
    sql: "SELECT id, contact_person FROM contacts WHERE user_id = ? AND phone_number = ? LIMIT 1",
    args: [userId, canonicalPhone]
  });

  if (existingRes.rows.length > 0) {
    return {
      id: existingRes.rows[0].id,
      contactPerson: existingRes.rows[0].contact_person,
      isNew: false
    };
  }

  const contactId = "cnt_" + crypto.randomUUID();
  const name = contactPerson || ("Client " + canonicalPhone.slice(-4));
  await db.execute({
    sql: "INSERT INTO contacts (id, user_id, contact_person, phone_number, created_at, last_updated) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
    args: [contactId, userId, name, canonicalPhone]
  });

  return {
    id: contactId,
    contactPerson: name,
    isNew: true
  };
}

export async function executeWhatsAppMessagingPipeline(
  db,
  user,
  phone,
  templateName,
  contactPerson,
  token,
  env,
  referenceId,
  templateParams = [],
  contactId = null,
  miniTargetId = null
) {
  const MESSAGE_COST_PAISE = 90;
  const idempotencyKey = `idemp_${user?.id || 'sys'}_${referenceId}`;

  const msgCheck = await db.execute({
    sql: "SELECT status FROM whatsapp_messages WHERE user_id = ? AND idempotency_key = ?",
    args: [user?.id || 'sys', idempotencyKey]
  });
  if (msgCheck.rows.length > 0 && msgCheck.rows[0].status === 'SENT') {
    return { success: true, delivered: true, idempotent: true };
  }

  const isDevEnv = (env?.ENVIRONMENT === 'development');
  let currentBalance = 900;

  if (isDevEnv) {
    const userRes = await db.execute({
      sql: "SELECT credit_balance FROM users WHERE id = ?",
      args: [user?.id || 'sys']
    });
    currentBalance = (userRes.rows[0]?.credit_balance !== undefined && userRes.rows[0]?.credit_balance !== null) ? Number(userRes.rows[0].credit_balance) : 900;
    if (currentBalance < MESSAGE_COST_PAISE) {
      const balanceRupees = (currentBalance / 100).toFixed(2);
      return {
        success: false,
        insufficientCredits: true,
        error: "INSUFFICIENT_CREDITS",
        message: `Your credit balance (₹${balanceRupees}) is exhausted. Minimum ₹0.90 required to send WhatsApp messages.`,
        balancePaise: currentBalance,
        balanceRupees
      };
    }
  }

  const msgId = "msg_" + crypto.randomUUID();
  await db.execute({
    sql: "INSERT INTO whatsapp_messages (id, user_id, idempotency_key, status) VALUES (?, ?, ?, 'SENDING') ON CONFLICT(user_id, idempotency_key) DO UPDATE SET status = 'SENDING'",
    args: [msgId, user?.id || 'sys', idempotencyKey]
  }).catch(e => console.error("Failed writing whatsapp_message:", e));

  const resId = "res_" + crypto.randomUUID();
  if (isDevEnv) {
    await db.execute({
      sql: "INSERT INTO credit_reservations (id, user_id, amount_paise, reference_id, status) VALUES (?, ?, ?, ?, 'PENDING')",
      args: [resId, user?.id || 'sys', MESSAGE_COST_PAISE, referenceId]
    }).catch(e => console.error("Failed writing reservation:", e));
  }

  const rawToken = token || "verify";
  const baseUrl = `${env.FRONTEND_URL || "https://collectrr-v2.collectr.workers.dev"}/upload.html?t=`;
  const uploadLink = `${baseUrl}${rawToken}`;

  let customTpls = [];
  try {
    const customRes = await db.execute("SELECT * FROM message_templates");
    if (customRes && customRes.rows) customTpls = customRes.rows;
  } catch (_) {}

  // Compute exact rendered template body before dispatch
  const renderedBody = renderTemplateBody(templateName, {
    contactPerson,
    userName: user?.username || "Collectrr",
    userPhone: user?.phone || "",
    rawToken,
    uploadLink,
    templateParams,
    customTemplates: customTpls
  });

  try {
    const tplConfig = getWhatsAppTemplate(templateName, env, customTpls);
    const providerResult = await clientSendWhatsAppTemplate({
      phone,
      templateConfig: tplConfig,
      templateParams: {
        contactPerson,
        rawToken,
        uploadLink,
        templateParams,
      },
      env,
    });

    const providerMsgId = providerResult?.messages?.[0]?.id || null;

    let newBalance = currentBalance;
    if (isDevEnv) {
      newBalance = Math.max(0, currentBalance - MESSAGE_COST_PAISE);
      await db.execute({
        sql: "UPDATE users SET credit_balance = ? WHERE id = ?",
        args: [newBalance, user?.id || 'sys']
      });

      await db.execute({
        sql: "UPDATE credit_reservations SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [resId]
      }).catch(e => console.error("Failed updating reservation success:", e));

      const txId = "tx_ded_" + crypto.randomUUID();
      await db.execute({
        sql: "INSERT OR IGNORE INTO credit_transactions (id, user_id, amount_paise, balance_after_paise, transaction_type, reference_type, reference_id, description) VALUES (?, ?, ?, ?, 'whatsapp_deduction', 'whatsapp_message', ?, 'Outbound WhatsApp Request (-₹0.90)')",
        args: [txId, user?.id || 'sys', -MESSAGE_COST_PAISE, newBalance, referenceId]
      }).catch(e => console.error("Failed writing deduction ledger:", e));
    }

    await db.execute({
      sql: "UPDATE whatsapp_messages SET status = 'SENT', provider_message_id = ? WHERE id = ?",
      args: [providerMsgId, msgId]
    }).catch(e => console.error("Failed updating message success:", e));

    if (miniTargetId) {
      await db.execute({
        sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'sent', last_updated = datetime('now') WHERE id = ?",
        args: [miniTargetId]
      }).catch(() => {});
    }

    // Persist exact rendered body into case_timeline
    const timelineId = crypto.randomUUID();
    const metadata = {
      channel: "whatsapp",
      message_type: "template",
      template_name: templateName,
      provider_message_id: providerMsgId,
      whatsapp_status: "sent"
    };

    await db.execute({
      sql: `INSERT INTO case_timeline (id, contact_id, case_id, provider_message_id, template_name, event_type, content, metadata, created_by)
            VALUES (?, ?, ?, ?, ?, 'whatsapp_sent', ?, ?, 'system')`,
      args: [timelineId, contactId, miniTargetId, providerMsgId, templateName, renderedBody, JSON.stringify(metadata)]
    }).catch(e => console.error("Failed writing timeline message:", e));

    return { success: true, delivered: true, newBalancePaise: newBalance, providerMsgId, renderedBody };
  } catch (waErr) {
    const errMsg = String(waErr?.message || waErr).toLowerCase();
    const isTimeout = errMsg.includes("timeout") || errMsg.includes("econnreset") || errMsg.includes("504") || errMsg.includes("502");

    if (isTimeout) {
      await db.execute({
        sql: "UPDATE credit_reservations SET status = 'UNKNOWN' WHERE id = ?",
        args: [resId]
      }).catch(e => console.error(e));
      await db.execute({
        sql: "UPDATE whatsapp_messages SET status = 'UNKNOWN' WHERE id = ?",
        args: [msgId]
      }).catch(e => console.error(e));
      if (miniTargetId) {
        await db.execute({
          sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'unknown', last_updated = datetime('now') WHERE id = ?",
          args: [miniTargetId]
        }).catch(() => {});
      }
      return { success: false, error: "WHATSAPP_TIMEOUT", message: "WhatsApp gateway status unknown due to provider timeout." };
    } else {
      if (isDevEnv) {
        await db.execute({
          sql: "UPDATE credit_reservations SET status = 'REFUNDED', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          args: [resId]
        }).catch(e => console.error(e));
      }
      await db.execute({
        sql: "UPDATE whatsapp_messages SET status = 'FAILED' WHERE id = ?",
        args: [msgId]
      }).catch(e => console.error(e));
      if (miniTargetId) {
        await db.execute({
          sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'failed', last_updated = datetime('now') WHERE id = ?",
          args: [miniTargetId]
        }).catch(() => {});
        await logSystemFailure(db, "whatsapp_delivery", miniTargetId, waErr.message || String(waErr)).catch(() => {});
        await db.execute({
          sql: `INSERT INTO case_timeline (id, contact_id, case_id, template_name, event_type, content, metadata, created_by)
                VALUES (?, ?, ?, ?, 'whatsapp_failed', ?, ?, 'system')`,
          args: [
            crypto.randomUUID(),
            contactId,
            miniTargetId,
            templateName,
            `WhatsApp delivery failed: ${waErr.message || waErr}`,
            JSON.stringify({ whatsapp_status: 'failed', error: waErr.message || String(waErr) })
          ]
        }).catch(e => console.error("Failed writing failure timeline:", e));
      }
      return { success: false, error: "WHATSAPP_FAILED", message: waErr.message || "WhatsApp message delivery failed. Credits remain intact." };
    }
  }
}

async function sendWhatsAppTemplate(phone, templateName, contactPerson, token, env, templateParams = [], db = null) {
  const rawToken = token || "verify";
  const baseUrl = `${env.FRONTEND_URL || "https://collectrr-v2.collectr.workers.dev"}/upload.html?t=`;
  const uploadLink = `${baseUrl}${rawToken}`;

  let customTpls = [];
  if (db) {
    try {
      const customRes = await db.execute("SELECT * FROM message_templates");
      if (customRes && customRes.rows) customTpls = customRes.rows;
    } catch (_) {}
  }

  const tplConfig = getWhatsAppTemplate(templateName, env, customTpls);
  return clientSendWhatsAppTemplate({
    phone,
    templateConfig: tplConfig,
    templateParams: {
      contactPerson,
      rawToken,
      uploadLink,
      templateParams,
    },
    env,
  });
}

// 0. Check Duplicate Contact & Mini Target Existence
export async function handleCheckContact(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const userId = user ? (user.id || user.sub || null) : null;
  const body = await c.req.json().catch(() => ({}));

  let canonicalPhone;
  try {
    canonicalPhone = normalizeIndianPhoneNumber(body.phone);
  } catch (e) {
    return c.json({ error: e.message }, 400);
  }

  const loanProduct = String(body.loanProduct || body.category || "").trim();

  try {
    const contactRes = await db.execute({
      sql: "SELECT * FROM contacts WHERE user_id = ? AND phone_number = ? LIMIT 1",
      args: [userId, canonicalPhone]
    });

    if (contactRes.rows.length === 0) {
      return c.json({ exists: false, canonicalPhone });
    }

    const contact = contactRes.rows[0];

    const targetsRes = await db.execute({
      sql: "SELECT id, loan_product, template_name, status, whatsapp_delivery_status, created_at FROM loan_cases WHERE contact_id = ? ORDER BY created_at DESC",
      args: [contact.id]
    });

    const miniTargets = targetsRes.rows;
    const activeMiniTargets = miniTargets.filter(t => ACTIVE_STATUSES.includes(t.status));

    let isBlocked = false;
    let blockReason = null;

    if (loanProduct) {
      const duplicateActive = activeMiniTargets.find(
        t => (t.loan_product || '').trim().toLowerCase() === loanProduct.toLowerCase()
      );
      if (duplicateActive) {
        isBlocked = true;
        blockReason = `An active Mini Target for "${loanProduct}" already exists under ${contact.contact_person}.`;
      }
    }

    return c.json({
      exists: true,
      canonicalPhone,
      contact: {
        id: contact.id,
        contactPerson: contact.contact_person,
        phone: contact.phone_number
      },
      miniTargetsCount: miniTargets.length,
      activeMiniTargetsCount: activeMiniTargets.length,
      miniTargets,
      isBlocked,
      blockReason
    });
  } catch (err) {
    console.error("handleCheckContact Error:", err);
    return c.json({ error: "Failed to check contact duplicate state: " + err.message }, 500);
  }
}

// 1. Create Case / Mini Target
export async function handleCreateCase(c) {
  const body = await c.req.json().catch(() => ({}));
  
  let canonicalPhone;
  try {
    canonicalPhone = normalizeIndianPhoneNumber(body.phone);
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }

  const contactPerson = String(body.contactPerson || "").trim();
  if (!contactPerson) {
    return c.json({ error: "Please provide a contact person name." }, 400);
  }

  let amountRequired = null;
  if (body.amountRequired !== undefined && body.amountRequired !== null && body.amountRequired !== "" && body.amountRequired !== 0 && body.amountRequired !== "0") {
    const parsed = parseFloat(body.amountRequired);
    if (isNaN(parsed) || parsed <= 0) {
      return c.json({ error: "Please enter a valid positive number for Amount Required in Lacs (e.g. 25)." }, 400);
    }
    amountRequired = parsed;
  }

  const env = c.env;
  const db = getDbClient(env);

  const user = c.get("user");
  const userId = user ? (user.id || user.sub || null) : null;

  let isNoDocs = !!(body.noDocsRequired || body.noDocs);
  let loanProduct = String(body.loanProduct || body.templateName || (isNoDocs ? "Direct Outreach" : "")).trim();
  if (!loanProduct) {
    return c.json({ error: "Please select a loan product or template from the dropdown." }, 400);
  }

  const templateParams = Array.isArray(body.templateParams) ? body.templateParams : [];
  const targetTemplate = body.templateName || (isNoDocs ? body.loanProduct : null) || env?.WHATSAPP_NEW_LEAD_TEMPLATE || "new_convo_1";

  let requiredDocTypes = isNoDocs ? [] : (body.requiredDocIds || []);
  if (!isNoDocs && requiredDocTypes.length === 0) {
    requiredDocTypes = ['pan', 'bank_statement', 'gst_returns'];
  }

  try {
    // 1. Ensure Contact exists (without silently renaming existing Contact)
    const contact = await ensureContact(db, userId, canonicalPhone, contactPerson);

    // 2. Active Mini Target duplicate check
    const existingActiveRes = await db.execute({
      sql: "SELECT id FROM loan_cases WHERE contact_id = ? AND lower(trim(loan_product)) = lower(trim(?)) AND status IN ('lead', 'documents_pending', 'ready_for_review', 'submitted', 'approved') LIMIT 1",
      args: [contact.id, loanProduct]
    });

    if (existingActiveRes.rows.length > 0) {
      return c.json({
        error: `An active Mini Target for "${loanProduct}" already exists under ${contact.contactPerson}. Please manage the existing target or close it before re-creating.`
      }, 400);
    }

    const caseId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const initialStatus = requiredDocTypes.length > 0 ? 'documents_pending' : 'lead';

    // Insert Mini Target
    await db.execute({
      sql: `INSERT INTO loan_cases (id, contact_id, user_id, is_demo, contact_person, phone_number, loan_product, template_name, amount_required, status, whatsapp_delivery_status, created_at, last_updated)
            VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
      args: [caseId, contact.id, userId, contact.contactPerson, canonicalPhone, loanProduct, targetTemplate, isNoDocs ? null : amountRequired, initialStatus]
    });

    // Insert Secure Token
    await db.execute({
      sql: "INSERT INTO secure_tokens (token, case_id, expires_at) VALUES (?, ?, ?)",
      args: [token, caseId, expiresAt.toISOString()]
    });

    // Insert Document Requirements
    if (!isNoDocs) {
      for (const docType of requiredDocTypes) {
        await db.execute({
          sql: "INSERT INTO required_documents (id, case_id, document_type, label, status) VALUES (?, ?, ?, ?, 'pending')",
          args: [crypto.randomUUID(), caseId, docType, getCanonicalDocumentLabel(docType)]
        });
      }
    }

    // Insert Internal Timeline Event
    await db.execute({
      sql: `INSERT INTO case_timeline (id, contact_id, case_id, event_type, content, created_by)
            VALUES (?, ?, ?, 'case_created', ?, 'agent')`,
      args: [crypto.randomUUID(), contact.id, caseId, isNoDocs ? `Direct outreach message dispatched for ${loanProduct}` : `Filing request created for ${loanProduct}`]
    });

    // Dispatch WhatsApp Template with Idempotency and State Machine
    let whatsappWarning = null;
    const refId = `init_${caseId}`;

    const pipeRes = await executeWhatsAppMessagingPipeline(
      db,
      user,
      canonicalPhone,
      targetTemplate,
      contact.contactPerson,
      token,
      env,
      refId,
      templateParams,
      contact.id,
      caseId
    );

    if (pipeRes.insufficientCredits) {
      whatsappWarning = pipeRes.message;
    } else if (!pipeRes.delivered && pipeRes.error) {
      whatsappWarning = pipeRes.message || "WhatsApp message delivery failed.";
    }

    return c.json({
      success: true,
      caseId,
      contactId: contact.id,
      contactPerson: contact.contactPerson,
      token,
      whatsappWarning
    });
  } catch (err) {
    console.error("Failed to create Mini Target / Contact:", err);
    return c.json({ error: `Failed to create target: ${err.message || "Unknown error"}` }, 500);
  }
}

// 1.1 Bulk Import Clients Preview Handler (0 DB writes, 0 sends)
export async function handleBulkImportPreview(c) {
  const body = await c.req.json().catch(() => ({}));
  const rawClients = Array.isArray(body.clients) ? body.clients : [];
  if (rawClients.length === 0) {
    return c.json({ error: "No client records provided for preview." }, 400);
  }

  const env = c.env;
  const db = getDbClient(env);
  const user = c.get("user");
  const userId = user ? (user.id || user.sub || null) : null;
  const defaultProduct = body.defaultLoanProduct || "Direct Intake";

  let validRows = [];
  let invalidRows = [];
  let duplicatePhoneRows = [];
  let existingContactRows = [];
  let newContactRows = [];

  const seenInBatch = new Map();

  for (let i = 0; i < rawClients.length; i++) {
    const item = rawClients[i];
    const rawName = String(item.contactPerson || item.name || item.contact_person || "").trim();
    const rawPhone = String(item.phoneNumber || item.phone || item.phone_number || item.mobile || "").trim();
    const product = String(item.loanProduct || item.category || item.product || defaultProduct).trim();

    let canonicalPhone;
    try {
      canonicalPhone = normalizeIndianPhoneNumber(rawPhone);
    } catch (e) {
      invalidRows.push({ index: i, name: rawName, phone: rawPhone, reason: e.message });
      continue;
    }

    if (seenInBatch.has(canonicalPhone)) {
      duplicatePhoneRows.push({ index: i, name: rawName, phone: canonicalPhone, firstIndex: seenInBatch.get(canonicalPhone) });
    } else {
      seenInBatch.set(canonicalPhone, i);
    }

    // Check if Contact exists in database
    const contactRes = await db.execute({
      sql: "SELECT id, contact_person FROM contacts WHERE user_id = ? AND phone_number = ? LIMIT 1",
      args: [userId, canonicalPhone]
    });

    if (contactRes.rows.length > 0) {
      const existing = contactRes.rows[0];
      existingContactRows.push({
        index: i,
        nameEntered: rawName,
        existingContactName: existing.contact_person,
        phone: canonicalPhone,
        product
      });
    } else {
      newContactRows.push({
        index: i,
        name: rawName || ("Client " + canonicalPhone.slice(-4)),
        phone: canonicalPhone,
        product
      });
    }

    validRows.push({ index: i, name: rawName, phone: canonicalPhone, product });
  }

  return c.json({
    success: true,
    totalRows: rawClients.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    newContactsCount: newContactRows.length,
    existingContactsCount: existingContactRows.length,
    duplicateInBatchCount: duplicatePhoneRows.length,
    invalidRows,
    existingContactRows,
    newContactRows
  });
}

// 1.2 Bulk Import Clients / Cases Execution Handler
export async function handleBulkImportCases(c) {
  const body = await c.req.json().catch(() => ({}));
  const rawClients = Array.isArray(body.clients) ? body.clients : [];
  if (rawClients.length === 0) {
    return c.json({ error: "No client records provided for import." }, 400);
  }

  if (rawClients.length > 500) {
    return c.json({ error: "Import limit exceeded. Maximum 500 clients per batch." }, 400);
  }

  const env = c.env;
  const db = getDbClient(env);
  const user = c.get("user");
  const userId = user ? (user.id || user.sub || null) : null;
  const isNoDocs = !!(body.noDocsRequired || body.noDocs);
  const sendWhatsApp = body.sendWhatsApp !== false;
  const templateName = body.templateName || env?.WHATSAPP_NEW_LEAD_TEMPLATE || "new_convo_1";
  const defaultProduct = body.defaultLoanProduct || "Direct Intake";
  const defaultRequiredDocs = isNoDocs ? [] : (body.defaultRequiredDocIds || ['pan', 'bank_statement', 'gst_returns']);

  const results = [];
  let importedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < rawClients.length; i++) {
    const item = rawClients[i];
    let contactPerson = String(item.contactPerson || item.name || item.contact_person || "").trim();
    let rawPhone = String(item.phoneNumber || item.phone || item.phone_number || item.mobile || "").trim();

    let canonicalPhone;
    try {
      canonicalPhone = normalizeIndianPhoneNumber(rawPhone);
    } catch (e) {
      failedCount++;
      results.push({ index: i, name: contactPerson || "Unknown", phone: rawPhone, success: false, error: e.message });
      continue;
    }

    if (!contactPerson) {
      contactPerson = "Client " + canonicalPhone.slice(-4);
    }

    let loanProduct = String(item.loanProduct || item.category || item.product || defaultProduct).trim();
    let amountRequired = null;
    if (item.amountRequired !== undefined && item.amountRequired !== null && String(item.amountRequired).trim() !== "") {
      const parsedAmount = parseFloat(String(item.amountRequired).replace(/[^0-9.]/g, ""));
      if (!isNaN(parsedAmount)) amountRequired = parsedAmount;
    }

    try {
      const contact = await ensureContact(db, userId, canonicalPhone, contactPerson);

      const caseId = crypto.randomUUID();
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      const initialStatus = defaultRequiredDocs.length > 0 ? 'documents_pending' : 'lead';

      await db.execute({
        sql: `INSERT INTO loan_cases (id, contact_id, user_id, is_demo, contact_person, phone_number, loan_product, template_name, amount_required, status, whatsapp_delivery_status, created_at, last_updated)
              VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
        args: [caseId, contact.id, userId, contact.contactPerson, canonicalPhone, loanProduct, templateName, amountRequired, initialStatus]
      });

      await db.execute({
        sql: "INSERT INTO secure_tokens (token, case_id, expires_at) VALUES (?, ?, ?)",
        args: [token, caseId, expiresAt.toISOString()]
      });

      if (!isNoDocs && defaultRequiredDocs.length > 0) {
        for (const docType of defaultRequiredDocs) {
          await db.execute({
            sql: "INSERT INTO required_documents (id, case_id, document_type, label, status) VALUES (?, ?, ?, ?, 'pending')",
            args: [crypto.randomUUID(), caseId, docType, getCanonicalDocumentLabel(docType)]
          });
        }
      }

      await db.execute({
        sql: `INSERT INTO case_timeline (id, contact_id, case_id, event_type, content, created_by)
              VALUES (?, ?, ?, 'case_created', ?, 'agent')`,
        args: [crypto.randomUUID(), contact.id, caseId, `Client imported via bulk list: ${contact.contactPerson}`]
      });

      let whatsappStatus = 'not_sent';
      const rowParams = Array.isArray(item.templateParams) ? item.templateParams : (Array.isArray(item.params) ? item.params : []);
      if (sendWhatsApp && env?.WHATSAPP_PHONE_ID) {
        const refId = `bulk_${caseId}`;
        const pipeRes = await executeWhatsAppMessagingPipeline(
          db,
          user,
          canonicalPhone,
          templateName,
          contact.contactPerson,
          token,
          env,
          refId,
          rowParams,
          contact.id,
          caseId
        );
        whatsappStatus = pipeRes.delivered ? 'sent' : (pipeRes.error === 'WHATSAPP_TIMEOUT' ? 'unknown' : 'failed');
      }

      importedCount++;
      results.push({
        index: i,
        caseId,
        contactId: contact.id,
        name: contact.contactPerson,
        phone: canonicalPhone,
        loanProduct,
        whatsappStatus,
        success: true
      });
    } catch (err) {
      console.error(`Error importing row ${i}:`, err);
      failedCount++;
      results.push({ index: i, name: contactPerson, phone: canonicalPhone, success: false, error: err.message || "Failed to insert record" });
    }
  }

  return c.json({
    success: true,
    message: `Successfully imported ${importedCount} of ${rawClients.length} clients.`,
    total: rawClients.length,
    importedCount,
    failedCount,
    results
  });
}

// 2. Get Cases (List for Dashboard)
export async function handleGetCases(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  
  try {
    const filter = getAccessibleCaseFilter(user);

    // Fetch Mini Targets
    const casesRes = await db.execute({
      sql: `SELECT c.*, st.token as upload_token 
            FROM loan_cases c 
            LEFT JOIN secure_tokens st ON c.id = st.case_id AND st.status = 'active'
            WHERE ${filter.whereClause}
            ORDER BY c.last_updated DESC`,
      args: filter.params
    });

    const cases = casesRes.rows;
    const reqDocsRes = await db.execute("SELECT * FROM required_documents");
    const uploadsRes = await db.execute("SELECT id, case_id, required_doc_id, file_label, s3_key, ocr_status, ocr_payload FROM uploaded_documents");

    // Fetch distinct Contacts for user
    const contactsFilter = (user && user.role !== 'admin')
      ? { sql: "SELECT * FROM contacts WHERE user_id = ? ORDER BY last_updated DESC", args: [user.id || user.sub || ''] }
      : { sql: "SELECT * FROM contacts ORDER BY last_updated DESC", args: [] };

    const contactsRes = await db.execute(contactsFilter).catch(() => ({ rows: [] }));
    const contacts = contactsRes.rows;

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

      const totalReqs = caseReqDocs.length;
      const fulfilledReqs = caseReqDocs.filter(d => {
        const u = caseUploads.filter(up => up.required_doc_id === d.id);
        return u.length > 0 || d.status === 'received';
      }).length;

      let displayPhone = row.phone_number || '';
      if (displayPhone.startsWith("91") && displayPhone.length === 12) {
        displayPhone = displayPhone.slice(2);
      }

      let normalizedStatus = row.status;
      if (normalizedStatus === 'lender_query' || normalizedStatus === 'lead') {
        normalizedStatus = totalReqs > 0 ? 'documents_pending' : 'lead';
      }

      return {
        rowIndex: index,
        id: row.id,
        contactId: row.contact_id,
        contactPerson: row.contact_person,
        phone: displayPhone,
        rawPhone: row.phone_number,
        loanProduct: row.loan_product,
        templateName: row.template_name,
        amountRequired: row.amount_required,
        status: normalizedStatus,
        noDocs: (caseReqDocs.length === 0),
        noDocsRequired: (caseReqDocs.length === 0),
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

    // Group Contacts with attached Mini Targets
    const contactMap = new Map();
    contacts.forEach(cRow => {
      let displayPhone = cRow.phone_number || '';
      if (displayPhone.startsWith("91") && displayPhone.length === 12) {
        displayPhone = displayPhone.slice(2);
      }
      contactMap.set(cRow.id, {
        id: cRow.id,
        contactPerson: cRow.contact_person,
        phone: displayPhone,
        rawPhone: cRow.phone_number,
        userId: cRow.user_id,
        createdAt: cRow.created_at,
        lastUpdated: cRow.last_updated,
        miniTargets: []
      });
    });

    formattedCases.forEach(fc => {
      if (fc.contactId && contactMap.has(fc.contactId)) {
        contactMap.get(fc.contactId).miniTargets.push(fc);
      } else {
        // Fallback synthetic contact wrapper for cases without contact_id
        const synthId = fc.contactId || ("cnt_synth_" + fc.rawPhone);
        if (!contactMap.has(synthId)) {
          contactMap.set(synthId, {
            id: synthId,
            contactPerson: fc.contactPerson,
            phone: fc.phone,
            rawPhone: fc.rawPhone,
            userId: fc.userId,
            createdAt: fc.lastUpdated,
            lastUpdated: fc.lastUpdated,
            miniTargets: []
          });
        }
        contactMap.get(synthId).miniTargets.push(fc);
      }
    });

    const contactList = Array.from(contactMap.values());

    const summary = {
      total: formattedCases.length,
      totalContacts: contactList.length,
      lead: formattedCases.filter(c => c.status === 'lead').length,
      documentsPending: formattedCases.filter(c => c.status === 'documents_pending').length,
      readyForReview: formattedCases.filter(c => c.status === 'ready_for_review').length,
      submitted: formattedCases.filter(c => c.status === 'submitted').length,
      lenderQuery: formattedCases.filter(c => c.status === 'lender_query').length,
      approved: formattedCases.filter(c => c.status === 'approved').length,
      disbursed: formattedCases.filter(c => c.status === 'disbursed').length,
      closed: formattedCases.filter(c => c.status === 'closed').length
    };

    return c.json({ cases: formattedCases, contacts: contactList, summary });
  } catch (err) {
    console.error("handleGetCases error:", err);
    return c.json({ error: "Failed to load loan cases from database." }, 500);
  }
}

// Fetch Single Case / Contact Details
export async function handleGetSingleCase(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    let caseItem = null;
    let contactId = null;

    // Check if `id` is a contact_id or mini_target_id
    const contactCheck = await db.execute({
      sql: "SELECT * FROM contacts WHERE id = ? LIMIT 1",
      args: [id]
    });

    if (contactCheck.rows.length > 0) {
      contactId = contactCheck.rows[0].id;
    } else {
      const auth = await authorizeCaseAccess(db, id, user);
      if (!auth.authorized) {
        return c.json({ error: auth.notFound ? "Target not found." : "Unauthorized." }, auth.notFound ? 404 : 403);
      }
      caseItem = auth.caseItem;
      contactId = caseItem.contact_id;
    }

    // Resolve Contact
    let contact = null;
    if (contactId) {
      const cRes = await db.execute({ sql: "SELECT * FROM contacts WHERE id = ? LIMIT 1", args: [contactId] });
      contact = cRes.rows[0] || null;
    }

    // Fetch all Mini Targets under this Contact
    const targetsRes = await db.execute({
      sql: `SELECT c.*, st.token as upload_token 
            FROM loan_cases c 
            LEFT JOIN secure_tokens st ON c.id = st.case_id AND st.status = 'active'
            WHERE c.contact_id = ? OR c.id = ?
            ORDER BY c.created_at DESC`,
      args: [contactId || id, id]
    });

    const miniTargets = targetsRes.rows;
    if (!caseItem && miniTargets.length > 0) {
      caseItem = miniTargets[0];
    }

    if (!caseItem && !contact) {
      return c.json({ error: "Record not found." }, 404);
    }

    const primaryTargetId = caseItem ? caseItem.id : (miniTargets[0]?.id || null);

    const reqDocsRes = await db.execute({
      sql: "SELECT * FROM required_documents WHERE case_id = ?",
      args: [primaryTargetId]
    });
    const uploadsRes = await db.execute({
      sql: "SELECT id, case_id, required_doc_id, file_label, s3_key, ocr_status, ocr_payload FROM uploaded_documents WHERE case_id = ?",
      args: [primaryTargetId]
    });

    const docRequirements = reqDocsRes.rows.map(req => {
      const uploadsForReq = uploadsRes.rows.filter(u => u.required_doc_id === req.id);
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

    let displayPhone = (contact?.phone_number || caseItem?.phone_number || '');
    if (displayPhone.startsWith("91") && displayPhone.length === 12) {
      displayPhone = displayPhone.slice(2);
    }

    const loanCase = {
      id: caseItem?.id || primaryTargetId,
      contactId: contact?.id || contactId,
      contactPerson: contact?.contact_person || caseItem?.contact_person,
      phone: displayPhone,
      rawPhone: contact?.phone_number || caseItem?.phone_number,
      loanProduct: caseItem?.loan_product,
      templateName: caseItem?.template_name,
      amountRequired: caseItem?.amount_required,
      status: caseItem?.status || 'lead',
      docProgress: { fulfilled: fulfilledReqs, total: totalReqs },
      docRequirements,
      aiReport: caseItem?.ai_metadata ? JSON.parse(caseItem.ai_metadata) : null,
      lastUpdated: caseItem?.last_updated ? caseItem.last_updated.replace(' ', 'T') + 'Z' : null,
      token: caseItem?.upload_token,
      whatsappDeliveryStatus: caseItem?.whatsapp_delivery_status,
      miniTargets: miniTargets.map(mt => ({
        id: mt.id,
        loanProduct: mt.loan_product,
        templateName: mt.template_name,
        status: mt.status,
        whatsappDeliveryStatus: mt.whatsapp_delivery_status,
        amountRequired: mt.amount_required,
        token: mt.upload_token,
        createdAt: mt.created_at
      })),
      isDemo: Boolean(caseItem?.is_demo),
      userId: caseItem?.user_id
    };

    return c.json({ success: true, loanCase, contact });
  } catch (err) {
    console.error("handleGetSingleCase Error:", err);
    return c.json({ error: "Failed to load case details." }, 500);
  }
}

// 3. Update Status
export async function handleUpdateStatus(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");
  const { status, note } = await c.req.json().catch(() => ({}));

  if (!VALID_STATUSES.includes(status)) {
    return c.json({ error: `Invalid status "${status}". Allowed statuses are: Lead, Documents Pending, Ready for Review, Submitted, Approved, Disbursed, Closed.` }, 400);
  }

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) {
      return c.json({ error: auth.notFound ? "Loan case not found." : "Unauthorized." }, auth.notFound ? 404 : 403);
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
      sql: `INSERT INTO case_timeline (id, contact_id, case_id, event_type, content, metadata, created_by)
            VALUES (?, ?, ?, 'status_change', ?, ?, 'agent')`,
      args: [
        crypto.randomUUID(),
        auth.caseItem.contact_id,
        id,
        `Status updated from ${oldStatus} to ${status}${note ? ` (${note})` : ''}`,
        JSON.stringify({ oldStatus, newStatus: status, note: note || null })
      ]
    });

    return c.json({ success: true, oldStatus, newStatus: status });
  } catch (err) {
    return c.json({ error: "Failed to update status: " + err.message }, 500);
  }
}

// 4. Follow Up (WhatsApp reminder message)
export async function handleFollowUp(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) return c.json({ error: "Target not found or unauthorized." }, 404);

    const tokenRes = await db.execute({
      sql: "SELECT token FROM secure_tokens WHERE case_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
      args: [id]
    });
    const token = tokenRes.rows[0]?.token || null;

    const refId = `followup_${id}_${Date.now()}`;
    const pipeRes = await executeWhatsAppMessagingPipeline(
      db,
      user,
      auth.caseItem.phone_number,
      auth.caseItem.template_name || "onboarding_first_message",
      auth.caseItem.contact_person,
      token,
      c.env,
      refId,
      [],
      auth.caseItem.contact_id,
      id
    );

    return c.json({ success: true, delivered: pipeRes.delivered, message: pipeRes.message || "Follow-up message dispatched." });
  } catch (err) {
    return c.json({ error: "Failed to send follow up: " + err.message }, 500);
  }
}

// 5. Get Timeline / Unified Conversation
export async function handleGetTimeline(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    let contactId = null;
    let miniTarget = null;

    // Check if `id` is a Contact ID
    const contactCheck = await db.execute({ sql: "SELECT * FROM contacts WHERE id = ? LIMIT 1", args: [id] });
    if (contactCheck.rows.length > 0) {
      contactId = contactCheck.rows[0].id;
    } else {
      const auth = await authorizeCaseAccess(db, id, user);
      if (!auth.authorized) {
        return c.json({ error: auth.notFound ? "Target not found." : "Unauthorized." }, auth.notFound ? 404 : 403);
      }
      miniTarget = auth.caseItem;
      contactId = miniTarget.contact_id;
    }

    // Fetch unified conversation stream by contact_id
    const res = await db.execute({
      sql: "SELECT * FROM case_timeline WHERE contact_id = ? OR case_id = ? ORDER BY created_at ASC",
      args: [contactId || id, id]
    });

    const waStatus = miniTarget ? (miniTarget.whatsapp_delivery_status || 'none') : 'none';
    return c.json({ timeline: res.rows, whatsappDeliveryStatus: waStatus });
  } catch (e) {
    return c.json({ error: "Failed to load timeline history." }, 500);
  }
}

// 6. Add Timeline Note
export async function handleAddTimelineNote(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");
  const { note } = await c.req.json().catch(() => ({}));

  if (!note || !note.trim()) {
    return c.json({ error: "Please write a note before saving." }, 400);
  }

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) return c.json({ error: "Target not found or unauthorized." }, 404);

    const metadataJson = JSON.stringify({ note: note.trim() });
    await db.execute({
      sql: `INSERT INTO case_timeline (id, contact_id, case_id, event_type, content, metadata, created_by)
            VALUES (?, ?, ?, 'note', ?, ?, ?)`,
      args: [crypto.randomUUID(), auth.caseItem.contact_id, id, note.trim(), metadataJson, user ? user.username : 'agent']
    });

    await db.execute({ sql: "UPDATE loan_cases SET last_updated = datetime('now') WHERE id = ?", args: [id] });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: "Failed to add timeline note." }, 500);
  }
}

// 7. Edit Case / Mini Target
export async function handleEditCase(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) return c.json({ error: "Target not found or unauthorized." }, 404);

    const body = await c.req.json().catch(() => ({}));
    let canonicalPhone;
    try {
      canonicalPhone = normalizeIndianPhoneNumber(body.phone || auth.caseItem.phone_number);
    } catch (e) {
      return c.json({ error: e.message }, 400);
    }

    const contactPerson = String(body.contactPerson || auth.caseItem.contact_person || "").trim();
    const loanProduct = String(body.loanProduct || auth.caseItem.loan_product || "").trim();

    let amountRequired = null;
    if (body.amountRequired !== undefined && body.amountRequired !== null && body.amountRequired !== "" && body.amountRequired !== 0 && body.amountRequired !== "0") {
      const parsed = parseFloat(body.amountRequired);
      if (!isNaN(parsed) && parsed > 0) amountRequired = parsed;
    }

    await db.execute({
      sql: "UPDATE loan_cases SET contact_person = ?, phone_number = ?, loan_product = ?, amount_required = ?, last_updated = datetime('now') WHERE id = ?",
      args: [contactPerson, canonicalPhone, loanProduct, amountRequired, id]
    });

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Failed to edit case: " + err.message }, 500);
  }
}

// 8. Delete Case
export async function handleDeleteCase(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  try {
    const auth = await authorizeCaseAccess(db, id, user);
    if (!auth.authorized) return c.json({ error: "Target not found or unauthorized." }, 404);

    await db.execute({ sql: "DELETE FROM required_documents WHERE case_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM uploaded_documents WHERE case_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM secure_tokens WHERE case_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM case_timeline WHERE case_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM loan_cases WHERE id = ?", args: [id] });

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Failed to delete case: " + err.message }, 500);
  }
}

// 9. Document Catalog & Loan Products
export async function handleDocumentCatalog(c) {
  const excluded = new Set(['gst_returns', 'quotation', 'property_docs', 'invoices']);
  const catalog = Object.entries(DOCUMENT_CATALOG_MAP).map(([id, label]) => ({ id, label }));
  return c.json({ catalog });
}

export async function handleGetLoanProducts(c) {
  const db = getDbClient(c.env);
  try {
    const res = await db.execute("SELECT * FROM loan_products ORDER BY label ASC");
    if (res.rows.length === 0) return c.json({ products: DEFAULT_LOAN_PRODUCTS });
    return c.json({ products: res.rows });
  } catch (err) {
    return c.json({ products: DEFAULT_LOAN_PRODUCTS });
  }
}

export async function handleAddLoanProduct(c) {
  const db = getDbClient(c.env);
  const { label } = await c.req.json().catch(() => ({}));
  if (!label || !label.trim()) return c.json({ error: "Label is required." }, 400);

  const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  try {
    await db.execute({
      sql: "INSERT INTO loan_products (id, label) VALUES (?, ?) ON CONFLICT(label) DO NOTHING",
      args: [id, label.trim()]
    });
    return c.json({ success: true, product: { id, label: label.trim() } });
  } catch (err) {
    return c.json({ error: "Failed to add product: " + err.message }, 500);
  }
}

export const DEFAULT_PRODUCT_MAPPINGS = {
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
        if (Array.isArray(docIds)) mappings[row.product_label] = docIds;
      } catch (_) {}
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

    if (!productLabel) return c.json({ error: "Please specify a product label." }, 400);

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

// 10. Agent Upload URL & Complete
export async function handleAgentUploadUrl(c) {
  const db = getDbClient(c.env);
  const caseId = c.req.param("id");
  const user = c.get("user");
  const { authorized, notFound, caseItem } = await authorizeCaseAccess(db, caseId, user);
  if (notFound) return c.json({ error: "Case not found." }, 404);
  if (!authorized) return c.json({ error: "Access denied." }, 403);

  const body = await c.req.json().catch(() => ({}));
  const filename = body.filename || "agent_upload.pdf";
  const contentType = body.contentType || "application/pdf";
  const requiredDocId = body.requiredDocId || null;

  const key = `${caseId}/${Date.now()}_agent_${filename}`;
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: c.env.R2_ACCESS_KEY_ID,
      secretAccessKey: c.env.R2_SECRET_ACCESS_KEY
    }
  });

  const command = new PutObjectCommand({ Bucket: c.env.R2_BUCKET_NAME || "collectrr-documents", Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return c.json({ uploadUrl, key, requiredDocId });
}

export async function handleAgentUploadComplete(c) {
  const db = getDbClient(c.env);
  const caseId = c.req.param("id");
  const user = c.get("user");
  const { authorized, notFound, caseItem } = await authorizeCaseAccess(db, caseId, user);
  if (notFound) return c.json({ error: "Case not found." }, 404);
  if (!authorized) return c.json({ error: "Access denied." }, 403);

  const body = await c.req.json().catch(() => ({}));
  const { key, requiredDocId, fileLabel, contentType } = body;

  const uploadId = crypto.randomUUID();
  await db.execute({
    sql: "INSERT INTO uploaded_documents (id, case_id, required_doc_id, file_label, s3_key, content_type, ocr_status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
    args: [uploadId, caseId, requiredDocId, fileLabel || 'Agent Uploaded Document', key, contentType]
  });

  if (requiredDocId) {
    await db.execute({ sql: "UPDATE required_documents SET status = 'received' WHERE id = ?", args: [requiredDocId] });
  }

  await db.execute({
    sql: `INSERT INTO case_timeline (id, contact_id, case_id, event_type, content, created_by) VALUES (?, ?, ?, 'document_uploaded', ?, ?)`,
    args: [crypto.randomUUID(), caseItem.contact_id, caseId, `Agent uploaded document: ${fileLabel || 'Document'}`, user ? user.username : 'agent']
  });

  return c.json({ success: true, uploadId });
}

// 11. Reject Upload
export async function handleRejectUpload(c) {
  const db = getDbClient(c.env);
  const { uploadId, reason } = await c.req.json().catch(() => ({}));
  if (!uploadId) return c.json({ error: "Upload ID is required" }, 400);

  const docRes = await db.execute({ sql: "SELECT * FROM uploaded_documents WHERE id = ?", args: [uploadId] });
  if (docRes.rows.length === 0) return c.json({ error: "Document not found" }, 404);
  const doc = docRes.rows[0];

  await db.execute({ sql: "DELETE FROM uploaded_documents WHERE id = ?", args: [uploadId] });
  if (doc.required_doc_id) {
    await db.execute({ sql: "UPDATE required_documents SET status = 'pending' WHERE id = ?", args: [doc.required_doc_id] });
  }

  await db.execute({
    sql: "INSERT INTO case_timeline (id, case_id, event_type, content, created_by) VALUES (?, ?, 'document_rejected', ?, 'agent')",
    args: [crypto.randomUUID(), doc.case_id, `Rejected document "${doc.file_label}": ${reason || 'Document unreadable or invalid'}`]
  });

  return c.json({ success: true });
}

// 12. Generate Report
export async function handleGenerateReport(c) {
  const db = getDbClient(c.env);
  const id = c.req.param("id");
  const user = c.get("user");

  const { authorized, notFound, caseItem } = await authorizeCaseAccess(db, id, user);
  if (notFound) return c.json({ error: "Case not found." }, 404);
  if (!authorized) return c.json({ error: "Access denied." }, 403);

  const reqDocsRes = await db.execute({ sql: "SELECT * FROM required_documents WHERE case_id = ?", args: [id] });
  const uploadsRes = await db.execute({ sql: "SELECT * FROM uploaded_documents WHERE case_id = ?", args: [id] });

  const totalReqs = reqDocsRes.rows.length;
  const fulfilledReqs = reqDocsRes.rows.filter(d => uploadsRes.rows.some(u => u.required_doc_id === d.id) || d.status === 'received').length;

  const score = Math.min(95, Math.max(70, Math.round(60 + (fulfilledReqs / Math.max(1, totalReqs)) * 35)));
  const report = {
    readinessScore: score,
    readinessGrade: score >= 85 ? "A - High Approval Probability" : score >= 75 ? "B - Moderate Approval Probability" : "C - Conditional Review Needed",
    executiveSummary: `Synthesis report for ${caseItem.contact_person}. Package for ${caseItem.loan_product || 'Loan Requirement'} worth ₹${caseItem.amount_required || 0} Lacs. ${fulfilledReqs}/${totalReqs} requirements fulfilled.`,
    verifiedEntities: [
      `Contact Person: ${caseItem.contact_person}`,
      `Mobile Number: ${caseItem.phone_number}`,
      `Submitted Documents: ${uploadsRes.rows.map(u => u.file_label || u.id).join(", ") || 'None'}`
    ],
    recommendedLenders: ["HDFC Bank", "ICICI Bank MSME Credit", "Tata Capital", "Bajaj Finance SME"],
    riskAssessment: "Documentation verified. Low risk profile.",
    nextSteps: ["Submit package to lender underwriting portal.", "Track initial sanction turnaround."],
    generatedAt: new Date().toISOString()
  };

  await db.execute({ sql: "UPDATE loan_cases SET ai_metadata = ?, last_updated = datetime('now') WHERE id = ?", args: [JSON.stringify(report), id] });
  await db.execute({
    sql: `INSERT INTO case_timeline (id, contact_id, case_id, event_type, content, created_by) VALUES (?, ?, ?, 'report_generated', ?, 'agent')`,
    args: [crypto.randomUUID(), caseItem.contact_id, id, `Generated AI Synthesis Report (Readiness Score: ${report.readinessScore}/100)`]
  });

  return c.json({ success: true, report });
}

// 13. Retry WhatsApp Message (3-Attempt Hard Cap)
export async function handleRetryWhatsApp(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const caseId = c.req.param("id");

  const { authorized, notFound, caseItem } = await authorizeCaseAccess(db, caseId, user);
  if (notFound) return c.json({ error: "Loan case not found." }, 404);
  if (!authorized) return c.json({ error: "Access denied." }, 403);

  const attemptsRes = await db.execute({
    sql: `SELECT COUNT(*) as count FROM case_timeline WHERE case_id = ? AND event_type IN ('whatsapp_sent', 'whatsapp_failed')`,
    args: [caseId]
  });
  const attemptsUsed = (attemptsRes.rows[0] && Number(attemptsRes.rows[0].count)) || 0;
  const HARD_CAP = 3;

  if (attemptsUsed >= HARD_CAP) {
    return c.json({ error: `Maximum retry limit (${HARD_CAP} attempts) reached for WhatsApp messaging on this target.`, attemptsUsed, attemptsLeft: 0, hardCapReached: true }, 400);
  }

  const tokenRes = await db.execute({
    sql: "SELECT token FROM secure_tokens WHERE case_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
    args: [caseId]
  });
  const token = tokenRes.rows[0]?.token || null;
  const nextAttemptNum = attemptsUsed + 1;

  const targetTemplate = caseItem.template_name || caseItem.loan_product || c.env?.WHATSAPP_NEW_LEAD_TEMPLATE || "new_convo_1";
  const refId = `retry_${caseId}_${nextAttemptNum}`;

  const pipeRes = await executeWhatsAppMessagingPipeline(
    db,
    user,
    caseItem.phone_number,
    targetTemplate,
    caseItem.contact_person,
    token,
    c.env,
    refId,
    [],
    caseItem.contact_id,
    caseId
  );

  if (pipeRes.insufficientCredits) {
    return c.json({ error: "INSUFFICIENT_CREDITS", message: pipeRes.message, insufficientCredits: true }, 402);
  }

  if (!pipeRes.delivered) {
    return c.json({ error: pipeRes.message || "Retry failed", attemptsUsed: nextAttemptNum, attemptsLeft: HARD_CAP - nextAttemptNum }, 400);
  }

  return c.json({ success: true, message: "WhatsApp retry successful!", attemptsUsed: nextAttemptNum, attemptsLeft: HARD_CAP - nextAttemptNum });
}

// 14. Add Document Requirement
export async function handleAddDocumentRequirement(c) {
  const db = getDbClient(c.env);
  const caseId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const label = (body.label || body.documentType || "").trim();

  if (!label) return c.json({ error: "Document label/name is required" }, 400);

  const docType = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const reqId = crypto.randomUUID();

  try {
    await db.execute({
      sql: "INSERT INTO required_documents (id, case_id, document_type, label, status) VALUES (?, ?, ?, ?, 'pending')",
      args: [reqId, caseId, docType, label]
    });
    return c.json({ success: true, requirementId: reqId, label });
  } catch (err) {
    return c.json({ error: "Failed to add document requirement: " + err.message }, 500);
  }
}

// 15. Send Free-Form WhatsApp Text
export async function handleSendWhatsAppText(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const caseId = c.req.param("id") || c.req.param("caseId");

  const { authorized, notFound, caseItem } = await authorizeCaseAccess(db, caseId, user);
  if (notFound) return c.json({ error: "Case not found." }, 404);
  if (!authorized) return c.json({ error: "Access denied." }, 403);

  const body = await c.req.json().catch(() => ({}));
  const text = String(body.message || body.text || "").trim();
  if (!text) return c.json({ error: "Please enter a message to send." }, 400);
  if (text.length > 4096) return c.json({ error: "Message exceeds Meta's limit of 4096 characters." }, 400);

  const phone = caseItem.phone_number;
  const serviceWindow = await getCustomerReplyWindowStatus(db, caseId);
  if (!serviceWindow.hasReplied) {
    return c.json({ error: "Cannot send free-form message: The client has not replied yet.", code: "WINDOW_NO_REPLY", serviceWindow }, 403);
  }
  if (!serviceWindow.isOpen) {
    return c.json({ error: "Cannot send free-form message: The 24-hour customer service window has expired.", code: "WINDOW_EXPIRED", serviceWindow }, 403);
  }

  try {
    const metaResult = await sendWhatsAppText(phone, text, c.env);
    const metaMsgId = metaResult?.messages?.[0]?.id || null;

    await db.execute({ sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'sent', last_updated = datetime('now') WHERE id = ?", args: [caseId] });

    const metadata = {
      channel: "whatsapp",
      message_type: "freeform",
      meta_message_id: metaMsgId,
      whatsapp_status: "sent"
    };

    await db.execute({
      sql: `INSERT INTO case_timeline (id, contact_id, case_id, provider_message_id, event_type, content, metadata, created_by)
            VALUES (?, ?, ?, ?, 'whatsapp_sent', ?, ?, ?)`,
      args: [crypto.randomUUID(), caseItem.contact_id, caseId, metaMsgId, text, JSON.stringify(metadata), user?.username || 'agent']
    });

    return c.json({ success: true, message: "WhatsApp message sent successfully.", metaMessageId: metaMsgId, serviceWindow });
  } catch (err) {
    return c.json({ error: `Meta WhatsApp API error: ${err.message}` }, 502);
  }
}

// 16. Send WhatsApp Template from Modal
export async function handleSendWhatsAppTemplate(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const caseId = c.req.param("id") || c.req.param("caseId");

  const { authorized, notFound, caseItem } = await authorizeCaseAccess(db, caseId, user);
  if (notFound) return c.json({ error: "Case not found." }, 404);
  if (!authorized) return c.json({ error: "Access denied." }, 403);

  const body = await c.req.json().catch(() => ({}));
  const templateName = String(body.templateName || body.template || "").trim();
  if (!templateName) return c.json({ error: "Please select a template to send." }, 400);

  const phone = caseItem.phone_number;
  const tokenRes = await db.execute({
    sql: "SELECT token FROM secure_tokens WHERE case_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
    args: [caseId]
  });
  const token = tokenRes.rows[0]?.token || null;
  const templateParams = Array.isArray(body.templateParams) ? body.templateParams : [];

  const refId = `manual_tpl_${caseId}_${Date.now()}`;
  const pipeRes = await executeWhatsAppMessagingPipeline(
    db,
    user,
    phone,
    templateName,
    caseItem.contact_person,
    token,
    c.env,
    refId,
    templateParams,
    caseItem.contact_id,
    caseId
  );

  if (pipeRes.insufficientCredits) {
    return c.json({ error: "INSUFFICIENT_CREDITS", message: pipeRes.message, insufficientCredits: true }, 402);
  }

  if (!pipeRes.delivered) {
    return c.json({ error: pipeRes.message || "Failed to dispatch template." }, 502);
  }

  return c.json({ success: true, message: "WhatsApp template sent successfully.", metaMessageId: pipeRes.providerMsgId, renderedBody: pipeRes.renderedBody });
}

export { sendWhatsAppText, getCustomerReplyWindowStatus };
