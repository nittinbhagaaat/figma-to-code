import { route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { objectId, parse } from "@/lib/validation";
import { z } from "zod";
import { env } from "@/lib/env";
import { importScreenshot, serializeImport } from "@/services/figma/import";
export const POST = route({ limit: { key: "shot-upload", limit: 30, windowSec: 600 } }, async ({ request, user }) => {
  const form = await request.formData().catch(() => { throw badRequest("Expected multipart form data"); });
  const { projectId, width, height } = parse(z.object({ projectId: objectId, width: z.coerce.number().int().min(100).max(10000).optional(), height: z.coerce.number().int().min(100).max(20000).optional() }),
    { projectId: form.get("projectId"), width: form.get("viewportWidth") || undefined, height: form.get("viewportHeight") || undefined });
  const file = form.get("file");
  if (!file || typeof file === "string") throw badRequest("Attach an image");
  if (file.size > env.maxImageMb * 1024 * 1024) throw badRequest(`Image exceeds the ${env.maxImageMb} MB limit`);
  const bytes = Buffer.from(await file.arrayBuffer());
  return serializeImport(await importScreenshot(user, projectId, file.name, bytes, width && height ? { width, height } : undefined));
});
