import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sourceType: { type: String, enum: ["figma-url", "fig-file", "screenshot"], required: true },
    fileKey: String,
    sourceMetadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // name, lastModified, pages, counts, viewport...
    parsedDocumentReference: { type: String, default: "" }, // storage key of normalized document JSON
    assetsPrefix: { type: String, default: "" },
    importStatus: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    errors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true }, suppressReservedKeysWarning: true }
);
export default mongoose.models.FigmaImport || mongoose.model("FigmaImport", schema);
