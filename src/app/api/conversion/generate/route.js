import { z } from "zod";
import { route } from "@/lib/api";
import { objectId, frameworkEnum, stylingEnum } from "@/lib/validation";
import { generate } from "@/services/conversion";
const schema = z.object({
  projectId: objectId, framework: frameworkEnum, styling: stylingEnum, nodeIds: z.array(z.string().max(64)).max(5000).optional(), force: z.boolean().optional(),
  options: z.object({ responsive: z.boolean().optional(), inferLayout: z.boolean().optional(), componentize: z.boolean().optional() }).optional(),
});
export const maxDuration = 120;
export const POST = route({ schema, limit: { key: "generate", limit: 40, windowSec: 600 } }, async ({ user, body }) => generate(user, body.projectId, body));
