#!/bin/sh
# Proves that a release can be installed, not merely built.
#
#   sh scripts/e2e-install.sh build/signum-sandbox-0.0.1.zip   # a built archive
#   sh scripts/e2e-install.sh --released                       # the real one-liner
#
# The first form is what .github/workflows/release.yml runs before it creates a
# tag: nothing is published until it has passed. The second runs the line from
# the README unchanged and is for afterwards, by hand — it needs a public
# repository and a release that exists, so it cannot be a gate.
#
# Both run inside debian:stable-slim, which has tar and neither java, curl nor
# unzip. That is the point. We install exactly what install.sh says it needs,
# so anything in the chain that quietly depends on a tool the instructions do
# not mention breaks here, at the line that lies. A GitHub runner has
# everything already and could never show it.
#
# What the container cannot show is the opposite mistake — picking up a system
# java, because there is none to pick up. So the run does not assert that some
# java started; it asserts that the running process is the private one.
#
# POSIX sh: Debian's /bin/sh is dash, which is also the strictest shell the
# launcher ever meets, and running it here is how that gets checked at all.
set -eu

IMAGE='debian:stable-slim'
REPO='signum-network/signum-sandbox'
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

say()  { printf '%s\n' "$*"; }
die()  { printf '%s\n' "$*" >&2; exit 1; }

fails=0
check() {
  # check <label> <expected> <actual>
  if [ "$2" = "$3" ]; then
    printf 'ok   %s\n' "$1"
  else
    printf 'FAIL %s\n       expected: %s\n       actual:   %s\n' "$1" "$2" "$3"
    fails=$((fails + 1))
  fi
}
yesno() { if [ "$1" = 0 ]; then printf 'yes'; else printf 'no'; fi; }

# ── outside: start the container ───────────────────────────────
outer() {
  command -v docker >/dev/null 2>&1 || die 'e2e: docker is required to run this'

  if [ "$1" = '--released' ]; then
    inner_arg='--released'
    say "e2e: $IMAGE, installing the newest release the way the README says"
  else
    [ -f "$1" ] || die "e2e: no such archive: $1"
    # The repository is the only thing mounted, so the archive has to live in
    # it — which it does, package.sh puts it in build/.
    case $1 in
      "$ROOT"/*) rel=${1#"$ROOT"/} ;;
      /*)        die 'e2e: the archive has to be inside the repository; that is what gets mounted' ;;
      *)         rel=$1 ;;
    esac
    [ -f "$ROOT/$rel" ] || die "e2e: no such archive inside the repository: $rel"
    inner_arg="/work/$rel"
    say "e2e: $IMAGE, installing $rel"
  fi

  # Read-only: the test installs into the container's home directory and must
  # not be able to change the repository it is testing.
  docker run --rm -v "$ROOT:/work:ro" "$IMAGE" \
    sh /work/scripts/e2e-install.sh --inside "$inner_arg"
}

# ── inside: install it and make the assertions ─────────────────
prerequisites() {
  check 'this image has no java of its own' '' "$(command -v java || true)"

  export DEBIAN_FRONTEND=noninteractive
  # Only what install.sh claims to need. ca-certificates comes with it because
  # a curl that cannot speak HTTPS is not a curl, not because we need anything
  # extra. --no-install-recommends so nothing else sneaks in.
  apt-get update -qq >/dev/null 2>&1 || apt-get update -qq >/dev/null
  apt-get install -y -qq --no-install-recommends curl unzip ca-certificates >/dev/null
  say 'e2e: curl and unzip installed, nothing else'
}

install_from_archive() {
  archive=$1
  version=$(basename "$archive" .zip)
  version=${version#signum-sandbox-}
  [ -n "$version" ] || die 'e2e: cannot read a version out of that filename'

  # Exactly the two steps install.sh takes once it has downloaded: unpack, then
  # hand the archive to the launcher inside it. The steps before — asking the
  # releases API and downloading — cannot be run against an archive that is not
  # a release yet; --released is where those get covered.
  mkdir -p /tmp/release
  unzip -q "$archive" -d /tmp/release
  launcher="/tmp/release/signum-sandbox-$version/scripts/signum-sandbox"
  [ -f "$launcher" ] || die 'e2e: this archive contains no launcher'
  sh "$launcher" __bootstrap "$version" "$archive"
}

install_from_release() {
  curl -fsSL "https://github.com/$REPO/releases/latest/download/install.sh" | sh
}

wait_for_node() {
  waited=0
  while [ "$waited" -lt 90 ]; do
    if curl -fsS -m 2 "http://localhost:$1/api?requestType=getBlockchainStatus" >/dev/null 2>&1; then
      printf '%s' 'yes'
      return 0
    fi
    waited=$((waited + 1))
    sleep 1
  done
  printf '%s' "nothing after ${waited}s"
}

inside() {
  prerequisites

  if [ "$1" = '--released' ]; then
    install_from_release
  else
    install_from_archive "$1"
  fi

  HOME_DIR="$HOME/.signum-sandbox"
  BIN="$HOME/.local/bin/signum-sandbox"
  version=$(cat "$HOME_DIR/installed" 2>/dev/null || true)

  say ''
  check 'the installation records a version'  'yes' "$(yesno "$([ -n "$version" ]; echo $?)")"
  check 'the launcher was placed and is runnable' 'yes' "$(yesno "$([ -x "$BIN" ]; echo $?)")"
  [ -n "$version" ] || die 'e2e: nothing more can be asserted without an installed version'

  # The launcher travels with the release, so the pinned JRE data is in there
  # too, and reading it is how this test learns the directory name instead of
  # repeating it.
  . "$HOME_DIR/app/$version/scripts/jre.pinned"
  JAVA="$HOME_DIR/jre/$JRE_DIR/bin/java"
  check 'the private jre is unpacked' 'yes' "$(yesno "$([ -x "$JAVA" ]; echo $?)")"

  trap '"$BIN" stop >/dev/null 2>&1 || true' EXIT

  "$BIN" start --daemon
  PID_FILE="$HOME_DIR/run/node.pid"
  check 'starting in the background leaves a pidfile' 'yes' "$(yesno "$([ -f "$PID_FILE" ]; echo $?)")"

  port=6876
  check 'the node answers' 'yes' "$(wait_for_node "$port")"
  check 'the sandbox ui answers'  '200' "$(curl -sL -o /dev/null -w '%{http_code}' "http://localhost:$port/")"
  check 'the api documentation answers' '200' \
    "$(curl -sL -o /dev/null -w '%{http_code}' "http://localhost:$port/api-doc/")"

  # The one assertion the container cannot make for us by being empty: that the
  # jvm running is the one the release brought, not one that happened to be on
  # the machine.
  pid=$(cat "$PID_FILE" 2>/dev/null || true)
  running_java=$(tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null | head -1)
  check 'the running jvm is the private one' "$JAVA" "$running_java"

  status=$("$BIN" status)
  check 'status names the installed version' 'yes' \
    "$(yesno "$(printf '%s' "$status" | grep -q "version: $version"; echo $?)")"
  check 'status sees the background process' 'yes' \
    "$(yesno "$(printf '%s' "$status" | grep -q 'process: running'; echo $?)")"
  check 'status asks the node rather than the pidfile' 'yes' \
    "$(yesno "$(printf '%s' "$status" | grep -q 'answering on port'; echo $?)")"

  check 'the chain exists before we try to delete it' 'yes' \
    "$(yesno "$([ -d "$HOME_DIR/db" ]; echo $?)")"
  if "$BIN" reset >/dev/null 2>&1; then refused=no; else refused=yes; fi
  check 'reset refuses while the node holds the chain' 'yes' "$refused"
  check 'and the chain is still there'                'yes' \
    "$(yesno "$([ -d "$HOME_DIR/db" ]; echo $?)")"

  "$BIN" stop
  check 'stopping removes the pidfile' 'gone' "$([ -f "$PID_FILE" ] && printf 'still there' || printf 'gone')"
  check 'and the process is gone'      'gone' "$(kill -0 "$pid" 2>/dev/null && printf 'alive' || printf 'gone')"

  printf 'y\n' | "$BIN" reset >/dev/null
  check 'reset deletes the chain once nothing holds it' 'gone' \
    "$([ -d "$HOME_DIR/db" ] && printf 'still there' || printf 'gone')"

  printf '\n'
  if [ "$fails" -eq 0 ]; then
    say "e2e: signum-sandbox $version installs, starts, answers and resets"
  else
    say "e2e: $fails check(s) failed"
    exit 1
  fi
}

case "${1:-}" in
  --inside)   shift; inside "${1:?e2e: --inside needs an archive or --released}" ;;
  --released) outer --released ;;
  '')         die 'usage: e2e-install.sh <release zip> | --released' ;;
  *)          outer "$1" ;;
esac
