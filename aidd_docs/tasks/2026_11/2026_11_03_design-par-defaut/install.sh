#!/bin/sh
# Deploy the global design rule from this versioned source.
# Idempotent: run it after a machine change, or to undo drift.
set -eu

source_file="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/rule-design.md"
config_dir="${HOME}/.config/opencode"
rule_target="${config_dir}/rules/design.md"

mkdir -p "${config_dir}/rules"
cp "${source_file}" "${rule_target}"
printf 'deployed %s\n' "${rule_target}"

if grep -q 'opencode/rules/\*\.md' "${config_dir}/opencode.json" 2>/dev/null; then
  printf 'instructions already wired\n'
else
  printf 'WIRING MISSING: add "instructions": ["%s/rules/*.md"] to %s/opencode.json\n' "${config_dir}" "${config_dir}"
  exit 1
fi
