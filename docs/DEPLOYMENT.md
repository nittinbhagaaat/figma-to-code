# Deployment

## Requirements
- Node.js 20.19+ (tested on 22), MongoDB 6+ (local or Atlas), a place to keep files (local disk or a mounted volume).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | e.g. `mongodb+srv://user:pass@cluster.mongodb.net/figma2code` |
| `APP_SECRET` | **yes (prod)** | 32+ random chars (`openssl rand -hex 32`). Encrypts Figma tokens and signs tokens. Changing it invalidates stored Figma tokens. |
| `APP_URL` | yes | Public base URL, used in emailed links and the CSRF origin check |
| `RESEND_API_KEY` **or** `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | yes (prod) | Email delivery. With neither set, mail is printed to the server console (dev only) |
| `EMAIL_FROM` | yes (prod) | Sender, e.g. `Figma2Code <no-reply@yourdomain.com>` (domain must be verified with your provider) |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_DIR` | no | `local` (default) stores parsed designs, assets and version bundles under `.data/storage`. **Mount a persistent volume** there. Implement the 4-method interface in `src/lib/storage.js` for S3/GCS. |
| `MAX_FIG_UPLOAD_MB`, `MAX_IMAGE_UPLOAD_MB` | no | Upload limits (defaults 100 / 15) |
| `FIGMA_API_BASE` | no | Override the Figma API base (proxies/tests). Leave unset in production. |

Figma access is per user: each person saves their own personal access token in **Settings** (scope *File content: read*).

## Build and run
```bash
npm ci
npm run build        # also builds the self-hosted preview runtime + Monaco into /public
npm start            # next start, port 3000
```
`prebuild`/`predev` run `scripts/build-preview-vendor.mjs`, which writes `public/preview-vendor/` and `public/monaco/` (git-ignored).

## Production checklist
- Serve over HTTPS (session cookies become `Secure` when `NODE_ENV=production`).
- Put the app behind a proxy that sets `X-Forwarded-For` **and strips client-supplied values** — rate limits key on it.
- Run behind a request-size limit slightly above `MAX_FIG_UPLOAD_MB` (e.g. nginx `client_max_body_size 110m`).
- Previews run in `sandbox="allow-scripts"` iframes with an opaque origin, so generated code cannot reach app cookies or storage.
  For defence in depth you may also serve `/preview-vendor/*` from a separate origin.
- MongoDB Atlas: allow your server's IP, use a dedicated DB user. TTL indexes clean up sessions, tokens and rate-limit counters automatically.
- Back up MongoDB **and** the storage directory together (documents reference blobs by key).
- Single-node note: storage is local disk; to scale horizontally, implement a shared `STORAGE_DRIVER` first.

## Tests
```bash
npm test                    # unit tests (engine, parsers, permissions, zip, preview)
npm run test:integration    # boots the app on a throwaway MongoDB database; auth, RBAC, invitations, import→generate→version→export
npm run test:e2e            # real Chrome journey; add --all for React, Next.js and HTML
```
Integration/E2E need a MongoDB on `127.0.0.1:27017` and (for E2E) Google Chrome. They use a local stand-in for the Figma API.
