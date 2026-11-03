import { route } from "@/lib/api";
import { previewInvitation } from "@/services/team";
import { badRequest } from "@/lib/errors";
export const GET = route({ auth: false, limit: { key: "invite-preview", limit: 30, windowSec: 600 } }, async ({ query }) => {
  if (!query.token) throw badRequest("Missing token");
  return previewInvitation(query.token);
});
