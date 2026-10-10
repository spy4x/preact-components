# No third-party component libraries

The standing policy for this repository. It is a decision, not a task: it does not close when some
milestone is reached, it holds on every PR until it is explicitly revoked.

Issued as [issue #34](https://github.com/spy4x/preact-components/issues/34), which this document
closes with evidence. [`docs/not-building.md`](./not-building.md) is the sibling record of what the
policy rules _out_ — the components we evaluated and are not building. This document is the rule
itself and how it is checked.

## The rule

**Every component in this repository is written here. No third-party component library is a
dependency — not in the root import map, not in a package's own `imports`, not vendored.**

## Why

Third-party UI libraries have cost more to work around than to own, in three specific ways:

1. **Styling opinions.** A library ships a look. `theme/preset.css` already defines ours. Reconciling
   the two means either fighting the library's defaults on every component or abandoning our tokens,
   and the second outcome is the one that wins slowly.
2. **Upgrade breakage.** A component library is a dependency that changes its API and its rendered
   markup. Every upgrade reopens components that already worked, for no product reason.
3. **Extension limits.** The component we need is never quite the component it ships. The workaround
   is usually more code than the component, and it inherits the library's constraints on top.

The alternative is that we own the component — including its accessibility, which is the real price
and is stated below rather than hidden.

## Not allowed

Any of these, as a dependency or vendored into the tree:

| Family       | Packages                                           |
| ------------ | -------------------------------------------------- |
| Radix        | `@radix-ui/*`, `radix-ui`                          |
| bits-ui      | `bits-ui`                                          |
| Headless UI  | `@headlessui/*`, `@headlessui-float/*`             |
| shadcn ports | shadcn components copied from any shadcn-based app |
| Material     | `@material/*`, `@mui/*`, `material-components-web` |
| Chakra       | `@chakra-ui/*`                                     |
| Ark UI       | `@ark-ui/*`                                        |
| React Aria   | `react-aria`, `@react-aria/*`, `@react-stately/*`  |

**Vendored copies count.** Copying a library's source into this tree to avoid declaring the
dependency does not satisfy the policy — it produces the same upgrade breakage with no version to
pin, no upstream changelog, and an unsolved licence question. If the package name is gone but the
implementation is theirs, the policy is broken.

## Private applications are design-intent sources, never code sources

Two earlier private applications use shadcn, Radix and bits-ui. They are where a large part of this
library's _design intent_ was first observed, and they are useful to read: the markup, the
interaction model, the states a surface has.

**Port the markup and the behaviour. Never the dependency.** Concretely, that means reading how one
of them composes a dialog and writing our own `ui/modal.tsx` against the same idea — not importing
`bits-ui`, and not transcribing its internals either.

One of the two is also one of the icon set's six sources: its own 52-file Svelte icon set is what
[`icons/README.md`](../icons/README.md) calls "the ported set", and 18 of its glyphs ship here
([issue #15](https://github.com/spy4x/preact-components/issues/15)). That is a port of drawings —
inline SVG paths — and brings no dependency with it, so the rule above holds for it too.

## Behaviour is implemented, not imported

This is what the policy costs, and it is not optional:

- **Focus traps** — moving focus into a surface, cycling within it, restoring the previous element on
  close.
- **Outside-click dismissal** — and `Escape`, and the difference between a dismissal and a
  deliberate close.
- **ARIA wiring** — `role`, `aria-expanded`, `aria-controls`, `aria-labelledby`, `aria-describedby`,
  and which id belongs on which element.
- **Keyboard navigation** — arrow keys within a composite widget, `Home`/`End`, typeahead, and the
  tab stops that must be dropped.
- **Positioning** — anchoring a surface to its trigger, flipping when it would overflow, and
  following the trigger on scroll and resize.

If a component needs one of these, it is written in the component's own file or a shared module in
this repository. Naming what was hand-written in the PR body is part of the policy's evidence
requirement — see #34.

## Accessibility is ours

With no library providing it, accessibility is this repository's responsibility, and it is the main
cost of the constraint and the main thing review checks. Practically:

- Every component explicitly handles its roles, labels, keyboard interaction and focus.
- Prefer the platform primitive where one exists — `<dialog>`, `<details>`, `<button>`, `Intl`,
  `crypto`, `URL`, `structuredClone`. A native element ships the semantics already.
- A component that cannot be reached or operated by keyboard is not finished, however good it looks.
- `AGENTS.md` → _Component rules_ governs how the rest of the repository's conventions apply: props
  and ports, no global state, server-renderable.

## The allowed set, as it is today

The full dependency surface of the repository, each clause justified. Root import map in
`deno.jsonc` unless stated. This list is descriptive of the tree today — adding to it is a decision,
not a maintenance chore.

| Specifier                                    | Why it is allowed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preact`, `preact/`                          | The renderer. Not a component library — it provides no components, no styling and no behaviour. Owned by the library by construction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `@preact/signals`, `@preact/signals-core`    | Reactive state primitives. A general-purpose primitive, shared with `spy4x/template` so an app resolves one copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `wouter-preact`                              | URL routing. A small, well-solved problem that is not ours to reimplement, and it is a router rather than a component library.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `arktype`                                    | Validation. `AGENTS.md` → _Validation_ names it the only permitted validator; it supplies runtime checks and the inferred type, nothing visual.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tailwind-merge`                             | Class-string composition. One function, no components and no styling opinion of its own — it serves `theme/preset.css` rather than competing with it. Wrapped by `cn/`, which does the falsy-input filtering `clsx` used to do before it was removed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tailwindcss`, `tailwindcss/`                | The styling system itself, and the one deliberate styling opinion in the tree. `theme/preset.css` is built on it, so it is the substrate rather than a rival to it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `@std/assert`, `@std/expect`, `@std/testing` | Test-only. Never reachable from a published entry point.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `preact-render-to-string`                    | Pinned once in the root import map — #219 replaced six identical per-package copies with this one. Used by tests that assert on real rendered markup (`charts/`, `crud/`, `system/`, `ui/`, `ui-guide/`) **and by non-test build code** — `pages/src/prerender.tsx` prerenders the demo to markup at build time. Never named in a package's own `exports`, so no published package's consumer resolves it. It is not a component library: it renders components, it ships none.                                                                                                                                                                                                                                                                                                                             |
| `leaflet`, `@types/leaflet`                  | A map engine, not a component library — it draws tiles and manages pan/zoom, and ships no button, dialog, form control or any other surface this policy governs. Named in the owner's global instructions among the "giant, well-solved" libraries to keep, and accepted as reusable per [issue #143](https://github.com/spy4x/preact-components/issues/143). Declared once, in `map/deno.json` alone: nothing else in the workspace resolves it, so `ui/` and `charts/` do not carry it merely by existing in the same repo — verified with `deno info` against each package's own entry point rather than by reading their imports. `@types/leaflet` is a separate, community-maintained package (Leaflet ships no types of its own), pinned to the newest release compatible with the `leaflet` version. |
| `@tailwindcss/oxide`                         | Build-only, declared in `pages/deno.json`. Tailwind 4's class scanner, at the version the `tailwindcss` pin already resolves to; drives the demo build instead of shelling out to a CLI that needs a `node_modules` tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `node:path`, `node:url`, `node:fs`           | Deno's built-in Node-compatibility modules, used by build and test helper scripts. Platform, not third-party.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Nothing else is permitted. A new dependency needs a written justification in the PR body
(`AGENTS.md` → _Code style_ → "Minimise dependencies"), and the burden is on the addition, not on the
refusal.

## How the rule is held to — and what is not checked

Stated precisely, because an overclaimed guard is worse than no guard. **The short version: nothing
mechanical enforces this policy. CI does not check it. Review does.**

### The one mechanical gate — and how narrow it is

`deno task ts:check` runs `deno check` over every `.ts`/`.tsx` file in the tree
(`infra/scripts/type-check.ts`). **It fails only on a _bare_ specifier that no config declares**, with
`TS2307: not a dependency and not in import map`. That is the whole of its coverage.

It is a gate on **resolution, not on permission**, in two distinct ways:

1. **A bare specifier added to an import map resolves, type-checks and passes.** The map is the
   permission, and nothing else checks the map.
2. **A scheme-qualified specifier written inline in a source file is declared in no config at all and
   passes green.** Observed:

   ```console
   $ printf 'import * as Radix from "npm:@radix-ui/react-dialog@1.0.0"\nexport const p = Radix\n' > probe/inline-dep.ts
   $ deno check probe/inline-dep.ts
   Download https://registry.npmjs.org/@radix-ui/react-dialog/-/react-dialog-1.0.0.tgz
   ...
   Check probe/inline-dep.ts          # exit 0
   ```

   No config declares it, both audit greps below are clean on it, and the suite is unaffected — an
   excluded component library reached this way passes CI entirely. It is also invisible to the greps,
   which read configs only, and to the lockfile-as-record, which simply gains the entries.

So the gate does not mean "a dependency must be declared to be permitted". It means only that Deno
cannot resolve a bare word nobody mapped. Treat it as a resolvability check, not a permission check.

### There is no lockfile gate — the lockfile is a record, not a check

It is tempting to assume the committed `deno.lock` is the enforcement mechanism. **It is not.**

Deno keeps the lockfile in sync automatically and does not fail when it is stale. Observed under CI
emulation — `CI=true DENO_DIR=$(mktemp -d)` — on Deno 2.9.7 (the version in the CI image):

```console
$ # change an existing pin, tailwind-merge 3.7.0 -> 3.6.0, then run the check task
$ CI=true DENO_DIR=$(mktemp -d) deno task check
Download https://registry.npmjs.org/tailwind-merge/-/tailwind-merge-3.6.0.tgz
Checks passed!                     # exit 0 — and deno.lock was rewritten to 3.6.0

$ # add a dependency absent from the lock, imported by a source file
$ CI=true DENO_DIR=$(mktemp -d) deno check src/mod.ts
Download https://registry.npmjs.org/lodash
Check src/mod.ts                   # exit 0 — lock rewritten to include lodash
```

Only an explicit `deno cache --frozen` fails, and **no task in this repository passes `--frozen`, and
CI does not run `deno cache`.** So the lockfile records what was resolved; it does not refuse a change.
Exact pinning is a **convention held by review**, and the grep below only shows a reviewer whether it
is being held:

```bash
grep -rnE ':\s*"(npm|jsr):[^"]*[\^~]' --include=deno.json --include=deno.jsonc . | grep -v node_modules
# no output, exit 1 — true of the tree today
```

A lockfile change appearing in a diff is the signal that a dependency was added or moved. That is
review reading a diff, not CI failing a build.

One narrow exception: `deno task --cwd pages verify`, which the GitHub workflow runs, fails when
`deno.lock` records a specifier with no version (`jsr:…@*`), whoever wrote it, and when the run
itself changes the lockfile (#283). It checks the lockfile's shape, not which dependencies it
holds.

### Nothing in CI checks the allowlist

Woodpecker (`.woodpecker.yml`) runs `deno task check`, which is exactly `fmt:check`, `lint`,
`ts:check` and `test`, then `deno task publish:dry` as its own step. The GitHub workflow
(`.github/workflows/pages.yml`) runs `deno task check`, `deno task publish:dry`, `deno task --cwd
pages build` and `deno task --cwd pages verify`, on every pull request into `main` and before every
deploy. Not one of those looks at a dependency: `publish:dry` simulates a JSR publish and fails on a
malformed package, not a disallowed one, and `verify` drives the built demo in a browser and asserts
what the page does, never what it was built from. There is
no dependency-allowlist test, no audit script, no a11y gate and no git hook anywhere in this
repository: `infra/scripts/` contains `type-check.ts` alone, there is no `.githooks` directory, and
`.github/workflows/` holds only `pages.yml`.

The consequence, stated plainly: **a PR could add `@radix-ui/react-dialog` to the root import map at
an exact pin, and every check in CI would pass.** The policy would be broken and the build would be
green. The same is true of the inline form above — here it is written in the map, which is the shape
both greps are built to see; the inline form in a source file is not seen by either.

What stops that is review. These two greps are how a reviewer checks it:

```bash
# Form 1 — the specifier KEY, for a library named directly.
grep -rniE '"@?(radix|bits-ui|headlessui|shadcn|chakra|ark-ui|react-aria|react-stately|mui|material)' \
  --include=deno.json --include=deno.jsonc . | grep -v node_modules

# Form 2 — the specifier VALUE, for the same library behind an indirect key.
grep -rniE '(npm|jsr):(@)?(radix|bits-ui|headlessui|shadcn|chakra|ark-ui|react-aria|react-stately|mui|material)' \
  --include=deno.json --include=deno.jsonc . | grep -v node_modules
```

**Both must be run — they are complementary, and each is blind where the other sees.** The key form is
the weaker one and is easy to mistake for sufficient: it only matches a specifier _key_, so a library
reached through an innocent key is invisible to it. This configuration is caught by the value form and
missed entirely by the key form:

```jsonc
"imports": {
  "the-dialog-lib": "npm:@radix-ui/react-dialog@1.0.0",
}
```

Both were mutation-tested. Every family in the table above — all 14 forms, each as a direct key and
each behind an innocent key — was injected into a scratch copy: the key form detects all 14 direct
formulations and misses the indirect key; the value form detects all 14 in both positions. A check that
cannot fail is not a check.

### What the greps cover — a named subset, not a proof of absence

Be clear about the shape of this check, because it is weaker than it looks:

- **They cover a named list of families** — exactly the rows of the "Not allowed" table, and nothing
  else. A component library outside that list is not caught, and the list is not the whole space of
  component libraries. **This is not a proof that no component library is present.**
- **They inspect configs only** — every `deno.json`/`deno.jsonc`. **This is the significant hole:** a
  specifier written inline in a source file is declared in no config, so neither grep can see it:

  ```ts
  import * as Radix from "npm:@radix-ui/react-dialog@1.0.0"
  ```

  No config declares it, the greps are clean, and `deno check` passes it (see "The one mechanical gate"
  above). A forbidden dependency can enter the tree this way and pass every check CI runs. Configs are
  where imports are _conventionally_ declared in this repository — an inline scheme-qualified specifier
  would be caught in review as a style violation long before the policy question — but that is a review
  argument, not a mechanical one.
- **Vendored source is invisible to both.** A library's implementation copied into the tree declares
  no specifier and no version, so no grep over configs finds it. Review-only — and the reason "vendored
  copies count" is stated as part of the rule.
- **A URL value form is not caught.** `"x": "https://esm.sh/@radix-ui/react-dialog@1.0.0"` matches
  neither grep, because neither looks for the `https:` form. The same goes for any other CDN or a
  `git+https` specifier.
- **`material` is a broad token, deliberately.** It catches `@material/web`, `material-components-web`
  and `@mui/material`, and it would also flag an innocent package whose name merely contains
  `material`. On this tree both greps are clean, so the tradeoff costs nothing today; a false positive
  costs a reviewer one glance, a false negative costs the policy.
- **The value form is case-insensitive.** npm and JSR package names are lowercase by spec, so a
  case-sensitive form would be correct — but `NPM:@RADIX-UI/...` in a config is a mistake worth
  seeing rather than missing, so `-i` stays on.

Behaviour reimplemented poorly, and accessibility regressions, are likewise not detectable here:
nothing mechanical distinguishes our own focus trap from a transcription of someone else's, and no
automated a11y check runs in this repository. The suites assert on rendered markup and on ARIA
attributes for many components, but coverage is per-component.

### The honest summary

**CI pins nothing and checks nothing about dependencies. There is no mechanical enforcement of this
policy at all — only review, helped by two greps over a named list of families.** A lockfile drift
appears in the diff and is caught by a human reading it.

If that is not enough for a given change, the fix is a real allowlist check — a test that parses every
config's `imports` against a committed allowlist, and that reads `deno.lock` with an assertion instead
of trusting it. **That test does not exist yet, and neither does any frozen-lockfile gate.** Adding one
is a legitimate follow-up; claiming the current state is that check is not.

## Deferred decisions

Recorded so a deferred decision stays visible instead of becoming an ambiguity somebody has to
reconstruct later. **A deferred decision is not a resolved one.**

### Replacing the icon set with a licensed FOSS pack — issue #10

**Status: decided by the repository owner on 2026-09-30 and done in
[issue #233](https://github.com/spy4x/preact-components/issues/233): every glyph comes from a FOSS
pack.** The section stays under this heading so the history of the decision is easy to find.

The icon set was not written here from scratch. Per [`icons/README.md`](../icons/README.md), which
is the authority on this:

- It is a **merge of six source apps** — deduped by SVG body, not by name. One of the six
  contributed nothing after dedupe (a fork of another with byte-identical bodies throughout).
- **Provenance is checked, not eyeballed.** `icons/provenance.ts` compares every exported glyph's
  geometry against the published Heroicons v1, Heroicons v2, Feather, Lucide and Simple Icons packs.
  All 123 glyphs match a pack's glyph exactly. #233 got there by replacing the 32 glyphs that did
  not — 24 that matched no pack, 6 that matched one only nearly, and the 2 brand marks that matched
  Feather — with a pack's own drawing under the same export name and props; `icons/README.md` →
  "Provenance" lists each one with its old and new source.
  [`icons/THIRD_PARTY_NOTICES.md`](../icons/THIRD_PARTY_NOTICES.md) carries the licence text for
  all five packs.
- **Six glyphs are trademarked brand marks** — GitHub, LinkedIn, Telegram, Upwork, Twitter and
  YouTube. Five are Simple Icons' drawings (CC0); LinkedIn is Feather's, because Simple Icons no
  longer ships LinkedIn's mark. Trademark constraints are independent of any icon licence: the pack's
  licence covers the drawing, and using a mark is still subject to its owner's brand guidelines.
- All 123 glyphs are inline source in `icons/+index.tsx`, `{ class?: string }` prop surface, no
  codegen, no build step, no runtime dependency beyond Preact. The packs are pinned in
  `icons/deno.json` for `provenance.ts` alone and never reach a published consumer.

> The glyph count above is the module's: `icons/+index.test.ts` asserts 123 exports, and
> `deno task test` runs it. The source count is six, the ported set included — the section on
> design-intent sources earlier in this document says why that set is a port of drawings and not of
> a dependency.

For every glyph, the matched pack's own licence applies — that is a fact about which pack the
geometry compares equal to, not a legal opinion rendered here. The repository's own licence is
unaffected and is stated in [`LICENSE`](../LICENSE) (MIT, covering the code in this repository);
[`CREDITS.md`](../CREDITS.md) is attribution for the design system and states explicitly that it is
not a licence statement.

**New icon work** takes a glyph from one of the five packs, copied exactly, and records its source on
the glyph's JSDoc line; `deno task --cwd icons provenance` must still report every glyph as an exact
match afterwards.
