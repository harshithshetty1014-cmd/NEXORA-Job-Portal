import { Router, type IRouter } from "express";
import {
  CreateJobBody,
  DeleteJobParams,
  GetJobParams,
  ListJobsQueryParams,
  UpdateJobBody,
  UpdateJobParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { parseId } from "../lib/errors";
import Application from "../models/Application";
import Company from "../models/Company";
import Job from "../models/Job";

const router: IRouter = Router();

type PopulatedJob = {
  _id: unknown;
  title: string;
  companyId: { _id?: unknown; name?: string } | unknown;
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
  applicationCount?: number;
};

async function presentJob(job: PopulatedJob) {
  const populated = job.companyId && typeof job.companyId === "object" && "name" in job.companyId
    ? job.companyId as { _id?: unknown; name?: string }
    : null;
  const companyId = populated?._id ?? job.companyId;
  return {
    id: String(job._id),
    title: job.title,
    companyId: String(companyId),
    companyName: populated?.name ?? "Company",
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
    applicationCount: job.applicationCount ?? await Application.countDocuments({ jobId: job._id }),
  };
}

router.get("/jobs", async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid search filters." });
    return;
  }
  const { q, location, jobType, experienceLevel, salaryMin, salaryMax, sort, page = 1, limit = 12 } = parsed.data;
  const filter: Record<string, unknown> = { status: "Open" };
  if (q?.trim()) {
    const terms = q.trim().split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const expression = new RegExp(terms.join("|"), "i");
    const companies = await Company.find({ name: expression }).select("_id").lean();
    filter.$or = [
      { title: expression },
      { skills: expression },
      { description: expression },
      { location: expression },
      { companyId: { $in: companies.map((company) => company._id) } },
    ];
  }
  if (location?.trim()) filter.location = new RegExp(location.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (jobType) filter.jobType = jobType;
  if (experienceLevel) filter.experienceLevel = experienceLevel;
  if (salaryMin !== undefined) filter.salaryMax = { $gte: salaryMin };
  if (salaryMax !== undefined) {
    filter.salaryMin = { $lte: salaryMax };
  }

  const pageNumber = Math.max(1, page);
  const pageSize = Math.min(50, Math.max(1, limit));
  const sortBy: Record<string, 1 | -1> =
    sort === "salary" ? { salaryMax: -1 } : { createdAt: -1 };
  const [records, total] = await Promise.all([
    Job.find(filter).populate("companyId", "name").sort(sortBy).skip((pageNumber - 1) * pageSize).limit(pageSize).lean(),
    Job.countDocuments(filter),
  ]);
  const items = await Promise.all(records.map((record) => presentJob(record as unknown as PopulatedJob)));
  res.json({ items, page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) });
});

router.post("/jobs", requireAuth, requireRole("Recruiter"), async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the job details." });
    return;
  }
  if (parsed.data.salaryMax < parsed.data.salaryMin) {
    res.status(400).json({ error: "Maximum salary must be at least the minimum salary." });
    return;
  }
  if (!req.user!.companyId) {
    res.status(409).json({ error: "Create a company profile before publishing a job." });
    return;
  }
  const job = await Job.create({
    ...parsed.data,
    companyId: req.user!.companyId,
    recruiterId: req.user!._id,
    status: parsed.data.status ?? "Open",
  });
  const populated = await Job.findById(job._id).populate("companyId", "name").lean();
  res.status(201).json(await presentJob(populated as unknown as PopulatedJob));
});

router.get("/jobs/mine", requireAuth, requireRole("Recruiter"), async (req, res): Promise<void> => {
  const records = await Job.find({ recruiterId: req.user!._id }).populate("companyId", "name").sort({ createdAt: -1 }).lean();
  res.json(await Promise.all(records.map((record) => presentJob(record as unknown as PopulatedJob))));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  const id = params.success ? parseId(params.data.id) : null;
  if (!id) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }
  const job = await Job.findById(id).populate("companyId", "name").lean();
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }
  res.json(await presentJob(job as unknown as PopulatedJob));
});

router.put("/jobs/:id", requireAuth, requireRole("Recruiter"), async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  const id = params.success ? parseId(params.data.id) : null;
  if (!id) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the job details." });
    return;
  }
  if (parsed.data.salaryMax < parsed.data.salaryMin) {
    res.status(400).json({ error: "Maximum salary must be at least the minimum salary." });
    return;
  }
  const job = await Job.findOneAndUpdate(
    { _id: id, recruiterId: req.user!._id },
    { $set: parsed.data },
    { new: true, runValidators: true },
  ).populate("companyId", "name").lean();
  if (!job) {
    res.status(404).json({ error: "Job not found or you do not own this listing." });
    return;
  }
  res.json(await presentJob(job as unknown as PopulatedJob));
});

router.delete("/jobs/:id", requireAuth, requireRole("Recruiter"), async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  const id = params.success ? parseId(params.data.id) : null;
  if (!id) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }
  const job = await Job.findOne({ _id: id, recruiterId: req.user!._id });
  if (!job) {
    res.status(404).json({ error: "Job not found or you do not own this listing." });
    return;
  }
  if (await Application.exists({ jobId: job._id })) {
    res.status(409).json({ error: "This job has applications. Close the listing instead to preserve candidate records." });
    return;
  }
  await job.deleteOne();
  res.json({ message: "Job listing deleted." });
});

export default router;
