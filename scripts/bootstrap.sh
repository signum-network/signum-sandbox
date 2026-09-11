#!/bin/sh
# Pulls the artifacts the sandbox needs from a signum-node release.
# Nothing this script writes belongs in git; see .gitignore.
set -eu

REPO="signum-network/signum-node"
BUN_VERSION="1.2.15"

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

VERSION=$(cat .signum-node-version)
if [ "${1:-}" = "--latest" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | sed -n 's/.*"tag_name"[ ]*:[ ]*"v\{0,1\}\([^"]*\)".*/\1/p' | head -1)
  [ -n "$VERSION" ] || { echo "bootstrap: could not resolve the latest release" >&2; exit 1; }
  echo "bootstrap: resolved latest release as $VERSION"
  echo "bootstrap: .signum-node-version still pins $(cat .signum-node-version)"
fi

ZIP="signum-node-v${VERSION}.zip"
URL="https://github.com/$REPO/releases/download/v${VERSION}/${ZIP}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "bootstrap: fetching $URL"
curl -fL --progress-bar -o "$TMP/$ZIP" "$URL" \
  || { echo "bootstrap: download failed: $URL" >&2; exit 1; }
unzip -q "$TMP/$ZIP" -d "$TMP/x"

for required in signum-node.jar conf/node-default.properties conf/logging-default.properties html/api-doc LICENSE.txt; do
  [ -e "$TMP/x/$required" ] || { echo "bootstrap: release is missing $required" >&2; exit 1; }
done

mkdir -p conf html
cp "$TMP/x/signum-node.jar" ./signum-node.jar
cp "$TMP/x/conf/node-default.properties" conf/node-default.properties
cp "$TMP/x/conf/logging-default.properties" conf/logging-default.properties
cp "$TMP/x/LICENSE.txt" ./LICENSE-signum-node.txt
rm -rf html/api-doc
cp -R "$TMP/x/html/api-doc" html/api-doc
echo "bootstrap: node artifacts in place (v$VERSION)"

if command -v bun >/dev/null 2>&1 || command -v node >/dev/null 2>&1; then
  echo "bootstrap: a JavaScript runtime is already installed, not fetching Bun"
else
  ARCH=$(uname -m)
  case "$ARCH" in
    arm64|aarch64) BUN_ARCH="aarch64" ;;
    *)             BUN_ARCH="x64" ;;
  esac
  case "$(uname -s)" in
    Darwin) BUN_OS="darwin" ;;
    Linux)  BUN_OS="linux" ;;
    *)      echo "bootstrap: unsupported platform $(uname -s); install Bun or Node manually" >&2; exit 1 ;;
  esac
  BUN_ZIP="bun-${BUN_OS}-${BUN_ARCH}.zip"
  BUN_URL="https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${BUN_ZIP}"
  echo "bootstrap: no runtime found, fetching $BUN_URL"
  mkdir -p .tools
  curl -fL --progress-bar -o "$TMP/$BUN_ZIP" "$BUN_URL" \
    || { echo "bootstrap: download failed: $BUN_URL" >&2; exit 1; }
  unzip -q -o "$TMP/$BUN_ZIP" -d .tools
  echo "bootstrap: Bun $BUN_VERSION in .tools/bun-${BUN_OS}-${BUN_ARCH}/bun"
fi

echo "bootstrap: done"
