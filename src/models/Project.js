import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 500 },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sourceType: { type: String, enum: ["none", "figma-url", "fig-file", "screenshot"], default: "none" },
    sourceReference: { type: String, default: "" },
    activeImport: { type: mongoose.Schema.Types.ObjectId, ref: "FigmaImport" },
    framework: { type: String, enum: ["html", "react", "nextjs"], default: "react" },
    styling: { type: String, enum: ["css", "tailwind"], default: "tailwind" },
    selectedNodeIds: { type: [String], default: [] },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    currentVersion: { type: Number, default: 0 },
    // Working copy edited in Code Studio (path -> storage key lives in the working-copy blob).
    workingCopyKey: { type: String, default: "" },
    workingCopyBase: { type: Number, default: 0 }, // version the working copy derives from
    workingCopyDirty: { type: Boolean, default: false },
    versionCounter: { type: Number, default: 0 },
  },
  { timestamps: true }
);
schema.index({ workspace: 1, status: 1, updatedAt: -1 });
export default mongoose.models.Project || mongoose.model("Project", schema);
