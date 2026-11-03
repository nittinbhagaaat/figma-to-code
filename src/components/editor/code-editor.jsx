"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";

const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> });

// Self-hosted Monaco (copied to /public/monaco by scripts/build-preview-vendor.mjs): no CDN dependency.
let configured = false;
function configure() { if (!configured) { loader.config({ paths: { vs: "/monaco/vs" } }); configured = true; } }

const LANG = { js: "javascript", jsx: "javascript", mjs: "javascript", css: "css", html: "html", json: "json", md: "markdown", svg: "xml" };
export const languageOf = (path) => LANG[path.split(".").pop()] || "plaintext";

export function CodeEditor({ path, value, readOnly, onChange, onSave, reveal }) {
  const { resolvedTheme } = useTheme();
  useEffect(() => { configure(); }, []);
  configure();
  return (
    <Monaco path={path} language={languageOf(path)} value={value} theme={resolvedTheme === "dark" ? "vs-dark" : "light"} height="100%"
      onChange={(v) => onChange(v ?? "")}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave());
        if (reveal) { editor.revealLineInCenter(reveal); editor.setPosition({ lineNumber: reveal, column: 1 }); editor.focus(); }
      }}
      options={{ readOnly, minimap: { enabled: false }, fontSize: 13, tabSize: 2, scrollBeyondLastLine: false, automaticLayout: true, wordWrap: "on", padding: { top: 8 }, fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }} />
  );
}
