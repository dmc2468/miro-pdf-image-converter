#!/usr/bin/env bash
set -euo pipefail

# Stops VS Code from trying to commit thousands of files.
#
# The usual cause is that folders which should be ignored (node_modules,
# dist, storage, tmp, .env ...) are being tracked by git. This script
# removes them from git only. Nothing is deleted from your disk, so you
# do not need to reinstall or rebuild anything.
#
# Run it from a terminal inside the project folder:
#   bash scripts/clean-workspace.sh
# Add --yes to skip the confirmation prompt.

if ! root=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "This folder is not a git repository."
  echo "Open the miro-pdf-image-converter folder in your terminal and try again."
  exit 1
fi
cd "${root}"

echo "Project: $(pwd)"
before=$(git status --porcelain | wc -l | tr -d " ")
echo "Git currently sees ${before} changed or staged file(s)."
echo

count=$(git ls-files -ci --exclude-standard | wc -l | tr -d " ")

if [ "${count}" -eq 0 ]; then
  echo "Nothing to clean. No ignored files are being tracked by git."
  echo "If VS Code still shows a long list, make sure you have pulled the"
  echo "latest version of the project (it contains the up to date .gitignore)."
  exit 0
fi

echo "${count} ignored file(s) are being tracked by git. Examples:"
git ls-files -ci --exclude-standard | head -10 | sed "s/^/  /"
if [ "${count}" -gt 10 ]; then
  echo "  ... and $((count - 10)) more"
fi
echo
echo "These will be removed from git only. They stay on your disk."
echo

if [ "${1:-}" != "--yes" ] && [ "${1:-}" != "-y" ]; then
  printf "Untrack these %s file(s)? [y/N] " "${count}"
  read -r reply
  case "${reply}" in
    y | Y | yes | YES) ;;
    *)
      echo "Cancelled. Nothing was changed."
      exit 0
      ;;
  esac
fi

git ls-files -ci --exclude-standard -z | xargs -0 git rm --cached --quiet --ignore-unmatch

after=$(git status --porcelain | wc -l | tr -d " ")
echo
echo "Done. Untracked ${count} file(s)."
echo "Git now sees ${after} changed or staged file(s)."
echo
echo "Last step: commit the cleanup so it sticks."
echo "  git commit -m \"chore: stop tracking files that should be ignored\""
