import type { Request, Response, NextFunction } from "express";
import { mongoReady } from "./mongo";

export function requireDatabase(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (mongoReady()) {
    next();
    return;
  }

  res.status(503).json({
    error: process.env.MONGODB_URI
      ? "MongoDB is not reachable. Check the Atlas connection string and network access."
      : "MongoDB is not configured. Add MONGODB_URI in Replit Secrets to enable accounts and persistent job data.",
  });
}

export function handleApiError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err && typeof err === "object" && "code" in err && err.code === 11000) {
    res.status(409).json({ error: "This record already exists." });
    return;
  }
  req.log.error({ err }, "Unhandled API error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
}

export function parseId(value: string | string[] | undefined): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^[a-f\d]{24}$/i.test(id) ? id : null;
}
