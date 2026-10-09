import mongoose, { type InferSchemaType } from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    description: { type: String, required: true, minlength: 20, maxlength: 12000 },
    requirements: { type: String, required: true, maxlength: 8000 },
    skills: { type: [String], default: [] },
    location: { type: String, required: true, trim: true },
    jobType: { type: String, enum: ["Full-time", "Part-time", "Contract", "Internship", "Remote"], required: true },
    experienceLevel: { type: String, enum: ["Entry", "Mid", "Senior", "Lead"], required: true },
    salaryMin: { type: Number, min: 0, required: true },
    salaryMax: { type: Number, min: 0, required: true },
    status: { type: String, enum: ["Open", "Closed"], default: "Open", index: true },
  },
  { timestamps: true },
);
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ title: "text", skills: "text", location: "text" });

export type JobRecord = InferSchemaType<typeof jobSchema> & { _id: mongoose.Types.ObjectId };
export default mongoose.models.Job ?? mongoose.model("Job", jobSchema);
