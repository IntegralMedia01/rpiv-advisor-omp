#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE="$SCRIPT_DIR/../.omp/agents/consultant.md"
AGENT_ROOT=${PI_CODING_AGENT_DIR:-"$HOME/.omp/agent"}
TARGET_DIR="$AGENT_ROOT/agents"
TARGET="$TARGET_DIR/consultant.md"

if [ ! -f "$SOURCE" ]; then
  printf '%s\n' "Cannot find consultant agent definition: $SOURCE" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$SOURCE" "$TARGET"

printf '%s\n' "Installed OMP consultant task agent:" "  $TARGET" "" "Open /agents and press Ctrl+R, or restart OMP, to reload agent definitions."
