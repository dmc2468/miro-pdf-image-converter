# CLAUDE.md

## Critical Rules

1. **NEVER commit or push without explicit instruction** — keep making changes freely until the user says to commit. Only then stage and commit. Pushing is a separate explicit gate: never push unless the user says so.
2. **No code comments** — no `//`, no `/* */`, no JSDoc `/** */`. Self-documenting names.
3. **No AI attribution in commits** — `commit-msg` hook enforces.
4. **Strict TypeScript everywhere** — `.ts` only. No `.js` / `.mjs` / `.cjs` source files.
5. **Interfaces only, no `any`** — use `interface` not `type` for object shapes; `any` is banned outright, use `unknown` and narrow.
6. **DRY** — search `src/` first.

## Project Overview

- **Purpose**: Convert architectural PDF drawings into correctly scaled JPEG images for importing into Miro. Online version of a Python desktop app (`MIRO Converter/PDFtoJPEGscaler.py`).
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

(Stylistic prose preferences live globally in `~/.claude/CLAUDE.md`.)

## Git Workflow

- **Conventional commits**: `<type>(<scope>): <description>`
- **Paragraph-style body** — root cause + supporting fixes
- **100% trunk-based on `main`** — no PRs, no branches, no worktrees
- **No literal `\n`** in commit messages

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
pnpm build                  # Vite build client + tsc build server
pnpm start                  # run dist/server/index.js
pnpm typecheck              # tsc --noEmit on client + server tsconfigs
pnpm test                   # vitest run
```

## File layout

- `src/shared/` — types, scaling table (shared between client and server)
- `src/client/` — React + Vite frontend
- `src/server/` — Express backend
- `src/server/services/` — conversion pipeline, ZIP creation
- `src/server/repositories/` — MongoDB / in-memory user and job repositories
- `src/server/storage/` — S3 / local object store
- `MIRO Converter/` — original Python desktop app (behaviour reference only)
