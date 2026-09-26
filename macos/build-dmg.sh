#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-1.0.0}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

APP="$WORK/Tafelhelden.app"
CONTENTS="$APP/Contents"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"

SDK="$(xcrun --sdk macosx --show-sdk-path)"
for ARCH in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -parse-as-library -O -target "$ARCH-apple-macos12.0" -sdk "$SDK" \
    "$ROOT/macos/TafelheldenApp.swift" \
    -framework Cocoa -framework WebKit \
    -o "$WORK/Tafelhelden-$ARCH"
done
lipo -create "$WORK/Tafelhelden-arm64" "$WORK/Tafelhelden-x86_64" \
  -output "$CONTENTS/MacOS/Tafelhelden"

cp "$ROOT/macos/Info.plist" "$CONTENTS/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$CONTENTS/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSION" "$CONTENTS/Info.plist"

ICONSET="$WORK/AppIcon.iconset"
mkdir -p "$ICONSET"
for spec in '16 16x16.png' '32 16x16@2x.png' '32 32x32.png' '64 32x32@2x.png' \
            '128 128x128.png' '256 128x128@2x.png' '256 256x256.png' \
            '512 256x256@2x.png' '512 512x512.png' '1024 512x512@2x.png'; do
  size="${spec%% *}"
  filename="${spec#* }"
  sips -s format png -z "$size" "$size" "$ROOT/outputs/icon.png" --out "$ICONSET/icon_$filename" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$CONTENTS/Resources/AppIcon.icns"

# Ad-hoc signing lets the app bundle stay intact; it does not bypass Gatekeeper.
codesign --force --deep --sign - "$APP"

DMG_ROOT="$WORK/dmg-root"
mkdir -p "$DMG_ROOT"
cp -R "$APP" "$DMG_ROOT/"
cp "$ROOT/macos/Installatie.txt" "$DMG_ROOT/"
mkdir -p "$ROOT/dist-download"
hdiutil create -volname "Tafelhelden" -srcfolder "$DMG_ROOT" -ov -format UDZO \
  "$ROOT/dist-download/Tafelhelden-macOS.dmg"
echo "Created $ROOT/dist-download/Tafelhelden-macOS.dmg"
