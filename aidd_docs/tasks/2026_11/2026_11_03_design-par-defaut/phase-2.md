---
status: done
---

# Instruction: ui-skills-install

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── /Users/val/.config/opencode/skills/
    ├── baseline-ui/SKILL.md ✅
    └── fixing-accessibility/SKILL.md ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `shasum` the aidd skill copies under `.opencode/skills`; confirm neither skill folder exists under the global skills directory | a baseline digest list is saved and no collision with an existing skill | cli |
| Happy path   | fetch both skills and write them | two files, each with its `name` in front matter | cli |
| Edge case    | a folder already exists | stop and report, never overwrite a skill the user may have edited | cli |
| Teardown     | re-run the digest list | no aidd skill copy changed | cli |

## Tasks to do

### `1)` Confirm the target is free

> Never overwrite a skill the user may have tuned.

1. List `/Users/val/.config/opencode/skills/baseline-ui` and `/Users/val/.config/opencode/skills/fixing-accessibility`.
2. Stop and report if either exists.

### `2)` Fetch and write both skills

> Copies are reviewed text, not a runtime dependency.

1. Run `npx -y ui-skills get baseline-ui`, confirm the first line is `---` and that no banner precedes it, then write the output to `/Users/val/.config/opencode/skills/baseline-ui/SKILL.md`.
2. Run `npx -y ui-skills get fixing-accessibility`, apply the same check, then write it to `/Users/val/.config/opencode/skills/fixing-accessibility/SKILL.md`.
3. Create the folders as needed.

### `3)` Verify

> Each file must satisfy the documented loading rules.

1. Read the first six lines of each file; expect `---`, `name:`, `description:`, `---`.
2. Confirm each `name` matches its folder and the documented regex `^[a-z0-9]+(-[a-z0-9]+)*$`.
3. Confirm each `description` is 1 to 1024 characters.
4. Re-run the setup digest list and `diff` it against the baseline; expect no output.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the check runs before any write, and a pre-existing folder stops the phase |
| 2 | both files exist and are non-empty |
| 3 | each `name` matches its folder and the regex, each `description` is non-empty, and the aidd skill digests match the baseline |
