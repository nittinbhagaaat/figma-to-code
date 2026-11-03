import GeneratedCode from "@/models/GeneratedCode";
import Project from "@/models/Project";
import { storage } from "@/lib/storage";
import { AppError, badRequest, notFound } from "@/lib/errors";
import { requireProject } from "@/services/workspace/access";
import { logActivity } from "@/services/workspace/activity";
import { convertDocument, collectAssetNeeds } from "@/engine/generators/convert.js";
import { requireImport, loadDocument, loadAssets } from "@/services/figma/import";
import { saveBundle, loadBundle, manifest, isSafePath } from "./bundle";

const serializeVersion = (v, full = false) => ({
  id: String(v._id), project: String(v.project), version: v.version, label: v.label, kind: v.kind, framework: v.framework, styling: v.styling,
  config: v.config, files: v.files, fileCount: v.files.length, createdBy: String(v.createdBy), createdAt: v.createdAt,
  ...(full ? { conversionReport: v.conversionReport } : { warnings: v.conversionReport?.summary }),
});

async function nextVersion(projectId) {
  const p = await Project.findByIdAndUpdate(projectId, { $inc: { versionCounter: 1 } }, { returnDocument: "after" });
  return p.versionCounter;
}

async function createVersion(project, user, { files, kind, label = "", framework, styling, config = {}, report = {} }) {
  const version = await nextVersion(project._id);
  const bundleKey = `projects/${project._id}/versions/${version}.json`;
  await saveBundle(bundleKey, files);
  return GeneratedCode.create({ project: project._id, version, label, kind, framework, styling, config, bundleKey, files: manifest(files), conversionReport: report, createdBy: user.id });
}

async function setWorkingCopy(project, files, baseVersion) {
  const key = `projects/${project._id}/working.json`;
  await saveBundle(key, files);
  await Project.updateOne({ _id: project._id }, { workingCopyKey: key, workingCopyBase: baseVersion, workingCopyDirty: false, currentVersion: baseVersion });
}

/** Runs the deterministic compiler for a project's active import and records a new immutable version. */
export async function generate(user, projectId, { framework, styling, nodeIds, options = {}, force = false }) {
  const { project } = await requireProject(user, projectId, "code:generate");
  if (project.workingCopyDirty && !force) throw new AppError("You have unsaved manual edits that regeneration would replace. Save a version first or confirm to overwrite.", 409, "DIRTY_WORKING_COPY");
  if (!project.activeImport) throw badRequest("Import a design before generating code");
  const { imp } = await requireImport(user, project.activeImport, "code:generate");
  if (imp.sourceType === "screenshot") throw badRequest("Screenshots are visual references only and cannot be converted. Import a Figma URL or .fig file.");
  const doc = await loadDocument(imp);
  const selection = nodeIds?.length ? nodeIds : project.selectedNodeIds;
  const needs = collectAssetNeeds(doc, selection);
  const assets = await loadAssets(imp, needs);
  let result;
  try { result = convertDocument(doc, { framework, styling, selection, projectName: project.name, ...options }, assets); }
  catch (e) { if (e.code === "NO_FRAMES") throw badRequest("No frames are selected. Select at least one frame or page to convert."); console.error("[convert]", e); throw new AppError("Conversion failed unexpectedly", 500, "CONVERSION_FAILED"); }
  for (const w of doc.unsupportedFeatures || []) result.report.notes.push(`Source: ${w}`);
  const config = { framework, styling, nodeIds: selection, options };
  const v = await createVersion(project, user, { files: result.files, kind: "generated", framework, styling, config, report: result.report });
  await setWorkingCopy(project, result.files, v.version);
  project.framework = framework; project.styling = styling; project.selectedNodeIds = selection; await project.save();
  await logActivity({ workspace: project.workspace, actor: user.id, action: "code.generated", project: project._id, message: `${user.name} generated ${framework}/${styling} code for "${project.name}" (v${v.version})` });
  return serializeVersion(v, true);
}

export async function listVersions(user, projectId) {
  const { project } = await requireProject(user, projectId, "code:view");
  const list = await GeneratedCode.find({ project: project._id }).sort({ version: -1 }).limit(200);
  return list.map((v) => serializeVersion(v));
}

export async function getVersion(user, projectId, versionId, { withFiles = false } = {}) {
  const { project } = await requireProject(user, projectId, "code:view");
  const v = await GeneratedCode.findOne({ _id: versionId, project: project._id }).catch(() => null);
  if (!v) throw notFound("Version not found");
  const out = serializeVersion(v, true);
  if (withFiles) out.fileContents = (await loadBundle(v.bundleKey)).map(wireFile);
  return out;
}

/** Wire format for the studio: text inline, binary as base64 flagged. */
export const wireFile = (f) => (f.binary ? { path: f.path, binary: true, content: Buffer.from(f.content).toString("base64") } : { path: f.path, binary: false, content: f.content });

export async function getWorkingCopy(user, projectId) {
  const { project, role } = await requireProject(user, projectId, "code:view");
  if (!project.workingCopyKey) return { files: [], dirty: false, baseVersion: 0, role };
  const files = await loadBundle(project.workingCopyKey);
  return { files: files.map(wireFile), dirty: project.workingCopyDirty, baseVersion: project.workingCopyBase, role };
}

/** Saves edited files into the working copy (never touches historical versions). */
export async function saveWorkingCopy(user, projectId, changes, deletions = []) {
  const { project } = await requireProject(user, projectId, "code:edit");
  if (!project.workingCopyKey) throw badRequest("Generate code before editing");
  const files = await loadBundle(project.workingCopyKey);
  const map = new Map(files.map((f) => [f.path, f]));
  let total = 0;
  for (const c of changes) {
    if (!isSafePath(c.path)) throw badRequest(`Invalid file path: ${c.path}`);
    const existing = map.get(c.path);
    if (existing?.binary) throw badRequest("Binary files cannot be edited as text");
    total += Buffer.byteLength(c.content);
    map.set(c.path, { path: c.path, content: c.content, binary: false });
  }
  if (total > 20 * 1024 * 1024) throw badRequest("Edits are too large");
  for (const d of deletions) map.delete(d);
  await saveBundle(project.workingCopyKey, [...map.values()]);
  project.workingCopyDirty = true; await project.save();
  return { saved: changes.length, dirty: true };
}

/** Snapshots the working copy as a new version ("Save version"). */
export async function saveVersion(user, projectId, label = "") {
  const { project } = await requireProject(user, projectId, "code:edit");
  if (!project.workingCopyKey) throw badRequest("Nothing to save yet");
  const files = await loadBundle(project.workingCopyKey);
  const v = await createVersion(project, user, { files, kind: "saved", label, framework: project.framework, styling: project.styling, config: { baseVersion: project.workingCopyBase } });
  project.workingCopyBase = v.version; project.currentVersion = v.version; project.workingCopyDirty = false; await project.save();
  await logActivity({ workspace: project.workspace, actor: user.id, action: "code.saved", project: project._id, message: `${user.name} saved version v${v.version} of "${project.name}"` });
  return serializeVersion(v);
}

/** Restores an old version: writes a NEW version (history is never rewritten) and replaces the working copy. */
export async function restoreVersion(user, projectId, versionId) {
  const { project } = await requireProject(user, projectId, "code:edit");
  const old = await GeneratedCode.findOne({ _id: versionId, project: project._id }).catch(() => null);
  if (!old) throw notFound("Version not found");
  const files = await loadBundle(old.bundleKey);
  const v = await createVersion(project, user, { files, kind: "restored", label: `Restored from v${old.version}`, framework: old.framework, styling: old.styling, config: { ...old.config, restoredFrom: old.version }, report: old.conversionReport });
  await setWorkingCopy(project, files, v.version);
  project.framework = old.framework; project.styling = old.styling; await project.save();
  await logActivity({ workspace: project.workspace, actor: user.id, action: "code.restored", project: project._id, message: `${user.name} restored v${old.version} of "${project.name}"` });
  return serializeVersion(v);
}

export async function filesForExport(user, projectId, versionId) {
  const { project } = await requireProject(user, projectId, "code:export");
  if (versionId) {
    const v = await GeneratedCode.findOne({ _id: versionId, project: project._id }).catch(() => null);
    if (!v) throw notFound("Version not found");
    return { project, files: await loadBundle(v.bundleKey), label: `v${v.version}` };
  }
  if (!project.workingCopyKey) throw badRequest("Nothing to export yet");
  return { project, files: await loadBundle(project.workingCopyKey), label: "working" };
}
export { storage };
