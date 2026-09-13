#!/bin/sh
# Assembles the deliverable a non-developer downloads from GitHub Releases.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
NODE_VERSION=$(cat .signum-node-version)
NAME="signum-sandbox-${VERSION}"
OUT="build/$NAME"

[ -f signum-node.jar ] || { echo "package: signum-node.jar missing - run ./scripts/bootstrap.sh" >&2; exit 1; }
[ -d html/api-doc ] || { echo "package: html/api-doc missing - run ./scripts/bootstrap.sh" >&2; exit 1; }

echo "package: building the UI"
bun run build

# Without this the deliverable would serve a bare 404 at / with no explanation.
[ -f html/sandbox/index.html ] || { echo "package: the UI build produced no html/sandbox/index.html" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/conf" "$OUT/html" "$OUT/scripts"

cp signum-node.jar "$OUT/"
cp conf/node.properties conf/node-default.properties conf/logging-default.properties "$OUT/conf/"
cp -R html/sandbox "$OUT/html/sandbox"
cp -R html/api-doc "$OUT/html/api-doc"
cp scripts/start.sh "$OUT/scripts/start.sh"
cp scripts/start.cmd "$OUT/scripts/start.cmd"
chmod +x "$OUT/scripts/start.sh"
cp LICENSE "$OUT/LICENSE"
cp LICENSE-signum-node.txt "$OUT/LICENSE-signum-node.txt"
cp README.md "$OUT/README.md"

cat > "$OUT/VERSIONS.txt" <<EOF
signum-sandbox $VERSION
signum-node    $NODE_VERSION
EOF

( cd build && rm -f "$NAME.zip" && zip -qr "$NAME.zip" "$NAME" )
echo "package: build/$NAME.zip"
