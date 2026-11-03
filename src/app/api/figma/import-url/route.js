import { z } from "zod";
import { route } from "@/lib/api";
import { objectId } from "@/lib/validation";
import { importFromUrl, serializeImport } from "@/services/figma/import";
export const maxDuration = 300;
export const POST = route({ schema: z.object({ projectId: objectId, url: z.string().url().max(500) }), limit: { key: "figma-import", limit: 20, windowSec: 600 } },
  async ({ user, body }) => serializeImport(await importFromUrl(user, body.projectId, body.url)));
