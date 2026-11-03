import { z } from "zod";
import { route } from "@/lib/api";
import { updateWorkspace, deleteWorkspace, serializeWorkspace } from "@/services/workspace";
import { requireWorkspace } from "@/services/workspace/access";
import { frameworkEnum, stylingEnum } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(), description: z.string().trim().max(500).optional(), logo: z.string().max(2000).optional(),
  settings: z.object({ defaultFramework: frameworkEnum.optional(), defaultStyling: stylingEnum.optional() }).optional(),
});
export const GET = route(async ({ user, params }) => { const { workspace, role } = await requireWorkspace(user, params.id); return serializeWorkspace(workspace, role); });
export const PATCH = route({ schema }, async ({ user, params, body }) => updateWorkspace(user, params.id, body));
export const DELETE = route(async ({ user, params }) => { await deleteWorkspace(user, params.id); return { deleted: true }; });
