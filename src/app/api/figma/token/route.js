import { z } from "zod";
import { route } from "@/lib/api";
import { saveFigmaToken, clearFigmaToken } from "@/services/figma/token";
export const PUT = route({ schema: z.object({ token: z.string().trim().min(20).max(200) }), limit: { key: "figma-token", limit: 10, windowSec: 600 } },
  async ({ user, body }) => { await saveFigmaToken(user.id, body.token); return { saved: true }; });
export const DELETE = route(async ({ user }) => { await clearFigmaToken(user.id); return { removed: true }; });
