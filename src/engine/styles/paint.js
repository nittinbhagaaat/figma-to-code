import { colorToCss } from "./color.js";
import { round } from "../utils/number.js";

/**
 * Converts a Figma paint list (bottom-to-top) to CSS background layers.
 * Returns { layers: string[], color: string|null, images: string[] (imageRefs), approximations: string[] }.
 * CSS stacks first-listed on top, so Figma's order is reversed.
 */
export function paintsToBackground(fills, ctx) {
  const visible = (fills || []).filter((f) => f.visible !== false && (f.opacity ?? 1) > 0);
  const layers = [];
  const images = [];
  const approximations = [];
  let solidOnly = null;
  const ordered = [...visible].reverse();
  for (const f of ordered) {
    const op = f.opacity ?? 1;
    if (f.type === "SOLID") {
      const css = colorToCss(f.color, op);
      layers.push(`linear-gradient(${css}, ${css})`);
      solidOnly = css;
    } else if (f.type === "GRADIENT_LINEAR") layers.push(linearGradient(f, op));
    else if (f.type === "GRADIENT_RADIAL") layers.push(radialGradient(f, op));
    else if (f.type === "GRADIENT_ANGULAR" || f.type === "GRADIENT_DIAMOND") {
      const stops = stopList(f, op);
      layers.push(f.type === "GRADIENT_ANGULAR" ? `conic-gradient(${stops})` : `radial-gradient(${stops})`);
      approximations.push(`${f.type} fill approximated`);
    } else if (f.type === "IMAGE") {
      const url = ctx?.imageUrl?.(f.imageRef);
      if (url) { layers.push(`url(${url})`); images.push(f.imageRef); }
      else approximations.push(`Image fill ${f.imageRef || ""} has no extracted asset`);
    } else approximations.push(`Unsupported paint type ${f.type}`);
  }
  // A single solid fill is emitted as plain background-color (cleaner CSS).
  if (ordered.length === 1 && ordered[0].type === "SOLID") return { layers: [], color: solidOnly, images, approximations };
  return { layers, color: null, images, approximations };
}

function stopList(f, op) {
  return (f.stops || []).map((s) => `${colorToCss(s.color, op)} ${round(s.position * 100, 1)}%`).join(", ");
}
function linearGradient(f, op) {
  const h = f.handles; // [start, end] in normalised node space
  let angle = 180;
  if (h && h.length >= 2) {
    const dx = h[1].x - h[0].x, dy = h[1].y - h[0].y;
    angle = round((Math.atan2(dy, dx) * 180) / Math.PI + 90, 1);
    if (angle < 0) angle += 360;
  }
  return `linear-gradient(${angle}deg, ${stopList(f, op)})`;
}
function radialGradient(f, op) { return `radial-gradient(circle, ${stopList(f, op)})`; }

/** First solid colour of a paint list, used for text colour and approximations. */
export function firstColor(fills) {
  const f = (fills || []).filter((x) => x.visible !== false).reverse().find((x) => x.type === "SOLID" || x.stops?.length);
  if (!f) return null;
  if (f.type === "SOLID") return colorToCss(f.color, f.opacity ?? 1);
  return colorToCss(f.stops[0].color, f.opacity ?? 1);
}
export const hasGradientText = (fills) => (fills || []).some((f) => f.visible !== false && f.type?.startsWith("GRADIENT"));
