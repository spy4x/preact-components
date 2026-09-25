# AGENTS.md — preact-components

Reusable Preact + Tailwind components, design tokens, icons and signals helpers for Deno apps.
Read `README.md` for scope and `LICENSE` for terms (MIT).

This repo is a Deno workspace. Several packages are built in parallel by different agents, each in
its own PR, each owning exactly one top-level directory.

## Package layout

| Directory   | Contents                                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `theme/`    | design-system CSS + Tailwind preset, and the opt-in dark ink palette, as strings (`TOKENS_CSS`, `PRESET_CSS`, `INK_CSS`)                 |
| `icons/`    | merged icon set: one component per glyph, all listed by the guide's icon gallery                                                         |
| `ui/`       | `Badge`, `Button`, `Table`, `DataTable`, `Dropdown`, `Combobox`, `Modal`, `Tooltip`, `Toastr` — and the rest                             |
| `system/`   | `AuthForm`, `Calendar`, `ImageLightbox`, `RailShell`, `SEOHead` + `head` store, `Shell`, `SiteHeader`, `StateInit`, `SWUpdater`          |
| `charts/`   | server-rendered SVG charts (`LineChart`, `Bars`, `DonutChart`, `Kpi`), axis maths (`scales`), d3 islands (`D3LineChart`, `CompareChart`) |
| `cn/`       | `cn()` — class-name join + Tailwind conflict resolution                                                                                  |
| `signals/`  | `buildModelStore`, `useUrlFilters`, `table-state`, `createThemeStore`, `createToastStore`, `patchSignal` — and the rest; no components   |
| `crud/`     | `CrudList`, `CrudEditor`, `AssociationEditor`, `DeletionValidation`, field rows                                                          |
| `map/`      | `Map` on Leaflet — its own package, so only an app that imports it resolves Leaflet                                                      |
| `ui-guide/` | live component catalogue: an overview and one page per package behind a side navigation (`UIGuide`, `uiGuideRoute`)                      |
| `pages/`    | demo app (GitHub Pages site and the browser checks under `pages/checks/`), not published                                                 |

A name in backticks in this table must be an export or a subpath of that package, and each
catalogued package's README lists every component it exports in a "Components" table.
`infra/scripts/export-lists.test.ts` holds both against the packages' real exports, and it runs in
`deno task test`.

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
business vocabulary into anything that lands here — components, docs, PRs or issues. Existing
mentions of that kind are known and their removal is tracked in #127; do not assume the repository
is already clean, and do not remove them as part of an unrelated change.

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
- Do not add an `imports` block unless you need a specifier the root does not provide. Two
  packages do, each because only it needs the dependency: `charts/deno.json` pins `d3`, and
  `map/deno.json` pins `leaflet` and `@types/leaflet`. Shared deps (preact, signals, arktype,
  tailwind, `@std/*`, tailwind-merge, wouter-preact, and `@spy4x/*` from spy4x/ts-libs) live in the
  root import map so every package resolves one copy.
- Sibling imports use the member name: `import { cn } from "@preact-components/cn"`.

Type-checking, formatting, linting and tests are discovered by walking the tree, so a new package is
covered without touching root config or `infra/scripts/type-check.ts`.

The catalogue has to be told about the package: add its directory to `packageIds` in
`ui-guide/registry.ts` and give every component it exports a card, or add it to `EXCLUDED_PACKAGES`
in `ui-guide/coverage.ts` with a reason. A package directory with neither fails `deno task test`.
Adding a component to a catalogued package means adding its card to that package's section in
`ui-guide/sections/`; `deno task test` fails without one. The test cannot see a helper — anything
not named in PascalCase — or a changed component, so those rest on the rule in "Every change
updates the UI guide" below.

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

A separate reviewer agent reviews every PR. Review happens before the PR is opened, or, for a PR
opened early under `[WIP]`, before that prefix is dropped.

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

| Task                             | Does                                                       |
| -------------------------------- | ---------------------------------------------------------- |
| `deno task check`                | all checks; run by both CIs                                |
| `deno task fmt`                  | format (`fmt:check` in CI)                                 |
| `deno task lint`                 | lint (`lint:fix` to apply suggestions)                     |
| `deno task ts:check`             | `deno check` over every `.ts`/`.tsx` in the tree           |
| `deno task test`                 | run all tests                                              |
| `deno task fix`                  | `lint --fix` then format                                   |
| `deno task publish:dry`          | `deno publish --dry-run` for every named workspace member  |
| `deno task private-names <file>` | search every package's dry-run file list for private names |

`publish:dry` is not part of `check`: `deno publish --dry-run` refuses a dirty tree, so folding it
into `check` would fail every local run against uncommitted work. Each CI system runs it as its own
step, after `check`, against its own clean checkout — `.github/workflows/pages.yml` and
`.woodpecker.yml` both do this.

`private-names` is not part of `check` either, and no CI runs it: it needs a file of names the owner
keeps outside the repository, and it exists for the owner to run before every `deno publish`.
[`docs/pre-publish-checks.md`](./docs/pre-publish-checks.md) says how.

Every package is published at the same version, every time, together (owner decision,
2026-09-25, #230): sibling imports publish as caret ranges, and one version for all is what keeps
`^0.1.N` resolving to the set published with it. [`docs/publishing.md`](./docs/publishing.md) has
the release steps.

Behaviour needs a second pair, in this order:

| Task                           | Does                                   |
| ------------------------------ | -------------------------------------- |
| `deno task --cwd pages build`  | build the demo site                    |
| `deno task --cwd pages verify` | drive the built site in a real browser |

Every test `deno task test` runs renders a component to an HTML string, so none of them executes an
effect, a ref, a key press, a focus change or a timer. Behaviour behind one of those can only be
proven in a real browser: write that proof into the package's own file under `pages/checks/` —
`pages/checks/ui.ts` for a `ui/` component, `pages/checks/system.ts` for a `system/` one, and so on —
never into `pages/verify.ts` directly; assume it is unproven until a check there covers it.
`pages/verify.ts` is still the script the task runs: it keeps the static phase and the browser
startup, and calls every package's file in one fixed order. The shared helpers — `check`, `poll`,
`pressKey`, the `Devtools` session — are defined once, in `pages/checks/harness.ts`, and imported
from there rather than redefined. Every workspace package whose components the catalogue demonstrates
has a file under `pages/checks/`, including the ones with no check yet — that emptiness is
deliberate, so a later pull request adding the first check to one of them touches nobody else's file.
`cn/` is the one workspace member with none: it is a single class-name function, and there is nothing
in it a browser could drive.

Which components are covered is not written here, because every version of that sentence has gone
stale. `pages/checks/` **is** the list: open the file for the package you care about and read the
names passed to `check(...)` — each one says in a sentence what it proves. Treat a component
whose check you cannot find as unproven rather than as working.

Two facts about that browser, both measured rather than assumed, and both worth knowing before you
write a check. First: Chromium activates a focused button on Enter only when the key-down carries
`text: "\r"` — `pressKey` in `pages/checks/harness.ts` sends it for `Enter` (#261 found the missing
field was the whole reason an earlier version of this repository's checks avoided Enter and reached
for `.click()` instead), so `pressKey(devtools, "Enter")` activates a focused button the way a real
Enter press does; a real Space press activates one either way, with no `text` field needed. The
browser is launched with a `--blink-settings` flag in `pages/verify.ts` that gives it a
hover-capable, fine pointer —
headless Chromium otherwise answers `(hover: none)` and `(pointer: none)`, and Tailwind compiles
every `hover:` and `group-hover:` utility inside `@media (hover: hover)`. So hover styles do apply,
and a check may lean on one. A hover style written by hand as `&:hover` in `theme/preset.css` is
emitted ungated and applies on any device; the same style written as a `hover:` utility is compiled
inside `@media (hover: hover)` and applies only where the pointer can hover. Right after the
hydration check, and before any package's checks run, a check asserts that the browser still
answers `(hover: hover)` and `(pointer: fine)`. The browser also delivers real mouse events, so a
pointer left resting on an element by an earlier check changes its computed colour and can pause a
timer; a check either parks the pointer away and reads back where it landed, or asserts the element
is not `:hover` before reading a style off it.

More facts measured in wave five, each found by a check that failed for a reason nobody had written
down:

- `<details>` fires its `toggle` event as a queued task, after the click that opened it. A listener
  attached by an effect that waits for the open state is not there yet when a fast Escape arrives.
  A check that has to land in that gap clicks and dispatches the key inside one `Runtime.evaluate`,
  after waiting two animation frames for the previous state's cleanup to finish; two separate
  protocol commands land in it only by chance.
- The catalogue scrolls smoothly. To bring an element into view before aiming at it, use
  `centreInView` in `harness.ts`: it works out where the page's own smooth scroll will stop and
  waits until the page is there. Do not swap it for an instant scroll: under load, an instant
  scroll lost to a smooth one the page already had running (#269). `pages/checks/system.ts` does
  not follow this yet: it still makes 15 instant `scrollIntoView` calls through its own
  `settleScroll` helper. Those checks passed under load and under `--cpu-throttle=6` in #274, so
  they were left alone; move them to `centreInView` when one of them next fails.
  After anything else that scrolls or reloads, wait for the page to stop moving (`settledScroll`)
  before aiming the pointer or reading a position.
- A real back/forward-cache restore can be driven: navigate away, then `Page.navigateToHistoryEntry`,
  and `Page.frameNavigated` reports `type: "BackForwardCacheRestore"`.
- The published GitHub Pages site answers a POST with 405. A form's no-JavaScript path is proven
  against the local preview server, which serves the page for a POST too.

And in wave six:

- The catalogue no longer scrolls itself on load (#255): `DeletionValidation` scrolls only when its
  dependency list changes to a new, non-empty one, and its catalogue demo starts with an empty
  list. `verify` still has a named check right after hydration, before the first block runs — a
  plain `settledScroll` alone would miss a scroll whose first frame has not run yet (one review
  measured starting a full second after load, which still read as a quiet page at 0), so the check
  reads `scrollY` again every 100ms for 2s after the plain settle and requires 0 on every read. A
  block that scrolls the page on its own, at any point in that 2s window, is caught at the source
  instead of being blamed on a stale coordinate.
- A check that clicks a link should read `defaultPrevented` from a `document` listener that then
  cancels the event, rather than let the page really navigate: a real navigation leaves the page
  moving after the check's own wait returns, and a later check pays for it.
- Two reads 100 ms apart that agree cannot tell a scroll that has not started from one that has
  stopped, and under load a smooth scroll's first frame can come after both (#269). So
  `settledScroll` is told about a scroll the caller expects: its `target` when the caller knows
  where it ends, or the position it starts `from` when only the page knows. Without either, it
  answers only whether anything is moving now.
- A download in a check really saves a file unless the browser is told otherwise. `verify` denies
  downloads for the whole run (`Browser.setDownloadBehavior`, falling back to
  `Page.setDownloadBehavior`); a check observes the file's bytes inside the page instead.
- Deno refuses to resolve a registry version younger than 24 hours unless the lockfile already
  records it. A dependency published the same day resolves in CI only because `deno.lock` is
  committed with it.

And in wave seven:

- `verify` serves `pages/dist` as it finds it and never checks that it was built from the current
  source (#280). Run `deno task --cwd pages build` right before every `verify`, and always after a
  rebase or a branch switch. A bundle left over from before a rebase made six checks fail on
  correct code, and a change that fixed nothing looked like the fix.
- Loading the machine with `stress-ng` reproduced none of the checks that failed under load;
  slowing the page itself with `verify --cpu-throttle=<rate>` did. `pages/README.md` says how.
- A page that has never had a real click or key press does not have focus, and Chromium sends no
  `focus` or `blur` event for a scripted `.focus()` or `.blur()` there. A check that needs those
  events clicks first (#273). A block run alone with `--only` meets this; a full run hides it,
  because an earlier block's real key presses already gave the page focus.
- `Input.insertText` delivers its whole string as one `input` event. A check about what happens
  between keystrokes sends one character per call.
- Preact keeps a text field's value while hydrating and fires no `input` event for it, so text
  typed before the bundle ran is invisible to the component until it reads the field on mount.
  `MoneyInput` does; a new input component that keeps its own state has to as well.
- Prove a mutation in its own throwaway worktree with a path no other run uses, and never rebuild
  a worktree while a `verify` is still running against it.

`verify` bounds itself: each browser launch attempt has its own deadline and is retried once, the
browser phase has a five-minute deadline, a dead browser fails the run naming the last check that
passed, and teardown runs on SIGINT, SIGTERM and SIGHUP as well: it closes the browser over
DevTools, then kills only processes whose command line carries this run's exact `--user-data-dir`.
Chromium's crash-reporter processes carry no profile argument; they exit on their own shortly after
the browser. `verify` fails when it finds no browser. `--static` leaves the browser phase out, and
`--only=<block>[,<block>]` runs only the named package blocks and says so on the run's last line
(`FILTERED: ran …`); neither is a full run, and CI passes neither. The GitHub workflow runs
`check`, `publish:dry`, the build and `verify` on every pull request into `main`, and the Pages
deploy waits for them.

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

## Labels

**Every user-visible string has an English default and a prop that overrides it.** Decided on
2026-09-21, and it replaces the three policies `ui/` used to hold at once — one component threw
when a label was missing, another demanded a whole labels object, and the rest hard-coded
English. A caller who says nothing gets English; a caller who needs another language passes one
prop. Nothing in the library throws for want of a label.

The one exception is a name that cannot be defaulted because only the caller knows it — the
accessible name of an icon-only trigger, for instance. Those stay required, and required means a
type error rather than a warning at runtime.

## Every change updates the UI guide

**A new or changed component, helper or hook updates its card or example in `ui-guide/` in the same
pull request.** Owner rule, 2026-09-25. The guide is how a reader finds out what the library does,
so a change it does not show is a change nobody sees: a new prop gets a demo, a changed default
changes the demo's snippet, and a helper or hook a component card does not already exercise gets
an example of its own.

`deno task test` enforces only part of this: every component-named export of a catalogued package
needs a card (`ui-guide/coverage.ts`). That a card still matches its component, and that a helper
or hook is shown at all, is held by review.

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
preact                          10.29.8
@preact/signals                  2.5.1
@preact/signals-core            1.12.1
wouter-preact                    3.9.0
arktype                          2.2.3
@std/assert                     1.0.19
@std/expect                     1.0.20
@std/path                       1.1.6
@std/testing                    1.0.20
preact-render-to-string          6.7.0
tailwind-merge                   3.7.0
@spy4x/platform, time, validation 1.3.0
tailwindcss                     4.1.12
```

Three pins are not in this list, because each is pinned once in the one package that needs it, not
at the root — see "Adding a package" above: `d3@7.9.0` in `charts/deno.json`, and `leaflet@1.9.4`
and `@types/leaflet@1.9.22` in `map/deno.json`. Everything else here resolves through the root
import map.

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
