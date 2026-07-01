#!/usr/bin/env bash
set -euo pipefail

# One command to get a clean run of Studio McLeod.
#
# It does three things, in order:
#   1. Stops any copy of the app that is already running, so you never end
#      up with two versions fighting over the same ports.
#   2. Updates the project's dependencies to match the lockfile.
#   3. Starts the app (backend + frontend with live reload).
#
# Run it from a terminal inside the project folder:
#   bash scripts/fresh-start.sh
#
# The app uses two ports:
#   8080  backend (API)
#   5173  frontend (the page you open in the browser)
# Anything still listening on those is stopped before we start.

PORTS=(8080 5173)

if ! root=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "This folder is not a git repository."
  echo "Open the miro-pdf-image-converter folder in your terminal and try again."
  exit 1
fi
cd "${root}"

echo "Project: $(pwd)"
echo

echo "1/3  Stopping any app already running on ports ${PORTS[*]} ..."
stopped=0
for port in "${PORTS[@]}"; do
  # lsof lists the process IDs listening on the port; there may be none.
  pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "${pids}" ]; then
    echo "  port ${port}: stopping process(es) ${pids//$'\n'/ }"
    # Ask nicely first, then force anything that ignores it.
    kill ${pids} 2>/dev/null || true
    sleep 1
    still=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "${still}" ]; then
      kill -9 ${still} 2>/dev/null || true
    fi
    stopped=$((stopped + 1))
  else
    echo "  port ${port}: nothing running"
  fi
done
if [ "${stopped}" -eq 0 ]; then
  echo "  Nothing to stop."
fi
echo

echo "2/3  Updating dependencies ..."
pnpm install
echo

echo "3/3  Starting the app ..."
echo "  Open http://localhost:5173 once you see 'VITE ready'."
echo "  Press Ctrl+C in this window to stop everything."
echo
exec pnpm dev
