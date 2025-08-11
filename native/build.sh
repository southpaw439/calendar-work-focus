#!/usr/bin/env bash
set -euo pipefail

# Build the Swift CLI that bridges Chrome → macOS Shortcuts.
# Output: native/out/focusbridge

cd "$(dirname "$0")"
OUTDIR="$(pwd)/out"
mkdir -p "$OUTDIR"

# Compile (Xcode Command Line Tools must be available on the machine/runner)
swiftc -O -parse-as-library -o "$OUTDIR/focusbridge" FocusBridge.swift

# Try to codesign if a signing identity exists (optional; harmless if it doesn't)
if security find-identity -p codesigning -v >/dev/null 2>&1; then
  IDENTITY=$(security find-identity -p codesigning -v | awk 'NR==1{print $2}')
  codesign --force --sign "$IDENTITY" "$OUTDIR/focusbridge" || true
fi

echo "Built: $OUTDIR/focusbridge"
