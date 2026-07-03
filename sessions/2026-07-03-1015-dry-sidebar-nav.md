# Session — 3 July 2026 (A DRY sidebar refactor)

A sidebar alignment bug whose fix is a worked example of an important design concept — DRY (Don't Repeat
Yourself) — followed by the same concept applied to the project's agent instructions (section 4). If you read
one section of these notes, read section 2: it shows, on real code from this app, why fixing a bug in four
places is worse than making it impossible to have the bug at all. Prompts are paraphrased for readability, each
followed by a summary of what was done.

---

## 1. Fix the wonky sidebar alignment

> Alignment looks a bit wonky here. *(screenshot of the sidebar, with "Vectorworks voice commands" centred over
> two lines while everything else sat left-aligned)*

The cause was invisible until now: browsers give `<button>` a default `text-align: center`. Every sidebar button
is a flex row, and a single-line label always starts at flex-start, so the centring never showed. "Vectorworks
voice commands" is the first label long enough to wrap, and the moment it did, both lines centred themselves.

The one-line cure is `text-left` on the button (plus `shrink-0` on the icon so a wrapping label can't squash it).

---

## 2. Make it DRY so this can't happen again

> Make the implementation 100% DRY please, so this can't happen for future items added.

This was the important part. The quick fix would have been pasting `text-left` into four places: the modules loop
and three hand-written admin buttons, each carrying its own copy of the same long className string. Those copies
had already diverged once — that is the whole disease. Duplicated markup does not fail loudly; it quietly lets one
copy rot until a new label happens to be long enough to expose it.

DRY has a direct parallel in building architecture. You do not redraw the same window jamb on every elevation of
a drawing set; you draw the typical detail once and every sheet says "refer to detail D-01". You do not write the
full ironmongery spec against every door on a plan; you tag each door "D1" and define D1 once in the door
schedule. The reason is the same in both trades: when the spec changes, a referenced detail updates everywhere at
once, while five redrawn copies mean someone updates four and the builder builds from the stale fifth. The four
sidebar buttons were four redrawn jamb details, and one of them had quietly gone out of step. The refactor below
is the software equivalent of replacing the redrawn copies with one typical detail and four references to it.

The DRY version removes the duplication rather than patching each copy:

- **One component.** `SidebarNavButton` now owns the button markup, the className string, the active/inactive
  styling, the `text-left`, and the `shrink-0` icon. It is the only place a sidebar button is defined.
- **Data, not markup.** The three admin buttons became an `adminModules` array, the same shape as the existing
  `modules` array. Both sections render by mapping over data through the one component.
- **The payoff.** Adding a future module is now a one-line data change, and it is impossible for it to be styled
  differently from its neighbours, because there is no second definition to get wrong. The alignment bug class is
  gone, not just this instance of it.

Net result: 36 lines added, 54 removed, and the sidebar has one definition of what a nav button is.

---

## 3. Verify it in the running app

Not just typecheck and tests (though both pass — 12 tests). The change was exercised in headless Chrome against
the live dev server, logged in as the seeded admin:

- Measured every nav label's rendered text position: all seven buttons report `text-align: left`, and the wrapped
  "Vectorworks voice commands" label's two lines both start at the same x-coordinate as every other label.
- All icons hold their 18px width next to the wrapping label.
- Clicked through Vectorworks voice commands, Sessions and Miro converter via the new component: routing, the URL
  path, the page heading and the active-button highlight all behave as before.
- Checked the mobile drawer at 375px: same left alignment, admin section intact.

---

## 4. Agent neutrality: one set of instructions, whatever the tool

> `AGENTS.md` and `CLAUDE.md` both exist, but Duncan is using Codex. Can you re-organise this so that it's
> entirely agent neutral?

Different coding agents read different instruction files: Codex reads `AGENTS.md`, Claude Code reads `CLAUDE.md`.
This repo had both, written at different times — and they disagreed. `AGENTS.md` still described an older
"never push to `main` directly, always rehearse on `pre-main`" workflow, while `CLAUDE.md` carried the current
trunk-based rules. So Nick's agent and Duncan's agent were literally working to different rule books, in the
same repo, on the same day.

Notice this is the sidebar bug again, one level up. Two copies of the same thing (the project's working rules),
no mechanism keeping them aligned, and one copy quietly went stale. The fix is also the same fix:

- **One authoritative file.** Everything now lives in `AGENTS.md`, the tool-neutral name, written so it assumes
  nothing about which agent is reading it — no references to any one tool's config or permission modes.
- **A reference, not a copy.** `CLAUDE.md` is now a symlink to `AGENTS.md` — the filesystem equivalent of
  "refer to detail D-01". Claude Code still finds the file it looks for, but there is nothing to keep in sync,
  because there is only one document.
- **Conflicts resolved by recency.** Where the two files disagreed, the newer trunk-based rules won: commit
  straight to `main`, rebase rather than merge, and never push without the user's explicit go-ahead (every push
  to `main` deploys to production). The `pre-main` pipeline rehearsal survives as an optional tool rather than a
  mandatory step.

The concept generalises: whenever the same fact must be visible in two places, store it once and reference it
from the other place. Copies rot; references cannot.

---

## Files touched

| File                                          | Change                                                                                        |
|-----------------------------------------------|-----------------------------------------------------------------------------------------------|
| `src/client/src/App.tsx`                      | New `SidebarNavButton` component and `adminModules` array; four hand-written buttons deleted. |
| `vite.config.ts`                              | Dev-only plugin: editing a session note now reloads the browser automatically.                |
| `AGENTS.md`                                   | The one agent-neutral instruction file, merged from the old `AGENTS.md` and `CLAUDE.md`.      |
| `CLAUDE.md`                                   | Now a symlink to `AGENTS.md`.                                                                 |
| `sessions/2026-07-03-1015-dry-sidebar-nav.md` | This write-up.                                                                                |

## Verification

- `pnpm typecheck` — passed.
- `pnpm test` — passed (12 tests).
- Headless Chrome against the live app — label alignment measured, navigation and active states clicked through,
  mobile drawer checked at 375px.
