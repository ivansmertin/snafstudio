# Codex Operating Manual (snafstudiotest)

## Project type
- Plain static website (single-page marketing/personal studio landing page).
- No build step, no package manager, no framework.

## Primary rule
- Preserve existing rendering and behavior unless a task explicitly requests visible/interactive changes.
- Visual regressions are unacceptable.

## Hard guardrails
- Inspect the actual repository state before changing anything.
- Prefer the smallest possible diff that solves the requested task.
- Do not add dependencies, tooling, or architecture changes unless explicitly requested.
- Do not rename/move/delete existing files unless explicitly requested.
- Do not refactor for style-only reasons when no functional task requires it.

## Priority order
1. Correctness.
2. Non-breaking changes.
3. Maintainability.
4. Cleanup.

## Safe workflow for future changes
1. Read `index.html`, `styles/main.css`, `js/main.js`, and referenced assets to understand current behavior.
2. Use `styles.css` as a legacy baseline reference when validating module parity.
3. Map affected selectors/anchors/interactive elements before editing.
4. Make incremental edits in small, reviewable commits.
5. Re-check desktop/mobile layout, nav anchors, burger menu, carousel, FAQ, and console output.
6. If behavior could be impacted, validate manually in browser before finishing.

## Conservative refactor guidance
- Keep DOM structure, CSS class names, and section IDs stable during refactors unless the task requires changing them.
- If extracting inline JS/CSS in future, do it in phased steps:
  1) move code without behavior changes,
  2) verify parity,
  3) then optimize.
- Avoid mixing structural refactors with visual redesign in one patch.

## Notes for Codex sessions
- Assume deployment simplicity is intentional.
- Treat anchor IDs, class hooks, and image paths as compatibility-sensitive.
