import { z } from "zod";
import { route } from "@/lib/api";
import { roleEnum } from "@/lib/validation";
import { changeMemberRole, removeMember } from "@/services/team";
export const PATCH = route({ schema: z.object({ role: roleEnum }) }, async ({ user, params, body }) => { await changeMemberRole(user, params.id, params.memberId, body.role); return { updated: true }; });
export const DELETE = route(async ({ user, params }) => { await removeMember(user, params.id, params.memberId); return { removed: true }; });
