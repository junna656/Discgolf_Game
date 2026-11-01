#!/bin/sh
# Lädt Butano in der festgelegten Version nach gba/butano (nicht im Repository).
set -e
cd "$(dirname "$0")"
VERSION=$(cat BUTANO_VERSION)
if [ -d butano/.git ] && [ "$(git -C butano describe --tags 2>/dev/null)" = "$VERSION" ]; then
  echo "Butano $VERSION ist schon da."
  exit 0
fi
rm -rf butano
git clone --depth 1 --branch "$VERSION" https://github.com/GValiente/butano.git butano
echo "Butano $VERSION geladen."
