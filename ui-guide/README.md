# `@preact-components/ui-guide`

The live component catalogue, shipped as a component so every app that imports the library gets it
free. It renders one demo per component of every package it covers — `ui`, `charts`, `system` and
`crud` — one card per group of `theme/preset.css` classes, the icon gallery, and the design-system
rules components are meant to be assembled in.

Ported from one source application's own modular route-per-section guide (the better structure of
the two source guides) and another's single-file guide component, whose icon gallery is kept
verbatim in spirit.

## Usage

An app renders the component at whatever path its router wants:

```tsx
import { UIGuide } from "@preact-components/ui-guide"

<UIGuide />
```

Or registers the route descriptor, which is the fix for one source guide being an orphan reachable
only by typing its URL:

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

## Routes

`routes.ts` is the catalogue's URL grammar, exported as its own subpath
(`@preact-components/ui-guide/routes`) and from the barrel. It is pure — no DOM, no `window`, no
`location` — so the decision it makes is unit-testable and the host owns the effects.

| Hash                     | Match                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| `""`, `#`, `#/`          | index, `reason: "empty"`                                                |
| `#/inputs`               | section `inputs` — its slug is `routeSlug(id)`, nothing hand-kept       |
| `#/inputs/toggle-switch` | demo `ToggleSwitch`, canonical href from `demoHref(section, name)`      |
| `#toggle-switch`         | the same demo: the bare fragment this page shipped before, kept working |
| `#/nonsense`             | index, `reason: "unknown"` — the sentinel, never a throw                |

Three decisions worth stating, because a later wave will build on them:

- **The routes derive from `catalogueSections`.** `routeSlug` of the section id is the section slug
  and `routeSlug` of the component name is the demo slug — one slug rule, the same one
  `pages/src/deep-link.ts`'s `demoSlug` delegates to. A section added to `registry.ts` is routable
  with no second edit, and `routes.test.ts` fails if the resolver stops accepting one or if the
  number of routes stops equalling the number of sections. There is deliberately **no**
  `Record<SectionId, …>` of routes: `SectionId` is a type while the ids at runtime come from a plain
  array, so a mapped type could only be fed by a hand-kept list.
- **A demo must live in the section its URL names.** `#/buttons/toggle-switch` is `"unknown"`, not a
  silent redirect to `inputs`: the build checks one canonical href per demo, and accepting a second
  would weaken that check.
- **The index match means "not ours".** A bare fragment that is not a demo name — `#icons`, `#top`, a
  section's own DOM id — resolves to the index route, so a host leaves the DOM alone and the
  browser's native anchor handling keeps working. `#inputs` scrolling to the `inputs` section is the
  browser's `id`, not a route.

`routeTable()` is the route table a host can echo into its single document, and `routeTableDrift()`
is the build guard over it: `pages/build.ts` embeds the table, reads it back out of the emitted HTML
and fails when an entry is missing, duplicated, non-canonical, or one the resolver would not accept.

## The coverage rule

This is the part that makes the catalogue stay true, and it is the part the source guides lacked.
Both of the source guides documented **class names** rather than component APIs, which is how one
of them ended up documenting `.btn-sm` and `.h6` — classes with zero usages that only its own
ui-guide kept alive.

### One rule: a PascalCase export is a component, and a component has a card

`coverage.ts` reads every covered package's value exports — from its barrel, and from every subpath
module its `deno.json` publishes, so a component reachable only through its own subpath is seen too
— and splits them by name. A name with an initial capital and a lower-case letter after it is a
component (`Badge`, `EmptyState`, `D3LineChart`); everything else is a helper (`clampProgress`,
`DEFAULT_AXIS_COLOR`, `CONFLICT`) and needs no entry anywhere. Every component must have a card in
some section, or a line in the allow-list below.

Four kinds of drift fail `deno task test`, each naming the component and the package it belongs to:

| Drift                                              | Message                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| exported with no card and no allow-list entry      | `crud exports CrudList and no section demonstrates it — write a demo, or …` |
| a card keyed to a name the package does not export | `the ui sections demo Badge, which ui does not export`                      |
| an allow-list entry the package does not export    | `ui does not export FakeHelper, which EXPORTS_WITHOUT_DEMO names`           |
| an allow-list entry whose component has a card     | `ui's Badge has a demo, so its EXPORTS_WITHOUT_DEMO entry is stale`         |

This used to be about 580 lines of conditional types, so the failure arrived at `deno check` rather
than at `deno test`. Both run in the same `deno task check`, so the earlier arrival bought nothing,
and it cost a hand-written helper name per helper, in seven lists — the hand-kept list it was meant
to remove. The rule above needs none of them: a helper is recognised by how it is named, which is how
every package already names one.

Prop vocabulary is guarded one level down: demos iterate a `Record<Union, …>` keyed by a prop's own
union type (`ButtonVariant`, `BadgeColor`, `SpinnerSize`, `BadgeType`, `ToastVariant`), so adding a
variant to a component fails `deno check` until the catalogue shows it.

### The allow-list is one list, and every entry carries its reason

`EXPORTS_WITHOUT_DEMO` in `coverage.ts` is the only list. It is keyed by package, and each entry is a
name and a sentence. Two things belong in it, and they read the same way to the check — this export
is component-shaped and no card is expected:

- **Not a component.** The one entry today is an `enum`, which is an object rather than something
  to render: `ValidationType` in `crud`.
- **A card somebody still owes.** A component whose demo is honestly not written yet goes here with
  a reason saying so, instead of being quietly absent.

Neither can be parked and forgotten: an entry the package no longer exports fails, and so does one
whose component has a card after all.

### A component without a card is visible, not absent

`missingDemos(registry)` is what the catalogue renders. It is exported and takes the registry as an
argument precisely so it can be driven with an incomplete one: `catalogue.test.tsx` passes registries
with one and two entries removed and asserts the red banner names them and the singular/plural count
is right, while `registry.test.ts` asserts the report is empty for the real registry.

A total registry means the banner never shows in a healthy tree — `coverage.test.ts` fires first, at
the package rather than at the page. The banner is the backstop for a guide a host trimmed by hand,
and it is tested rather than assumed.

### A package added later has to make a decision

`coverage.test.ts` walks the top-level directories for a `deno.json` and fails when one is neither a
`packageIds` entry nor an `EXCLUDED_PACKAGES` entry with a reason. Covering a package and excluding
it are both one line, and both are visible in review — the difference between a package that is
deliberately out of the guide and one nobody noticed. That is how `icons/` (the gallery reads the
barrel itself), `theme/` (CSS), `pages/` (the demo's host app, not a package) and `ui-guide/` itself
are written down.

### The theme's class names are checked against the theme, in both directions

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

The exclusions are the honest half: `theme-base` and `dark` are the host page's, the `.map-*` classes
are Leaflet marker states in a package the guide does not cover, and the `.btn*` classes stay
documented-but-not-demonstrated because `ui/Button` is the API for a button and `crud/` is the
class-form consumer (see "Class-name demos" below). Each entry carries its reason, and each is
checked for staleness — an excluded class the preset no longer defines, or that the catalogue
demonstrates after all, fails.

## The groups

Twelve sections in one scroll is a wall, not a structure. The catalogue reads them in five groups,
each of which is a reason a reader is looking rather than a package boundary:

| Group                           | Sections                                   | Why these are read together                                                                                                                                  |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Foundations**                 | `badges`, `buttons`                        | The two cards whose whole content is a mark: the palette, and the button surface. One control's visible difference from another is a fill and a size.        |
| **Surfaces and page furniture** | `display`, `feedback`, `surfaces`, `forms` | What a page shows and the feedback it shows instead, plus the two sections documenting `preset.css`'s own class families — the same material one level down. |
| **Inputs**                      | `inputs`, `fields`                         | One story in two halves: `ui/`'s controlled primitives, and the same controls written as the preset class on a native element.                               |
| **Data and resources**          | `charts`, `crud`                           | The two packages that only matter once there is a resource behind the page.                                                                                  |
| **App shell**                   | `system`                                   | The chrome an adopter wires first: navigation, heads, the service-worker prompt, the calendar.                                                               |

The app shell is a group of one. `signals/` was read beside it — the layer a shell is assembled
through — until that package stopped exporting components and left the catalogue; the group stays
because "the chrome I wire first" is a reader's own reason for looking, not a leftover of the
package it once shared a heading with. `forms` sits with `surfaces` and not with `fields`, which
puts the two class-family sections next to each other: they document the same thing (classes on
markup the library does not own) at the two levels a page meets them.

### The group is a property of the section

`registry.ts` attaches the group to the section — `SectionSpec.group: GroupId` — and derives
`catalogueGroups` from those specs. So there is one order, the groups', and one membership: a
section cannot be filed twice, and a section with no `group` does not type-check. `catalogueSections`
is the flattening of `catalogueGroups`, which is why the flat array `routes.ts`, `pages/` and
`verify.ts` read cannot disagree with the grouped view the page draws.

| Failure                                                         | Caught by                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| a section with no group                                         | `deno check` — `TS2741` "Property `group` is missing … required in type `SectionSpec`", at that section     |
| a group that is not one of the five, or a misspelling of one    | `deno check` — `TS2322` `"tools"` is not assignable to `GroupId`                                            |
| a section id that names no section, or no spec for one          | `deno check` — `TS1360` (id in `SectionId`, no spec) or `TS2353` (spec keyed to an id not in the union)     |
| a group with no heading / a heading for no group                | `deno check` — `TS2741` "Property `tools` is missing" in the heading record, or `TS2353` for a leftover one |
| a literal duplicate section key                                 | `deno check` — `TS1117` "An object literal cannot have multiple properties with the same name"              |
| a section cloned under a second id                              | `registry.test.ts` — "a name appears in two sections", and `routes.test.ts` — "two demo names share a slug" |
| the derived record losing a section, or doubling one            | `catalogue.test.tsx` — the rendered ids against a hand-written sequence                                     |
| the group vocabulary renamed, reordered or dropped              | `catalogue.test.tsx` — the rendered group ids and headings, written out in render order                     |
| the page rendering a section outside its group, or out of order | `catalogue.test.tsx` — "renders the sections in the groups' order", against a hand-written id sequence      |

Both memberships and the guards behind them are worth stating precisely, because an earlier revision
of this documentation claimed two things that are false:

- **"Exactly one group" is structural, not a checked list** — a section has one `group` field, so "in
  two groups" is inexpressible, and the compiler is what says so. What no shape can see is a section
  whose `group` is a _valid_ group it does not belong in: that is a reading matter, and the render
  test only catches it because the correct order is written down by hand.
- **A partition guard over member lists _is_ expressible; the obvious formulations are not.**
  `readonly SectionId[]` per group is satisfied by `[]`, and TypeScript erases duplicate tuple
  members — `["badges", "badges"] as const` is the union `"badges"` with a reported length of 1 — so
  union arithmetic and `Distinct`-style recursion cannot see a repeat. Asserting each group's literal
  _width_ can: `{ [G in GroupId]: Members[G]["length"] }` against written-out numbers goes red when a
  member is dropped, moved into another group, or invented. (Probed with the real diagnostics; the
  probe and its outputs are in the PR for #99.) The groups-first record is therefore a working
  alternative, and this shape was chosen over it because it states one fact once: the section says
  which group it is in, and the record is compiled from that, where the width assertions are a second
  place the same fact has to be written.

The heading copy lives in `registry.ts` beside the ids (`groupHeadings`), because a heading is prose:
a group whose sections are all still there can still be headed wrongly, and only a reader can say.

### Heading levels are the outline

`h1` the page title → `h2` a group → `h3` a section and its cards → `h4` a class card. One level per
nesting the document has, which is why the sections moved from `h2` to `h3` when the groups arrived:
a section is no longer a top-level division of the page. No test pins a section's level, so treat this
as a stated decision rather than a guarded one: `catalogue.test.tsx` checks the group headings and the
rendered order, and nothing asserts a section's heading level.

This is the one change a **host** can notice, because a stylesheet may key on the level. Hosts that
selected section blurbs as `section[id] > div > h2 + p` should widen the selector to
`:is(h1, h2, h3, h4, h5, h6)`; the published package's markup is not shaped by the demo's CSS. The
reverse is deliberately preserved: the group wrapper sits _around_ each `<section id>`, so a
section's own `div.grid` stays a direct child of it and structural selectors such as
`main section[id] > div.grid` keep matching.

## Coverage

One row per section, in render order, naming the demos it registers. Between them the sections cover
every component the catalogue demonstrates and every class of `preset.css` that something demonstrates.

The counts are deliberately not repeated here: the guide prints them under its own title, and
`pages/build.ts` asserts a prerendered card per entry of `catalogueNames` against the emitted HTML, so
the number that matters is checked where it is produced rather than transcribed into prose.

| Section                    | Package  | Cards                                                                                    |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| **Badges**                 | `ui`     | `Badge`                                                                                  |
| **Buttons**                | `ui`     | `Button`, `CopyButton`, `GeoButton`                                                      |
| **Display**                | `ui`     | `PageTitle`, `ConfidenceMeter`, `Table`                                                  |
| **Feedback**               | `ui`     | `ErrorState`, `LoadingSpinner`, `LoadingSkeleton`, `LoadingScreen`, `Toastr`             |
| **Inputs**                 | `ui`     | `ToggleSwitch`, `OnOffButtons`, `Dropdown`                                               |
| **Fields**                 | `ui`     | `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `RadioGroup`, `InputButton` |
| **Forms**                  | `theme`  | `.input`, `.select`, `.textarea`, `.label`, `.checkbox`, `.radio`, `.btn-input-icon`     |
| **Surfaces and utilities** | `theme`  | `.card`, `.scrollbar`, the type scale, the KPI tile, the colour atoms                    |
| **Charts**                 | `charts` | a card per component the package exports                                                 |
| **System**                 | `system` | a card per component the package exports                                                 |
| **CRUD**                   | `crud`   | a card per component the package exports                                                 |

Nothing here states how many components are _missing_ a card, on purpose: that number moves with every
component PR. Read `EXPORTS_WITHOUT_DEMO` in `coverage.ts`, which is where a card somebody still owes
is declared. A count in this file was wrong twice while this section was being written, which is the
argument against a third one.

The `ui` sections are written up; the `charts`, `system` and `crud` cards are placeholders with a
one-line summary and a live render, and their section blurbs say so — the real demos land in
follow-up PRs. `signals/` has no section at all: it is excluded in `coverage.ts` because everything
it exports is a factory or a pure function (`buildModelStore`, `createToastStore`, `useUrlFilters`,
`sortRows`), which a written-up example in its own README serves better than a card would.

`Fields` is the `ui/` half of the form story — the controlled primitives, each with the demo an app
writes — and `forms`/`surfaces` are the other half: the preset styles markup the library does not own,
so a page built out of these packages writes its own cards, controls and containers. `forms` is native
controls with a preset class and nothing wrapped around them; `surfaces` is the card, the scroll
container, the type scale, the KPI tile and the colour atoms.

The class cards declare `package: "theme"`, which is what keeps them out of the coverage rule,
and their ids are namespaced (`class-input`, `class-card`) because a card id becomes a URL fragment:
`input` and `Input` write the same slug, and `card` collides with `Card`, which merged while this
section was being written. Their other contract — a heading, and a class list that matches their own markup — is enforced
by `classes.test.tsx`.

The catalogue is checked against the packages' own exports, not against this table, so the table is
prose and nothing reads it: `coverage.test.ts` fails when a covered package has a component with no
card, whichever section it should have been in.

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
and `copy` it was handed. `pages/checks/ui-guide.ts` is what proves the click: it clicks every usage
block in a real browser and compares each clipboard write to the text of the block it came from.

## Not carried over

- **One source's `currency.tsx` (221 LOC) — dropped.** It demonstrates `CurrencyDisplay`,
  `CurrencySelector` and `ExchangeRateBadge`, which are domain-coupled to that product and
  deliberately not part of `ui/`.
- **The same source's `form.tsx` (`UIGuideEditor`) — dropped.** It was an empty `<form class="card">`
  scaffold with three buttons and "Inputs go here…"; `Button` and `Table` cover the same ground with
  real assertions.
- **`.btn-sm` and `.h6` demos — dropped.** The theme dropped both classes; the guide now has a test
  that stops them coming back (see above).
- **Class-name demos in general — reversed, in part.** The other source's failure was documenting
  classes nothing used, not demonstrating classes at all; the two source guides had no way to tell
  the two apart. `forms` and `surfaces` demonstrate the classes no component covers, and
  `classes.test.tsx` is what the source guides lacked. The button family stays excluded: `Button`
  is demonstrated through `variant`/`size`, not through `btn btn-primary`, because one control with
  two documented APIs is a worse guide than one with a documented API and one documented class
  family.
- **Routing, navigation and toasts wiring.** That same source's guide called `navigate()` and a
  clipboard method straight off its own global store. Those are ports here, and the route is a
  descriptor the app registers.

## Tests

```bash
deno task check             # from the repository root, what CI runs
deno test --allow-read --allow-env ui-guide/   # this package alone
```

The suites: `coverage.test.ts` (the coverage rule, driven against the real packages and against
inputs a healthy tree cannot produce, plus the package-directory decision), `registry.test.ts` (the
catalogue's own data — one demo per card, every card in one section, the class cards namespaced apart
from the components, and the missing-card report), `routes.test.ts` (the resolver, the href builders,
a route for every section driven from `catalogueSections`, and the drift check that `pages/build.ts`
runs over the emitted route echo), `catalogue.test.tsx` (every demo renders, the banner, the route
descriptor, a usage block and copy control per card), `icons.test.tsx` (gallery exhaustiveness,
filter), `instructions.test.ts` (a documented class is defined), `classes.test.tsx` (a defined class
is demonstrated, or excluded with a reason) and `copy.test.tsx` (every card's copy control is wired to
its own snippet and to the injected port). Tests render real markup with `preact-render-to-string`
and assert on it; no DOM, no browser.

`preact-render-to-string` is pinned once, in the root import map, not in this package's own
`deno.json` — #219 replaced the six identical per-package copies this and `ui/` used to carry with
that one shared pin. `@std/jsonc` is still pinned in this package's own `deno.json`, because `coverage.ts` reads
each package's `exports` out of a `deno.json` and Deno writes those configs with comments; it is not
reachable from any published entry point.
