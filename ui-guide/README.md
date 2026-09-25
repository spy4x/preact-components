# `@preact-components/ui-guide`

The live component catalogue, shipped as a component so every app that imports the library gets it
free. It shows one page at a time: an overview, then one page per package, picked from a side
navigation that becomes a modal dialog behind a menu button on a phone. The pages hold one demo per
component of every package it covers (`ui`, `charts`, `system`, `crud` and `map`), an example card
per helper (`signals`, `theme` and `cn` have only helpers), one card per group of
`theme/preset.css` classes, the icon gallery, and the design-system rules components are meant to
be assembled in. An app mounts it in one line, `<uiGuideRoute.component />` (see "Usage").

Covering `map/` (#143) is what makes `@preact-components/ui-guide` resolve Leaflet: `map/`'s exact
`leaflet`/`@types/leaflet` pins reach an app's dependency graph the moment it imports this package's
`registry.ts`, which imports every section unconditionally, `sections/map.tsx` included — the same
way covering `charts/` already put an optional `d3` in reach of anything that imports this package.
This is a build-time fact about the module graph, not a run-time one: `UIGuide`'s own `registry` prop
(below) can be handed a partial registry that never _renders_ a `Map` card, but the app that built
that partial registry already resolved and bundled `@preact-components/map` — and therefore
Leaflet — to get the value it left out. There is no documented way around that.

Ported from one source application's own modular route-per-section guide (the better structure of
the two source guides) and another's single-file guide component, whose icon gallery is kept
verbatim in spirit.

## Usage

An app renders the component at whatever path its router wants, and hands it the address:

```tsx
import { UIGuide, useLocationHash } from "@preact-components/ui-guide"

<UIGuide hash={useLocationHash()} onRouteChange={({ page }) => document.title = page.title} />
```

`hash` is `location.hash` for a hash-routed host, re-read on every `hashchange` — which is what
`useLocationHash()` returns; the guide itself reads nothing from `location`. While `hash` is
`undefined` — on the server and in the first client render, before the host has read the address —
the guide renders its `all` page: every page at once, which is the markup a reader without
JavaScript gets and the tree hydration has to match, and its links change the address and nothing
else. Once it is a string, the guide renders that route's page and, in an effect, marks and scrolls
to the card or section the route names.

Or registers the route descriptor, which is the fix for one source guide being an orphan reachable
only by typing its URL:

```tsx
import { uiGuideRoute } from "@preact-components/ui-guide"

const nav = [...appLinks, { href: uiGuideRoute.path, label: uiGuideRoute.label }]

// at the route — it reads the address's hash itself:
<uiGuideRoute.component />
```

Set `history.scrollRestoration = "manual"` in the host, as `pages/src/app.tsx` does. The guide
scrolls to what the address names on its first read, but the browser's own restore after a reload
can still win now and then, because the server sends the longer all-pages document first. The
guide does not set it itself: it is the host's setting.

| Prop            | Meaning                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `hash`          | The address's fragment. `undefined` renders every page; a string renders the page its route names.                                 |
| `navigate`      | Called with a link's `#/…` href instead of following it, for a host that routes by something other than the fragment.              |
| `onRouteChange` | Called after a route is shown, with the route and the page showing, so the host can title the document.                            |
| `pageExtras`    | Host content appended to one page, after its cards — a demo that needs a page of its own.                                          |
| `labels`        | Overrides for the shell's own strings, each with an English default: titles, button and skip-link names, the overview's counts.    |
| `registry`      | Registry to render; defaults to the complete one. A partial one raises the banner.                                                 |
| `copy`          | Clipboard port, forwarded to every copy control — each card's usage block and the icon gallery. Defaults to `navigator.clipboard`. |
| `class`         | Extra utilities on the guide's root.                                                                                               |

Nothing here imports an app's state: what a catalogue needs from its host — the address, where to put
a copied snippet — arrives as props and ports.

## Pages

`registry.ts`'s `guidePages` is what the guide renders at one time: the overview, one page per
package (`ui`, `system`, `crud`, `charts`, `map`, `signals`, `theme`, `icons`, `cn`), and `all`. A
section belongs to its package's page — `theme` holds the two class sections and its examples — so
`ui/`'s sections are one page read top to bottom and a package with one section is a page of one.
A package page with no card in the registry says its examples are coming. `all` renders every other page in navigation order: it is
the served document and a route of its own, for searching the whole library with the browser's find.

The shell is a navigation and a page. At `lg` and up the navigation is a sticky column beside the
page; below that it is a native modal `<dialog>` behind a menu button, which Enter or Space opens,
Escape closes, and which puts focus back on the button when it closes. The navigation is a `<nav>`
named by `labels.nav`; it lists every page, marks the one showing `aria-current="page"`, and under it
lists that page's sections and cards, marking the one the route names `aria-current="true"`. A skip
link, the guide's first link, moves focus past the navigation to the page. A page's link opens the
page at its title, including the pages whose id is also their section's (`#/crud`).

A host that keeps sticky chrome above the guide sets `--ui-guide-top` to its height, and the
navigation column and the phone menu bar stick below it. The page column clips what overflows it
sideways, so a demo that runs past a phone's edge is cut there rather than scrolling the page.

A section still names a group in `registry.ts`, but the group only orders the sections: a package's
page replaced the group heading as the unit a reader navigates by, so no heading is drawn for it.

## Routes

`routes.ts` is the catalogue's URL grammar, exported as its own subpath
(`@preact-components/ui-guide/routes`) and from the barrel. It is pure — no DOM, no `window`, no
`location` — so the decision it makes is unit-testable, and the shell owns the effects.

| Hash                     | Match                                                                   | Page               |
| ------------------------ | ----------------------------------------------------------------------- | ------------------ |
| `""`, `#`, `#/`          | index, `reason: "empty"`                                                | overview           |
| `#/ui`, `#/icons`        | page — a page whose id is no section's                                  | that page          |
| `#/inputs`               | section `inputs` — its slug is `routeSlug(id)`, nothing hand-kept       | its package's      |
| `#/inputs/toggle-switch` | demo `ToggleSwitch`, canonical href from `demoHref(section, name)`      | its package's      |
| `#toggle-switch`         | the same demo: the bare fragment this page shipped before, kept working | its package's      |
| `#inputs`, `#icons`      | index, `reason: "unknown"` — a section's or a page's own DOM id         | the one holding it |
| `#/nonsense`, `#top`     | index, `reason: "unknown"` — the sentinel, never a throw                | the one showing    |

`pageOfRoute` answers the last column for a route, `pageOfFragment` for a bare fragment that names
an element the guide renders, and `pageHref` writes a page's href. A page whose id is also a
section's (`charts`, `crud`, `map`, `system`) shares that section's route.

Four decisions worth stating, because a later wave will build on them:

- **The routes derive from `catalogueSections` and `guidePages`.** `routeSlug` of the section id is
  the section slug and `routeSlug` of the component name is the demo slug — one slug rule, the same
  one `pages/src/deep-link.ts`'s `demoSlug` delegates to. A section added to `registry.ts` is
  routable with no second edit, and `routes.test.ts` fails if the resolver stops accepting one or if
  the number of routes stops equalling the number of sections. There is deliberately **no**
  `Record<SectionId, …>` of routes: `SectionId` is a type while the ids at runtime come from a plain
  array, so a mapped type could only be fed by a hand-kept list.
- **A demo must live in the section its URL names.** `#/buttons/toggle-switch` is `"unknown"`, not a
  silent redirect to `inputs`: the build checks one canonical href per demo, and accepting a second
  would weaken that check.
- **The index match means "not ours".** A bare fragment that is not a demo name — `#top`, a card's
  own in-page link, a section's own DOM id — resolves to the index route. When it is a section's or a
  page's id (`#inputs`, `#icons`), the shell opens the page that holds it and scrolls there, since on
  another page the element is not rendered; anything else keeps the page showing, so the element is
  still there for the browser's native anchor handling. Only a first route that names nothing opens
  the overview.
- **A page is not a card's address.** Pages are routes a reader navigates by; a card is still
  addressed by its section, so every link written before pages existed still opens its card.

`routeTable()` is the route table a host can echo into its single document, and `routeTableDrift()`
is the build guard over it: `pages/build.ts` embeds the table, reads it back out of the emitted HTML
and fails when a page, section or demo entry is missing, duplicated, non-canonical, or one the
resolver would not accept.

## The coverage rule

This is the part that makes the catalogue stay true, and it is the part the source guides lacked.
Both of the source guides documented **class names** rather than component APIs, which is how one
of them ended up documenting `.btn-sm` and `.h6` — classes with zero usages that only its own
ui-guide kept alive.

### One rule: every export has a card or an example

`coverage.ts` reads every covered package's value exports — from its barrel, and from every subpath
module its `deno.json` publishes, so an export reachable only through its own subpath is seen too.
A **component** is a function named in PascalCase (`Badge`, `EmptyState`, `D3LineChart`), and it
needs a card in a component section; an example does not count as its card. Anything else — a
function (`clampProgress`), a constant (`DEFAULT_AXIS_COLOR`), an enum (`ThemeValue`) — needs a
card or an example card that names it in its `covers`. An export with neither needs a line in the
allow-list below.

Each kind of drift fails `deno task test`, naming the export and its package:

| Drift                                                 | Message                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| a component with no card and no allow-list entry      | `crud exports the component CrudList and no section demonstrates it — …`        |
| anything else with no card, no example, no entry      | `ui exports clampProgress and no card or example covers it — …`                 |
| a card or an example naming a name the package lacks  | `the ui sections demo Badge, which ui does not export`                          |
| an allow-list entry the package does not export       | `ui does not export FakeHelper, which the allow-list names`                     |
| an allow-list entry whose export is covered after all | `ui's clampProgress has a card or an example, so its allow-list entry is stale` |

Prop vocabulary is guarded one level down: demos iterate a `Record<Union, …>` keyed by a prop's own
union type (`ButtonVariant`, `BadgeColor`, `SpinnerSize`, `BadgeType`, `ToastVariant`), so adding a
variant to a component fails `deno check` until the catalogue shows it.

### The allow-list carries a reason, and it only shrinks

Two lists feed it. `EXPORTS_WITHOUT_DEMO` in `coverage.ts` holds an export with a sentence saying
why it has no card or example; today that is `useUrlFilters` alone, whose card would read and
write the host application's own address. `examples-pending.ts` holds, per package and one
name per line, every export that had neither when example cards were added; each carries the reason
"example pending (#215)". An entry the package no longer exports fails, and so does one that
has a card or an example since — so adding an example fails the tests until its names leave the
list. Adding a new export to the pending list to skip its example is what review refuses.

### Adding an example

1. Open the package's example section, `sections/<package>-examples.tsx`. Every package with
   helpers has one, so adding an example never touches `registry.ts`. A new section is a file
   exporting `toExampleDemos({...})` plus a `catalogue` entry in `registry.ts` with
   `kind: "example"`.
2. Add an entry keyed by the card id, usually the main export's name, so the card is
   `#demo-<key>`: a `title`, a one-sentence `summary`, the `snippet` a reader copies, the names it
   `covers`, and `run`, which makes the same calls as the snippet and returns what the card prints.
   One example may cover several related exports.
3. Remove every covered name from `examples-pending.ts`.

Every name in `covers` has to appear as a whole word in both the `snippet` and `run`, and the
snippet cannot be empty; `example.test.tsx` fails otherwise. `run` is called when the card
renders, so the output on the page is the real export's, never a copy. Being inside a render, `run`
may call a hook. The card calls it inside `untracked`, so `run` may read and write signals freely:
a tracked read would subscribe the card, and the write after it would render the card again and
again until the page stopped loading. Keep it deterministic — no clock, no random, no network —
since the server render and the browser render have to match.

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
`coveredPackageIds` entry nor an `EXCLUDED_PACKAGES` entry with a reason. `coveredPackageIds` is
`packageIds` — the packages whose markup the guide renders, which the host's stylesheet scans — then
`examplePackageIds` (`signals`, `theme`, `cn`), which export nothing that renders. Covering a
package and excluding it are both one line, and both are visible in review. That is how `icons/`
(the gallery reads the barrel itself), `pages/` (the demo's host app, not a package) and
`ui-guide/` itself are written down.

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

The exclusions are the honest half: `theme-base` and `dark` are the host page's, `power-anomaly` is
recorded in `removedClasses` instead — one application's wording, dropped rather than demonstrated —
and the `.btn*` classes stay documented-but-not-demonstrated because `ui/Button` is the API for a
button and `crud/` is the class-form consumer (see "Class-name demos" below). The `.map-*` classes
used to be excluded here too, for the same reason `power-anomaly` was — Leaflet marker states in a
package the guide did not cover — until `map/` landed (#143) and gave them a real card; they are
demonstrated now, through the `Map` card's plain-text list of markers. Each remaining entry carries
its reason, and each is checked for staleness — an excluded class the preset no longer defines, or
that the catalogue demonstrates after all, fails.

## Heading levels are the outline

On one page: `h1` the page → `h2` a section → `h3` a card. On the `all` page the overview's `h1` is
the only one, a package's page is an `h2` and its sections `h3`, beside their cards. A package with
one section keeps its section heading for the outline and hides it visually, since it would repeat
the page's. No test pins a level, so treat this as a stated decision rather than a guarded one.

## Coverage

One row per section. No count and no card list is written here: both moved with every component PR,
and a list in this file was wrong more often than it was right. The guide's own navigation lists every
card, the overview prints the counts from the registry, and `pages/build.ts` asserts a prerendered card
per entry of `catalogueNames` against the emitted HTML.

| Section                            | Package   | Page      |
| ---------------------------------- | --------- | --------- |
| **Badges**                         | `ui`      | `ui`      |
| **Buttons**                        | `ui`      | `ui`      |
| **Display**                        | `ui`      | `ui`      |
| **Feedback**                       | `ui`      | `ui`      |
| **Inputs**                         | `ui`      | `ui`      |
| **Fields**                         | `ui`      | `ui`      |
| **Enhanced forms**                 | `ui`      | `ui`      |
| **Forms**                          | `theme`   | `theme`   |
| **Surfaces and utilities**         | `theme`   | `theme`   |
| **Charts**                         | `charts`  | `charts`  |
| **System**                         | `system`  | `system`  |
| **CRUD**                           | `crud`    | `crud`    |
| **Map**                            | `map`     | `map`     |
| **Helpers** (examples)             | `ui`      | `ui`      |
| **Signals** (examples)             | `signals` | `signals` |
| **Helpers** (examples)             | `charts`  | `charts`  |
| **Helpers** (examples)             | `system`  | `system`  |
| **Helpers** (examples)             | `crud`    | `crud`    |
| **Stylesheets as text** (examples) | `theme`   | `theme`   |
| **cn** (examples)                  | `cn`      | `cn`      |

Nothing here states how many components are _missing_ a card, on purpose: that number moves with every
component PR. Read `examples-pending.ts` and `EXPORTS_WITHOUT_DEMO` in `coverage.ts`, which is where a card or
an example somebody still owes is declared. A count in this file was wrong twice while this section was being written, which is the
argument against a third one.

`Fields` is the `ui/` half of the form story — the controlled primitives, each with the demo an app
writes — and `forms`/`surfaces` are the other half: the preset styles markup the library does not own,
so a page built out of these packages writes its own cards, controls and containers. `forms` is native
controls with a preset class and nothing wrapped around them; `surfaces` is the card, the scroll
container, the type scale, the KPI tile and the colour atoms.

The class cards declare `package: "theme"` and are a class section, which keeps them out of the coverage rule,
and their ids are namespaced (`class-input`, `class-card`) because a card id becomes a URL fragment:
`input` and `Input` write the same slug, and `card` collides with `Card`, which merged while this
section was being written. Their other contract — a heading, and a class list that matches their own markup — is enforced
by `classes.test.tsx`.

The catalogue is checked against the packages' own exports, not against this table, so the table is
prose and nothing reads it: `coverage.test.ts` fails when a covered package has an export with no card or
example, whichever section it should have been in.

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
records every `DemoCard` element the guide creates while it renders, finds each card's `CopyButton`
and checks the `textToCopy` and `copy` it was handed. `pages/checks/ui-guide.ts` is what proves the
click: it opens every page with cards in a real browser, clicks every usage block and compares each
clipboard write to the text of the block it came from.

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
runs over the emitted route echo, and the page each route opens), `catalogue.test.tsx` (every demo
renders, the banner, the route descriptor, a usage block and copy control per card, and the `all`
page's order), `shell.test.tsx` (the page a hash renders, the navigation's marks and names, a
host's page extra), `icons.test.tsx` (gallery exhaustiveness,
filter), `instructions.test.ts` (a documented class is defined), `classes.test.tsx` (a defined class
is demonstrated, or excluded with a reason) `copy.test.tsx` (every card's copy control is wired to
its own snippet and to the injected port) and `example.test.tsx` (an example runs when its card
renders, on its package's page, uses every export it covers, and how its output is printed). Tests render real markup with `preact-render-to-string`
and assert on it; no DOM, no browser.

`preact-render-to-string` is pinned once, in the root import map, not in this package's own
`deno.json` — #219 replaced the six identical per-package copies this and `ui/` used to carry with
that one shared pin. `@std/jsonc` is still pinned in this package's own `deno.json`, because `coverage.ts` reads
each package's `exports` out of a `deno.json` and Deno writes those configs with comments; it is not
reachable from any published entry point.
