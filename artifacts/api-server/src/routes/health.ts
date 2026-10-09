import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { mongoReady } from "../lib/mongo";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", (_req, res): void => {
  const ready = mongoReady();
  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    database: ready ? "connected" : process.env.MONGODB_URI ? "unavailable" : "not_configured",
  });
});

export default router;
