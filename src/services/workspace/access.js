import mongoose from "mongoose";
import Workspace from "@/models/Workspace";
import Project from "@/models/Project";
import { can } from "@/lib/permissions";
import { forbidden, notFound } from "@/lib/errors";

const valid = (id) => mongoose.isValidObjectId(id);

/** Loads a workspace and asserts the user is a member holding `permission`. Non-members get 404 (no existence leak). */
export async function requireWorkspace(user, workspaceId, permission = "workspace:view") {
  if (!valid(workspaceId)) throw notFound("Workspace not found");
  const workspace = await Workspace.findById(workspaceId);
  const member = workspace?.members.find((m) => String(m.user) === String(user.id));
  if (!workspace || !member) throw notFound("Workspace not found");
  if (!can(member.role, permission)) throw forbidden();
  return { workspace, role: member.role };
}

/** Loads a project through its workspace membership. */
export async function requireProject(user, projectId, permission = "project:view") {
  if (!valid(projectId)) throw notFound("Project not found");
  const project = await Project.findById(projectId);
  if (!project) throw notFound("Project not found");
  const { workspace, role } = await requireWorkspace(user, project.workspace, "workspace:view").catch(() => { throw notFound("Project not found"); });
  if (!can(role, permission)) throw forbidden();
  return { project, workspace, role };
}

export async function userWorkspaceIds(userId) {
  const list = await Workspace.find({ "members.user": userId }).select("_id").lean();
  return list.map((w) => w._id);
}
