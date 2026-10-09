import mongoose, { type InferSchemaType } from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    website: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    logoUrl: { type: String, default: null },
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

export type CompanyRecord = InferSchemaType<typeof companySchema> & { _id: mongoose.Types.ObjectId };
export default mongoose.models.Company ?? mongoose.model("Company", companySchema);
