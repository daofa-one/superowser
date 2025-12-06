# Repository Guidelines

## Project Structure & Module Organization
Superowser lives under `src/`, split by runtime. `src/background/` hosts the extension services (messaging, Dexie repositories, Pinia stores, omnibox handlers). `src/sidepanel/` is the Vue 3 UI with router-driven views and child components. `src/content/` injects lightweight listeners into pages and must stay minimal—delegate heavy logic to shared utilities in `src/shared/`. Static assets reside in `public/` and `sidepanel/index.html`; production bundles land in `dist/` after `pnpm build` and should never be committed.

## Build, Test, and Development Commands
- `pnpm install` – install all workspace dependencies; always run after pulling manifest changes.
- `pnpm dev` – run the Vite dev server and rebuild the extension for Chrome’s live reload workflow.
- `pnpm build` – emit optimized artifacts into `dist/` for packaging or `pnpm preview`.
- `pnpm preview` – serve the built UI to smoke test the side panel.
- `pnpm lint` – enforce ESLint + Prettier rules; this must pass before submitting a PR.

## Coding Style & Naming Conventions
TypeScript + Vue `<script setup>` is default. Keep imports relative to `src`. Prettier governs formatting (2 spaces, double quotes); avoid manual tweaks. Components use PascalCase files (`TaskList.vue`), directories remain kebab-case, composables start with `use`, stores end with `.store.ts`, utilities belong in `src/shared/utils.ts`, and messaging namespaces live under `src/background/messaging/`.

## Testing Guidelines
Automated tests are not yet wired, so rely on `pnpm build` and manual smoke runs inside Chrome’s extension preview. When introducing specs, colocate them using `*.spec.ts`, cover core flows (saving pages, tagging, notes, omnibox commands), and document repro steps in PRs for any bug fix.

## Commit & Pull Request Guidelines
Follow Conventional Commits such as `feat: add highlight export` or `fix: guard empty shortcut`. Keep changes scoped, describe user-visible impact, and link issues. Attach screenshots or short clips for sidepanel or permissions changes. Ensure `pnpm lint` (and any new tests) pass before requesting review and call out any manual validation done.

## Security & Configuration Tips
Secrets are not required; Dexie keeps data local. Review `manifest.config.ts` before adding APIs, and request approval when bumping permissions. When using omnibox or content scripts, gate new listeners via feature flags in `src/background/feature-flags.ts` so they can be toggled quickly during QA.
