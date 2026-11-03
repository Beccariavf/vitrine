# Design before implementation

- When a task produces or changes rendered UI (HTML, CSS, a component, a page), the plan carries a design contract. Otherwise skip it, silently.
- The contract names the tokens used (color, type, spacing, radius, shadow), the components reused, the interaction states (hover, focus, active, disabled, empty, error), and the responsive behavior.
- Source of truth, in order: the project's design documentation, then the existing components, then an installed UI skill. A documented value wins over a skill default.
- When the plan format has a `## Rules` table, the contract is one row of it; detailed values go where the work happens.
- Even with no plan, name the contract before editing rendered UI.
- When asserting a UI change, compare the rendered result to the contract. When no frontend can be run, state what was not visually verified instead of claiming it holds.
- Never invent a visual language the project already documents.
