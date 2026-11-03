"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildPreviewDoc, PREVIEW_SANDBOX } from "@/lib/preview/build-doc";
import { cn } from "@/lib/utils";

export const VIEWPORTS = { desktop: { label: "Desktop", width: 1280 }, tablet: { label: "Tablet", width: 820 }, mobile: { label: "Mobile", width: 390 } };

/**
 * Sandboxed live preview. The iframe has an opaque origin (sandbox="allow-scripts" only), so generated
 * code cannot read this app's cookies, storage or DOM. Messages are accepted only from our own frame.
 * The page renders at the true viewport width and is scaled down to fit the pane, so breakpoints behave as on a real device.
 */
export function PreviewFrame({ files, framework, styling, page, viewport = "desktop", reloadKey = 0, onMessage, className }) {
  const ref = useRef(null);
  const wrap = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const srcDoc = useMemo(() => (files.length ? buildPreviewDoc({ files, framework, styling, page, origin: window.location.origin }) : ""), [files, framework, styling, page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e) => { if (e.source === ref.current?.contentWindow && e.data?.source === "f2c-preview") onMessage?.(e.data); };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, [onMessage]);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const width = VIEWPORTS[viewport]?.width ?? 1280;
  const scale = Math.min(1, (box.w - 8) / width);
  return (
    <div ref={wrap} className={cn("h-full w-full overflow-hidden bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] [background-size:16px_16px]", className)}>
      {srcDoc && (
        <div style={{ width: width * scale, height: box.h, margin: "0 auto" }}>
          <iframe ref={ref} key={`${reloadKey}-${viewport}`} title="Live preview" sandbox={PREVIEW_SANDBOX} srcDoc={srcDoc} referrerPolicy="no-referrer"
            className="block border-0 bg-white shadow-sm" style={{ width, height: box.h / scale, transform: `scale(${scale})`, transformOrigin: "top left" }} />
        </div>)}
    </div>
  );
}
