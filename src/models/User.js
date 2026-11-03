import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false },
    avatar: { type: String, default: "" },
    figmaTokenEnc: { type: String, default: "", select: false }, // AES-GCM encrypted personal access token
    figmaTokenSetAt: Date,
    failedLogins: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
    lastWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
  },
  { timestamps: true }
);
export default mongoose.models.User || mongoose.model("User", schema);
