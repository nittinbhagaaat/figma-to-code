import mongoose from "mongoose";
/** Immutable version record. File contents live in storage (bundleKey); a manifest is kept here. */
const schema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    version: { type: Number, required: true },
    label: { type: String, default: "" },
    kind: { type: String, enum: ["generated", "saved", "restored"], default: "generated" },
    framework: { type: String, enum: ["html", "react", "nextjs"], required: true },
    styling: { type: String, enum: ["css", "tailwind"], required: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} }, // conversion configuration incl. selected node ids
    bundleKey: { type: String, required: true },
    files: { type: [{ _id: false, path: String, size: Number }], default: [] },
    conversionReport: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ project: 1, version: -1 }, { unique: true });
export default mongoose.models.GeneratedCode || mongoose.model("GeneratedCode", schema);
