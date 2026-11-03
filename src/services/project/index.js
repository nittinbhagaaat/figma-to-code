import Project from "@/models/Project";
import GeneratedCode from "@/models/GeneratedCode";
import FigmaImport from "@/models/FigmaImport";
import { storage } from "@/lib/storage";
import { requireWorkspace, requireProject, userWorkspaceIds } from "@/services/workspace/access";
import { logActivity } from "@/services/workspace/activity";
import { notFound } from "@/lib/errors";

export function serializeProject(p, extra = {}) {
  return {
    id: String(p._id), name: p.name, description: p.description, workspace: String(p.workspace), createdBy: String(p.createdBy),
    sourceType: p.sourceType, sourceReference: p.sourceReference, framework: p.framework, styling: p.styling,
    status: p.status, currentVersion: p.currentVersion, selectedNodeIds: p.selectedNodeIds || [],
    activeImport: p.activeImport ? String(p.activeImport) : null, workingCopyDirty: !!p.workingCopyDirty,
    createdAt: p.createdAt, updatedAt: p.updatedAt, ...extra,
  };
}

export async function listProjects(user, { workspaceId, status = "active", limit = 100 }) {
  let wsFilter;
  if (workspaceId) { await requireWorkspace(user, workspaceId, "project:view"); wsFilter = workspaceId; }
  else wsFilter = { $in: await userWorkspaceIds(user.id) };
  const list = await Project.find({ workspace: wsFilter, status }).sort({ updatedAt: -1 }).limit(limit);
  return list.map((p) => serializeProject(p));
}

export async function createProject(user, { workspaceId, name, description, framework, styling }) {
  const { workspace } = await requireWorkspace(user, workspaceId, "project:create");
  const p = await Project.create({
    name, description, workspace: workspace._id, createdBy: user.id,
    framework: framework || workspace.settings?.defaultFramework || "react",
    styling: styling || workspace.settings?.defaultStyling || "tailwind",
  });
  await logActivity({ workspace: workspace._id, actor: user.id, action: "project.created", project: p._id, message: `${user.name} created project "${name}"` });
  return serializeProject(p);
}

export async function updateProject(user, id, patch) {
  const needsArchive = patch.status !== undefined;
  const { project } = await requireProject(user, id, needsArchive ? "project:archive" : "project:update");
  for (const k of ["name", "description", "framework", "styling", "status", "selectedNodeIds"]) if (patch[k] !== undefined) project[k] = patch[k];
  await project.save();
  if (needsArchive) await logActivity({ workspace: project.workspace, actor: user.id, action: "project." + patch.status, project: project._id, message: `${user.name} ${patch.status === "archived" ? "archived" : "restored"} "${project.name}"` });
  return serializeProject(project);
}

export async function deleteProject(user, id) {
  const { project } = await requireProject(user, id, "project:delete");
  await Promise.all([GeneratedCode.deleteMany({ project: project._id }), FigmaImport.deleteMany({ project: project._id }), storage().delete(`projects/${project._id}`)]);
  await logActivity({ workspace: project.workspace, actor: user.id, action: "project.deleted", message: `${user.name} deleted project "${project.name}"` });
  await project.deleteOne();
}

/** Duplicates project settings, source import (copied blob references) and the latest version. */
export async function duplicateProject(user, id) {
  const { project } = await requireProject(user, id, "project:create");
  const copy = await Project.create({
    name: `${project.name} (copy)`.slice(0, 80), description: project.description, workspace: project.workspace, createdBy: user.id,
    sourceType: project.sourceType, sourceReference: project.sourceReference, framework: project.framework, styling: project.styling,
    selectedNodeIds: project.selectedNodeIds,
  });
  if (project.activeImport) {
    const imp = await FigmaImport.findById(project.activeImport);
    if (imp) {
      const newKey = `projects/${copy._id}/import/document.json`;
      const prefix = `projects/${copy._id}/import/assets`;
      if (imp.parsedDocumentReference) await storage().put(newKey, await storage().get(imp.parsedDocumentReference));
      const clone = await FigmaImport.create({ ...imp.toObject(), _id: undefined, project: copy._id, createdBy: user.id, parsedDocumentReference: imp.parsedDocumentReference ? newKey : "", assetsPrefix: prefix, createdAt: undefined, updatedAt: undefined });
      if (imp.assetsPrefix) {
        try { await copyDir(imp.assetsPrefix, prefix); } catch { /* assets optional */ }
      }
      copy.activeImport = clone._id;
      await copy.save();
    }
  }
  await logActivity({ workspace: project.workspace, actor: user.id, action: "project.duplicated", project: copy._id, message: `${user.name} duplicated "${project.name}"` });
  return serializeProject(copy);
}

async function copyDir(from, to) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR || ".data/storage");
  const src = path.join(root, from); const dst = path.join(root, to);
  if (!src.startsWith(root) || !dst.startsWith(root)) throw notFound();
  await fs.cp(src, dst, { recursive: true });
}

export async function getProject(user, id) {
  const { project, workspace, role } = await requireProject(user, id, "project:view");
  return { project: serializeProject(project), workspace: { id: String(workspace._id), name: workspace.name }, role };
}
