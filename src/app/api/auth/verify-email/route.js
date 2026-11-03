import { z } from "zod";
import { route } from "@/lib/api";
import { verifyEmail } from "@/services/auth";
export const POST = route({ auth: false, schema: z.object({ token: z.string().min(10).max(200) }), limit: { key: "verify", limit: 20, windowSec: 600 } },
  async ({ body }) => { await verifyEmail(body.token); return { verified: true }; });
