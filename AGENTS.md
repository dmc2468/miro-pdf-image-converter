# Studio McLeod — Miro PDF Image Converter

Instructions for every coding agent working in this repo, whichever tool it runs in (Codex, Claude Code, or
anything else). `CLAUDE.md` is a symlink to this file, so there is one set of instructions.

## Critical rules

1. **Never push without the user's explicit go-ahead in the current session.** Committing as you work is fine;
   pushing is not a side effect of it. Every push to `main` triggers a production build and deploy, so batch
   local commits and push once, when asked. This applies in every permission mode — an agent harness may prompt
   before `git push`, but this rule holds even where that prompt is bypassed.
2. **No code comments** — no `//`, no `/* */`, no JSDoc. Names should say exactly what they do — the ronseal
   rule: it does what it says on the tin. If a comment feels necessary, extract the logic into a well-named
   function or rename the variable instead; that keeps one version of the truth, rather than code and a comment
   that can fall out of step. Prose explanation of *why* something was built a certain way belongs in commit
   messages or `sessions/` notes, not in the code.
3. **No AI attribution in commits** — `commit-msg` hook enforces.
4. **Strict TypeScript everywhere** — `.ts` only. No `.js` / `.mjs` / `.cjs` source files.
5. **Interfaces only, no `any`** — use `interface` not `type` for object shapes; `any` is banned outright, use
   `unknown` and narrow.
6. **DRY** — search `src/` for an existing implementation before writing a new one.

## Project Overview

- **Purpose**: Convert architectural PDF drawings into correctly scaled JPEG images for importing into Miro.
- **Architecture**: Node 22+, Express, Vite + React frontend, Tailwind CSS, MongoDB Atlas, S3-compatible object storage, Poppler `pdftoppm` + `sharp` for rendering.
- **Auth**: JWT-based. Bcrypt password hashing. Admin-created users with one-time magic links. No self-registration.
- **Repository**: https://github.com/nbarrett/miro-pdf-image-converter
- **Source**: `src/` (TypeScript only). Frontend in `src/client/`, shared types in `src/shared/`, backend in `src/server/`.

## Auth

JWT bearer tokens signed with `JWT_SECRET`. `requireAuth` middleware decodes and attaches `{ id, email, role }` to the request. Admin-only routes use `requireAdmin` middleware.

Password storage uses bcrypt (12 rounds). Magic links use `crypto.randomBytes(32)` tokens, SHA-256 hashed before storage.

Login is rate-limited (5 attempts per 60s per IP).

## Code Style

- **Double quotes** always, never single
- **No "get" prefixes** on methods
- **`undefined` for absence**
- **`T[]` not `Array<T>`**
- **Immutable operations** — `map` / `reduce` / `filter`
- **kebab-case** for filenames
- **UK English** in commits, README, prose
- **Minimal changes** — patches scoped

## Bans

| Banned | Use instead |
|--------|------------|
| `console.log/warn/error` | the `error` route handler + `next(error)` pattern |
| Inline comments | self-documenting code |
| `any` | concrete types or `unknown` + narrowing |
| `^` / `~` ranges in `package.json` | pin every dependency to an exact version |
| `.js`, `.mjs`, `.cjs` source | `.ts` only |

## Git Workflow

Trunk-based: commit straight to `main`, no merge commits. If local `main` and `origin/main` have diverged
(someone else pushed in the meantime), rebase onto `origin/main` before pushing — never `git merge origin/main`.

- **Conventional commits**: `<type>(<scope>): <description>`
- **Paragraph-style body** — root cause + supporting fixes
- **No literal `\n`** in commit messages
- **`main` is production** — every push to `main` runs the pipeline and deploys to Fly, which is why pushing
  needs the explicit go-ahead (critical rule 1). `main`'s history is also the app's release notes, so it should
  never carry experimental or broken commits.

**Changes that alter behaviour should arrive with tests.** Add unit tests (and integration tests where a
pipeline is involved) that prove the new behaviour, so the pipeline actually exercises the change rather than
just compiling it.

### Rehearsing on `pre-main` (optional)

To prove a change would ship cleanly without touching production: push to `pre-main` (nothing runs
automatically — it is a quiet staging branch), then run the pipeline manually against it: GitHub → Actions →
CI/CD → "Run workflow" → pick `pre-main`, or `gh workflow run CI/CD --ref pre-main`. That runs the entire
pipeline — tests, typecheck, a production `docker build`, and a `/health` smoke test — but never deploys. Only
an actual push to `main` deploys.

### Commit messages are the app's release notes

The release-notes panel (`/admin/release-notes`) renders each commit's subject and body straight from `git log`,
so **every commit message is user-facing** — Duncan (a non-developer) reads it as a changelog entry. Write the
body in the limited markdown that `renderCommitBody` in `src/client/src/App.tsx` actually supports:

- **Headings**: a line starting with `#`, `##` or `###`, alone in its own block (blank line above and below). Use these to group a larger change.
- **Bullets**: lines starting with `- `. Wrapped continuation lines fold into the same bullet.
- **Inline code**: `` `backticks` `` for filenames, commands and identifiers.
- **Issue links**: a bare `#123` becomes a link to the repo's issues.
- **Paragraphs**: any other block; a blank line separates blocks.

Not supported, so avoid (these render as literal text): `**bold**`, italics, markdown links `[text](url)`, numbered lists, code fences, and tables.

Format rules:
- Keep the Conventional-commits subject as the one-line summary.
- Separate blocks with real blank lines (use multiple `-m` flags or a heredoc body). "No literal `\n`" means never the two characters backslash-n, not "single line only".
- Scale the body to the change: a trivial tidy needs no body; a feature or multi-part change earns headings and bullets so the panel reads well.

## Backend Patterns

- **Express app**: constructed in `createApp()` in `src/server/app.ts`, takes `Repositories` and `ObjectStore` as dependencies
- **Async route handlers**: try/catch wrapping with `next(error)` — no wrapper needed, the error middleware at the bottom catches `HttpError` and `Error`
- **Errors**: `HttpError` class from `src/server/errors.ts` — throw with status code and message
- **Validation**: type guards from `src/shared/scaling.ts` (`isPaperSize`, `isOrientation`, `isDrawingScale`)
- **Config**: single `config` object from `src/server/config.ts`, populated from environment variables
- **Scaling table**: `src/shared/scaling.ts` — `PIXEL_WIDTHS` mapping of paper size x orientation x drawing scale → target pixel width. Covered by `src/shared/scaling.test.ts`
- **Conversion pipeline**: `ConversionService` in `src/server/services/conversion.ts` — store sources → render via pdftoppm → resize via sharp → create ZIP → upload to object store → update job record
- **Storage**: `ObjectStore` interface with `S3ObjectStore` and `LocalObjectStore` implementations. Auto-selected based on S3 env vars
- **Frontend**: React components in `src/client/src/App.tsx` (single file for MVP), API client in `src/client/src/api.ts`

## Commands

```bash
pnpm install                # Node 22+ required
pnpm dev                    # concurrently runs Vite dev server + tsx watch on server
pnpm fresh                  # stop stale instances, install deps, start the app
pnpm build                  # Vite build client + tsc build server
pnpm start                  # run dist/server/index.js
pnpm typecheck              # tsc --noEmit on client + server tsconfigs
pnpm test                   # vitest run
```

## Development workflow

`pnpm dev` runs both the Express backend (on port 8080) and the Vite dev server (on port 5173) concurrently. Vite waits for the backend health check before starting, then proxies `/api` and `/health` to the backend. The proxy silently swallows ECONNREFUSED/ECONNRESET errors during `tsx watch` restarts so HMR stays clean.

Editing `sessions/*.md` triggers a full browser reload in dev — a Vite plugin in `vite.config.ts` watches the folder, because the notes are served as API data rather than imported client modules.

For a straight production-like build without Vite: `pnpm build && pnpm start` serves everything through Express on port 8080.

## Key design decisions

### Storage
Both local dev and Fly deployment use the same S3 bucket (`studio-mcleod-miro-images`). The `ObjectStore` interface auto-selects `S3ObjectStore` when S3 env vars are present, falling back to `LocalObjectStore` otherwise. All images persist across restarts and are visible from any environment pointing at the same bucket.

### Auth flow
1. Admin creates a user via the Users panel
2. A one-time magic link is generated and shared
3. The user clicks the link, optionally sets a password (min 10 chars)
4. The user logs in with email + password thereafter
5. Any user can change their own password from the sidebar

No self-registration. No password reset — admins generate a new magic link instead.

### Image previews
Previews silently show "Unavailable" when the backing object doesn't exist in S3 (e.g. old jobs from a previous deployment with a different storage backend). No error banners, no server crashes — the `LocalObjectStore` checks file existence before creating a read stream, and the frontend `.catch()` sets a failed state without propagating errors upward.

### Jobs
Each job row has a delete (X) button. Deletion removes the MongoDB record only — orphaned S3 objects are expected to be cleaned up by a bucket lifecycle policy.

### CI/CD
GitHub Actions (`.github/workflows/main.yml`) runs on push to `main` and on manual `workflow_dispatch`. Two jobs: **verify** (tests + typecheck) and **pipeline** (`build:release-notes` → production `docker build` → `/health` smoke test → `flyctl deploy`). The two deploy steps are guarded by `github.event_name == 'push' && github.ref == 'refs/heads/main'`, so a manual run — for example dispatched against `pre-main` — rehearses the whole pipeline (build + smoke test) without ever deploying. Only an actual push to `main` deploys. Auth uses email/password (not Fly API tokens) because the org token format wasn't accepted by `flyctl deploy`.

## File layout

- `src/shared/` — types, scaling table (shared between client and server)
- `src/client/` — React + Vite frontend
- `src/server/` — Express backend
- `src/server/services/` — conversion pipeline, ZIP creation
- `src/server/repositories/` — MongoDB / in-memory user and job repositories
- `src/server/storage/` — S3 / local object store
- `sessions/` — session write-ups, rendered in the app's Sessions view
