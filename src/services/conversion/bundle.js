import { putJson, getJson } from "@/lib/storage";

/** Files <-> JSON bundle. Text stays utf8; binary (images) is base64. */
export const toBundle = (files) => ({ files: files.map((f) => (f.binary || typeof f.content !== "string" ? { path: f.path, encoding: "base64", content: Buffer.from(f.content).toString("base64") } : { path: f.path, encoding: "utf8", content: f.content })) });
export const fromBundle = (b) => b.files.map((f) => ({ path: f.path, binary: f.encoding === "base64", content: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content }));
export const saveBundle = (key, files) => putJson(key, toBundle(files));
export const loadBundle = async (key) => fromBundle(await getJson(key));
export const manifest = (files) => files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content) }));

const SAFE = /^(?!\/)(?!.*(^|\/)\.\.(\/|$))[\w@.\-\/ ]{1,200}$/;
/** Validates a project-relative file path (no traversal, no absolute paths, sane characters). */
export const isSafePath = (p) => typeof p === "string" && SAFE.test(p) && !p.includes("//");
