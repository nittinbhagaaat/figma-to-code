import { buildIR } from "../ir/build.js";
import { createReport } from "../ir/report.js";
import { extractComponents } from "../components/extract.js";
import { createStyleStrategy } from "./style-strategy.js";
import { createRenderer, collectFonts, fontLinks } from "./markup.js";
import { packageJson, viteConfig, nextConfig, postcssConfig, gitignore, readme } from "./scaffold.js";
import { createNamer, slugify, componentName } from "../utils/names.js";
import { hashString } from "../utils/hash.js";

const FRAME_LIKE = new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "GROUP", "SECTION"]);

/** Walks the document and returns the node with `id`, plus its page. */
export function indexDocument(doc) {
  const byId = new Map();
  const visit = (n, page) => { byId.set(n.id, { node: n, page }); (n.children || []).forEach((c) => visit(c, page)); };
  doc.pages.forEach((p) => visit(p, p));
  return byId;
}

/** Resolves selected node ids into root frames. Selecting a page selects its top-level frames. */
export function resolveRoots(doc, selection, report) {
  const idx = indexDocument(doc);
  const roots = [];
  const seen = new Set();
  const add = (n) => { if (!seen.has(n.id)) { seen.add(n.id); roots.push(n); } };
  const ids = selection?.length ? selection : [];
  if (!ids.length && doc.pages[0]) doc.pages[0].children.filter((c) => FRAME_LIKE.has(c.type) && c.visible !== false).forEach(add);
  for (const id of ids) {
    const hit = idx.get(id);
    if (!hit) { report.note(`Selected node ${id} was not found in the imported document`); continue; }
    const n = hit.node;
    if (n.type === "PAGE") n.children.filter((c) => FRAME_LIKE.has(c.type) && c.visible !== false).forEach(add);
    else if (n.type === "SECTION") n.children.filter((c) => FRAME_LIKE.has(c.type)).forEach(add);
    else if (FRAME_LIKE.has(n.type)) add(n);
    else report.skip(n, `${n.type} cannot be converted on its own — select its parent frame`);
  }
  // drop roots nested inside other selected roots
  const containing = (a, b) => { let found = false; const v = (x) => { if (x === b) found = true; (x.children || []).forEach(v); }; a.children?.forEach(v); return found; };
  return roots.filter((r) => !roots.some((o) => o !== r && containing(o, r)));
}

/** Lists the image refs and vector node ids needed by the selection (for asset prefetch). */
export function collectAssetNeeds(doc, selection) {
  const report = createReport();
  const roots = resolveRoots(doc, selection, report);
  const images = new Set(), vectors = [];
  const visit = (n) => {
    if (n.visible === false) return;
    for (const f of n.fills || []) if (f.type === "IMAGE" && f.imageRef) images.add(f.imageRef);
    if (["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "REGULAR_POLYGON"].includes(n.type)) vectors.push(n.id);
    (n.children || []).forEach(visit);
  };
  roots.forEach(visit);
  return { images: [...images], vectors };
}

/**
 * Deterministic Figma → code compile.
 * @param doc        normalized design document
 * @param opts       { selection, framework: html|react|nextjs, styling: css|tailwind, projectName, responsive, inferLayout, componentize }
 * @param assets     { images: Map<ref,{ext,bytes}>, svgs: Map<nodeId,string> }
 * @returns { files:[{path,content,encoding}], report, pages }
 */
export function convertDocument(doc, opts, assets = { images: new Map(), svgs: new Map() }) {
  const { framework = "react", styling = "tailwind", projectName = doc.name || "figma-project" } = opts;
  const report = createReport();
  const roots = resolveRoots(doc, opts.selection, report);
  if (!roots.length) throw Object.assign(new Error("No convertible frames selected"), { code: "NO_FRAMES" });

  const assetFiles = new Map();
  const ctx = {
    options: { responsive: opts.responsive !== false, inferLayout: opts.inferLayout !== false },
    report,
    imageUrl(ref) {
      const a = assets.images.get(ref);
      if (!a) return null;
      const p = `images/${ref.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}.${a.ext || "png"}`;
      assetFiles.set(p, a.bytes);
      return `asset://${p}`;
    },
    svgUrl(id) {
      const s = assets.svgs.get(id);
      if (!s) return null;
      const p = `svg/vector-${hashString(id).slice(0, 8)}.svg`;
      assetFiles.set(p, s);
      return `asset://${p}`;
    },
  };

  const pageNamer = createNamer();
  const pages = roots.map((r) => {
    const base = componentName(r.name, "Page");
    const name = pageNamer(base);
    return { name, slug: slugify(name), ir: buildIR(r, ctx), node: r };
  }).filter((p) => p.ir);
  pages.forEach((p, i) => { p.slug = i === 0 ? "" : slugify(p.name); });

  const files = [];
  const style = createStyleStrategy(styling, { responsive: ctx.options.responsive });
  const componentize = framework !== "html" && opts.componentize !== false;
  let defs = [];
  if (componentize) ({ defs } = extractComponents(pages, { sections: true }));

  const fontUrl = fontLinks(collectFonts([...pages.map((p) => p.ir), ...defs.map((d) => d.template)]));
  const pkgName = slugify(projectName, "figma-project");
  const publicAsset = (s) => String(s).replace(/asset:\/\//g, framework === "html" ? "assets/" : "/assets/");

  if (framework === "html") {
    const resolveHtml = publicAsset;
    const renderers = pages.map(() => createRenderer({ jsx: false, style, resolve: resolveHtml }));
    const bodies = pages.map((p, i) => renderers[i].renderNode(p.ir, 2));
    const tw = styling === "tailwind";
    pages.forEach((p, i) => {
      files.push({ path: i === 0 ? "index.html" : `${p.slug}.html`, content: htmlDoc({ title: `${p.name}`, body: bodies[i], fontUrl, tw }) });
    });
    files.push({ path: "css/styles.css", content: style.stylesheet({ resolveAsset: (s) => s.replace(/asset:\/\//g, "../assets/") }) });
    files.push({ path: "js/script.js", content: `// Generated by Figma2Code. Add interactivity here.\ndocument.documentElement.classList.add("js");\n` });
    files.push({ path: "package.json", content: packageJson({ framework, styling, name: pkgName }) });
  } else {
    const resolveJsx = publicAsset;
    const renderComponentFile = (def) => {
      const r = createRenderer({ jsx: true, style, resolve: resolveJsx });
      const body = r.renderNode(def.template, 2, true);
      const props = ["className = \"\"", ...def.props.map((p) => `${p.name} = ${JSON.stringify(p.type === "image" ? resolveJsx(p.default) : p.default)}`)];
      const imports = [...r.used].filter((n) => n !== def.name).sort().map((n) => `import ${n} from "./${n}";`);
      return `${imports.join("\n")}${imports.length ? "\n\n" : ""}export default function ${def.name}({ ${props.join(", ")} }) {\n  return (\n${body}\n  );\n}\n`;
    };
    const next = framework === "nextjs";
    const compDir = next ? "components" : "src/components";
    for (const def of defs) files.push({ path: `${compDir}/${def.name}.jsx`, content: renderComponentFile(def) });

    const pageFile = (p, rel) => {
      const r = createRenderer({ jsx: true, style, resolve: resolveJsx });
      const body = r.renderNode(p.ir, 2);
      const imports = [...r.used].sort().map((n) => `import ${n} from "${rel}${n}";`);
      return `${imports.join("\n")}${imports.length ? "\n\n" : ""}export default function ${next ? "Page" : p.name}() {\n  return (\n${body}\n  );\n}\n`;
    };
    const cssPath = next ? "app/globals.css" : "src/styles/styles.css";
    if (next) {
      pages.forEach((p, i) => {
        const dir = i === 0 ? "app" : `app/${p.slug}`;
        files.push({ path: `${dir}/page.js`, content: pageFile(p, i === 0 ? "../components/" : "../../components/") });
      });
      files.push({ path: "app/layout.js", content: `import "./globals.css";\n\nexport const metadata = {\n  title: ${JSON.stringify(projectName)},\n  description: "Generated by Figma2Code",\n};\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n${fontUrl ? `      <head>\n        <link rel="preconnect" href="https://fonts.googleapis.com" />\n        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />\n        <link rel="stylesheet" href=${JSON.stringify(fontUrl)} />\n      </head>\n` : ""}      <body>{children}</body>\n    </html>\n  );\n}\n` });
      files.push({ path: "next.config.js", content: nextConfig });
      files.push({ path: "jsconfig.json", content: JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }, null, 2) + "\n" });
      if (styling === "tailwind") files.push({ path: "postcss.config.mjs", content: postcssConfig });
      files.push({ path: "lib/README.md", content: "Shared helpers can live here.\n" });
    } else {
      pages.forEach((p) => files.push({ path: `src/pages/${p.name}.jsx`, content: pageFile(p, "../components/") }));
      files.push({ path: "src/App.jsx", content: appJsx(pages) });
      files.push({ path: "src/main.jsx", content: `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport "./styles/styles.css";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n` });
      files.push({ path: "index.html", content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${escapeHtml(projectName)}</title>\n${fontUrl ? `    <link rel="preconnect" href="https://fonts.googleapis.com" />\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link rel="stylesheet" href="${fontUrl}" />\n` : ""}  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n` });
      files.push({ path: "vite.config.js", content: viteConfig(styling === "tailwind") });
    }
    files.push({ path: cssPath, content: style.stylesheet({ resolveAsset: (s) => s.replace(/asset:\/\//g, "/assets/") }) });
    files.push({ path: "package.json", content: packageJson({ framework, styling, name: pkgName }) });
  }

  const assetRoot = framework === "html" ? "assets" : "public/assets";
  for (const [p, data] of [...assetFiles].sort(([a], [b]) => (a < b ? -1 : 1))) files.push({ path: `${assetRoot}/${p}`, content: data, binary: typeof data !== "string" });
  files.push({ path: ".gitignore", content: gitignore });
  files.push({ path: "README.md", content: readme({ framework, styling, name: projectName, report, pages }) });

  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { files, report: { ...report.data, summary: report.summary(), components: defs.map((d) => ({ name: d.name, instances: d.instances.length, props: d.props.map((p) => p.name) })), pages: pages.map((p) => ({ name: p.name, nodeId: p.node.id })) } };
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function htmlDoc({ title, body, fontUrl, tw }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
${fontUrl ? `    <link rel="preconnect" href="https://fonts.googleapis.com" />\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link rel="stylesheet" href="${fontUrl}" />\n` : ""}${tw ? `    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>\n    <style type="text/tailwindcss">\n      @import "tailwindcss";\n    </style>\n` : ""}    <link rel="stylesheet" href="css/styles.css" />
  </head>
  <body>
${body}
    <script src="js/script.js"></script>
  </body>
</html>
`;
}

function appJsx(pages) {
  if (pages.length === 1) return `import ${pages[0].name} from "./pages/${pages[0].name}";\n\nexport default function App() {\n  return <${pages[0].name} />;\n}\n`;
  const imports = pages.map((p) => `import ${p.name} from "./pages/${p.name}";`).join("\n");
  const routes = pages.map((p, i) => `  { path: ${JSON.stringify(i === 0 ? "/" : "/" + p.slug)}, Component: ${p.name} },`).join("\n");
  return `import { useEffect, useState } from "react";\n${imports}\n\n// Minimal hash router: open #/${pages[1].slug} to see the next page.\nconst routes = [\n${routes}\n];\n\nconst current = () => window.location.hash.replace(/^#/, "") || "/";\n\nexport default function App() {\n  const [path, setPath] = useState(current());\n  useEffect(() => {\n    const onChange = () => setPath(current());\n    window.addEventListener("hashchange", onChange);\n    return () => window.removeEventListener("hashchange", onChange);\n  }, []);\n  const route = routes.find((r) => r.path === path) || routes[0];\n  return <route.Component />;\n}\n`;
}
