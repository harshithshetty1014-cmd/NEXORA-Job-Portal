import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import type { UserRecord } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}

export function issueSession(userId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for authentication");
  return jwt.sign({}, secret, { subject: userId, expiresIn: "7d" });
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.nexora_session as string | undefined;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    const userId = typeof payload === "object" ? payload.sub : undefined;
    if (!userId) {
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }
    const user = (await User.findById(userId).lean()) as UserRecord | null;
    if (!user) {
      res.status(401).json({ error: "Your account is no longer available." });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

export function requireRole(
  ...roles: string[]
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "This action is not available for your account." });
      return;
    }
    next();
  };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}
