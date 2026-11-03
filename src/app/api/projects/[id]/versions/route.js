import { z } from "zod";
import { route } from "@/lib/api";
import { listVersions, saveVersion } from "@/services/conversion";
export const GET = route(async ({ user, params }) => listVersions(user, params.id));
export const POST = route({ schema: z.object({ label: z.string().trim().max(100).optional() }) }, async ({ user, params, body }) => saveVersion(user, params.id, body.label));
