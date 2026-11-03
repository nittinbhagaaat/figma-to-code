import { z } from "zod";
import { route } from "@/lib/api";
import { email } from "@/lib/validation";
import { authenticate } from "@/services/auth";
import { createSession, serializeUser } from "@/services/auth/session";

const schema = z.object({ email, password: z.string().min(1).max(128), remember: z.boolean().optional() });
export const POST = route({ auth: false, schema, limit: { key: "login", limit: 15, windowSec: 600 } }, async ({ body, ip, request }) => {
  const user = await authenticate(body);
  await createSession(user._id, { remember: body.remember, ip, userAgent: request.headers.get("user-agent") });
  return { user: serializeUser(user) };
});
