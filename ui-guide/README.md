# `@preact-components/ui-guide`

The live component catalogue, shipped as a component so every app that imports the library gets it
free. It renders one demo per component of every package it covers — `ui`, `charts`, `system`, `crud`
and `signals` — the icon gallery, and the design-system rules components are meant to be assembled
in.

Ported from `financy`'s modular `routes/ui-guide/*` (the better structure of the two source guides)
and `gb`'s `islands/system/UIGuide.tsx`, whose icon gallery is kept verbatim in spirit.

## Usage

An app renders the component at whatever path its router wants:

```tsx
import { UIGuide } from "@preact-components/ui-guide"

<UIGuide />
```

Or registers the route descriptor, which is the fix for `gb`'s guide being an orphan reachable only
by typing its URL:

```tsx
import { uiGuideRoute } from "@preact-components/ui-guide"

const nav = [...appLinks, { href: uiGuideRoute.path, label: uiGuideRoute.label }]

// at the route:
<uiGuideRoute.component />
```

| Prop       | Meaning                                                                            |
| ---------- | ---------------------------------------------------------------------------------- |
| `registry` | Registry to render; defaults to the complete one. A partial one raises the banner. |
| `copy`     | Clipboard port, forwarded to the icon gallery. Defaults to `navigator.clipboard`.  |
| `class`    | Extra utilities on the catalogue's root.                                           |

Nothing here imports an app's state: the two things a catalogue needs from its host — where to put a
copied snippet — arrive as ports.

## The drift guard

This is the part that makes the catalogue stay true, and it is the part the source guides lacked.
Both of the source guides documented **class names** rather than component APIs, which is how `gb`
ended up documenting `.btn-sm` and `.h6` — classes with zero usages that only its own ui-guide kept
alive.

### 1. Compile-time: rename, removal and a missing demo fail `deno check`

`registry.ts` derives each package's vocabulary from that package's own module namespace instead of
maintaining a list:

```ts
export type ComponentNamesOf<P extends PackageId> = Exclude<
  keyof (typeof PACKAGES)[P]["namespace"],
  (typeof PACKAGES)[P]["helpers"][number]
>
export type ComponentName = { [P in PackageId]: ComponentNamesOf<P> }[PackageId]
```

A section declares the package it documents (`package: "ui"`), registers its demos through
`satisfies DemoFragment<"Badge" | …>`, and `registryDrift` is typed `DriftReport` — one conditional
report per package, collapsing to `true` only while that package's demos, pending list and helpers
account for its exports exactly. Five kinds of drift all fail the build, each naming the offending
component and, with it, the package whose report is wrong:

| Drift                                          | Error                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| exported with no demo and no pending entry     | `Type 'boolean' is not assignable to '{ missingDemo: "Badge" }'` |
| demo for a component that is not exported      | `'{ unexpectedDemo: "BadgePill" }'`                              |
| a pending component that has been demoed since | `'{ stalePending: "BadgePill" }'`                                |
| a component demoted into a helper list         | `Type '"Badge"' is not assignable to type '"buttonClasses" …'`   |
| one demo dropped from a section fragment       | `Property 'Badge' is missing in type 'DemoFragment<"Badge">'`    |

Prop vocabulary is guarded one level down: demos iterate a `Record<Union, …>` keyed by a prop's own
union type (`ButtonVariant`, `BadgeColor`, `SpinnerSize`, `BadgeType`, `ToastVariant`), so adding a
variant to a component fails `deno check` until the catalogue shows it.

### 2. Declared gaps are a list, not an omission

A component whose demo is honestly not written yet belongs in `PENDING_DEMOS`, not in a helper list: a
helper says "this is not a component", a pending entry says "this is one, and nobody has written it
up". The list is typed over the same union, so it cannot name something the package does not export,
and the guide prints it (`pendingDemos`) as an amber worklist under the title. `charts`, `system` and
`crud` each have one live card and the rest of their components on that list.

### 3. Runtime: a component without a demo is visible, not absent

`missingDemos(registry)` is what the catalogue renders. It is exported and takes the registry as an
argument precisely so it can be driven with an incomplete one: `catalogue.test.tsx` passes registries
with one and two entries removed and asserts the red banner names them and the singular/plural count
is right, while `registry.test.ts` asserts the report is empty for the real registry.

A total registry means the banner never shows in a healthy tree — the compile-time guard fires first.
The banner is the backstop for a deliberately trimmed guide, and it is tested rather than assumed.
`missingDemos` covers the cards the sections declare; the declared gaps are `pendingDemos`' business,
which is why a healthy page shows the amber list and no red banner.

### 4. A package added later has to make a decision

`registry.test.ts` walks the top-level directories for a `deno.json` and fails when one is neither a
`PACKAGES` source nor an `EXCLUDED_PACKAGES` entry with a reason. Covering a package and excluding it
are both one line, both typed, and both visible in review — the difference between a package that is
deliberately out of the guide and one nobody noticed. That is how `icons/` (the gallery reads the
barrel itself), `theme/` (CSS), `pages/` (the demo's host app, not a package) and `ui-guide/` itself
are written down.

### 5. The theme's class names are checked against the theme

`instructions.tsx` renders the design-system rules from `documentedClasses`, and
`instructions.test.ts` reads `theme/preset.css` and fails if any documented class is not defined
there. `definedClasses()` strips comments before searching, because the preset explains the removal
of `.h6` and `.btn-sm` in prose and a substring search would count that mention as a definition — a
test pins that behaviour down.

## Coverage

20 components have a card each, across nine sections. The other 25 — of `charts`, `system` and
`crud` — are declared in `PENDING_DEMOS` and printed as the worklist under the title:

| Section      | Package   | Components                                                                   |
| ------------ | --------- | ---------------------------------------------------------------------------- |
| **Badges**   | `ui`      | `Badge`                                                                      |
| **Buttons**  | `ui`      | `Button`, `CopyButton`, `GeoButton`                                          |
| **Display**  | `ui`      | `PageTitle`, `ConfidenceMeter`, `Table`                                      |
| **Feedback** | `ui`      | `ErrorState`, `LoadingSpinner`, `LoadingSkeleton`, `LoadingScreen`, `Toastr` |
| **Inputs**   | `ui`      | `ToggleSwitch`, `OnOffButtons`, `Dropdown`                                   |
| **Charts**   | `charts`  | `Bars` — 7 components pending                                                |
| **System**   | `system`  | `Breadcrumb` — 7 components pending                                          |
| **CRUD**     | `crud`    | `CrudList` — 11 components pending                                           |
| **Signals**  | `signals` | `For`, `Show` — the package's only components                                |

The five `ui` sections are written up; the four newer cards are placeholders with a one-line summary
and a live render, and their section blurbs say so — the real demos land in follow-up PRs. `signals`
gets two cards rather than one because it has exactly two components and both are a signal and a
line of JSX; the parts that make the package hard to read (`buildModelStore`, `createListState`,
`createToastStore`, `useUrlFilters`) are factories, declared as helpers, and need a written-up
example rather than a card.

The registry is checked against the barrels, not against this table, so the table cannot drift either
— `registry.test.ts` fails if a section gains or loses a component, and it fails if a covered package
has a component that is neither demoed nor pending.

Two demos needed a `class` override to be renderable inside a page: `LoadingScreen` is a
full-viewport overlay and `Toastr` is pinned to the page corner, so both are shown inside a
positioned box (the package merges classes through `cn`, where a later position utility wins).

## The icon gallery

`icons.tsx` reads the whole `@preact-components/icons` namespace — no list, no count, no registry
entry — and renders every glyph with a live name filter and click-to-copy of `<IconName />`. A new
icon is in the catalogue the moment it is exported. `icons.test.tsx` matches the rendered
`data-icon` attributes against the icon module's own exports, so the gallery cannot fall behind it.

The clipboard goes through the `copy` port, which falls back to `copyToClipboard` from
`@preact-components/ui/copy-button` so the legacy `execCommand` path is not reimplemented here.

## Not carried over

- **`financy`'s `currency.tsx` (221 LOC) — dropped.** It demonstrates `CurrencyDisplay`,
  `CurrencySelector` and `ExchangeRateBadge`, which are domain-coupled to that product and
  deliberately not part of `ui/`.
- **`financy`'s `form.tsx` (`UIGuideEditor`) — dropped.** It was an empty `<form class="card">`
  scaffold with three buttons and "Inputs go here…"; `Button` and `Table` cover the same ground with
  real assertions.
- **`.btn-sm` and `.h6` demos — dropped.** The theme dropped both classes; the guide now has a test
  that stops them coming back (see above).
- **Class-name demos in general.** `Button` is demonstrated through `variant`/`size`, not through
  `btn btn-primary`, so the guide cannot outlive the API it documents.
- **Routing, navigation and toasts wiring.** `gb`'s guide called `navigate()` and
  `state.clipboard.copy()`. Those are ports here, and the route is a descriptor the app registers.

## Tests

```bash
deno task check             # from the repository root, what CI runs
deno test --allow-read --allow-env ui-guide/   # this package alone
```

Four suites: `registry.test.ts` (drift guard, package coverage, pending bookkeeping),
`catalogue.test.tsx` (every demo renders, banner and worklist behaviour, route descriptor),
`icons.test.tsx` (gallery exhaustiveness, filter), and `instructions.test.ts` (theme class drift). Tests render real markup with `preact-render-to-string`
and assert on it; no DOM, no browser.

`preact-render-to-string` is pinned in this package's `deno.json` for the same reason as in `ui/`:
the root import map has no renderer. It is the only dependency this package adds.
