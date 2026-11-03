import { z } from "zod";
import { route } from "@/lib/api";
import { password } from "@/lib/validation";
import { changePassword } from "@/services/auth";
import { createSession } from "@/services/auth/session";
export const POST = route({ schema: z.object({ current: z.string().min(1).max(128), next: password }), limit: { key: "pw-change", limit: 5, windowSec: 600 } }, async ({ user, body, ip, request }) => {
  await changePassword(user.id, body.current, body.next); // revokes all sessions
  await createSession(user.id, { ip, userAgent: request.headers.get("user-agent") }); // issue a fresh one for this device
  return { changed: true };
});
