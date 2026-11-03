import Workspace from "@/models/Workspace";
import Project from "@/models/Project";
import Invitation from "@/models/Invitation";
import FigmaImport from "@/models/FigmaImport";
import GeneratedCode from "@/models/GeneratedCode";
import Activity from "@/models/Activity";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { storage } from "@/lib/storage";
import { logActivity } from "./activity";
import { requireWorkspace } from "./access";

export function serializeWorkspace(w, role, extra = {}) {
  return {
    id: String(w._id), name: w.name, description: w.description, logo: w.logo, owner: String(w.owner),
    role, memberCount: w.members.length, settings: w.settings, createdAt: w.createdAt, updatedAt: w.updatedAt, ...extra,
  };
}

export async function listWorkspaces(user) {
  const list = await Workspace.find({ "members.user": user.id }).sort({ updatedAt: -1 });
  const counts = await Project.aggregate([
    { $match: { workspace: { $in: list.map((w) => w._id) }, status: "active" } },
    { $group: { _id: "$workspace", n: { $sum: 1 } } },
  ]);
  const byWs = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return list.map((w) => serializeWorkspace(w, w.members.find((m) => String(m.user) === user.id).role, { projectCount: byWs[String(w._id)] || 0 }));
}

export async function createWorkspace(user, { name, description, logo }) {
  const w = await Workspace.create({ name, description, logo, owner: user.id, members: [{ user: user.id, role: "owner" }] });
  await User.updateOne({ _id: user.id }, { lastWorkspace: w._id });
  await logActivity({ workspace: w._id, actor: user.id, action: "workspace.created", message: `${user.name} created the workspace "${name}"` });
  return serializeWorkspace(w, "owner", { projectCount: 0 });
}

export async function updateWorkspace(user, id, patch) {
  const { workspace, role } = await requireWorkspace(user, id, "workspace:update");
  for (const k of ["name", "description", "logo"]) if (patch[k] !== undefined) workspace[k] = patch[k];
  if (patch.settings) workspace.settings = { ...workspace.settings.toObject?.() , ...patch.settings };
  await workspace.save();
  await logActivity({ workspace: workspace._id, actor: user.id, action: "workspace.updated", message: `${user.name} updated workspace settings` });
  return serializeWorkspace(workspace, role);
}

/** Hard-deletes a workspace and everything under it (projects, imports, versions, invitations, stored blobs). */
export async function deleteWorkspace(user, id) {
  const { workspace } = await requireWorkspace(user, id, "workspace:delete");
  const projects = await Project.find({ workspace: workspace._id }).select("_id").lean();
  const ids = projects.map((p) => p._id);
  await Promise.all(ids.map((pid) => storage().delete(`projects/${pid}`)));
  await Promise.all([
    GeneratedCode.deleteMany({ project: { $in: ids } }),
    FigmaImport.deleteMany({ project: { $in: ids } }),
    Project.deleteMany({ workspace: workspace._id }),
    Invitation.deleteMany({ workspace: workspace._id }),
    Activity.deleteMany({ workspace: workspace._id }),
    Notification.deleteMany({ workspace: workspace._id }),
  ]);
  await User.updateMany({ lastWorkspace: workspace._id }, { $unset: { lastWorkspace: 1 } });
  await workspace.deleteOne();
}
