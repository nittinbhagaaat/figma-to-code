/** Deterministic naming helpers. */
const GENERIC = /^(frame|group|rectangle|ellipse|vector|line|text|component|instance|section|image|polygon|star|boolean)\s*\d*$/i;

export function words(str) {
  return String(str ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}
export const pascalCase = (s) => words(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
export const camelCase = (s) => { const p = pascalCase(s); return p ? p[0].toLowerCase() + p.slice(1) : ""; };
export const kebabCase = (s) => words(s).map((w) => w.toLowerCase()).join("-");
export const isGenericName = (s) => GENERIC.test(String(s ?? "").trim());

/** Makes a valid JS identifier for a React component. */
export function componentName(raw, fallback = "Section") {
  let n = pascalCase(raw);
  if (!n || isGenericName(raw)) n = n && !isGenericName(raw) ? n : fallback;
  if (/^\d/.test(n)) n = fallback + n;
  const reserved = new Set(["App", "Image", "Link", "Head", "Script", "Main", "Document", "Error"]);
  if (reserved.has(n)) n += "Block";
  return n;
}

/** Hands out unique names in call order: Card, Card2, Card3... */
export function createNamer() {
  const used = new Map();
  return (base) => {
    const key = base.toLowerCase();
    const n = (used.get(key) || 0) + 1;
    used.set(key, n);
    return n === 1 ? base : `${base}${n}`;
  };
}
export function slugify(s, fallback = "page") { return kebabCase(s) || fallback; }
