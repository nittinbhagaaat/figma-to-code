import { route } from "@/lib/api";
import { getVersion } from "@/services/conversion";
export const GET = route(async ({ user, params, query }) => getVersion(user, params.id, params.versionId, { withFiles: query.files === "1" }));
