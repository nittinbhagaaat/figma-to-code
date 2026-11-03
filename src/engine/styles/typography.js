import { px, round } from "../utils/number.js";
import { colorToCss } from "./color.js";
import { firstColor } from "./paint.js";

const FONT_WEIGHT_NAMES = { thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400, book: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 };
const GENERIC_FALLBACK = (fam) => (/mono|code|courier/i.test(fam) ? "monospace" : /serif/i.test(fam) && !/sans/i.test(fam) ? "serif" : "sans-serif");

/** Derives numeric weight from a Figma style name like "Semi Bold Italic". */
export function weightFromStyleName(name) {
  const n = String(name || "").toLowerCase().replace(/italic|oblique/g, "").replace(/[\s_-]/g, "");
  return FONT_WEIGHT_NAMES[n] ?? 400;
}

export function fontFamilyCss(fam) {
  if (!fam) return null;
  const q = /\s/.test(fam) ? `'${fam}'` : fam;
  return `${q}, ${GENERIC_FALLBACK(fam)}`;
}

/** Text style (Figma-REST-shaped) -> CSS declarations. */
export function textStyleToCss(s = {}, fills) {
  const css = {};
  if (s.fontFamily) css["font-family"] = fontFamilyCss(s.fontFamily);
  if (s.fontSize) css["font-size"] = px(s.fontSize);
  const weight = s.fontWeight ?? weightFromStyleName(s.fontStyle);
  if (weight) css["font-weight"] = String(weight);
  if (s.italic || /italic|oblique/i.test(s.fontStyle || "")) css["font-style"] = "italic";
  if (s.lineHeightUnit === "PIXELS" && s.lineHeightPx) css["line-height"] = px(s.lineHeightPx);
  else if (s.lineHeightUnit === "FONT_SIZE_%" && s.lineHeightPercentFontSize) css["line-height"] = String(round(s.lineHeightPercentFontSize / 100, 3));
  else if (s.lineHeightPx && s.fontSize && s.lineHeightUnit !== "INTRINSIC_%") css["line-height"] = px(s.lineHeightPx);
  if (s.letterSpacing) css["letter-spacing"] = px(s.letterSpacing);
  const align = { LEFT: "left", CENTER: "center", RIGHT: "right", JUSTIFIED: "justify" }[s.textAlignHorizontal];
  if (align && align !== "left") css["text-align"] = align;
  const deco = { UNDERLINE: "underline", STRIKETHROUGH: "line-through" }[s.textDecoration];
  if (deco) css["text-decoration"] = deco;
  const tc = { UPPER: "uppercase", LOWER: "lowercase", TITLE: "capitalize" }[s.textCase];
  if (tc) css["text-transform"] = tc;
  const color = fills ? firstColor(fills) : null;
  if (color) css.color = color;
  return css;
}

export { colorToCss };
