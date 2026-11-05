# AGENTS.md — preact-components

Reusable Preact + Tailwind components, design tokens, icons and signals helpers, published on JSR
as `@spy4x/preact-<directory>`. A Deno workspace: one package per top-level directory. What each
package holds: the "Scope" table in [`docs/maintaining.md`](./docs/maintaining.md). `pages/` is the
demo site and the browser checks, and is not published.

**UI work:** read [`docs/design-rules.md`](./docs/design-rules.md) and
[`docs/choose-a-component.md`](./docs/choose-a-component.md) first. Open
`docs/design-language.md` only at the section they point to.

## Commands

```bash
deno task check   # fmt:check, lint, ts:check, test; all must pass
deno task fix     # lint --fix, then fmt
deno test --no-prompt --allow-read --allow-env ui/button.test.tsx   # one test file
deno task llms    # rewrite llms.txt and llms-full.txt after an export, JSDoc or README change
deno task --cwd pages build && deno task --cwd pages verify --only=ui   # one package's browser checks
```

A few test files need more permissions; the `test` task in `deno.jsonc` lists them.

## What belongs here

A component belongs here when a future project can reuse it, even if one app uses it today.
Business wording, one app's data model, or a renamed copy of something generic disqualifies it
(worked examples: `docs/maintaining.md`, "What belongs").

- Removing an export breaks apps: move every app that imports it onto a replacement first.
- This is a public repository: no private application's code, paths, file lists or vocabulary.
  Known mentions are tracked in [#859](https://github.com/spy4x/preact-components/issues/859); do
  not remove one in an unrelated change. A project deleted before its components were extracted is
  not a source; do not name it.

## Adding a package

- A member joins or leaves `"workspace"` in `deno.jsonc` in the same change as its
  `<pkg>/deno.json`, never ahead of it. `name` is `@spy4x/preact-<directory>`; `exports` lists
  exactly the entry points that exist.
- An `imports` block only for a specifier the root import map lacks. Today `theme`, `system`, `map`
  and `pages` have one.
- Add the directory to `packageIds` or `helperPackageIds` (`ui-guide/registry-ids.ts`), or to
  `EXCLUDED_PACKAGES` (`ui-guide/coverage.ts`) with a reason, to `PUBLISHED_PACKAGES`
  (`infra/scripts/private-names.ts`) and to `WORKSPACE_DIRECTORIES` (`pages/build-fingerprint.ts`).
- Add a row to the "Scope" table in `docs/maintaining.md`, a `deno add` line in `docs/usage.md`, a
  link in the README's "Packages" table and, for a package in `packageIds`, a complete list of its
  components in its own README; `infra/scripts/export-lists.test.ts` checks all four.
- Every component (a PascalCase function) needs a card under `ui-guide/sections/`, or an entry in
  `COMPONENTS_WITHOUT_CARD` with a reason. Every helper is named in code in the package README
  (`` `clampProgress(value, max)` ``) with a line on what it does.

## Pull requests

One package per PR, plus the generated files and guide cards that package's change forces. Never
reformat or edit a directory another agent owns. Update the PR body after every significant change
with the decisions you made.

Branch types: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `style/`, `perf/`, `ci/`. A commit's
scope is the package directory or `deps`, omitted when repo-wide; its summary is lowercase.

Filing issues follows the global rule alone: one piece of work per issue, additions in a comment,
no list of proposed issues. One addition: findings that wait on the owner's answer go together in
one `needs-decision` issue, so they do not hold back the rest of their area.

## Checks

- `llms.txt` and `llms-full.txt` are generated from exports, first JSDoc sentences and package
  READMEs; never hand-edit them. Every export needs a JSDoc summary sentence. A test fails when they
  are stale.
- `publish:dry` refuses a dirty tree, so it is not in `check`; CI runs it after `check`.
- **Behaviour needs a browser check.** String-render tests never run an effect, a ref, a key press,
  a focus change or a timer. A new browser check, or one you edit, is a Playwright spec in
  `pages/e2e/<package>.spec.ts` with axe-core; untouched ones stay in `pages/checks/`. Read
  [`pages/README.md`](./pages/README.md), "Writing a browser check", first. Always `build` before
  `verify`; `--static` and `--only` are not full runs. On a busy machine run the full run in parts
  (same file, "Running a full run in parts").
- CI: Woodpecker runs `check`, `publish:dry`, the build and the browser checks (`e2e` in four
  shards) on every PR and every push to `main`. GitHub Actions only deploys `main` to Pages.

## Releases

Every package is published at the same version, together, so a sibling's caret range resolves to
the set published with it. A change that can break an app bumps the major. Steps:
[`docs/publishing.md`](./docs/publishing.md). Before the tag, run `deno task private-names` with
`private-names.txt` from the owner's private memory repository
([`docs/pre-publish-checks.md`](./docs/pre-publish-checks.md)).

## Code style

The global TS style applies, with two overrides: double quotes, backticks only for interpolated or
multi-line strings; and an explicit `throw` on any missing required value, not only env. A new
dependency needs a reason in the PR.

## Component rules

**Props and ports, not global state.** A component gets everything through props or a port (a
callback or interface) from the caller. It never imports an app's state singleton, a module-level
`signal()` holding app data, or ambient context the host did not hand over.

- Local, purely visual state (open/closed, hover, input draft) may live inside the component.
- Application state arrives as props or as a signal the caller created and passed in.
- Persistence, routing and auth are ports: `onSubmit`, `navigate`, `currentUser`.
- Stay server-renderable: touch `document`/`window` only in an effect or event handler.

**Local state is `useSignal`, not `useState`.** Convert existing `useState` only in a change that
already touches that component. `useRef` stays for DOM handles and timers, `useEffect` for DOM
lifecycle work. Never write a signal during a render: reading `.value` subscribes, so the write
re-renders forever. Write it in a handler, an effect, or a callback one of them set up.

**An input that keeps its own state reads the field on mount.** Preact keeps the text a person typed
before hydration and fires no `input` event for it, so state that starts empty misses that text.

**Spacing.** Padding, margin and gap use only `0 px 1 2 3 4 6 8 12 16`, never an arbitrary value.
`infra/scripts/spacing-scale.test.ts` catches classes, arbitrary spacing properties and
`--spacing()` calls; review holds raw CSS, inline `style`, runtime class names and `theme()`. A
component's root carries no margin: the parent's gap spaces siblings (`Page`, `Section`, `Stack`,
`Cluster`, `Grid`). See [`docs/spacing.md`](./docs/spacing.md).

**The `crud/` data contract** (details in `crud/README.md`): rows are never deleted but carry
`deletedAt`, set and cleared by an optional archive checkbox in the normal update, and the list
filters active from archived. The store is shaped like `buildModelStore` (`CrudListStore` and
`CrudEditorStore` in `crud/store.ts`). `canChange?: () => boolean`, a function from the app,
decides who may edit; `CrudList` takes `canAdd?: () => boolean` the same way.

**Labels.** Every user-visible string has an English default and a prop that overrides it. The
exception is a name only the caller knows, such as an icon-only trigger's accessible name: a
required prop.

**Every change updates the UI guide.** A new or changed component updates its `ui-guide/` card in
the same PR (a new prop gets a demo, a changed default changes the snippet); a new or changed helper
or hook updates its README line. `deno task test` checks that they exist; review checks that they
are accurate.

**Validation: arktype only.** No zod, valibot or hand-rolled validators.

## Dependencies

**Pin exactly: never `^`, `~` or a floating tag.** A version bump is its own `deps` commit. The
exception: `preact`, `preact/`, `@preact/signals` and `@preact/signals-core` in the root
`deno.jsonc` are caret ranges, because `deno publish` copies import-map values into published
imports and an exact pin made apps load a second copy. This must print nothing:

```bash
grep -rnoE '"(npm|jsr):[^"]*[\^~]' --include='deno.json' --include='deno.jsonc' . |
  grep -vE '^(\./)?deno\.jsonc:[0-9]+:"npm:/?(preact|@preact/signals|@preact/signals-core)@\^$'
```

Pins live in the root import map and in the `imports` blocks of `theme`, `system`, `map` and
`pages`. Matching pins with `spy4x/seed` and `spy4x/ts-libs` is checked by hand:
`grep -oE '"(arktype|preact|@preact/signals)@[0-9][^"_]*' deno.lock` in each repo. Pinning and the
allowed dependencies are held by review, not CI:
[`docs/no-third-party-components.md`](./docs/no-third-party-components.md).
