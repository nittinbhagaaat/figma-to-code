import { z } from "zod";
import { route } from "@/lib/api";
import { password } from "@/lib/validation";
import { resetPassword } from "@/services/auth";
export const POST = route({ auth: false, schema: z.object({ token: z.string().min(10).max(200), password }), limit: { key: "reset", limit: 10, windowSec: 3600 } },
  async ({ body }) => { await resetPassword(body.token, body.password); return { reset: true }; });
