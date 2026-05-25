import express from "express";
import { documentValidationRouter } from "./modules/document-validation/document-validation.controller.js";
import { leadsRouter } from "./modules/leads/leads.controller.js";
import { webhookRouter } from "./modules/webhook/webhook.controller.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });

  app.use("/api", leadsRouter);
  app.use("/api", documentValidationRouter);
  app.use("/webhook", webhookRouter);
  app.use(express.static("public"));

  return app;
}
