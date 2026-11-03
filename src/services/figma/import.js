import FigmaImport from "@/models/FigmaImport";
import Project from "@/models/Project";
import { storage, putJson, getJson } from "@/lib/storage";
import { badRequest, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { requireProject } from "@/services/workspace/access";
import { logActivity } from "@/services/workspace/activity";
import { normalizeRestFile } from "@/engine/parsers/figma-rest.js";
import { parseFigFile, FigParseError, validateFigSignature } from "@/engine/parsers/fig-file.js";
import { collectAssetNeeds } from "@/engine/generators/convert.js";
import { parseFigmaUrl } from "./url";
import { getFigmaToken } from "./token";
import { fetchFile, fetchImageFillUrls, fetchSvgUrls, downloadAsset } from "./client";
import { inspectImage } from "./image-info";

const MAX_ASSETS = 400;

const countNodes = (doc) => { let n = 0; const v = (x) => { n++; (x.children || []).forEach(v); }; doc.pages.forEach(v); return n; };

async function pool(items, size, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

async function persist(project, user, { sourceType, fileKey, doc, assets, warnings = [], sourceReference, extraMeta = {} }) {
  const imp = await FigmaImport.create({ project: project._id, createdBy: user.id, sourceType, fileKey, importStatus: "pending" });
  const base = `projects/${project._id}/import/${imp._id}`;
  const index = { images: {}, svgs: {} };
  for (const [ref, a] of assets.images) { await storage().put(`${base}/assets/images/${ref}.${a.ext}`, a.bytes); index.images[ref] = a.ext; }
  for (const [id, svg] of assets.svgs) { const f = `${id.replace(/[^A-Za-z0-9_-]/g, "_")}.svg`; await storage().put(`${base}/assets/svg/${f}`, Buffer.from(svg)); index.svgs[id] = f; }
  await putJson(`${base}/assets/index.json`, index);
  await putJson(`${base}/document.json`, doc);
  imp.parsedDocumentReference = `${base}/document.json`;
  imp.assetsPrefix = `${base}/assets`;
  imp.sourceMetadata = { name: doc.name, pages: doc.pages.map((p) => ({ id: p.id, name: p.name, frames: p.children.length })), nodeCount: countNodes(doc), imageCount: assets.images.size, vectorCount: assets.svgs.size, unsupportedFeatures: doc.unsupportedFeatures || [], ...extraMeta };
  imp.warnings = warnings;
  imp.importStatus = "completed";
  await imp.save();
  project.sourceType = sourceType; project.sourceReference = sourceReference; project.activeImport = imp._id; project.selectedNodeIds = [];
  await project.save();
  await logActivity({ workspace: project.workspace, actor: user.id, action: "figma.imported", project: project._id, message: `${user.name} imported "${doc.name}" into "${project.name}"` });
  return imp;
}

export async function importFromUrl(user, projectId, url) {
  const { project } = await requireProject(user, projectId, "figma:import");
  const { fileKey } = parseFigmaUrl(url);
  const token = await getFigmaToken(user.id);
  const file = await fetchFile(token, fileKey);
  const doc = normalizeRestFile(file);
  const warnings = [];
  const assets = { images: new Map(), svgs: new Map() };
  // Fetch only assets that frames actually use.
  const all = { images: new Set(), vectors: [] };
  for (const p of doc.pages) { const n = collectAssetNeeds({ pages: [p] }, p.children.map((c) => c.id)); n.images.forEach((i) => all.images.add(i)); all.vectors.push(...n.vectors); }
  const refs = [...all.images].slice(0, MAX_ASSETS);
  if (all.images.size > MAX_ASSETS) warnings.push(`Only the first ${MAX_ASSETS} of ${all.images.size} images were downloaded`);
  if (refs.length) {
    try {
      const urls = await fetchImageFillUrls(token, fileKey);
      await pool(refs, 5, async (ref) => {
        try {
          if (!urls[ref]) throw new Error("no URL");
          const { bytes } = await downloadAsset(urls[ref]);
          const info = inspectImage(bytes);
          if (!info) throw new Error("not a supported image");
          assets.images.set(ref, { ext: info.ext, bytes });
        } catch (e) { warnings.push(`Image ${ref.slice(0, 8)}… could not be downloaded (${e.message})`); }
      });
    } catch (e) { warnings.push(`Image fills could not be fetched: ${e.message}`); }
  }
  const vec = all.vectors.slice(0, MAX_ASSETS);
  if (vec.length) {
    try {
      const urls = await fetchSvgUrls(token, fileKey, vec);
      await pool(vec, 5, async (id) => {
        try { if (!urls[id]) throw new Error("no export URL"); const { bytes } = await downloadAsset(urls[id]); assets.svgs.set(id, bytes.toString("utf8")); }
        catch (e) { warnings.push(`Vector ${id} could not be exported (${e.message})`); }
      });
    } catch (e) { warnings.push(`Vector export failed: ${e.message}`); }
  }
  return persist(project, user, { sourceType: "figma-url", fileKey, doc, assets, warnings, sourceReference: url });
}

export async function importFromFig(user, projectId, filename, bytes) {
  const { project } = await requireProject(user, projectId, "figma:import");
  if (!/\.fig$/i.test(filename || "")) throw badRequest("Upload a file with the .fig extension");
  if (bytes.length > env.maxFigMb * 1024 * 1024) throw badRequest(`File exceeds the ${env.maxFigMb} MB limit`);
  let doc;
  try { validateFigSignature(bytes); doc = await parseFigFile(bytes); }
  catch (e) { if (e instanceof FigParseError) throw badRequest(e.message, { code: e.code }); console.error("[fig]", e); throw badRequest("The .fig file could not be parsed"); }
  const warnings = [...(doc.unsupportedFeatures || [])];
  const { assets } = doc; delete doc.assets;
  const imp = await persist(project, user, { sourceType: "fig-file", fileKey: undefined, doc, assets, warnings, sourceReference: filename, extraMeta: { filename, sizeBytes: bytes.length } });
  return imp;
}

export async function importScreenshot(user, projectId, filename, bytes, viewport) {
  const { project } = await requireProject(user, projectId, "figma:import");
  if (bytes.length > env.maxImageMb * 1024 * 1024) throw badRequest(`Image exceeds the ${env.maxImageMb} MB limit`);
  const info = inspectImage(bytes);
  if (!info) throw badRequest("Upload a PNG, JPG or WebP image");
  const imp = await FigmaImport.create({ project: project._id, createdBy: user.id, sourceType: "screenshot", importStatus: "completed" });
  const key = `projects/${project._id}/import/${imp._id}/screenshot.${info.ext}`;
  await storage().put(key, bytes);
  imp.assetsPrefix = key;
  imp.sourceMetadata = { filename, mime: info.mime, width: info.width, height: info.height, viewport: viewport || { width: info.width, height: info.height }, conversion: "unavailable" };
  imp.warnings = ["Screenshots are visual references only. They carry no layers, components or layout data, so they cannot be converted deterministically."];
  await imp.save();
  project.sourceType = "screenshot"; project.sourceReference = filename; project.activeImport = imp._id; await project.save();
  return imp;
}

export const serializeImport = (i) => ({ id: String(i._id), project: String(i.project), sourceType: i.sourceType, fileKey: i.fileKey, importStatus: i.importStatus, errors: i.errors, warnings: i.warnings, sourceMetadata: i.sourceMetadata, createdAt: i.createdAt });

export async function requireImport(user, importId, permission = "project:view") {
  const imp = await FigmaImport.findById(importId).catch(() => null);
  if (!imp) throw notFound("Import not found");
  const ctx = await requireProject(user, imp.project, permission);
  return { imp, ...ctx };
}

export async function loadDocument(imp) {
  if (!imp.parsedDocumentReference) throw badRequest("This import has no design document");
  return getJson(imp.parsedDocumentReference);
}

/** Loads the assets needed by a selection from storage into the engine's asset maps. */
export async function loadAssets(imp, needs) {
  const out = { images: new Map(), svgs: new Map() };
  if (!imp.assetsPrefix) return out;
  let index = { images: {}, svgs: {} };
  try { index = await getJson(`${imp.assetsPrefix}/index.json`); } catch { return out; }
  for (const ref of needs.images) if (index.images[ref]) { try { out.images.set(ref, { ext: index.images[ref], bytes: await storage().get(`${imp.assetsPrefix}/images/${ref}.${index.images[ref]}`) }); } catch { /* reported by engine */ } }
  for (const id of needs.vectors) if (index.svgs[id]) { try { out.svgs.set(id, (await storage().get(`${imp.assetsPrefix}/svg/${index.svgs[id]}`)).toString("utf8")); } catch { /* reported */ } }
  return out;
}
export { Project };
