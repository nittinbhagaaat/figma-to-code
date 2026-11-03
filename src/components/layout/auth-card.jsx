import Link from "next/link";
import { Braces } from "lucide-react";

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_20%,oklch(0.55_0.2_275/0.35),transparent)]" />
        <Link href="/" className="relative flex items-center gap-2 text-lg font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Braces className="size-4" /></span>Figma2Code</Link>
        <div className="relative max-w-md space-y-4">
          <p className="font-mono text-sm text-zinc-400">{"<Frame/> → <Component/>"}</p>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">A compiler for your designs, not a prompt.</h2>
          <p className="text-zinc-400">Auto Layout becomes flexbox, repeated structures become components, and the same input always produces the same code.</p>
        </div>
        <p className="relative text-xs text-zinc-500">No AI in the conversion path. Free to use.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
