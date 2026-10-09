import mongoose, { type InferSchemaType } from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["Applicant", "Recruiter"], required: true },
    skills: { type: [String], default: [] },
    location: { type: String, default: "" },
    resumeUrl: { type: String, default: null },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    savedJobs: { type: [mongoose.Schema.Types.ObjectId], ref: "Job", default: [] },
  },
  { timestamps: true },
);

export type UserRecord = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export default mongoose.models.User ?? mongoose.model("User", userSchema);
