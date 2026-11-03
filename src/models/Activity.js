import mongoose from "mongoose";
/** Workspace activity feed (team activity on the dashboard). */
const schema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    message: { type: String, required: true, maxlength: 300 },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ workspace: 1, createdAt: -1 });
export default mongoose.models.Activity || mongoose.model("Activity", schema);
