import { round } from "../utils/number.js";

const h = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");

/** {r,g,b,a} (0..1) + extra opacity -> "#rrggbb" or "rgba(...)". */
export function colorToCss(c, opacity = 1) {
  if (!c) return "transparent";
  const a = round((c.a ?? 1) * opacity, 3);
  if (a >= 1) return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
}
