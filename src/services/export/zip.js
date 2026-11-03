import JSZip from "jszip";
import { isSafePath } from "@/services/conversion/bundle";

/** Builds a ZIP buffer from project files. Unsafe paths are rejected, never silently written. */
export async function buildZip(files, rootDir = "") {
  const zip = new JSZip();
  const seen = new Set();
  for (const f of files) {
    if (!isSafePath(f.path)) throw new Error(`Unsafe path in export: ${f.path}`);
    if (seen.has(f.path)) throw new Error(`Duplicate path in export: ${f.path}`);
    seen.add(f.path);
    zip.file(rootDir ? `${rootDir}/${f.path}` : f.path, f.content, { date: new Date(0), binary: !!f.binary || typeof f.content !== "string" });
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
