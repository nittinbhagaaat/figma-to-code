import { route } from "@/lib/api";
import GeneratedCode from "@/models/GeneratedCode";
import { getVersion } from "@/services/conversion";
import { notFound } from "@/lib/errors";
export const GET = route(async ({ user, params }) => {
  const v = await GeneratedCode.findById(params.id).select("project").catch(() => null);
  if (!v) throw notFound("Conversion not found");
  const full = await getVersion(user, String(v.project), params.id);
  return { version: full.version, report: full.conversionReport };
});
