import mongoose, { type InferSchemaType } from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    resumeUrl: { type: String, default: null },
    coverLetter: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Submitted", "Reviewing", "Shortlisted", "Interview", "Offered", "Rejected", "Withdrawn"],
      default: "Submitted",
    },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
applicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
applicationSchema.index({ applicantId: 1, appliedAt: -1 });

export type ApplicationRecord = InferSchemaType<typeof applicationSchema> & { _id: mongoose.Types.ObjectId };
export default mongoose.models.Application ?? mongoose.model("Application", applicationSchema);
