/**
 * Runs INSIDE the sandboxed iframe (opaque origin, no cookies, no access to the parent app).
 * Provides: console/error forwarding, a tiny CommonJS-style module loader, Sucrase JSX/ESM transpile,
 * CSS injection and minimal shims for next/link and next/image.
 */
export const BOOT_SCRIPT = String.raw`
(function () {
  var send = function (type, payload) { try { parent.postMessage(Object.assign({ source: "f2c-preview", type: type }, payload), "*"); } catch (e) {} };
  ["log", "info", "warn", "error"].forEach(function (l) {
    var orig = console[l];
    console[l] = function () {
      orig.apply(console, arguments);
      send("console", { level: l, text: Array.prototype.map.call(arguments, function (x) { try { return typeof x === "string" ? x : JSON.stringify(x); } catch (e) { return String(x); } }).join(" ") });
    };
  });
  var showError = function (msg) {
    send("error", { message: msg });
    var el = document.getElementById("f2c-error");
    if (!el) { el = document.createElement("pre"); el.id = "f2c-error"; el.style.cssText = "position:fixed;inset:0;margin:0;padding:16px;background:#1a0b0b;color:#ffb4b4;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow:auto;z-index:2147483647"; document.body.appendChild(el); }
    el.textContent = "Preview error\n\n" + msg;
  };
  window.addEventListener("error", function (e) { showError(e.message + (e.lineno ? " (line " + e.lineno + ")" : "")); });
  window.addEventListener("unhandledrejection", function (e) { showError(String((e.reason && e.reason.message) || e.reason)); });

  var cfg = JSON.parse(document.getElementById("f2c-config").textContent);
  if (cfg.kind === "html") { send("ready", {}); return; }
  var F = window.__F2C;
  if (!F) { showError("Preview runtime failed to load."); return; }
  var files = cfg.files, cache = {};
  var EXT = ["", ".jsx", ".js", ".css", "/index.jsx", "/index.js"];
  var norm = function (p) { var out = []; p.split("/").forEach(function (s) { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); }); return out.join("/"); };
  var dirOf = function (p) { return p.indexOf("/") < 0 ? "" : p.slice(0, p.lastIndexOf("/")); };
  var tw = cfg.styling === "tailwind";
  var addCss = function (css) {
    var s = document.createElement("style");
    if (tw) s.setAttribute("type", "text/tailwindcss");
    s.textContent = css; document.head.appendChild(s);
  };
  var shims = {
    "react": F.React, "react-dom": F.ReactDOM, "react-dom/client": F.ReactDOMClient, "react/jsx-runtime": F.jsxRuntime, "react/jsx-dev-runtime": F.jsxRuntime,
    "next/link": function Link(p) { var rest = Object.assign({}, p); var c = rest.children; delete rest.children; return F.React.createElement("a", rest, c); },
    "next/image": function Img(p) { var rest = Object.assign({}, p); delete rest.priority; return F.React.createElement("img", rest); }
  };
  var loadFile = function (path) {
    if (cache[path]) return cache[path].exports;
    var src = files[path];
    var mod = { exports: {} }; cache[path] = mod;
    if (/\.css$/.test(path)) { addCss(src); return mod.exports; }
    if (/\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(path)) { mod.exports = src; return src; }
    var code;
    try { code = F.Sucrase.transform(src, { transforms: ["jsx", "imports"], jsxRuntime: "automatic", production: true, filePath: path }).code; }
    catch (e) { throw new Error(path + ": " + e.message); }
    var req = function (name) { return requireFrom(path, name); };
    new Function("require", "module", "exports", code)(req, mod, mod.exports);
    return mod.exports;
  };
  var requireFrom = function (from, name) {
    if (Object.prototype.hasOwnProperty.call(shims, name)) return shims[name];
    if (name[0] === "." || name[0] === "/") {
      var base = name[0] === "/" ? norm(name) : norm(dirOf(from) + "/" + name);
      for (var i = 0; i < EXT.length; i++) if (Object.prototype.hasOwnProperty.call(files, base + EXT[i])) return loadFile(base + EXT[i]);
      throw new Error("Cannot find module '" + name + "' imported from " + from);
    }
    throw new Error("Module '" + name + "' is not available in the preview sandbox (only react, react-dom, next/link, next/image and relative imports).");
  };
  var get = function (m) { return m && m.__esModule ? m.default : (m && m.default) || m; };
  try {
    var root = document.getElementById("root");
    if (cfg.kind === "react") {
      requireFrom("", "./" + cfg.entry);
    } else {
      var route = (location.hash.replace(/^#/, "") || "/").replace(/\/+$/, "") || "/";
      var page = route === "/" ? "app/page.js" : "app" + route + "/page.js";
      if (!files[page]) page = "app/page.js";
      Object.keys(files).filter(function (p) { return /(^|\/)globals\.css$/.test(p); }).forEach(function (p) { loadFile(p); });
      var Page = get(loadFile(page));
      F.ReactDOMClient.createRoot(root).render(F.React.createElement(Page));
    }
    send("ready", {});
  } catch (e) { showError(e && e.stack ? e.message : String(e)); }
})();
`;
