import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
    type: { type: String, required: true },
    message: { type: String, required: true, maxlength: 300 },
    link: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ user: 1, read: 1, createdAt: -1 });
export default mongoose.models.Notification || mongoose.model("Notification", schema);
