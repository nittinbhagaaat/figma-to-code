/**
 * Adapter: native Figma `.fig` file -> normalized design document.
 *
 * Format (reverse-engineered; Figma publishes no spec):
 *   - Modern files are a ZIP: canvas.fig, meta.json, thumbnail.png, images/<sha1 hex> (raw image bytes).
 *     Older files are the bare canvas.fig.
 *   - canvas.fig = "fig-kiwi" (8 bytes) | uint32 LE version | repeated [uint32 LE length | bytes] chunks.
 *     chunk 0: Kiwi *binary schema*, chunk 1: the Kiwi-encoded Message. Each chunk is raw-deflate or zstd compressed.
 *   - The Message holds `nodeChanges`: a flat list of nodes linked by parentIndex.guid (+ fractional `position` for order).
 *
 * VERIFICATION STATUS: the container handling and tree assembly are covered by tests that build .fig-shaped
 * files with the same container layout. Field names follow Figma's published-by-reverse-engineering Kiwi schema;
 * this adapter has NOT been verified against real files produced by the Figma app. Anything not understood is
 * reported through `unsupportedFeatures` instead of being silently dropped.
 */
import JSZip from "jszip";
import pako from "pako";
import { decompress as zstdDecompress } from "fzstd";
import { decodeBinarySchema, compileSchema } from "kiwi-schema";

const MAGIC = "fig-kiwi";
const JAM_MAGIC = "fig-jam.";
const isZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const isZstd = (b) => b.length > 4 && b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;

export class FigParseError extends Error {
  constructor(message, code = "FIG_PARSE_ERROR") { super(message); this.code = code; }
}

/** Upload validation: extension and file signature (never trust the name alone). */
export function validateFigSignature(bytes) {
  if (isZip(bytes)) return "zip";
  const head = Buffer.from(bytes.slice(0, 8)).toString("latin1");
  if (head === MAGIC) return "canvas";
  if (head === JAM_MAGIC) throw new FigParseError("FigJam (.jam) files are not supported — export a Figma Design file.", "UNSUPPORTED_FILE");
  throw new FigParseError("This is not a Figma .fig file (unrecognised file signature).", "BAD_SIGNATURE");
}

const MAX_ENTRY_BYTES = 200 * 1024 * 1024;
const MAX_ENTRIES = 5000;

/** Reads container -> { canvas: Uint8Array, images: Map<hex, Uint8Array>, meta } with zip-slip & zip-bomb guards. */
export async function readContainer(bytes) {
  const kind = validateFigSignature(bytes);
  if (kind === "canvas") return { canvas: bytes, images: new Map(), meta: null };
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  if (entries.length > MAX_ENTRIES) throw new FigParseError("Archive contains too many files");
  let canvas = null, meta = null, total = 0;
  const images = new Map();
  for (const f of entries) {
    const name = f.name.replace(/\\/g, "/");
    if (name.startsWith("/") || name.split("/").includes("..")) throw new FigParseError("Archive contains an unsafe path", "UNSAFE_ARCHIVE");
    const size = f._data?.uncompressedSize ?? 0;
    total += size;
    if (size > MAX_ENTRY_BYTES || total > MAX_ENTRY_BYTES * 2) throw new FigParseError("Archive is too large when extracted", "UNSAFE_ARCHIVE");
    if (name === "canvas.fig") canvas = await f.async("uint8array");
    else if (name === "meta.json") { try { meta = JSON.parse(await f.async("string")); } catch { meta = null; } }
    else if (name.startsWith("images/")) images.set(name.slice(7), await f.async("uint8array"));
  }
  if (!canvas) throw new FigParseError("The archive does not contain canvas.fig");
  return { canvas, images, meta };
}

function inflateChunk(chunk) {
  if (isZstd(chunk)) return zstdDecompress(chunk);
  try { return pako.inflateRaw(chunk); } catch { return pako.inflate(chunk); }
}

/** Decodes canvas.fig -> { schema, message } */
export function decodeCanvas(canvas) {
  const dv = new DataView(canvas.buffer, canvas.byteOffset, canvas.byteLength);
  if (Buffer.from(canvas.slice(0, 8)).toString("latin1") !== MAGIC) throw new FigParseError("Missing fig-kiwi header");
  const version = dv.getUint32(8, true);
  let off = 12;
  const chunks = [];
  while (off + 4 <= canvas.length) {
    const len = dv.getUint32(off, true); off += 4;
    if (len > canvas.length - off) throw new FigParseError("Corrupt chunk table");
    chunks.push(canvas.subarray(off, off + len)); off += len;
  }
  if (chunks.length < 2) throw new FigParseError("File is missing the schema or data chunk");
  let schema, message;
  try {
    schema = compileSchema(decodeBinarySchema(inflateChunk(chunks[0])));
    message = schema.decodeMessage(inflateChunk(chunks[1]));
  } catch (e) {
    throw new FigParseError(`Could not decode the file contents (${e.message}). The .fig version (${version}) may be newer than this parser supports.`, "DECODE_FAILED");
  }
  return { version, message };
}

/* ------------------------------ node mapping ------------------------------ */

const gk = (g) => (g ? `${g.sessionID}:${g.localID}` : null);
const hex = (arr) => Array.from(arr || [], (b) => b.toString(16).padStart(2, "0")).join("");
const TYPE = { CANVAS: "PAGE", SYMBOL: "COMPONENT", ROUNDED_RECTANGLE: "RECTANGLE", REGULAR_POLYGON: "POLYGON", FRAME: "FRAME" };
const H = { MIN: "MIN", CENTER: "CENTER", MAX: "MAX", STRETCH: "STRETCH", SCALE: "SCALE" };

const paint = (p, images) => {
  const o = { type: p.type, visible: p.visible !== false, opacity: p.opacity ?? 1, blendMode: p.blendMode };
  if (p.color) o.color = p.color;
  if (p.stops) o.stops = p.stops.map((s) => ({ position: s.position, color: s.color }));
  if (p.type?.startsWith("GRADIENT") && p.transform) {
    // gradient transform maps unit space -> node space; derive handle positions from it
    const t = p.transform; // {m00,m01,m02,m10,m11,m12} (inverse mapping); approximate vertical/horizontal axis
    const inv = invert(t);
    o.handles = [apply(inv, 0, 0.5), apply(inv, 1, 0.5)];
  }
  if (p.type === "IMAGE") {
    const h = hex(p.image?.hash);
    o.imageRef = h || undefined;
    o.scaleMode = { FILL: "FILL", FIT: "FIT", TILE: "TILE", STRETCH: "STRETCH" }[p.imageScaleMode] || "FILL";
    o.__missing = h && !images.has(h);
  }
  return o;
};
const invert = (t) => { const d = t.m00 * t.m11 - t.m01 * t.m10 || 1; return { m00: t.m11 / d, m01: -t.m01 / d, m10: -t.m10 / d, m11: t.m00 / d, m02: (t.m01 * t.m12 - t.m11 * t.m02) / d, m12: (t.m10 * t.m02 - t.m00 * t.m12) / d }; };
const apply = (t, x, y) => ({ x: t.m00 * x + t.m01 * y + t.m02, y: t.m10 * x + t.m11 * y + t.m12 });

function sizing(v) { return v === "FIXED" || v == null ? "FIXED" : "AUTO"; }

/** Path-command blob (fillGeometry[].commandsBlob) -> SVG path data. */
export function blobToPath(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0; const d = [];
  const f = () => { const v = dv.getFloat32(o, true); o += 4; return +v.toFixed(3); };
  while (o < bytes.length) {
    const c = bytes[o++];
    if (c === 0) d.push("Z");
    else if (c === 1) d.push(`M${f()} ${f()}`);
    else if (c === 2) d.push(`L${f()} ${f()}`);
    else if (c === 3) d.push(`Q${f()} ${f()} ${f()} ${f()}`);
    else if (c === 4) d.push(`C${f()} ${f()} ${f()} ${f()} ${f()} ${f()}`);
    else return null; // unknown command: refuse rather than emit a wrong shape
  }
  return d.join("");
}

function svgForVector(n, blobs, cssColor) {
  const geoms = (n.fillGeometry || []).map((g) => ({ d: blobs[g.commandsBlob]?.bytes ? blobToPath(blobs[g.commandsBlob].bytes) : null, rule: g.windingRule }));
  if (!geoms.length || geoms.some((g) => !g.d)) return null;
  const w = n.size?.x || 0, h = n.size?.y || 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">${geoms.map((g) => `<path d="${g.d}" fill="${cssColor}"${g.rule === "EVENODD" ? ' fill-rule="evenodd" clip-rule="evenodd"' : ""}/>`).join("")}</svg>`;
}
const toCssColor = (c, op = 1) => (c ? `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${(c.a ?? 1) * op})` : "#000");

export async function parseFigFile(bytes) {
  const { canvas, images, meta } = await readContainer(bytes);
  const { version, message } = decodeCanvas(canvas);
  return normalizeFigMessage(message, { images, meta, version });
}

export function normalizeFigMessage(message, { images = new Map(), meta = null, version } = {}) {
  const unsupported = new Set();
  const raw = new Map();
  for (const n of message.nodeChanges || []) if (n.guid) raw.set(gk(n.guid), n);
  const blobs = message.blobs || [];
  const kids = new Map();
  for (const [id, n] of raw) {
    const pid = gk(n.parentIndex?.guid);
    if (!pid) continue;
    (kids.get(pid) || kids.set(pid, []).get(pid)).push({ id, pos: n.parentIndex?.position ?? "" });
  }
  for (const list of kids.values()) list.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0)); // fractional index strings sort lexicographically

  const svgs = new Map();
  const usedImages = new Map();
  const memo = new Map();

  const make = (id, parentRaw, idPrefix = "") => {
    const n = raw.get(id);
    if (!n || n.phase === "REMOVED") return null;
    const type = TYPE[n.type] || n.type;
    const t = n.transform || { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
    const w = n.size?.x ?? 0, h = n.size?.y ?? 0;
    const rotDeg = Math.abs(t.m10) > 1e-4 ? (Math.atan2(-t.m01, t.m00) * 180) / Math.PI : 0;
    let x = t.m02, y = t.m12;
    if (rotDeg) { const cx = t.m00 * (w / 2) + t.m01 * (h / 2) + t.m02, cy = t.m10 * (w / 2) + t.m11 * (h / 2) + t.m12; x = cx - w / 2; y = cy - h / 2; }
    const out = {
      id: idPrefix + id, name: n.name ?? type, type, visible: n.visible !== false, opacity: n.opacity ?? 1, blendMode: n.blendMode,
      x, y, width: w, height: h, rotation: rotDeg,
      constraints: n.horizontalConstraint || n.verticalConstraint ? { horizontal: H[n.horizontalConstraint] || "MIN", vertical: H[n.verticalConstraint] || "MIN" } : undefined,
      fills: (n.fillPaints || []).map((p) => paint(p, images)), strokes: (n.strokePaints || []).map((p) => paint(p, images)),
      strokeWeight: n.strokeWeight, strokeAlign: n.strokeAlign, strokeDashes: n.dashPattern?.length ? n.dashPattern : undefined,
      cornerRadius: n.cornerRadius,
      cornerRadii: n.rectangleTopLeftCornerRadius != null || n.rectangleTopRightCornerRadius != null
        ? [n.rectangleTopLeftCornerRadius ?? n.cornerRadius ?? 0, n.rectangleTopRightCornerRadius ?? n.cornerRadius ?? 0, n.rectangleBottomRightCornerRadius ?? n.cornerRadius ?? 0, n.rectangleBottomLeftCornerRadius ?? n.cornerRadius ?? 0] : undefined,
      clipsContent: n.frameMaskDisabled === undefined ? (type === "FRAME" || type === "COMPONENT") : !n.frameMaskDisabled,
      effects: (n.effects || []).map((e) => ({ type: e.type, visible: e.visible !== false, radius: e.radius, spread: e.spread, color: e.color, offset: e.offset })),
      isMask: n.mask || undefined, children: [],
    };
    for (const p of [...out.fills, ...out.strokes]) {
      if (p.type === "IMAGE" && p.imageRef && images.has(p.imageRef)) usedImages.set(p.imageRef, images.get(p.imageRef));
      delete p.__missing;
    }
    if (n.stackMode === "HORIZONTAL" || n.stackMode === "VERTICAL") {
      const pad = (k, legacy) => n[k] ?? n[legacy] ?? 0;
      out.layout = {
        mode: n.stackMode, gap: n.stackSpacing || 0, counterGap: n.stackCounterSpacing || 0, wrap: n.stackWrap === true,
        padding: { top: pad("stackPaddingTop", "stackVerticalPadding"), bottom: pad("stackPaddingBottom", "stackVerticalPadding"), left: pad("stackPaddingLeft", "stackHorizontalPadding"), right: pad("stackPaddingRight", "stackHorizontalPadding") },
        primaryAlign: ({ SPACE_EVENLY: "SPACE_BETWEEN", SPACE_BETWEEN: "SPACE_BETWEEN" }[n.stackPrimaryAlignItems]) || n.stackPrimaryAlignItems || "MIN",
        counterAlign: n.stackCounterAlignItems || "MIN",
        primarySizing: sizing(n.stackPrimarySizing), counterSizing: sizing(n.stackCounterSizing),
      };
    }
    if (parentRaw && (parentRaw.stackMode === "HORIZONTAL" || parentRaw.stackMode === "VERTICAL")) {
      out.childLayout = { grow: n.stackChildPrimaryGrow ? 1 : 0, align: n.stackChildAlignSelf === "STRETCH" ? "STRETCH" : "INHERIT", positioning: n.stackPositioning === "ABSOLUTE" ? "ABSOLUTE" : "AUTO" };
    }
    if (type === "TEXT") {
      const lh = n.lineHeight, ls = n.letterSpacing;
      const fs = n.fontSize || 16;
      const style = {
        fontFamily: n.fontName?.family, fontStyle: n.fontName?.style, fontSize: fs,
        textAlignHorizontal: n.textAlignHorizontal, textAlignVertical: n.textAlignVertical, textCase: n.textCase, textDecoration: n.textDecoration,
        textAutoResize: { WIDTH_AND_HEIGHT: "WIDTH_AND_HEIGHT", HEIGHT: "HEIGHT", NONE: "NONE", TRUNCATE: "NONE" }[n.textAutoResize] || "NONE",
        letterSpacing: ls ? (ls.units === "PERCENT" ? (ls.value / 100) * fs : ls.value) : 0,
      };
      if (lh && lh.units === "PIXELS") { style.lineHeightUnit = "PIXELS"; style.lineHeightPx = lh.value; }
      else if (lh && lh.units === "PERCENT") { style.lineHeightUnit = "PIXELS"; style.lineHeightPx = (lh.value / 100) * fs; }
      const chars = n.textData?.characters ?? "";
      out.text = { characters: chars, style, runs: [{ text: chars }] };
      const ids = n.textData?.characterStyleIDs;
      if (ids?.length && n.textData?.styleOverrideTable?.length) {
        unsupported.add("Mixed text styles are only partially supported in .fig files");
        const table = new Map(n.textData.styleOverrideTable.map((s) => [s.styleID, s]));
        const runs = []; let start = 0;
        for (let i = 1; i <= chars.length; i++) {
          if (i === chars.length || (ids[i] || 0) !== (ids[start] || 0)) {
            const o = table.get(ids[start] || 0);
            runs.push(o ? { text: chars.slice(start, i), style: { ...style, ...(o.fontSize ? { fontSize: o.fontSize } : {}), ...(o.fontName ? { fontFamily: o.fontName.family, fontStyle: o.fontName.style } : {}), ...(o.textDecoration ? { textDecoration: o.textDecoration } : {}) }, fills: o.fillPaints?.map((p) => paint(p, images)) } : { text: chars.slice(start, i) });
            start = i;
          }
        }
        out.text.runs = runs;
      }
    }
    if (type === "INSTANCE") {
      const sym = gk(n.symbolData?.symbolID);
      out.componentId = sym; out.componentName = sym && raw.get(sym)?.name;
    }
    if (["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "LINE"].includes(type) && n.fillGeometry?.length) {
      const fill = (n.fillPaints || []).find((p) => p.visible !== false && p.color);
      const svg = svgForVector(n, blobs, toCssColor(fill?.color, fill?.opacity ?? 1));
      if (svg) { svgs.set(out.id, svg); out.svg = true; } else unsupported.add("Some vector shapes could not be decoded and are emitted as empty boxes");
    }
    if (n.layoutGrids?.length) unsupported.add("Layout grids are ignored");
    if (n.prototypeInteractions?.length) unsupported.add("Prototype interactions are ignored");

    const childIds = kids.get(id) || [];
    out.children = childIds.map((c) => make(c.id, n, idPrefix)).filter(Boolean);
    // Instances saved without a child tree: fall back to the main component's tree (overrides NOT applied).
    if (type === "INSTANCE" && !out.children.length) {
      const sym = gk(n.symbolData?.symbolID);
      if (sym && raw.has(sym) && !memo.get(sym)) {
        memo.set(sym, true);
        out.children = (kids.get(sym) || []).map((c) => make(c.id, raw.get(sym), `${out.id};`)).filter(Boolean);
        memo.set(sym, false);
        unsupported.add("Instances without stored children were expanded from their main component; overrides are not applied");
      }
    }
    return out;
  };

  const root = [...raw.values()].find((n) => n.type === "DOCUMENT");
  const pages = (kids.get(gk(root?.guid)) || []).map((c) => make(c.id, root)).filter((p) => p && p.type === "PAGE" && p.name !== "Internal Only Canvas");
  if (!pages.length) throw new FigParseError("No design pages were found in this file.", "EMPTY_DOCUMENT");
  for (const p of pages) { p.width = 0; p.height = 0; }
  const components = {};
  for (const [id, n] of raw) if (n.type === "SYMBOL") components[id] = { name: n.name };
  return {
    source: "fig-file", name: meta?.file_name || "Figma file", version: String(version ?? ""), pages, components,
    unsupportedFeatures: [...unsupported].sort(),
    assets: { images: usedImages, svgs },
  };
}
