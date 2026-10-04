#!/bin/sh
# The Signum Sandbox installer.
#
#   curl -fsSL https://github.com/signum-network/signum-sandbox/releases/latest/download/install.sh | sh
#
# Deliberately the dumbest part of this: it finds out what the newest release
# is, downloads it, and hands over to the launcher inside it. Every decision —
# which Java, where things live, how to start — belongs to that launcher,
# because this is the piece that runs on a machine nobody can look at.
set -eu

REPO='signum-network/signum-sandbox'

die() { printf '%s\n' "$*" >&2; exit 1; }

# install_sha256 <file> -> the hex sum. The same tools the launcher falls
# back on: macOS has shasum, most Linux distributions sha256sum.
install_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    die 'install: no sha256sum or shasum on this machine, cannot verify the download'
  fi
}

# sum_verdict <file> <published sum> -> ok | mismatch | absent
#
# Absent is its own answer rather than a pass: releases before 0.2.0 publish
# no sum, and installing those has to stay possible — but loudly.
sum_verdict() {
  [ -n "$2" ] || { printf 'absent'; return 0; }
  if [ "$(install_sha256 "$1")" = "$2" ]; then printf 'ok'; else printf 'mismatch'; fi
}

# install_published_sum <url> -> the sum a release publishes beside its
# archive, or nothing. -L because GitHub redirects release downloads; without
# it the empty redirect body reads as "no sum published".
install_published_sum() {
  curl -fsSL -m 20 "$1" 2>/dev/null | cut -d' ' -f1 || true
}

# Sourced by scripts/launcher.test.sh to reach the functions above. Nothing
# below this line may run then: it downloads a release and installs it over
# whatever is in ~/.signum-sandbox.
[ "${INSTALL_LIB_ONLY:-}" = 1 ] && return 0

command -v curl  >/dev/null 2>&1 || die 'install: curl is required'
command -v unzip >/dev/null 2>&1 || die 'install: unzip is required'
command -v tar   >/dev/null 2>&1 || die 'install: tar is required'

case "$(uname -s)" in
  Darwin|Linux) : ;;
  *) die "install: $(uname -s) is not supported yet — macOS and Linux are" ;;
esac

printf 'install: asking which release is newest\n'
answer=$(curl -fsS -m 20 "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null || true)
version=$(printf '%s' "$answer" \
  | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/p' | head -1)
[ -n "$version" ] || die "install: could not find a release of $REPO"

tmp=$(mktemp -d)
# Removed even when something fails: the alternative is a stray 60MB in /tmp
# for every attempt somebody makes.
trap 'rm -rf "$tmp"' EXIT

zip_url="https://github.com/$REPO/releases/download/v$version/signum-sandbox-$version.zip"
printf 'install: downloading %s\n' "$version"
curl -fL --retry 2 --progress-bar -o "$tmp/release.zip" "$zip_url" \
  || die "install: could not download $zip_url"

published=$(install_published_sum "$zip_url.sha256")
case $(sum_verdict "$tmp/release.zip" "$published") in
  ok)       printf 'install: checksum verified\n' ;;
  mismatch) die "install: $zip_url does not match its published checksum — not installing it" ;;
  absent)   printf 'install: %s publishes no .sha256 beside it — installing unverified\n' "$version" >&2 ;;
esac

unzip -q "$tmp/release.zip" -d "$tmp/x"
launcher="$tmp/x/signum-sandbox-$version/scripts/signum-sandbox"
[ -f "$launcher" ] || die 'install: this release contains no launcher'

sh "$launcher" __bootstrap "$version" "$tmp/release.zip"
