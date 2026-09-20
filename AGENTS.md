# AGENTS.md — preact-components

Reusable Preact + Tailwind components, design tokens, icons and signals helpers for Deno apps.
Read `README.md` for scope and `LICENSE` for terms (MIT).

This repo is a Deno workspace. Several packages are built in parallel by different agents, each in
its own PR, each owning exactly one top-level directory.

## Package layout

| Directory   | Contents                                                                          |
| ----------- | --------------------------------------------------------------------------------- |
| `theme/`    | design-system CSS + tailwind preset                                               |
| `icons/`    | merged icon set, `+index.tsx`                                                     |
| `ui/`       | Badge, Table, Dropdown, ToggleSwitch, OnOffButtons, PageTitle, Toast, Button      |
| `system/`   | Shell, Nav, Auth, StateInit, SEOHead, Breadcrumb, Menu, SWUpdater                 |
| `charts/`   | server-rendered SVG kit (scales) + d3 wrappers                                    |
| `cn/`       | `cn()` — class-name join + Tailwind conflict resolution                           |
| `signals/`  | For/Show/map, buildModelStore, useListState, useUrlFilters                        |
| `crud/`     | CrudList, CrudEditor, AssociationEditor                                           |
| `ui-guide/` | live component catalogue route                                                    |
| `pages/`    | demo app (GitHub Pages site and the browser checks in `verify.ts`), not published |

## What belongs in this library

A component belongs here when a future project can reuse it, even if only one app uses it today —
a calendar stays, a booking slot picker goes. What disqualifies a component: business wording, one
app's data model, or a renamed copy of something generic that already exists.

The flow runs one way: an existing app feeds `spy4x/ts-libs` and this library, and this library
feeds `spy4x/template`, which future projects start from. An existing app is never refactored to
call into this library, and "remove" means delete from this library only — the app that had the
copy keeps its own. A project that was deleted before its components were extracted is not a
source for anything here; do not name it.

This is a public repository. Do not put a private application's code, file paths, file lists or
business vocabulary into anything that lands here — components, docs, PRs or issues.

## Adding a package

`deno.jsonc` lists every package directory in `"workspace"`, and a member is added or removed
**deliberately, in the same change as its `<pkg>/deno.json`** — never on the assumption that it is
coming. Deno skips a listed member whose directory does not exist (warning, exit 0), which is why a
pre-listed member is easy to leave behind: `"./map"` sat there long after `Map` was recorded as
deliberately not built, and every Deno invocation printed a not-found warning until it was dropped.
So a package joins the workspace when you create its own config, and the array is edited with it:

```bash
mkdir ui
cat > ui/deno.json <<'EOF'
{
  "name": "@preact-components/ui",
  "version": "0.1.0",
  "exports": {
    ".": "./mod.ts"
  }
}
EOF
```

Rules for a package config:

- `name` is `@preact-components/<directory>` — that is how sibling packages import you.
- `exports` lists exactly the entry points that exist today. Adding a file does not add an export.
- Do not add an `imports` block unless you need a specifier the root does not provide. Shared deps
  (preact, signals, arktype, d3, tailwind, `@std/*`, tailwind-merge, wouter-preact) live in
  the root import map so every package resolves one copy.
- Sibling imports use the member name: `import { cn } from "@preact-components/cn"`.

Type-checking, formatting, linting and tests are discovered by walking the tree, so a new package is
covered without touching root config or `infra/scripts/type-check.ts`.

The catalogue has to be told about the package: add its directory to `packageIds` in
`ui-guide/registry.ts` and give every component it exports a card, or add it to `EXCLUDED_PACKAGES`
in `ui-guide/coverage.ts` with a reason. A package directory with neither fails `deno task test`.
Adding a component to a catalogued package means adding its card to that package's section in
`ui-guide/sections/`; a helper — anything not named in PascalCase — needs nothing.

## Branch-first workflow

Create the branch before any edit. Never commit to `main`.

```bash
git fetch origin
git checkout -b <type>/<short-kebab-slug> origin/main
```

Types: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `style/`, `perf/`, `ci/`.

## Commit convention (Angular)

```
<type>(<scope>): <short summary>
```

- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`, `ci`
- Scope: the package directory (`ui`, `icons`, `signals`, …) or `deps`; omit when repo-wide
- Summary: imperative, lowercase, no trailing period, ≤ 72 chars
- Body only when the why is not obvious from the title. No AI attribution.

```
feat(ui): add badge and table primitives
fix(charts): correct log scale tick rounding
chore(deps): pin tailwind-merge to 3.7.0
docs: document the workspace member rule
```

## PR discipline

- Push and open the PR immediately after the first commit; prefix the title with `[WIP]` while
  incomplete and drop the prefix when the work is done.
- Base every PR on `main`. One package per PR — keep diffs disjoint from other packages.
- Update the PR body after every significant change; state the decisions you made.

```bash
gh pr create --fill --base main
```

## Review

A separate reviewer agent, one that did not write the change, reviews every PR. Review happens
before the PR is opened, or, for a PR opened early under `[WIP]`, before that prefix is dropped.

The reviewer runs the checks itself — a reported green run is not evidence — and verifies a test by
breaking the code it is supposed to protect: remove the fix and confirm the test goes red. A test
that passes either way is rejected. The reviewer never fixes what it finds; a rejection goes back to
the author with the precise changes required, and rejection is a normal outcome, not a failure.

The verdict and its evidence are posted as a PR comment, so GitHub's own review record stays empty
by design — an empty review record does not mean a PR went unreviewed.

The repository owner merges. An agent merges only when the owner delegated merge authority for that
run, and only after the reviewer passed.

## Pre-commit checklist

```bash
deno task check
```

Runs `fmt:check`, `lint`, `ts:check` and `test`. All four must pass with zero errors. Use
`deno task fix` to apply formatting and lint fixes, then re-run `deno task check`.

| Task                 | Does                                             |
| -------------------- | ------------------------------------------------ |
| `deno task check`    | all checks; run by both CIs                      |
| `deno task fmt`      | format (`fmt:check` in CI)                       |
| `deno task lint`     | lint (`lint:fix` to apply suggestions)           |
| `deno task ts:check` | `deno check` over every `.ts`/`.tsx` in the tree |
| `deno task test`     | run all tests                                    |
| `deno task fix`      | `lint --fix` then format                         |

Behaviour needs a second pair, in this order:

| Task                           | Does                                   |
| ------------------------------ | -------------------------------------- |
| `deno task --cwd pages build`  | build the demo site                    |
| `deno task --cwd pages verify` | drive the built site in a real browser |

Every test `deno task test` runs renders a component to an HTML string, so none of them executes an
effect, a ref, a key press, a focus change or a timer. Behaviour behind one of those can only be
proven in a real browser, and `pages/verify.ts` is where that proof has to be written — assume it is
unproven until a check there covers it. Today that means `Modal` alone: it opens as a real modal
dialog with focus inside, a real Escape press closes it, and focus returns to the trigger. Every
other component's keyboard and focus behaviour is still untested. `verify` fails when it finds no
browser; `--static` is the one explicit way to leave the browser phase out. The GitHub workflow runs
`check`, the build and `verify` on every pull request into `main`, and the Pages deploy waits for
them.

If a task fails because a specifier cannot be resolved, run the task that needs the new dependency once
with network access and commit the updated `deno.lock`. **This is a convenience, not a gate:** a stale
or missing lock entry does not fail anything by itself — Deno downloads and rewrites the lockfile — so
a task does not fail merely because the lockfile is out of date. `deno task check` never inspects a
version and never passes `--frozen`. Never delete or hand-edit the lockfile.

## Code style

- No semicolons. 2-space indent. Double quotes by default, backticks for interpolated or multi-line
  strings. 100 column limit. Trailing commas where legal. `deno fmt` is the arbiter.
- Files: kebab-case `.ts`, `+main.ts` / `+lib.ts` for entry points, colocated `*.test.ts`.
- Imports: relative local first, then `jsr:` stdlib, then `npm:` only when unavoidable.
- `interface` for extensible object shapes, `enum` for finite constants (start at 1), `type` only
  for unions and intersections.
- Named exports. `async`/`await`. Explicit `throw` on a missing required value.
- JSDoc on any non-trivial function, class or interface over 10 lines.
- Tests: colocated, deterministic, behaviour-named — `it("rejects an expired token")`.
- Minimise dependencies. Every new dependency needs a reason in the PR body.

## Component rules

**Props and ports, not global state.** A component receives everything it needs through props, or
through a port (a callback or interface) passed in by the caller. A component must never import an
app's global state singleton — no `../state/store.ts`, no module-level `signal()` holding app data,
no ambient context the host did not hand over.

- Local, purely visual state (open/closed, hover, input draft) may live inside the component.
- Application state arrives as props, or is read through a `@preact/signals` value the caller
  created and passed in.
- Persistence, routing and auth are ports: the caller injects `onSubmit`, `navigate`, `currentUser`.
- Keep components server-renderable. Touch `document`/`window` only inside an effect or an event
  handler.

This is what lets `spy4x/template` and any other app share the same `ui/` package without the
library knowing which app it is running in.

### The `crud/` data contract

`crud/` assumes three things about any app that uses it:

- a row is never really deleted — it carries a `deletedAt` timestamp; the editor sets and clears it
  through an optional archive checkbox, submitted with the form's normal update, and the list
  separates active rows from archived ones with a status filter;
- the store is shaped like `buildModelStore` from `signals/`; `crud/store.ts` describes the slice it
  reads as two structural interfaces, `CrudListStore` and `CrudEditorStore`, and `crud/store.test.ts`
  proves a real `buildModelStore` satisfies both with no adapter;
- one `canChange` port — a function returning a boolean, supplied by the app because the library has
  no auth — decides whether the current user may edit; `CrudList` takes the same kind of port as
  `canAdd`.

This is the standard for every app built from `spy4x/template`. See `crud/README.md` for the exact
store interfaces.

## Validation

**arktype only. No zod, no valibot, no hand-rolled validators.** Use `type(...)` from `arktype` for
both runtime validation and the inferred TypeScript type.

```ts
import { type } from "arktype"

const badgeProps = type({ label: "string", tone: "'neutral' | 'positive' | 'negative'" })
export type BadgeProps = typeof badgeProps.infer
```

## Dependencies

**Pin exactly. Never `^`, never `~`, never a floating tag.** The lockfile is committed; a version
bump is its own commit with scope `deps`. Exact pinning is checked by hand with
`grep -rnoE '"(npm|jsr):[^"]*[\^~]' --include='deno.json' --include='deno.jsonc' .`, which must
return nothing. Whether these pins match `spy4x/template` and `spy4x/ts-libs` where the repos
overlap is **not** checked by anything here — compare them by hand with
`grep -oE '"(arktype|preact|@preact/signals)@[0-9][^"_]*' deno.lock` run in each repo.

Current pins (root `deno.jsonc`, the single source of truth):

```
preact                          10.28.2
@preact/signals                  2.5.1
@preact/signals-core            1.12.1
wouter-preact                    3.9.0
arktype                          2.2.3
@std/assert                     1.0.19
@std/expect                     1.0.20
@std/testing                    1.0.20
tailwind-merge                   3.7.0
d3                               7.9.0
tailwindcss                     4.1.12
@tailwindcss/forms              0.5.10
```

**What is mechanically checked, and what is not.** Assume nothing here is. Exact pinning is a
convention held by review: `deno.lock` is committed and Deno keeps it in sync automatically, but it is
a record of what was resolved, **not a gate** — a changed or added specifier is downloaded, the
lockfile is rewritten, and the task exits 0. Only an explicit `deno cache --frozen` fails, and no task
passes it. `ts:check` fails on a **bare** specifier no config declares (`TS2307`) — that is all it
covers, so it is a gate on resolution rather than permission: adding an excluded library to an import
map resolves and passes, and a scheme-qualified specifier written inline in a source file
(`npm:@radix-ui/react-dialog@1.0.0`) is declared in no config, passes `deno check`, and is invisible to
the greps. **No check in CI verifies the dependency allowlist.** The component-library policy, the two
audit greps a reviewer is expected to run, and the full list of what neither catches are in
[`docs/no-third-party-components.md`](./docs/no-third-party-components.md).

## Hard rules

- Never commit a secret, token, credential, `.env` value or raw production URL.
- One logical change per commit. Keep commits small.
- Do not reformat or edit a directory another agent owns.
- Do not merge without a passing review from a separate reviewer, and only the owner or an agent
  the owner authorised for that run merges.
