import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth";
import Application from "../models/Application";
import Company from "../models/Company";
import Job from "../models/Job";
import type { ApplicationRecord } from "../models/Application";
import type { UserRecord } from "../models/User";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [openJobs, companies, applications] = await Promise.all([
    Job.countDocuments({ status: "Open" }),
    Company.countDocuments(),
    Application.countDocuments(),
  ]);
  res.json({ openJobs, companies, applications });
});

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const recruiter = user.role === "Recruiter";
  const jobFilter = recruiter ? { recruiterId: user._id } : {};
  const applicationFilter = recruiter
    ? { jobId: { $in: (await Job.find({ recruiterId: user._id }).distinct("_id")) } }
    : { applicantId: user._id };
  const [openJobs, applications, grouped, recent] = await Promise.all([
    Job.countDocuments(recruiter ? { ...jobFilter, status: "Open" } : { status: "Open" }),
    Application.countDocuments(applicationFilter),
    Application.aggregate<{ _id: string; count: number }>([
      { $match: applicationFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Application.find(applicationFilter).populate([
      { path: "jobId", select: "title companyId", populate: { path: "companyId", select: "name" } },
      { path: "applicantId", select: "name email skills location resumeUrl" },
    ]).sort({ appliedAt: -1 }).limit(5).lean(),
  ]);
  const statusCounts = Object.fromEntries(grouped.map((item) => [item._id, item.count]));
  const recentApplications = recent.map((app) => {
    const record = app as unknown as ApplicationRecord & {
      _id: unknown;
      jobId: { _id: unknown; title: string; companyId: { name: string } | unknown };
      applicantId: UserRecord & { _id: unknown; name: string; email: string; skills?: string[]; location?: string; resumeUrl?: string };
    };
    const company = record.jobId.companyId && typeof record.jobId.companyId === "object" && "name" in record.jobId.companyId
      ? record.jobId.companyId as { name: string }
      : { name: "Company" };
    return {
      id: String(record._id),
      jobId: String(record.jobId._id),
      jobTitle: record.jobId.title,
      companyName: company.name,
      applicantId: String(record.applicantId._id),
      applicantName: record.applicantId.name,
      applicantEmail: record.applicantId.email,
      applicantSkills: record.applicantId.skills ?? [],
      applicantLocation: record.applicantId.location ?? null,
      resumeUrl: record.resumeUrl ?? record.applicantId.resumeUrl ?? null,
      coverLetter: record.coverLetter ?? null,
      status: record.status,
      appliedAt: new Date(record.appliedAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  });
  res.json({
    role: user.role,
    openJobs,
    applications,
    shortlisted: statusCounts.Shortlisted ?? 0,
    interviews: statusCounts.Interview ?? 0,
    statusCounts,
    recentApplications,
  });
});

export default router;
