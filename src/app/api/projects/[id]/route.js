import { z } from "zod";
import { route } from "@/lib/api";
import { frameworkEnum, stylingEnum } from "@/lib/validation";
import { getProject, updateProject, deleteProject } from "@/services/project";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(), description: z.string().trim().max(500).optional(),
  framework: frameworkEnum.optional(), styling: stylingEnum.optional(), status: z.enum(["active", "archived"]).optional(),
  selectedNodeIds: z.array(z.string().max(64)).max(5000).optional(),
});
export const GET = route(async ({ user, params }) => getProject(user, params.id));
export const PATCH = route({ schema }, async ({ user, params, body }) => updateProject(user, params.id, body));
export const DELETE = route(async ({ user, params }) => { await deleteProject(user, params.id); return { deleted: true }; });
