import { route } from "@/lib/api";
import { requireImport, loadDocument, loadAssets } from "@/services/figma/import";
import { convertDocument, collectAssetNeeds } from "@/engine/generators/convert.js";
import { wireFile } from "@/services/conversion";
import { badRequest } from "@/lib/errors";
/** Renders ONE node as plain HTML/CSS (the same compiler as real output) for the inspector's centre panel. */
export const GET = route({ limit: { key: "inspect-preview", limit: 120, windowSec: 60 } }, async ({ user, params, query }) => {
  const { imp } = await requireImport(user, params.id);
  if (!query.node) throw badRequest("node is required");
  const doc = await loadDocument(imp);
  const needs = collectAssetNeeds(doc, [query.node]);
  const assets = await loadAssets(imp, needs);
  const out = convertDocument(doc, { framework: "html", styling: "css", selection: [query.node], componentize: false }, assets);
  return { files: out.files.filter((f) => !f.path.startsWith("package") && f.path !== "README.md" && f.path !== ".gitignore").map(wireFile), summary: out.report.summary };
});
