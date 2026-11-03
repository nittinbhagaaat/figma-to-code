import { z } from "zod";
import { route } from "@/lib/api";
import { listWorkspaces, createWorkspace } from "@/services/workspace";

const schema = z.object({ name: z.string().trim().min(1, "Name is required").max(60), description: z.string().trim().max(500).optional().default(""), logo: z.string().max(2_000).optional().default("") });
export const GET = route(async ({ user }) => listWorkspaces(user));
export const POST = route({ schema, limit: { key: "ws-create", limit: 30, windowSec: 3600 } }, async ({ user, body }) => createWorkspace(user, body));
