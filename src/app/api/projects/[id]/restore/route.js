import { z } from "zod";
import { route } from "@/lib/api";
import { objectId } from "@/lib/validation";
import { restoreVersion } from "@/services/conversion";
export const POST = route({ schema: z.object({ versionId: objectId }) }, async ({ user, params, body }) => restoreVersion(user, params.id, body.versionId));
