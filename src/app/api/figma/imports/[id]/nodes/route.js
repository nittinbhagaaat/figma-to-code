import { route } from "@/lib/api";
import { requireImport, loadDocument } from "@/services/figma/import";
import { badRequest } from "@/lib/errors";
/** Returns the normalized design tree (optionally one page) for the inspector. */
export const GET = route(async ({ user, params, query }) => {
  const { imp } = await requireImport(user, params.id);
  if (imp.sourceType === "screenshot") throw badRequest("Screenshots have no node tree");
  const doc = await loadDocument(imp);
  const pages = query.page ? doc.pages.filter((p) => p.id === query.page) : doc.pages;
  return { name: doc.name, source: doc.source, unsupportedFeatures: doc.unsupportedFeatures || [], pages };
});
