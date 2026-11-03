import fs from "node:fs/promises";
import path from "node:path";

/**
 * Storage abstraction for large blobs (parsed Figma documents, generated bundles, assets, uploads).
 * Keys are POSIX-style relative paths. The local driver is the default; implement the same
 * interface (put/get/delete/exists) for S3/GCS and select it via STORAGE_DRIVER.
 */
class LocalDriver {
  constructor(root) { this.root = path.resolve(root); }
  resolve(key) {
    const p = path.resolve(this.root, key);
    if (p !== this.root && !p.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return p;
  }
  async put(key, data) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
    return key;
  }
  async get(key) { return fs.readFile(this.resolve(key)); }
  async exists(key) { try { await fs.access(this.resolve(key)); return true; } catch { return false; } }
  async delete(key) { await fs.rm(this.resolve(key), { force: true, recursive: true }); }
}

let driver;
export function storage() {
  if (!driver) {
    const kind = process.env.STORAGE_DRIVER || "local";
    if (kind !== "local") throw new Error(`Unsupported STORAGE_DRIVER "${kind}". Implement it in src/lib/storage.js`);
    driver = new LocalDriver(process.env.STORAGE_LOCAL_DIR || ".data/storage");
  }
  return driver;
}
export const putJson = (key, obj) => storage().put(key, Buffer.from(JSON.stringify(obj)));
export const getJson = async (key) => JSON.parse((await storage().get(key)).toString("utf8"));
