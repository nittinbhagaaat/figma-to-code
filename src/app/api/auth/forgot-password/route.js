import { z } from "zod";
import { route } from "@/lib/api";
import { email } from "@/lib/validation";
import { requestPasswordReset } from "@/services/auth";
export const POST = route({ auth: false, schema: z.object({ email }), limit: { key: "forgot", limit: 5, windowSec: 3600 } },
  async ({ body }) => { await requestPasswordReset(body.email); return { sent: true }; });
