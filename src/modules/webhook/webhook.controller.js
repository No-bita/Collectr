import express from "express";
import { config } from "../../config/env.js";
import { handleIncomingWebhook, handleWebhookVerification } from "./webhook.service.js";

export const webhookRouter = express.Router();

webhookRouter.get("/", async (req, res) => {
  const out = await handleWebhookVerification(
    req.query["hub.mode"],
    req.query["hub.verify_token"],
    req.query["hub.challenge"],
    config.VERIFY_TOKEN,
  );
  if (out.status === 200) return res.send(out.body);
  return res.sendStatus(out.status);
});

webhookRouter.post("/", async (req, res) => {
  const out = await handleIncomingWebhook(req.body);
  return res.sendStatus(out.status);
});
