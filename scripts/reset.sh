#!/bin/sh
# Last-resort chain reset: stop the node, drop its database, start it again.
# The console tries popOff and fullReset first; this is what it names when
# neither worked.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

if pgrep -f signum-node.jar >/dev/null; then
  echo "reset: stopping the node"
  pkill -f signum-node.jar
  while pgrep -f signum-node.jar >/dev/null; do sleep 0.5; done
fi

echo "reset: removing db/"
rm -rf db

echo "reset: starting the node"
exec ./scripts/start.sh
