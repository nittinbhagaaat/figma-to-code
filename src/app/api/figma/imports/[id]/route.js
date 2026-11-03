import { route } from "@/lib/api";
import { requireImport, serializeImport } from "@/services/figma/import";
export const GET = route(async ({ user, params }) => serializeImport((await requireImport(user, params.id)).imp));
