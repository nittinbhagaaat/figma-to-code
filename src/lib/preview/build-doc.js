import { BOOT_SCRIPT } from "./boot";

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", avif: "image/avif", ico: "image/x-icon" };
const extOf = (p) => p.split(".").pop().toLowerCase();
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** Turns project files into a self-contained srcdoc string for a sandboxed iframe. Pure (no network). */
export function buildPreviewDoc({ files, framework, styling, origin, page }) {
  const text = {}, assets = {};
  for (const f of files) {
    if (f.binary) assets[f.path] = `data:${MIME[extOf(f.path)] || "application/octet-stream"};base64,${f.content}`;
    else text[f.path] = f.content;
  }
  // asset URL (as written by the generator) -> data URL
  const assetMap = {};
  for (const [p, data] of Object.entries(assets)) {
    if (framework === "html") { assetMap[`../${p}`] = data; assetMap[p] = data; } // ../assets/... must be replaced before assets/...
    else assetMap[`/${p.replace(/^public\//, "")}`] = data; // react/next: /assets/images/x.png
  }
  const inlineAssets = (s) => {
    let out = s;
    for (const [k, v] of Object.entries(assetMap)) if (out.includes(k)) out = out.split(k).join(v);
    return out;
  };
  const vendor = `<script src="${origin}/preview-vendor/tailwind.js"></script>`;
  const runtimeTag = `<script src="${origin}/preview-vendor/runtime.js"></script>`;

  if (framework === "html") {
    const name = page && text[page] ? page : "index.html";
    let html = text[name] || "<p>No index.html</p>";
    html = html.replace(/<script[^>]*@tailwindcss\/browser[^>]*><\/script>/, vendor)
      .replace(/<link[^>]*href="css\/styles\.css"[^>]*>/, () => `<style>${inlineAssets(text["css/styles.css"] || "")}</style>`)
      .replace(/<script src="js\/script\.js"><\/script>/, () => `<script>${(text["js/script.js"] || "").replace(/<\/script/gi, "<\\/script")}</script>`);
    html = inlineAssets(html);
    const cfg = `<script id="f2c-config" type="application/json">${json({ kind: "html" })}</script><script>${BOOT_SCRIPT}</script>`;
    return html.includes("</head>") ? html.replace("</head>", `${cfg}</head>`) : cfg + html;
  }

  const kind = framework === "nextjs" ? "next" : "react";
  const processed = {};
  for (const [p, c] of Object.entries(text)) if (/\.(jsx?|css)$/.test(p) && !/^(vite|next|postcss)\.config/.test(p)) processed[p] = inlineAssets(c);
  const fonts = (text["index.html"] || text["app/layout.js"] || "").match(/https:\/\/fonts\.googleapis\.com\/css2[^"'`\s)]*/);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${fonts ? `<link rel="stylesheet" href="${fonts[0].replace(/&amp;/g, "&")}">` : ""}
${styling === "tailwind" ? vendor : ""}
<style>html,body{margin:0}</style></head><body><div id="root"></div>
${runtimeTag}
<script id="f2c-config" type="application/json">${json({ kind, entry: "src/main.jsx", styling, files: processed })}</script>
<script>${BOOT_SCRIPT}</script></body></html>`;
}

export const PREVIEW_SANDBOX = "allow-scripts"; // deliberately NOT allow-same-origin: generated code gets an opaque origin
