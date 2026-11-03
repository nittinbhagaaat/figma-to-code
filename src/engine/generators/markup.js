/** Renders IR trees to HTML or JSX strings. */
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escHtml(s).replace(/"/g, "&quot;");

export function createRenderer({ jsx, style, resolve }) {
  const classAttr = jsx ? "className" : "class";
  const used = new Set();

  const textNode = (s) => {
    const parts = String(s).split("\n");
    return parts.map((p) => (jsx ? jsxText(p) : escHtml(p))).join(jsx ? "<br />" : "<br>");
  };
  const jsxText = (p) => (p === "" ? "" : /^[^{}<>&]*$/.test(p) && p === p.trim() ? p : `{${JSON.stringify(p)}}`);

  function classes(node) {
    const a = style.intrinsic(node), b = style.place(node);
    return [a, b].filter(Boolean).join(" ");
  }
  const attrStr = (name, value) => (jsx && /^[{]/.test(value) ? `${name}=${value}` : `${name}="${escAttr(value)}"`);

  function renderNode(node, indent, inTemplateRoot = false) {
    const pad = "  ".repeat(indent);
    if (node.kind === "component") {
      used.add(node.ref.name);
      const attrs = [];
      const place = style.place(node);
      if (place) attrs.push(attrStr(classAttr, place));
      for (const [k, v] of Object.entries(node.props || {})) {
        const isImg = node.ref.props.find((p) => p.name === k)?.type === "image";
        const val = isImg ? resolve(String(v)) : String(v ?? "");
        attrs.push(/^[^"{}<>\\\n]*$/.test(val) ? `${k}="${escAttr(val)}"` : `${k}={${JSON.stringify(val)}}`);
      }
      return `${pad}<${node.ref.name}${attrs.length ? " " + attrs.join(" ") : ""} />`;
    }
    const attrs = [];
    let cls = classes(node);
    let clsAttr = cls ? attrStr(classAttr, cls) : "";
    if (inTemplateRoot && jsx) clsAttr = cls ? `${classAttr}={\`${cls} \${className}\`.trim()}` : `${classAttr}={className}`;
    if (clsAttr) attrs.push(clsAttr);
    let tag = node.tag;
    if (node.kind === "image") {
      const src = node.image.prop ? `{${node.image.prop}}` : null;
      attrs.push(src ? `src=${src}` : attrStr("src", resolve(node.image.src)));
      attrs.push(attrStr("alt", node.image.alt || ""));
      return `${pad}<${tag} ${attrs.join(" ")}${jsx ? " />" : ">"}`;
    }
    if (node.kind === "text") {
      if (node.attrs?.href) { tag = "a"; attrs.push(attrStr("href", node.attrs.href)); }
      const inner = node.text.runs.map((r) => {
        const body = r.prop ? (jsx ? `{${r.prop}}` : escHtml(r.text)) : textNode(r.text);
        const rc = style.run(r.css, node.name);
        return rc ? `<span ${classAttr}="${rc}">${body}</span>` : body;
      }).join("");
      return `${pad}<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>${inner}</${tag}>`;
    }
    if (node.attrs?.href) attrs.push(attrStr("href", node.attrs.href));
    const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
    if (!node.children.length) return `${pad}${open}</${tag}>`;
    const kids = node.children.map((c) => renderNode(c, indent + 1)).join("\n");
    return `${pad}${open}\n${kids}\n${pad}</${tag}>`;
  }

  return { renderNode, used };
}

/** Collects Google Fonts families + weights referenced by an IR forest. */
export function collectFonts(roots) {
  const fams = new Map();
  const visit = (n) => {
    const scan = (css) => {
      const f = css?.["font-family"];
      if (!f) return;
      const name = f.split(",")[0].replace(/['"]/g, "").trim();
      if (!name || /^(sans-serif|serif|monospace)$/i.test(name)) return;
      if (!fams.has(name)) fams.set(name, new Set());
      fams.get(name).add(Number(css["font-weight"] || 400));
    };
    scan(n.css);
    n.text?.runs.forEach((r) => { if (r.css?.["font-family"]) scan(r.css); });
    n.children?.forEach(visit);
    if (n.kind === "component") { /* template visited separately */ }
  };
  roots.forEach(visit);
  return fams;
}
export function fontLinks(fams) {
  if (!fams.size) return null;
  const q = [...fams].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, w]) => `family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@${[...w, 400].filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b).join(";")}`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}
