#!/bin/sh
# Starts the sandbox node. Headless by default; pass --gui for the node's
# own Swing window.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

[ -f signum-node.jar ] || { echo "start: signum-node.jar missing - run ./scripts/bootstrap.sh" >&2; exit 1; }
[ -f html/sandbox/index.html ] || echo "start: warning - html/sandbox/index.html missing, / will 404 until you run 'bun run build'" >&2

MODE="--headless"
if [ "${1:-}" = "--gui" ]; then
  MODE=""
  shift
fi

echo "start: http://localhost:6876/"
# shellcheck disable=SC2086
exec java -jar signum-node.jar $MODE -c ./conf/
