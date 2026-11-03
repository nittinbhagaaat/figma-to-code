import { route } from "@/lib/api";
import { resendInvitation } from "@/services/team";
export const POST = route({ limit: { key: "invite-resend", limit: 20, windowSec: 3600 } }, async ({ user, params }) => resendInvitation(user, params.invitationId));
