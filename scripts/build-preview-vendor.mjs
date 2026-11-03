// Builds the self-hosted runtime used by the sandboxed preview iframe:
//   public/preview-vendor/runtime.js   React + ReactDOM client + JSX runtime + Sucrase (JSX/ESM transpiler)
//   public/preview-vendor/tailwind.js  @tailwindcss/browser (in-browser Tailwind v4)
// Hosting these ourselves means previews never depend on a CDN and dependencies are resolved from a fixed, audited set.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const out = "public/preview-vendor";
fs.mkdirSync(out, { recursive: true });
const entry = `
import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import { transform } from "sucrase";
window.__F2C = { React, ReactDOM, ReactDOMClient, jsxRuntime, Sucrase: { transform } };
`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "js" }, bundle: true, minify: true, format: "iife", platform: "browser", target: "es2020", outfile: path.join(out, "runtime.js"), define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
fs.copyFileSync("node_modules/@tailwindcss/browser/dist/index.global.js", path.join(out, "tailwind.js"));
console.log("preview vendor built:", fs.readdirSync(out).map((f) => `${f} (${Math.round(fs.statSync(path.join(out, f)).size / 1024)}KB)`).join(", "));

// Monaco editor assets, self-hosted so the Code Studio works offline and with strict CSPs.
fs.rmSync("public/monaco", { recursive: true, force: true });
fs.cpSync("node_modules/monaco-editor/min/vs", "public/monaco/vs", { recursive: true });
console.log("monaco copied");
