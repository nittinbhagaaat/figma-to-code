import { route } from "@/lib/api";
import { duplicateProject } from "@/services/project";
export const POST = route(async ({ user, params }) => duplicateProject(user, params.id));
