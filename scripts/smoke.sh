#!/bin/sh
# Starts the node, checks every mount, shuts down.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

[ -f signum-node.jar ] || { echo "smoke: signum-node.jar missing - run ./scripts/bootstrap.sh" >&2; exit 1; }
[ -f html/sandbox/index.html ] || { echo "smoke: html/sandbox/index.html missing - run 'bun run build'" >&2; exit 1; }
[ -f html/api-doc/index.html ] || { echo "smoke: html/api-doc missing - run ./scripts/bootstrap.sh" >&2; exit 1; }

LOG=$(mktemp)
java -jar signum-node.jar --headless -c ./conf/ > "$LOG" 2>&1 &
NODE_PID=$!
# shellcheck disable=SC2064
trap "kill $NODE_PID 2>/dev/null || true; rm -f '$LOG'" EXIT

echo "smoke: waiting for the node"
i=0
until curl -fsS "http://localhost:6876/api?requestType=getBlockchainStatus" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "smoke: node did not come up within 60s" >&2
    tail -20 "$LOG" >&2
    exit 1
  fi
  sleep 1
done

FAILED=0
check() {
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:6876$1")
  if [ "$code" = "200" ]; then
    echo "  ok   $1"
  else
    echo "  FAIL $1 -> $code"
    FAILED=1
  fi
}

# The admin API always answers 200, errors and all, so a wrong or missing
# API.adminKeyList shows up in the body instead of the status code.
check_admin() {
  body=$(curl -s -X POST "http://localhost:6876$1")
  case "$body" in
    *errorCode*)
      echo "  FAIL $1 -> $body"
      FAILED=1
      ;;
    *)
      echo "  ok   $1"
      ;;
  esac
}

check "/index.html"
check "/api-doc/index.html"
check "/api?requestType=getBlockchainStatus"
# #/console is served by the same index.html as / (hash routing), which the
# check above already covers - no separate assertion needed.
check_admin "/api?requestType=clearUnconfirmedTransactions&apiKey=sandbox"

if ! grep -q "Running in headless mode" "$LOG"; then
  echo "  FAIL node did not start headless"
  FAILED=1
fi
if ! grep -q "Signum-LOCAL-MOCK" "$LOG"; then
  echo "  FAIL node is not on the mock network"
  FAILED=1
fi

[ "$FAILED" -eq 0 ] && echo "smoke: passed" || echo "smoke: failed" >&2
exit "$FAILED"
