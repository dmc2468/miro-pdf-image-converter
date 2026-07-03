# Studio McLeod — Miro PDF Image Converter

## Code style

No comments in code. Names should say exactly what they do — the ronseal rule: it does what it says on the tin.
If a comment feels necessary, extract the logic into a well-named function or rename the variable instead; that
becomes the one version of the truth, rather than code and a comment that can drift apart.

Prose explanation of *why* something was built a certain way belongs in commit messages or `sessions/` notes, not
in the code.

## Git workflow

Trunk-based: commit straight to `main`, no merge commits. If local `main` and `origin/main` have diverged (someone
else pushed in the meantime), rebase onto `origin/main` before pushing — never `git merge origin/main`.

Never push without the user's explicit go-ahead in the current session — committing is fine, pushing is not a
side effect of it. Every push to `main` triggers a production build and deploy, so batch local commits and push
once, when asked. This applies to every agent working in this repo, whichever permission mode the session runs in
(`.claude/settings.json` also prompts on `git push`, but that prompt is skipped in bypass-permissions mode — this
rule is not).
