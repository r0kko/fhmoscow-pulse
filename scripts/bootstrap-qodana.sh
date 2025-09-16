#!/bin/sh

set -eu

echo "[qodana] Installing server dependencies"
npm ci --no-audit --ignore-scripts

if [ -d "client" ] && [ -f "client/package.json" ]; then
  echo "[qodana] Installing client dependencies"
  npm ci --no-audit --ignore-scripts --prefix client
fi
