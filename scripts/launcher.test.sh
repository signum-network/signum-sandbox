#!/bin/sh
# Tests for the launcher's decisions — the parts that take inputs and return a
# string. The effects (downloading, unpacking, starting a JVM) are covered by
# scripts/linux-e2e.sh instead, because asserting them here would mean
# pretending a mock is a filesystem.
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# A sourced sh script cannot find its own directory, so we tell it where the
# pinned JRE data is rather than letting it guess from $0, which here would be
# this file.
SIGNUM_SANDBOX_PINNED="$HERE/jre.pinned"
export SIGNUM_SANDBOX_PINNED
LAUNCHER_LIB_ONLY=1 . "$HERE/signum-sandbox"

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

# ── platform_id ────────────────────────────────────────────────
check 'apple silicon'   'mac_aarch64'   "$(platform_id Darwin arm64)"
check 'intel mac'       'mac_x64'       "$(platform_id Darwin x86_64)"
check 'linux amd64'     'linux_x64'     "$(platform_id Linux x86_64)"
check 'linux arm'       'linux_aarch64' "$(platform_id Linux aarch64)"
check 'linux arm64 alias' 'linux_aarch64' "$(platform_id Linux arm64)"
check 'unsupported os'  ''              "$(platform_id FreeBSD x86_64 || true)"
check 'unsupported arch' ''             "$(platform_id Linux riscv64 || true)"

# ── jre_url ────────────────────────────────────────────────────
check 'url for apple silicon' \
  'https://api.adoptium.net/v3/binary/version/jdk-21.0.12.1%2B1/mac/aarch64/jre/hotspot/normal/eclipse' \
  "$(jre_url mac_aarch64)"
check 'url for linux amd64' \
  'https://api.adoptium.net/v3/binary/version/jdk-21.0.12.1%2B1/linux/x64/jre/hotspot/normal/eclipse' \
  "$(jre_url linux_x64)"

# ── jre_sha: every platform this build claims must have one ────
for p in mac_aarch64 mac_x64 linux_x64 linux_aarch64; do
  sha=$(jre_sha "$p")
  case $sha in
    ????????????????????????????????????????????????????????????????) check "sha present for $p" 'ok' 'ok' ;;
    *) check "sha present for $p" 'a 64-character sum' "$sha" ;;
  esac
done

# ── java_binary ────────────────────────────────────────────────
check 'java on macOS' \
  '/tmp/jre/jdk-21.0.12.1+1-jre/Contents/Home/bin/java' \
  "$(java_binary mac_aarch64 /tmp/jre)"
check 'java on linux' \
  '/tmp/jre/jdk-21.0.12.1+1-jre/bin/java' \
  "$(java_binary linux_x64 /tmp/jre)"

printf '\n'
if [ "$fails" -eq 0 ]; then
  printf 'all checks passed\n'
else
  printf '%s check(s) failed\n' "$fails"
  exit 1
fi
