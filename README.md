# Figma2Code

A deterministic **Figma → code compiler** with a full SaaS around it: accounts, workspaces, roles, email
invitations, Figma import, a design inspector, a Monaco-based Code Studio with sandboxed live preview, immutable
version history and ZIP export. **No AI/LLM is used anywhere in conversion.** Free; no billing or limits.

```
Figma URL / .fig ─▶ source adapter ─▶ normalized design tree ─▶ IR (layout analysis, styles)
                                                                   │
                         component extraction ◀────────────────────┘
                                   ▼
                     HTML │ React (Vite) │ Next.js   ×   Plain CSS │ Tailwind v4
```

- **Stack:** Next.js (App Router) · JavaScript only · React · Tailwind v4 · shadcn/ui · Lucide · React Hook Form + Zod · Zustand · Mongoose/MongoDB · Monaco.
- **Engine:** `src/engine/` is UI-independent and has no I/O; it is unit-tested on its own.
- **Docs:** [feature compatibility & limitations](docs/COMPATIBILITY.md) · [deployment](docs/DEPLOYMENT.md)

## Quick start
```bash
cp .env.example .env.local      # set MONGODB_URI and APP_SECRET
npm install
npm run dev                     # http://localhost:3000
```
Register → verify (without an email provider the link is printed in the server console) → create a workspace and a
project → add your Figma token in Settings → import a URL or `.fig` → select frames → generate.

## Layout
```
src/app/            routes + route handlers (api/)      src/engine/    parsers · ir · layout · styles · components · generators
src/services/       auth · workspace · project · team    src/models/    Mongoose schemas
                    figma · conversion · export · email  src/lib/       permissions · rate-limit · storage · preview runtime
```

## Security summary
bcrypt (cost 12) · hashed single-use verify/reset/invite tokens · DB-backed sessions, HttpOnly + SameSite=Lax cookies, new token on every
login (no fixation), all sessions revoked on password reset/change · lockout + Mongo-backed rate limits · same-origin check on mutating
requests · every API enforces workspace membership and role server-side (non-members get 404) · Zod validation on all inputs ·
Figma tokens AES-256-GCM encrypted, never returned to the client · upload signature/size checks, ZIP path-traversal guards ·
preview iframes sandboxed with an opaque origin · generic 500s (no stack traces to clients).

## Known limits (read before relying on it)
See [COMPATIBILITY.md](docs/COMPATIBILITY.md). In short: output is clean and deterministic but not pixel-perfect;
`.fig` parsing is implemented against the real container format but **not yet verified against Figma-produced files**;
screenshots are references only; Code Studio's React/Next preview is an in-iframe transpile, not a full bundler build.
