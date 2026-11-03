import { z } from "zod";
import { route } from "@/lib/api";
import { objectId, frameworkEnum, stylingEnum } from "@/lib/validation";
import { listProjects, createProject } from "@/services/project";

const schema = z.object({ workspaceId: objectId, name: z.string().trim().min(1, "Name is required").max(80), description: z.string().trim().max(500).optional().default(""), framework: frameworkEnum.optional(), styling: stylingEnum.optional() });
export const GET = route(async ({ user, query }) => listProjects(user, { workspaceId: query.workspaceId, status: query.status === "archived" ? "archived" : "active" }));
export const POST = route({ schema }, async ({ user, body }) => createProject(user, body));
