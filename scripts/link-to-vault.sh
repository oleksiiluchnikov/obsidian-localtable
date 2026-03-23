#!/usr/bin/env bash

set -euo pipefail

# Usage: ./link-to-vault.sh /path/to/your/vault

VAULT_PATH="${1:-${OBSIDIAN_VAULT_PATH:-}}"
PLUGIN_NAME="localtable"
PLUGIN_DIR="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_NAME}"
SOURCE_DIR="$(pwd)"

if [ -z "$VAULT_PATH" ]; then
    printf 'Usage: %s /path/to/your/vault\n' "$0"
    printf '   or: OBSIDIAN_VAULT_PATH=/path/to/your/vault %s\n' "$0"
    exit 1
fi

# Check if vault exists
if [ ! -d "$VAULT_PATH" ]; then
    printf 'Error: Vault directory does not exist: %s\n' "$VAULT_PATH"
    exit 1
fi

# Create plugins directory if it doesn't exist
mkdir -p "${VAULT_PATH}/.obsidian/plugins"

# Remove existing plugin directory if it exists
if [ -d "$PLUGIN_DIR" ]; then
    printf 'Removing existing plugin directory...\n'
    rm -rf "$PLUGIN_DIR"
fi

# Create symlink
printf 'Creating symlink...\n'
ln -s "$SOURCE_DIR" "$PLUGIN_DIR"

printf 'Symlink created.\n'
printf '  From: %s\n' "$PLUGIN_DIR"
printf '  To:   %s\n\n' "$SOURCE_DIR"
printf 'Next steps:\n'
printf "1. Run 'npm run dev' in this directory\n"
printf '2. Reload Obsidian (Ctrl/Cmd + R)\n'
printf '3. Enable the plugin in Settings > Community Plugins\n'
