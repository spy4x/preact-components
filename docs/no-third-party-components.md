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

## `roley` and `evisa` are design-intent sources, never code sources

`roley` and `evisa` in `~/sync/code` use shadcn, Radix and bits-ui. They are where a large part of
this library's _design intent_ was first observed, and they are useful to read: the markup, the
interaction model, the states a surface has.

**Port the markup and the behaviour. Never the dependency.** Concretely, that means reading how
`roley` composes a dialog and writing our own `ui/modal.tsx` against the same idea — not importing
`bits-ui`, and not transcribing its internals either.

The same line applies to icons, and it is the reason this document does not list `roley` among the
icon sources. `roley` carries its own 52-glyph Svelte icon set, and six of its glyphs draw geometry
identical to ours (`arrowLeft`, `arrowRight`, `back`, `down`, `up`, `trash`), but every matching
glyph of ours is annotated `from template` and all six are stock Heroicons v1 paths. The overlap is a
shared upstream, not a port. See [`icons/README.md`](../icons/README.md) and "Deferred decisions"
below for what the icon set's provenance actually is.

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

| Specifier                                           | Why it is allowed                                                                                                                                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preact`, `preact/`                                 | The renderer. Not a component library — it provides no components, no styling and no behaviour. Owned by the library by construction.                                                                                                               |
| `@preact/signals`, `@preact/signals-core`           | Reactive state primitives. A general-purpose primitive, shared with `spy4x/template` so an app resolves one copy.                                                                                                                                   |
| `wouter-preact`                                     | URL routing. A small, well-solved problem that is not ours to reimplement, and it is a router rather than a component library.                                                                                                                      |
| `arktype`                                           | Validation. `AGENTS.md` → _Validation_ names it the only permitted validator; it supplies runtime checks and the inferred type, nothing visual.                                                                                                     |
| `clsx`, `tailwind-merge`                            | Class-string composition. Two functions, no components and no styling opinion of their own — they serve `theme/preset.css` rather than competing with it.                                                                                           |
| `tailwindcss`, `tailwindcss/`, `@tailwindcss/forms` | The styling system itself, and the one deliberate styling opinion in the tree. `theme/preset.css` is built on it, so it is the substrate rather than a rival to it.                                                                                 |
| `@std/assert`, `@std/expect`, `@std/testing`        | Test-only. Never reachable from a published entry point.                                                                                                                                                                                            |
| `preact-render-to-string`                           | Test-only, declared per package that asserts on real rendered markup (`charts/`, `crud/`, `pages/`, `signals/`, `system/`, `ui/`, `ui-guide/`). Kept out of the root map so a consumer never inherits a renderer.                                   |
| `d3`                                                | Optional peer of the interactive chart path only, declared in `charts/deno.json` and `ui-guide/deno.json` rather than the root map, so an SVG-only consumer never has it in their graph. See `charts/probe/no-d3-dependency.ts`, which proves that. |
| `@tailwindcss/oxide`                                | Build-only, declared in `pages/deno.json`. Tailwind 4's class scanner, at the version the `tailwindcss` pin already resolves to; drives the demo build instead of shelling out to a CLI that needs a `node_modules` tree.                           |
| `node:path`, `node:url`, `node:fs`                  | Deno's built-in Node-compatibility modules, used by build and test helper scripts. Platform, not third-party.                                                                                                                                       |

Nothing else is permitted. A new dependency needs a written justification in the PR body
(`AGENTS.md` → _Dependencies_), and the burden is on the addition, not on the refusal.

## How the rule is enforced

Stated precisely, because an overclaimed guard is worse than no guard.

### Mechanically enforced

Two things are checked mechanically. Neither of them is the allowlist.

1. **Exact version pins.** Every specifier in every `deno.json`/`deno.jsonc` is an exact pin — no
   `^`, no `~`, no floating tag. Checkable, and green today:

   ```bash
   grep -rnE ':\s*"(npm|jsr):[^"]*[\^~]' --include=deno.json --include=deno.jsonc . | grep -v node_modules
   # no output, exit 1
   ```

   What enforces it is Deno, not a checker written here: the committed `deno.lock` pins every
   resolved version and integrity hash, and `deno task check` fails against a stale lockfile.
2. **Declared imports resolve.** `deno task ts:check` runs `deno check` over every `.ts`/`.tsx` file
   in the tree (`infra/scripts/type-check.ts`), so an import of a specifier that no config declares
   fails the build. That is a real mechanical gate — but it is a gate on _resolution_, not on
   _permission_. A specifier added to the import map resolves, and `deno check` passes.

### Not mechanically enforced

**Nothing in CI checks the allowlist.** `deno task check` is the only command CI runs
(`.woodpecker.yml`), and it is exactly `fmt:check`, `lint`, `ts:check` and `test`. There is no
dependency-allowlist test, no audit script and no git hook in this repository: `infra/scripts/`
contains `type-check.ts` alone, and there is no `.githooks` directory.

The consequence, stated plainly: **a PR could add `@radix-ui/react-dialog` to the root import map at
an exact pin, and every check in CI would pass.** The policy would be broken and the build would be
green.

What stops that is review, and the two audit greps above are how a reviewer checks it. Run them:

```bash
# Specifier names: catches a library named directly as a key.
grep -rniE "\"(radix|@radix|headlessui|@headlessui|shadcn|bits-ui|@chakra|@material|react-aria|@ark)" \
  --include=deno.json --include=deno.jsonc . | grep -v node_modules

# Version values: catches the same library behind an innocent-looking key.
grep -rnE "npm:(@)?(radix|headlessui|shadcn|bits-ui|chakra|material-ui|react-aria|@ark)|jsr:(@)?(radix|shadcn|bits-ui)" \
  --include=deno.json --include=deno.jsonc . | grep -v node_modules
```

**Both must be run.** The first alone is not sufficient and it is easy to mistake it for being
sufficient: it matches a quoted specifier _key_, so it is blind to a library reached through an
indirect key. This configuration is not caught by the key grep at all, and is caught by the value
grep:

```jsonc
"imports": {
  "the-dialog-lib": "npm:@radix-ui/react-dialog@1.0.0",
}
```

Both greps are green on the tree today, and both were mutation-tested — a deliberately injected
`@radix-ui/react-dialog` pin in a scratch copy is detected by each. A check that cannot fail is not
a check.

### What neither grep can see

- **Vendored source.** A library's implementation copied into the tree declares no specifier and no
  version, so no grep over configs finds it. This is review-only, and the reason "vendored copies
  count" is stated as part of the rule.
- **Behaviour reimplemented poorly.** Nothing mechanical distinguishes our own focus trap from a
  transcription of someone else's.
- **Accessibility regressions.** No automated a11y check runs in this repository. The suites assert
  on rendered markup and on ARIA attributes for many components, but coverage is per-component and
  there is no axe-style gate.
- **A dependency added under a name that does not match the greps** — the greps enumerate the
  families named above, not the whole space of component libraries. They are a fast check for the
  known offenders, not a proof of absence.

### The honest summary

CI pins versions exactly and review enforces the rest. If that is not enough for a given change,
the fix is a real allowlist check — a test that parses every config's `imports` against a committed
allowlist — and that test does not exist yet. Adding one is a legitimate follow-up; claiming the
current greps are that check is not.

## Deferred decisions

Recorded so a deferred decision stays visible instead of becoming an ambiguity somebody has to
reconstruct later. **A deferred decision is not a resolved one.**

### Replacing the icon set with a licensed FOSS pack — issue #10

**Status: deferred, open, pending a licensing decision by the repository owner.** This section
records the decision's shape. It does not take it.

The icon set is **not** covered by the reasoning above, and it carries a separate question: it was
not written here from scratch. Per [`icons/README.md`](../icons/README.md), which is the authority on
this:

- It is a **merge of five source projects** — `spy4x/template`, `spy4x/gb`, `spy4x/antonshubin.com`,
  `spy4x/offer-lens`, `spy4x/mig` — deduped by SVG body, not by name. `gb` contributed nothing after
  dedupe.
- **The licence provenance of the glyphs is unverified.** `icons/README.md` states this outright
  under "Provenance — unverified". The families look like Heroicons v1/v2 and Feather — close enough
  to be confident about the lineage, nowhere near close enough to be confident about the licence of
  every individual path.
- **Brand marks are the trademark-constrained subset.** Five filled brand glyphs came from
  `antonshubin.com` — GitHub, LinkedIn, Telegram, Upwork and Quote. Trademark constraints are
  independent of any icon licence: brand marks are not freely relicensable even when the drawing is
  your own. This is the part most likely to need its own decision, and it is why any replacement is
  expected to split the brand subset from the general set.
- All 101 glyphs are inline source in `icons/+index.tsx`, `{ class?: string }` prop surface, no
  codegen, no build step, no runtime dependency beyond Preact.

**This document does not resolve that question and must not be read as doing so.** No licence is
asserted for the icon set, none is inferred, and no glyph has been changed, replaced or re-drawn.
The open choices — which pack, whether attribution alone is sufficient, and how to treat the brand
subset — belong to the repository owner as a legal decision, not to an implementation PR.

The repository's own licence is unaffected and is stated in [`LICENSE`](../LICENSE) (MIT, covering
the code in this repository); [`CREDITS.md`](../CREDITS.md) is attribution for the design system and
states explicitly that it is not a licence statement.

**Recommendation: keep #10 deferred and open.** It is not blocked, but it is also not urgent, and
acting on it now would replace working glyphs to settle a question that attribution may already
settle.

**Revisit trigger — any one of these:**

1. **A release or distribution event** — the set is published to a registry, the demo is promoted, or
   the package is consumed outside `spy4x`'s own apps. Unverified provenance and public distribution
   should not coexist.
2. **A licence audit** of this repository, or of any app that consumes it.
3. **A glyph is found to be from a pack whose licence forbids this use**, or whose attribution terms
   are not met by the current tree.
4. **A brand-mark complaint**, or any of the five brand glyphs being used in a context where the
   mark's owner's guidelines apply.
5. **New icon work** — a fresh need that would otherwise add another glyph of unverified lineage to a
   set already carrying that caveat. At that point generate from one licensed source rather than
   extending the merge.
