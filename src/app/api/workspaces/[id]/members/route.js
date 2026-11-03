import { route } from "@/lib/api";
import { listMembers } from "@/services/team";
export const GET = route(async ({ user, params }) => listMembers(user, params.id));
