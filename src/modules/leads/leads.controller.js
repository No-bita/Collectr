import express from "express";
import {
  createLead,
  getLeadDocumentCatalogResponse,
  listLeads,
  logFollowUp,
  sendInitFollowUpTemplate,
  updateLead,
} from "./leads.service.js";

export const leadsRouter = express.Router();

leadsRouter.get("/document-catalog", (req, res) => {
  res.json(getLeadDocumentCatalogResponse());
});

leadsRouter.get("/leads", async (req, res) => {
  try {
    const payload = await listLeads();
    res.json(payload);
  } catch (err) {
    console.error("leads:", err);
    res.status(500).json({ error: "Could not load leads." });
  }
});

leadsRouter.post("/leads", async (req, res) => {
  const out = await createLead(req.body);
  if (out.error) return res.status(out.status).json({ error: out.error });
  return res.status(out.status).json(out.payload);
});

leadsRouter.patch("/leads/:rowIndex", async (req, res) => {
  const rowIndex = parseInt(req.params.rowIndex, 10);
  const out = await updateLead(rowIndex, req.body);
  if (out.error) return res.status(out.status).json({ error: out.error });
  return res.status(out.status).json(out.payload);
});

leadsRouter.post("/leads/:rowIndex/follow-up/send-template", async (req, res) => {
  const rowIndex = parseInt(req.params.rowIndex, 10);
  const out = await sendInitFollowUpTemplate(rowIndex);
  if (out.error) return res.status(out.status).json({ error: out.error });
  return res.status(out.status).json(out.payload);
});

leadsRouter.post("/leads/:rowIndex/follow-up", async (req, res) => {
  const rowIndex = parseInt(req.params.rowIndex, 10);
  const out = await logFollowUp(rowIndex, req.body);
  if (out.error) return res.status(out.status).json({ error: out.error });
  return res.status(out.status).json(out.payload);
});
