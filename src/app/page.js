import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Boxes, Braces, GitCompare, Layers, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/services/auth/session";

export const dynamic = "force-dynamic";

const features = [
  { icon: Layers, title: "Auto Layout → Flexbox", text: "Gap, padding, alignment and sizing modes map to real CSS. Frames without Auto Layout get flow inferred from geometry; the rest use constraints." },
  { icon: Boxes, title: "Reusable components", text: "Structurally identical subtrees and Figma instances become React/Next components with props for the text and images that differ." },
  { icon: GitCompare, title: "Deterministic output", text: "Same design, same settings, same code — every time. An honest conversion report lists approximations and unsupported features." },
  { icon: Users, title: "Built for teams", text: "Workspaces, roles, email invitations, version history and one-click ZIP export." },
  { icon: ShieldCheck, title: "Safe by default", text: "Previews run in a sandboxed iframe with an opaque origin. Uploads are validated, tokens are encrypted." },
  { icon: Braces, title: "HTML, React or Next.js", text: "Plain CSS or Tailwind v4. Generated projects install and build on their own." },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between p-5">
        <span className="flex items-center gap-2 font-semibold"><span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Braces className="size-4" /></span>Figma2Code</span>
        <div className="flex gap-2"><Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button><Button asChild><Link href="/register">Get started</Link></Button></div>
      </header>
      <section className="relative mx-auto max-w-4xl px-5 pb-20 pt-16 text-center">
        <div className="pointer-events-none absolute inset-x-0 -top-20 -z-10 h-96 bg-[radial-gradient(50%_60%_at_50%_0%,oklch(0.6_0.2_275/0.18),transparent)]" />
        <p className="mb-4 inline-block rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground">no LLM · no prompts · just a compiler</p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Turn Figma designs into code you&apos;d actually ship</h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">Import a Figma file, pick frames, choose HTML, React or Next.js with CSS or Tailwind, then edit, preview and download the project. Completely free.</p>
        <div className="mt-8 flex justify-center gap-3"><Button asChild size="lg"><Link href="/register">Start converting<ArrowRight /></Link></Button><Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button></div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-card p-5"><div className="mb-3 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div><h3 className="font-medium">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>))}
      </section>
    </div>
  );
}
