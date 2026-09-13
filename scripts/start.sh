#!/bin/sh
# Starts the sandbox node. Headless by default; pass --gui for the node's
# own Swing window, or --reset to begin from an empty chain.
#
# --reset lives here rather than in the console because the node holds its
# database open while it runs: emptying the chain means stopping it first, and
# no web page can do that. The console can only wind the chain back to block 1,
# which is as far as popOff goes.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

[ -f signum-node.jar ] || { echo "start: signum-node.jar missing - run ./scripts/bootstrap.sh" >&2; exit 1; }
[ -f html/sandbox/index.html ] || echo "start: warning - html/sandbox/index.html missing, / will 404 until you run 'bun run build'" >&2

MODE="--headless"
RESET=""
for arg in "$@"; do
  case "$arg" in
    --gui) MODE="" ;;
    --reset) RESET="yes" ;;
    *) echo "start: unknown option $arg" >&2; exit 1 ;;
  esac
done

# Asked for, never volunteered: a prompt on every start would be answered
# "keep it" almost every time, and a question you always answer the same way
# stops being read.
if [ -n "$RESET" ]; then
  printf 'start: delete the chain in db/ and begin from empty? [y/N] '
  read -r answer
  case "$answer" in
    y|Y|yes|YES) rm -rf db && echo "start: chain deleted" ;;
    *) echo "start: kept the existing chain" ;;
  esac
fi

echo "start: http://localhost:6876/"
# shellcheck disable=SC2086
exec java -jar signum-node.jar $MODE -c ./conf/
