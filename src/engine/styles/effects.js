import { colorToCss } from "./color.js";
import { px } from "../utils/number.js";

/** Maps Figma effects to CSS box-shadow / filter / backdrop-filter / text-shadow. */
export function effectsToCss(effects, { isText = false } = {}) {
  const out = {};
  const shadows = [];
  const notes = [];
  for (const e of (effects || []).filter((x) => x.visible !== false)) {
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      const s = `${e.type === "INNER_SHADOW" && !isText ? "inset " : ""}${px(e.offset?.x || 0)} ${px(e.offset?.y || 0)} ${px(e.radius || 0)}${isText ? "" : ` ${px(e.spread || 0)}`} ${colorToCss(e.color)}`;
      shadows.push(s);
      if (isText && e.type === "INNER_SHADOW") notes.push("Inner shadow on text is not supported by CSS");
    } else if (e.type === "LAYER_BLUR") { out.filter = `blur(${px((e.radius || 0) / 2)})`; notes.push("Layer blur radius approximated as radius/2"); }
    else if (e.type === "BACKGROUND_BLUR") { out["backdrop-filter"] = `blur(${px((e.radius || 0) / 2)})`; notes.push("Background blur radius approximated as radius/2"); }
    else notes.push(`Unsupported effect ${e.type}`);
  }
  if (shadows.length) out[isText ? "text-shadow" : "box-shadow"] = shadows.join(", ");
  return { css: out, notes };
}
