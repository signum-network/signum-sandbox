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

# ── installed_version / html_needs_copy / prune_list ──────────
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

check 'no installed file means nothing is installed' '' "$(installed_version "$TMP/installed")"
printf '0.1.0\n' > "$TMP/installed"
check 'installed file is read, newline stripped' '0.1.0' "$(installed_version "$TMP/installed")"

check 'html must be copied when it is absent' 'yes' "$(html_needs_copy 0.1.0 "$TMP/absent/.version")"
mkdir -p "$TMP/html"
printf '0.1.0\n' > "$TMP/html/.version"
check 'html is current' 'no' "$(html_needs_copy 0.1.0 "$TMP/html/.version")"
check 'html is stale after an update' 'yes' "$(html_needs_copy 0.2.0 "$TMP/html/.version")"

# prune_list keeps what it is told to keep and names the rest. Deliberately
# not by mtime: mv preserves the archive's timestamps, so the release just
# installed is not reliably the newest on disk — the first draft deleted it.
mkdir -p "$TMP/app/0.1.0" "$TMP/app/0.2.0" "$TMP/app/0.3.0"
check 'prune names what is kept by nobody' '0.1.0' "$(prune_list "$TMP/app" 0.3.0 0.2.0)"
check 'prune names nothing when all are kept' '' "$(prune_list "$TMP/app" 0.3.0 0.2.0 0.1.0)"
check 'prune never names the active release' '' "$(prune_list "$TMP/app" 0.1.0 0.2.0 0.3.0 | grep -c 0.3.0 | tr -d '0')"

# ── sha256_of, against a file whose sum is known ──────────────
printf 'signum\n' > "$TMP/known.txt"
# Produced with: printf 'signum\n' | shasum -a 256 | cut -d' ' -f1
check 'sha256 of a known file' \
  '0a8abc637f4f2641c3dd39b93fa078ea42b6f988c57f621d93f20b1b594b1149' \
  "$(sha256_of "$TMP/known.txt")"

# ── reset must refuse while a node is running ─────────────────
# reset_verdict <running: yes|no> <confirmed: yes|no> -> delete | refuse | cancelled
check 'refuses while running'              'refuse'    "$(reset_verdict yes yes)"
check 'refuses even unconfirmed'           'refuse'    "$(reset_verdict yes no)"
check 'deletes when stopped and confirmed' 'delete'    "$(reset_verdict no yes)"
check 'cancels when not confirmed'         'cancelled' "$(reset_verdict no no)"

# ── latest_tag reads a version out of the releases API answer ─
api='{"tag_name":"v0.2.0","name":"0.2.0","draft":false}'
check 'tag without the v'          '0.2.0' "$(latest_tag "$api")"
check 'tag that has no v'          '0.2.0' "$(latest_tag '{"tag_name":"0.2.0"}')"
check 'no answer means no version' ''      "$(latest_tag '')"
check 'an error answer means none' ''      "$(latest_tag '{"message":"Not Found"}')"

# ── release_url builds the asset address ──────────────────────
check 'release asset url' \
  'https://github.com/signum-network/signum-sandbox/releases/download/v0.2.0/signum-sandbox-0.2.0.zip' \
  "$(release_url 0.2.0)"

printf '\n'
if [ "$fails" -eq 0 ]; then
  printf 'all checks passed\n'
else
  printf '%s check(s) failed\n' "$fails"
  exit 1
fi
