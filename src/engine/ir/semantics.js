/** Deterministic mapping from layer names / text metrics to semantic HTML tags. Explicit rules, no guessing. */
const has = (name, re) => re.test(String(name || ""));

export function containerTag(n, { isRoot, depth }) {
  if (isRoot) return "main";
  const name = n.name;
  if (has(name, /^(nav|navbar|navigation|menu)\b/i)) return "nav";
  if (has(name, /^(header|top ?bar)\b/i)) return "header";
  if (has(name, /^footer\b/i)) return "footer";
  if (has(name, /^(button|btn|cta)\b/i)) return "button";
  if (has(name, /^(section|hero|features?|testimonials?|pricing|about|contact|faq)\b/i) && depth <= 2) return "section";
  if (has(name, /^(aside|sidebar)\b/i)) return "aside";
  if (has(name, /^(list)\b/i)) return "ul";
  if (has(name, /^(list ?item|li)\b/i)) return "li";
  return "div";
}

export function textTag(n, state, parentTag = "div") {
  if (["header", "nav", "footer", "button", "li"].includes(parentTag)) return "span";
  const st = n.text?.style || {};
  const size = st.fontSize || 16;
  const weight = st.fontWeight || 400;
  const chars = n.text?.characters || "";
  const multi = /\n/.test(chars);
  if (size >= 32 && !multi && !state.h1) { state.h1 = true; return "h1"; }
  if (size >= 32 && chars.length < 80) return "h2";
  if (size >= 24 && weight >= 600 && chars.length < 60) return "h3";
  if (size >= 20 && weight >= 600 && chars.length < 50) return "h4";
  const long = chars.length > 40 || st.textAutoResize === "HEIGHT";
  return long ? "p" : "span";
}
