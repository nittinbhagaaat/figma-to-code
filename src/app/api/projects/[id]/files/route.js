import { z } from "zod";
import { route } from "@/lib/api";
import { getWorkingCopy, saveWorkingCopy } from "@/services/conversion";
export const GET = route(async ({ user, params }) => getWorkingCopy(user, params.id));
const schema = z.object({ changes: z.array(z.object({ path: z.string().max(200), content: z.string().max(5_000_000) })).max(500), deletions: z.array(z.string().max(200)).max(500).optional() });
export const PUT = route({ schema, limit: { key: "save-files", limit: 120, windowSec: 60 } }, async ({ user, params, body }) => saveWorkingCopy(user, params.id, body.changes, body.deletions));
