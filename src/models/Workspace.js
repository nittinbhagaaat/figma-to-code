import mongoose from "mongoose";
const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "admin", "editor", "viewer"], required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", maxlength: 500 },
    logo: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: { type: [memberSchema], default: [] },
    settings: {
      defaultFramework: { type: String, enum: ["html", "react", "nextjs"], default: "react" },
      defaultStyling: { type: String, enum: ["css", "tailwind"], default: "tailwind" },
    },
  },
  { timestamps: true }
);
schema.index({ "members.user": 1 });
export default mongoose.models.Workspace || mongoose.model("Workspace", schema);
