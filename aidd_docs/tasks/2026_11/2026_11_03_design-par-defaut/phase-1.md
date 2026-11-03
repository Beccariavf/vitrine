---
status: pending
---

# Instruction: design-contract-rule

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_11/2026_11_03_design-par-defaut/rule-design.md ✅
└── /Users/val/.config/opencode/
    ├── rules/design.md ✅
    └── opencode.json ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `shasum` the aidd skill copies under `.opencode/skills` | a baseline digest list is saved | cli |
| Happy path   | run the verification commands | identical copy, valid JSON, one glob match | cli |
| Edge case    | the global config already carries an `instructions` key | the new glob is appended and existing entries survive | cli |
| Teardown     | re-run the digest list | the aidd skill copies are byte-identical to the baseline | cli |

## Tasks to do

### `1)` Write the rule source

> One versioned file that carries the exact text deployed everywhere.

1. Create `aidd_docs/tasks/2026_11/2026_11_03_design-par-defaut/rule-design.md`.
2. Write it in English, model-facing, under 20 lines, with these rules:
   - a task that produces or changes rendered UI (HTML, CSS, component, page) makes its plan carry a design contract; otherwise skip silently
   - the contract names the tokens used, the components reused, the interaction states (hover, focus, active, disabled, empty, error), and the responsive behavior
   - source of truth in order: the project's design documentation, then the existing components, then an installed UI skill; a documented value wins over a skill default
   - when the plan format has a `## Rules` table, the contract is one row of it
   - when asserting a UI change, compare the rendered result to the contract; when no frontend can be run, state what was not visually verified instead of claiming it holds
   - never invent a visual language the project already documents

### `2)` Deploy it globally and wire it

> The rule loads in every project, including those without aidd.

1. Copy the source to `/Users/val/.config/opencode/rules/design.md`, creating the folder.
2. Add `"instructions": ["/Users/val/.config/opencode/rules/*.md"]` to `/Users/val/.config/opencode/opencode.json`, preserving `$schema` and `model`.
3. Keep the JSON two-space indented and valid.

### `3)` Verify

> Prove the wiring instead of assuming it.

1. `cmp` the source and the installed copy; expect no output.
2. Parse the global config with `node -e` and print `instructions`; expect the glob.
3. List the glob; expect exactly one file.
4. Re-run the setup digest list and `diff` it against the baseline; expect no output.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the source file exists and carries all six rules |
| 2 | `cmp` reports no difference between source and installed copy, and the config parses with the glob present |
| 3 | the glob lists one file and the aidd skill digests match the baseline |
