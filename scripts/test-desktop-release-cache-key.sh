#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
key_script="scripts/desktop-release-cache-key.py"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -R "$repo_root"/. "$tmp/repo"
cd "$tmp/repo"

args=(--platform Linux --target x86_64-unknown-linux-gnu --features mesh-llm --native-inputs ubuntu-24.04-mold)
original=$("$key_script" "${args[@]}")
current_version=$(sed -n 's/^version = "\(.*\)"/\1/p' desktop/src-tauri/Cargo.toml | head -1)
[[ "$current_version" != "9.8.7" ]] || { echo "fixture bump value collides with current manifest version" >&2; exit 1; }
CURRENT_VERSION="$current_version" python3 - <<'PY'
import os
from pathlib import Path
current = os.environ["CURRENT_VERSION"]
manifest = Path("desktop/src-tauri/Cargo.toml")
manifest.write_text(manifest.read_text().replace(f'version = "{current}"', 'version = "9.8.7"', 1))
lock = Path("desktop/src-tauri/Cargo.lock")
text = lock.read_text()
start = text.index('name = "buzz-desktop"')
version = text.index(f'version = "{current}"', start)
lock.write_text(text[:version] + 'version = "9.8.7"' + text[version + len(f'version = "{current}"'):])
PY
version_only=$("$key_script" "${args[@]}")
[[ "$original" == "$version_only" ]] || { echo "desktop version changed cache key" >&2; exit 1; }
printf '\n# dependency input\n' >> crates/buzz-acp/Cargo.toml
dependency_changed=$("$key_script" "${args[@]}")
[[ "$original" != "$dependency_changed" ]] || { echo "dependency manifest did not change cache key" >&2; exit 1; }
[[ "$original" == desktop-rust-release-v1-Linux-x86_64-unknown-linux-gnu-* ]] || { echo "unexpected key: $original" >&2; exit 1; }
echo "desktop release cache key contract passed"
