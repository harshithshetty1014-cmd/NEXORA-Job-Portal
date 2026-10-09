import { Router, type IRouter } from "express";
import {
  ApplyForJobBody,
  ListJobApplicationsParams,
  UpdateApplicationStatusBody,
  UpdateApplicationStatusParams,
  WithdrawApplicationParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { parseId } from "../lib/errors";
import Application from "../models/Application";
import Job from "../models/Job";
import User from "../models/User";

const router: IRouter = Router();
type PopulatedApplication = {
  _id: unknown;
  jobId: { _id: unknown; title: string; companyId: { name: string } | unknown };
  applicantId: {
    _id: unknown;
    name: string;
    email: string;
    skills?: string[];
    location?: string;
    resumeUrl?: string | null;
  };
  resumeUrl?: string | null;
  coverLetter?: string | null;
  status: string;
  appliedAt: Date;
  updatedAt: Date;
};

function presentApplication(app: PopulatedApplication) {
  const company = app.jobId.companyId && typeof app.jobId.companyId === "object" && "name" in app.jobId.companyId
    ? app.jobId.companyId as { name: string }
    : { name: "Company" };
  return {
    id: String(app._id),
    jobId: String(app.jobId._id),
    jobTitle: app.jobId.title,
    companyName: company.name,
    applicantId: String(app.applicantId._id),
    applicantName: app.applicantId.name,
    applicantEmail: app.applicantId.email,
    applicantSkills: app.applicantId.skills ?? [],
    applicantLocation: app.applicantId.location ?? null,
    resumeUrl: app.resumeUrl ?? app.applicantId.resumeUrl ?? null,
    coverLetter: app.coverLetter ?? null,
    status: app.status,
    appliedAt: new Date(app.appliedAt).toISOString(),
    updatedAt: new Date(app.updatedAt).toISOString(),
  };
}

const applicationPopulate = [
  { path: "jobId", select: "title companyId", populate: { path: "companyId", select: "name" } },
  { path: "applicantId", select: "name email skills location resumeUrl" },
];

router.post("/applications", requireAuth, requireRole("Applicant"), async (req, res): Promise<void> => {
  const parsed = ApplyForJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the application details." });
    return;
  }
  const jobId = parseId(parsed.data.jobId);
  if (!jobId) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }
  const job = await Job.findOne({ _id: jobId, status: "Open" });
  if (!job) {
    res.status(404).json({ error: "This job is no longer open." });
    return;
  }
  if (await Application.exists({ jobId, applicantId: req.user!._id })) {
    res.status(409).json({ error: "You have already applied to this job." });
    return;
  }
  const application = await Application.create({
    jobId,
    applicantId: req.user!._id,
    resumeUrl: parsed.data.resumeUrl || req.user!.resumeUrl || null,
    coverLetter: parsed.data.coverLetter ?? "",
  });
  const populated = await Application.findById(application._id).populate(applicationPopulate).lean();
  res.status(201).json(presentApplication(populated as unknown as PopulatedApplication));
});

router.get("/applications/me", requireAuth, requireRole("Applicant"), async (req, res): Promise<void> => {
  const applications = await Application.find({ applicantId: req.user!._id })
    .populate(applicationPopulate)
    .sort({ appliedAt: -1 })
    .lean();
  res.json(applications.map((app) => presentApplication(app as unknown as PopulatedApplication)));
});

router.get("/jobs/:id/applications", requireAuth, requireRole("Recruiter"), async (req, res): Promise<void> => {
  const parsed = ListJobApplicationsParams.safeParse(req.params);
  const jobId = parsed.success ? parseId(parsed.data.id) : null;
  if (!jobId) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }
  const ownedJob = await Job.exists({ _id: jobId, recruiterId: req.user!._id });
  if (!ownedJob) {
    res.status(404).json({ error: "Job not found or you do not own this listing." });
    return;
  }
  const applications = await Application.find({ jobId }).populate(applicationPopulate).sort({ appliedAt: -1 }).lean();
  res.json(applications.map((app) => presentApplication(app as unknown as PopulatedApplication)));
});

router.patch("/applications/:id/status", requireAuth, requireRole("Recruiter"), async (req, res): Promise<void> => {
  const params = UpdateApplicationStatusParams.safeParse(req.params);
  const applicationId = params.success ? parseId(params.data.id) : null;
  if (!applicationId) {
    res.status(400).json({ error: "Invalid application id." });
    return;
  }
  const parsed = UpdateApplicationStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Choose a valid application status." });
    return;
  }
  const application = await Application.findById(applicationId).populate({ path: "jobId", select: "title companyId recruiterId", populate: { path: "companyId", select: "name" } });
  const job = application?.jobId as unknown as { recruiterId: unknown } | undefined;
  if (!application || !job || String(job.recruiterId) !== String(req.user!._id)) {
    res.status(404).json({ error: "Application not found for one of your jobs." });
    return;
  }
  application.status = parsed.data.status;
  await application.save();
  const populated = await Application.findById(application._id).populate(applicationPopulate).lean();
  res.json(presentApplication(populated as unknown as PopulatedApplication));
});

router.patch("/applications/:id/withdraw", requireAuth, requireRole("Applicant"), async (req, res): Promise<void> => {
  const params = WithdrawApplicationParams.safeParse(req.params);
  const applicationId = params.success ? parseId(params.data.id) : null;
  if (!applicationId) {
    res.status(400).json({ error: "Invalid application id." });
    return;
  }
  const application = await Application.findOne({ _id: applicationId, applicantId: req.user!._id });
  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }
  if (!["Submitted", "Reviewing"].includes(application.status)) {
    res.status(409).json({ error: "This application can no longer be withdrawn." });
    return;
  }
  application.status = "Withdrawn";
  await application.save();
  const populated = await Application.findById(application._id).populate(applicationPopulate).lean();
  res.json(presentApplication(populated as unknown as PopulatedApplication));
});

router.get("/users/me/saved-jobs", requireAuth, requireRole("Applicant"), async (req, res): Promise<void> => {
  const user = await User.findById(req.user!._id).populate({ path: "savedJobs", populate: { path: "companyId", select: "name" } }).lean();
  const jobs = (user?.savedJobs ?? []) as unknown as Array<{
    _id: unknown;
    title: string;
    companyId: { name?: string; _id?: unknown } | unknown;
    recruiterId: unknown;
    description: string;
    requirements: string;
    skills: string[];
    location: string;
    jobType: string;
    experienceLevel: string;
    salaryMin: number;
    salaryMax: number;
    status: "Open" | "Closed";
    createdAt: Date;
  }>;
  res.json(jobs.map((job) => {
    const company = job.companyId && typeof job.companyId === "object" && "name" in job.companyId ? job.companyId as { _id?: unknown; name?: string } : null;
    return {
      id: String(job._id),
      title: job.title,
      companyId: String(company?._id ?? job.companyId),
      companyName: company?.name ?? "Company",
      recruiterId: String(job.recruiterId),
      description: job.description,
      requirements: job.requirements,
      skills: job.skills ?? [],
      location: job.location,
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      status: job.status,
      createdAt: new Date(job.createdAt).toISOString(),
      applicationCount: 0,
    };
  }));
});

router.put("/users/me/saved-jobs/:jobId", requireAuth, requireRole("Applicant"), async (req, res): Promise<void> => {
  const parsed = req.params.jobId;
  const jobId = parseId(parsed);
  if (!jobId || !(await Job.exists({ _id: jobId, status: "Open" }))) {
    res.status(404).json({ error: "Open job not found." });
    return;
  }
  await User.updateOne({ _id: req.user!._id }, { $addToSet: { savedJobs: jobId } });
  res.json({ message: "Job saved." });
});

router.delete("/users/me/saved-jobs/:jobId", requireAuth, requireRole("Applicant"), async (req, res): Promise<void> => {
  const jobId = parseId(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }
  await User.updateOne({ _id: req.user!._id }, { $pull: { savedJobs: jobId } });
  res.json({ message: "Job removed from saved jobs." });
});

export default router;
