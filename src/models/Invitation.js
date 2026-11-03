import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "editor", "viewer"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: Date,
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "cancelled"], default: "pending", index: true },
  },
  { timestamps: true }
);
schema.index({ workspace: 1, email: 1, status: 1 });
export default mongoose.models.Invitation || mongoose.model("Invitation", schema);
