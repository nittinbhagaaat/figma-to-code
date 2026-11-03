import { badRequest } from "@/lib/errors";

/** Extracts the file key (and optional node id) from a Figma URL. Only figma.com hosts are accepted. */
export function parseFigmaUrl(input) {
  let u;
  try { u = new URL(String(input).trim()); } catch { throw badRequest("Enter a valid Figma URL"); }
  if (u.protocol !== "https:" || !/^(www\.)?figma\.com$/i.test(u.hostname)) throw badRequest("The URL must be an https://www.figma.com link");
  const m = u.pathname.match(/^\/(?:file|design|proto|board)\/([A-Za-z0-9]{10,64})(?:\/|$)/);
  if (!m) throw badRequest("Could not find a file key. Use a link like https://www.figma.com/design/FILE_KEY/Name");
  const nodeId = u.searchParams.get("node-id");
  return { fileKey: m[1], nodeId: nodeId ? nodeId.replace("-", ":") : null };
}
