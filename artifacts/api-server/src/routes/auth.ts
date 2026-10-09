import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import {
  LoginBody,
  RegisterBody,
  UpdateMeBody,
} from "@workspace/api-zod";
import { requireAuth, issueSession, sessionCookieOptions } from "../middleware/auth";
import User from "../models/User";
import type { UserRecord } from "../models/User";

const router: IRouter = Router();
const publicUser = (user: UserRecord) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  skills: user.skills ?? [],
  location: user.location || null,
  resumeUrl: user.resumeUrl || null,
  companyId: user.companyId ? String(user.companyId) : null,
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the account details." });
    return;
  }
  const { name, email, password, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.exists({ email: normalizedEmail })) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = (await User.create({ name: name.trim(), email: normalizedEmail, passwordHash, role })) as unknown as UserRecord;
  res.cookie("nexora_session", issueSession(String(user._id)), sessionCookieOptions());
  res.status(201).json({ user: publicUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Enter your email and password." });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = (await User.findOne({ email }).select("+passwordHash")) as unknown as (UserRecord & { passwordHash: string }) | null;
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "The email or password is incorrect." });
    return;
  }
  res.cookie("nexora_session", issueSession(String(user._id)), sessionCookieOptions());
  res.json({ user: publicUser(user) });
});

router.post("/auth/logout", (_req, res): void => {
  res.clearCookie("nexora_session", { ...sessionCookieOptions(), maxAge: undefined });
  res.json({ message: "Signed out." });
});

router.get("/auth/me", requireAuth, (req, res): void => {
  res.json(publicUser(req.user!));
});

router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the profile details." });
    return;
  }
  const updated = await User.findByIdAndUpdate(req.user!._id, { $set: parsed.data }, { new: true, runValidators: true }).lean() as unknown as UserRecord | null;
  if (!updated) {
    res.status(404).json({ error: "Account not found." });
    return;
  }
  res.json(publicUser(updated));
});

export default router;
