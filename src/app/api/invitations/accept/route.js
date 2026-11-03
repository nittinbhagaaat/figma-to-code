import { z } from "zod";
import { route } from "@/lib/api";
import { acceptInvitation } from "@/services/team";
export const POST = route({ schema: z.object({ token: z.string().min(10).max(200) }), limit: { key: "invite-accept", limit: 20, windowSec: 600 } }, async ({ user, body }) => acceptInvitation(user, body.token));
