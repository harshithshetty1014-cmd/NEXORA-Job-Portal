import { Router, type IRouter } from "express";
import {
  CreateCompanyBody,
  GetCompanyParams,
  UpdateCompanyBody,
  UpdateCompanyParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { parseId } from "../lib/errors";
import Company from "../models/Company";
import Job from "../models/Job";
import User from "../models/User";

const router: IRouter = Router();

async function presentCompany(company: {
  _id: unknown;
  name: string;
  description: string;
  website: string;
  location: string;
  logoUrl?: string | null;
  recruiterId: unknown;
}) {
  return {
    id: String(company._id),
    name: company.name,
    description: company.description,
    website: company.website,
    location: company.location,
    logoUrl: company.logoUrl ?? null,
    recruiterId: String(company.recruiterId),
    openJobs: await Job.countDocuments({ companyId: company._id, status: "Open" }),
  };
}

router.get("/companies", async (_req, res): Promise<void> => {
  const companies = await Company.find().sort({ name: 1 }).lean();
  const withOpenJobs = await Promise.all(companies.map((company) => presentCompany(company)));
  res.json(withOpenJobs);
});

router.post("/companies", requireAuth, requireRole("Recruiter"), async (req, res): Promise<void> => {
  const parsed = CreateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the company details." });
    return;
  }
  if (req.user!.companyId) {
    res.status(409).json({ error: "Your account already has a company profile. Edit it instead." });
    return;
  }
  const company = await Company.create({ ...parsed.data, recruiterId: req.user!._id });
  await User.updateOne({ _id: req.user!._id }, { $set: { companyId: company._id } });
  res.status(201).json(await presentCompany(company));
});

router.get("/companies/:id", async (req, res): Promise<void> => {
  const parsed = GetCompanyParams.safeParse(req.params);
  const id = parsed.success ? parseId(parsed.data.id) : null;
  if (!id) {
    res.status(400).json({ error: "Invalid company id." });
    return;
  }
  const company = await Company.findById(id).lean();
  if (!company) {
    res.status(404).json({ error: "Company not found." });
    return;
  }
  res.json(await presentCompany(company));
});

router.put("/companies/:id", requireAuth, requireRole("Recruiter"), async (req, res): Promise<void> => {
  const params = UpdateCompanyParams.safeParse(req.params);
  const id = params.success ? parseId(params.data.id) : null;
  if (!id) {
    res.status(400).json({ error: "Invalid company id." });
    return;
  }
  const parsed = UpdateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the company details." });
    return;
  }
  const company = await Company.findOneAndUpdate(
    { _id: id, recruiterId: req.user!._id },
    { $set: parsed.data },
    { new: true, runValidators: true },
  ).lean();
  if (!company) {
    res.status(404).json({ error: "Company not found or you do not own this profile." });
    return;
  }
  res.json(await presentCompany(company));
});

export default router;
