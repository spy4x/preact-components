# `@preact-components/ui-guide`

The live component catalogue, shipped as a component so every app that imports the library gets it
free. It renders one demo per component of every package it covers — `ui`, `charts`, `system`, `crud`
and `signals` — one card per group of `theme/preset.css` classes, the icon gallery, and the
design-system rules components are meant to be assembled in.

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

| Prop       | Meaning                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `registry` | Registry to render; defaults to the complete one. A partial one raises the banner.                                                 |
| `copy`     | Clipboard port, forwarded to every copy control — each card's usage block and the icon gallery. Defaults to `navigator.clipboard`. |
| `class`    | Extra utilities on the catalogue's root.                                                                                           |

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

### 5. The theme's class names are checked against the theme, in both directions

`instructions.tsx` renders the design-system rules from `documentedClasses`, and
`instructions.test.ts` reads `theme/preset.css` and fails if any documented class is not defined
there. `definedClasses()` strips comments before searching, because the preset explains the removal
of `.h6` and `.btn-sm` in prose and a substring search would count that mention as a definition — a
test pins that behaviour down.

The other direction is `classes.test.tsx`, and it is the one that matters for dead CSS: a class
`preset.css` defines that nothing demonstrates has to be either demonstrated or named in
`UNDEMONSTRATED_CLASSES` with a reason, or the suite fails. Two decisions are worth stating:

- **A test rather than a type.** The class list lives in CSS — Tailwind `@utility` blocks and plain
  selectors — so there is no union for TypeScript to derive a `Record` from without a code-generation
  step and a generated file in the tree. The test reads the two sets instead: defined from
  `preset.css`, demonstrated from the _rendered_ catalogue's `class` attributes. No codegen, no new
  dependency, and the same shape as `instructions.test.ts`.
- **Demonstrated is measured, not listed.** A hand-kept "demonstrated" list is precisely how
  `.btn-sm` and `.h6` outlived their last caller. `demonstratedClasses(render(<UIGuide />))` reads
  what the page really applies, so removing a class from a demo removes it from the set — and a class
  named only inside a usage snippet is text, not markup, and does not count.

The exclusions are the honest half: `theme-base` and `dark` are the host page's, the five `.map-*`
classes are Leaflet marker states in a package the guide does not cover, and the twelve `.btn*`
classes stay documented-but-not-demonstrated because `ui/Button` is the API for a button and `crud/`
is the class-form consumer (see "Class-name demos" below). Each entry carries its reason, and each is
checked for staleness — an excluded class the preset no longer defines, or that the catalogue
demonstrates after all, fails.

## Coverage

One row per section, in render order, naming the demos it registers. Between them the sections cover
every component the catalogue demonstrates and every class of `preset.css` that something demonstrates.

The counts are deliberately not repeated here: the guide prints them under its own title, and
`pages/build.ts` asserts a prerendered card per entry of `catalogueNames` against the emitted HTML, so
the number that matters is checked where it is produced rather than transcribed into prose.

| Section                    | Package   | Cards                                                                                    |
| -------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| **Badges**                 | `ui`      | `Badge`                                                                                  |
| **Buttons**                | `ui`      | `Button`, `CopyButton`, `GeoButton`                                                      |
| **Display**                | `ui`      | `PageTitle`, `ConfidenceMeter`, `Table`                                                  |
| **Feedback**               | `ui`      | `ErrorState`, `LoadingSpinner`, `LoadingSkeleton`, `LoadingScreen`, `Toastr`             |
| **Inputs**                 | `ui`      | `ToggleSwitch`, `OnOffButtons`, `Dropdown`                                               |
| **Fields**                 | `ui`      | `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `RadioGroup`, `InputButton` |
| **Forms**                  | `theme`   | `.input`, `.select`, `.textarea`, `.label`, `.checkbox`, `.radio`, `.btn-input-icon`     |
| **Surfaces and utilities** | `theme`   | `.card`, `.scrollbar`, the type scale, the KPI tile, the colour atoms                    |
| **Charts**                 | `charts`  | `Bars`, and the rest of the package on the worklist                                      |
| **System**                 | `system`  | `Breadcrumb`, and the rest on the worklist                                               |
| **CRUD**                   | `crud`    | `CrudList`, and the rest on the worklist                                                 |
| **Signals**                | `signals` | `For`, `Show` — the package's only components                                            |

Nothing here states how many components are _missing_ a demo, on purpose: that number moves with every
component PR, and the guide already prints it under its own title. Read the worklist on the page, or
`pendingDemos`, which is derived from the packages' barrels — `PENDING_DEMOS` for the packages ported
whole, the export list itself for one under construction. A count in this file was wrong twice while
this section was being written, which is the argument against a third one.

The `ui` sections are written up; the `charts`, `system` and `crud` cards are placeholders with a
one-line summary and a live render, and their section blurbs say so — the real demos land in
follow-up PRs. `signals` gets two cards rather than one because it has exactly two components and both
are a signal and a line of JSX; the parts that make the package hard to read (`buildModelStore`,
`createListState`, `createToastStore`, `useUrlFilters`) are factories, declared as helpers, and need a
written-up example rather than a card.

`Fields` is the `ui/` half of the form story — the controlled primitives, each with the demo an app
writes — and `forms`/`surfaces` are the other half: the preset styles markup the library does not own,
so a page built out of these packages writes its own cards, controls and containers. `forms` is native
controls with a preset class and nothing wrapped around them; `surfaces` is the card, the scroll
container, the type scale, the KPI tile and the colour atoms.

The class cards declare `package: "theme"`, which is what keeps them out of the component drift guard,
and their ids are namespaced (`class-input`, `class-card`) because a card id becomes a URL fragment:
`input` and `Input` write the same slug, and `card` collides with `Card`, which merged while this
section was being written. Their other contract — a heading, and a class list that matches their own markup — is enforced
by `classes.test.tsx`.

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

## Copying a snippet

Every card's `Usage` block has a `CopyButton` beside it — the `ui/` component the catalogue already
demonstrates, not a second one — wired to that card's own snippet and to the `copy` port the guide
was rendered with. The button sits next to the `<details>` rather than inside its `<summary>`, where a
click would toggle the disclosure as well as copying. Its accessible name is the card it belongs
to, so the catalogue is not one long row of identical "Copy" buttons to a screen reader: the attribute
ships escaped (`aria-label="Copy the &lt;Badge /&gt; snippet"`, which reads as `Copy the <Badge />
snippet`), and the checkmark `CopyButton` shows for 1.5s is the visual confirmation.

`copy.test.tsx` asserts the wiring at the props level, since the repository has no DOM harness: it
walks the element tree `UIGuide` returns, finds each card's `CopyButton` and checks the `textToCopy`
and `copy` it was handed. `pages/verify.ts` is what proves the click: it clicks every usage block in
a real browser and compares each clipboard write to the text of the block it came from.

## Not carried over

- **`financy`'s `currency.tsx` (221 LOC) — dropped.** It demonstrates `CurrencyDisplay`,
  `CurrencySelector` and `ExchangeRateBadge`, which are domain-coupled to that product and
  deliberately not part of `ui/`.
- **`financy`'s `form.tsx` (`UIGuideEditor`) — dropped.** It was an empty `<form class="card">`
  scaffold with three buttons and "Inputs go here…"; `Button` and `Table` cover the same ground with
  real assertions.
- **`.btn-sm` and `.h6` demos — dropped.** The theme dropped both classes; the guide now has a test
  that stops them coming back (see above).
- **Class-name demos in general — reversed, in part.** `gb`'s failure was documenting classes nothing
  used, not demonstrating classes at all; the two source guides had no way to tell the two apart.
  `forms` and `surfaces` demonstrate the classes no component covers, and `classes.test.tsx` is what
  the source guides lacked. The button family stays excluded: `Button` is demonstrated through
  `variant`/`size`, not through `btn btn-primary`, because one control with two documented APIs is a
  worse guide than one with a documented API and one documented class family.
- **Routing, navigation and toasts wiring.** `gb`'s guide called `navigate()` and
  `state.clipboard.copy()`. Those are ports here, and the route is a descriptor the app registers.

## Tests

```bash
deno task check             # from the repository root, what CI runs
deno test --allow-read --allow-env ui-guide/   # this package alone
```

Six suites: `registry.test.ts` (drift guard, package coverage, pending bookkeeping, the class
sections), `catalogue.test.tsx` (every demo renders, banner and worklist behaviour, route descriptor,
a usage block and copy control per card), `icons.test.tsx` (gallery exhaustiveness, filter),
`instructions.test.ts` (a documented class is defined), `classes.test.tsx` (a defined class is
demonstrated, or excluded with a reason) and `copy.test.tsx` (every card's copy control is wired to
its own snippet and to the injected port). Tests render real markup with `preact-render-to-string`
and assert on it; no DOM, no browser.

`preact-render-to-string` is pinned in this package's `deno.json` for the same reason as in `ui/`:
the root import map has no renderer. It is the only dependency this package adds.
