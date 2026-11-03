import { route } from "@/lib/api";
import { destroySession } from "@/services/auth/session";
export const POST = route({ auth: false }, async () => { await destroySession(); return { done: true }; });
