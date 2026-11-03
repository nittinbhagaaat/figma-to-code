import { route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { objectId, parse } from "@/lib/validation";
import { z } from "zod";
import { env } from "@/lib/env";
import { importFromFig, serializeImport } from "@/services/figma/import";
export const maxDuration = 300;
export const POST = route({ limit: { key: "fig-upload", limit: 15, windowSec: 600 } }, async ({ request, user }) => {
  const form = await request.formData().catch(() => { throw badRequest("Expected multipart form data"); });
  const { projectId } = parse(z.object({ projectId: objectId }), { projectId: form.get("projectId") });
  const file = form.get("file");
  if (!file || typeof file === "string") throw badRequest("Attach a .fig file");
  if (file.size > env.maxFigMb * 1024 * 1024) throw badRequest(`File exceeds the ${env.maxFigMb} MB limit`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return serializeImport(await importFromFig(user, projectId, file.name, bytes));
});
