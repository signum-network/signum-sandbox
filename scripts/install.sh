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

unzip -q "$tmp/release.zip" -d "$tmp/x"
launcher="$tmp/x/signum-sandbox-$version/scripts/signum-sandbox"
[ -f "$launcher" ] || die 'install: this release contains no launcher'

sh "$launcher" __bootstrap "$version" "$tmp/release.zip"
