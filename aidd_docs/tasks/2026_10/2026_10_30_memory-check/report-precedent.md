### Structure

| File              | Gap     | Why                          |
| ----------------- | ------- | ---------------------------- |
| `codebase-map.md` | missing | core, now that code exists   |
| `testing.md`      | missing | core, now that tests exist   |
| `data.md`         | missing | `veille/` detects `data`     |

### Findings

| File              | Finding                                   | Evidence                          |
| ----------------- | ----------------------------------------- | --------------------------------- |
| `architecture.md` | claims an interface that does not exist   | `veille/sources/` has one adapter |
| `coding-assertions.md` | placeholder commands were replaced   | `npm test`, `npm run typecheck`   |

### Notes

- `data/` is not committed yet: the real pass only ran in temporary directories.
