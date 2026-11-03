import { route } from "@/lib/api";
import { filesForExport } from "@/services/conversion";
import { buildZip } from "@/services/export/zip";
import { kebabCase } from "@/engine/utils/names.js";
export const GET = route({ limit: { key: "export", limit: 30, windowSec: 600 } }, async ({ user, params, query }) => {
  const { project, files, label } = await filesForExport(user, params.id, query.versionId);
  const buf = await buildZip(files);
  const name = `${kebabCase(project.name) || "project"}-${label}.zip`;
  return new Response(buf, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
});
