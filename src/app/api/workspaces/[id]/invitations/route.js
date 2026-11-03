import { z } from "zod";
import { route } from "@/lib/api";
import { email, roleEnum } from "@/lib/validation";
import { createInvitation, listInvitations } from "@/services/team";
export const GET = route(async ({ user, params }) => listInvitations(user, params.id));
export const POST = route({ schema: z.object({ email, role: roleEnum }), limit: { key: "invite", limit: 30, windowSec: 3600 } }, async ({ user, params, body }) => createInvitation(user, params.id, body));
