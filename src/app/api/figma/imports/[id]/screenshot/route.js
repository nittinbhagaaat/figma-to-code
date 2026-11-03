import { route } from "@/lib/api";
import { requireImport } from "@/services/figma/import";
import { storage } from "@/lib/storage";
import { notFound } from "@/lib/errors";
export const GET = route(async ({ user, params }) => {
  const { imp } = await requireImport(user, params.id);
  if (imp.sourceType !== "screenshot") throw notFound();
  const bytes = await storage().get(imp.assetsPrefix);
  return new Response(bytes, { headers: { "Content-Type": imp.sourceMetadata.mime || "image/png", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
});
