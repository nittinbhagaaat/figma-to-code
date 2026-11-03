import { route } from "@/lib/api";
import { cancelInvitation } from "@/services/team";
export const DELETE = route(async ({ user, params }) => { await cancelInvitation(user, params.id); return { cancelled: true }; });
