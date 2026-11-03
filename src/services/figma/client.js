import { AppError } from "@/lib/errors";

const API = (process.env.FIGMA_API_BASE || "https://api.figma.com/v1").replace(/\/$/, "");
// Plain-http asset URLs are allowed only when pointing the API base at loopback (tests / local proxies).
const allowLoopback = /^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(API);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with Figma-specific error mapping and 429/5xx retry (honours Retry-After, capped). */
async function figmaFetch(url, token, { retries = 3, raw = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try { res = await fetch(url, { headers: raw ? {} : { "X-Figma-Token": token }, signal: AbortSignal.timeout(120_000) }); }
    catch { if (attempt < retries) { await sleep(500 * 2 ** attempt); continue; } throw new AppError("Could not reach Figma. Check your connection and try again.", 502, "FIGMA_UNREACHABLE"); }
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt, 10_000));
      continue;
    }
    if (res.status === 403) throw new AppError("Figma rejected your access token or you do not have access to this file. Check the token in Settings.", 400, "FIGMA_FORBIDDEN");
    if (res.status === 404) throw new AppError("Figma file not found. Check the URL and that your token's account can open it.", 404, "FIGMA_NOT_FOUND");
    if (res.status === 429) throw new AppError("Figma rate limit reached. Please wait a minute and retry.", 429, "FIGMA_RATE_LIMITED");
    throw new AppError(`Figma API error (${res.status})`, 502, "FIGMA_ERROR");
  }
}

export async function fetchFile(token, fileKey) {
  const res = await figmaFetch(`${API}/files/${fileKey}?geometry=paths`, token);
  return res.json();
}
export async function fetchImageFillUrls(token, fileKey) {
  const res = await figmaFetch(`${API}/files/${fileKey}/images`, token);
  return (await res.json()).meta?.images || {};
}
/** Batched SVG export for vector nodes (the render endpoint caps URL length, so ids are chunked). */
export async function fetchSvgUrls(token, fileKey, ids, chunk = 40) {
  const out = {};
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    const res = await figmaFetch(`${API}/images/${fileKey}?ids=${encodeURIComponent(part.join(","))}&format=svg&svg_include_id=false`, token);
    Object.assign(out, (await res.json()).images || {});
  }
  return out;
}
/** Downloads a signed asset URL (S3). Only https URLs are followed; size is capped. */
export async function downloadAsset(url) {
  if (!/^https:\/\//i.test(url) && !(allowLoopback && url.startsWith("http://127.0.0.1"))) throw new Error("Refusing non-https asset URL");
  const res = await figmaFetch(url, null, { raw: true });
  const len = Number(res.headers.get("content-length"));
  if (len > MAX_IMAGE_BYTES) throw new Error("Asset too large");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("Asset too large");
  return { bytes: buf, type: res.headers.get("content-type") || "" };
}
