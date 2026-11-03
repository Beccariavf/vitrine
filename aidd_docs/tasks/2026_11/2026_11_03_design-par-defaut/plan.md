---
objective: "Every session that changes rendered UI plans and verifies it against a design contract sourced from the project's design docs first, backed by two installed UI skills."
status: pending
---

# Plan: Design contract in every session

Source: conversation of 2026-11-03 (brainstorm, pivot to a global rule confirmed)

## Phases

| #   | Phase                  | File                         | Depends on |
| --- | ---------------------- | ---------------------------- | ---------- |
| 1   | design-contract-rule   | [`phase-1.md`](./phase-1.md) | none       |
| 2   | ui-skills-install      | [`phase-2.md`](./phase-2.md) | 1          |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://opencode.ai/docs/rules/ | `instructions` in the global `opencode.json` is combined with every project's `AGENTS.md`, and glob patterns are allowed |
| https://github.com/ibelick/ui-skills | the registry ships a CLI that prints a full skill markdown, so installation is a reviewed copy, not a runtime fetch |
| https://raw.githubusercontent.com/ibelick/ui-skills/main/skills/baseline-ui/SKILL.md | `baseline-ui` content is stack-agnostic except its React section; its `name` is `baseline-ui` |
| https://raw.githubusercontent.com/ibelick/ui-skills/main/skills/fixing-accessibility/SKILL.md | `fixing-accessibility` content and its `name` |
| https://opencode.ai/docs/skills/ | skills load from `~/.config/opencode/skills/<name>/SKILL.md`, `name` must match the folder and the lowercase-hyphen regex; a session lists them in the `skill` tool description |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | the rule reaches sessions only if OpenCode reads the absolute glob in the global config; observed: the config parses and the glob lists the file; unverified: injection into a new session | 1 |
| runtime | the two skills are discoverable per the documented global path, name rules, and are listed in the `skill` tool description; observed: paths free, front matter valid; unverified: presence in a session started before the install | 2 |
| regression | none: no project source, dependency, or test changes; `npm test` and `npm run build` are unaffected | none |
| architecture | none: no project module or aidd skill changes; the aidd copies under `.opencode/skills` are proven untouched by a before/after checksum | 1 |
| documentation | the rule text is versioned in this folder as `rule-design.md`; the installed copy is deployed from it | 1 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| aidd skill files stay untouched | `aidd doctor` reports no manifest: `.opencode/skills` is an untracked copy that a reinstall overwrites |
| project `AGENTS.md` unchanged | the rule is personal and global; project rules keep their scope |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| the contract lives in a global rule, not in `01-plan`'s phase template | `validate-plan.cjs` rejects any section absent from the template, so a phase section would fork an unversioned aidd copy that a reinstall erases |
| the rule is wired through `instructions` with an absolute glob | relative paths in a global config resolve against each project root, not the config directory |
| skills are installed as local copies, not through MCP | an MCP server adds tool schemas to every session and a network dependency for content two files already carry |
