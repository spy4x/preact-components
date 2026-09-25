# `@preact-components/map`

`Map` — markers on a Leaflet tile layer, plotted from plain data, plus the plain-text list of the
same places next to it. The map's own pins are the keyboard and screen-reader interface; the list is
a non-interactive overview — see "Keyboard and screen readers" below for why the two are split that
way.

Extracted per [issue #143](https://github.com/spy4x/preact-components/issues/143), which reverses
the `docs/not-building.md` entry recorded when `Map` was first evaluated: the blocker then was that
the one existing version loaded Leaflet from a `<script>` tag and depended on one framework's "am I
in the browser?" flag. Neither is true here — Leaflet is a real, exactly-pinned npm dependency of
this package alone, and the component finds out it is in a browser the same way every other
DOM-touching component in this library does: by rendering nothing browser-specific until an effect
runs.

## Components

| Component | Subpath | Ports / key props                                            |
| --------- | ------- | ------------------------------------------------------------ |
| `Map`     | (root)  | `center`, `zoom`, `markers`, and the labels in "Props" below |

## Install

```tsx
import { Map } from "@preact-components/map"
```

Leaflet's stylesheet also has to reach the page — see "Leaflet's stylesheet" below, which is a
separate step from importing the component.

## Props

| Prop            | Type                           | Default             | Notes                                                                                                                      |
| --------------- | ------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `center`        | `{ lat: number; lng: number }` | required            | View centre.                                                                                                               |
| `zoom`          | `number`                       | required            | Leaflet zoom level.                                                                                                        |
| `markers`       | `MapMarker[]`                  | required            | `{ id, lat, lng, label, status? }` — see below. See "What a new `markers` identity costs".                                 |
| `onMarkerClick` | `(id: string) => void`         | required            | Called from a pin's pointer click, or a real Enter or Space press while the pin has focus.                                 |
| `tileUrl`       | `string`                       | required            | Tile URL template, e.g. `"https://tile.example.com/{z}/{x}/{y}.png"`. No default — the application picks its own provider. |
| `attribution`   | `string`                       | required            | The tile provider's required credit line, rendered as **plain text** — see "Security".                                     |
| `class`         | `string`                       | —                   | Extra classes on the map's own box; this is what sizes it (default `h-80 w-full`).                                         |
| `label`         | `string`                       | `"Map"`             | Accessible name of the map region.                                                                                         |
| `listLabel`     | `string`                       | `"Places"`          | Heading over the plain-text list.                                                                                          |
| `zoomInLabel`   | `string`                       | `"Zoom in"`         | Leaflet's zoom-in control's tooltip and accessible name.                                                                   |
| `zoomOutLabel`  | `string`                       | `"Zoom out"`        | Leaflet's zoom-out control's tooltip and accessible name.                                                                  |
| `onLoadError`   | `(error: unknown) => void`     | logs to the console | Called if `import("leaflet")` fails. See "A failed Leaflet load" below.                                                    |

`MapMarker.status` is `"on" | "off" | "unknown"`, optional; a marker with no `status` is treated as
`"unknown"` — the same colour `theme/preset.css` already gives that state.

## Server rendering, and what happens after hydration

Leaflet touches `window` the instant it is imported, so `map.tsx` never imports it at module scope.
It is loaded with a dynamic `import()` inside the component's mount effect, which — like every
`useEffect` — never runs while `preact-render-to-string` renders the component to a string. The
server, and the page's very first paint before that `import()` resolves, both see an empty box at
whatever size `class` gives it. Nothing about the box's size changes once Leaflet mounts inside it,
because the size comes from that one class and nothing else touches it.

Once Leaflet has loaded, the mount effect creates the map, its tile layer, its zoom control and an
empty marker layer group, and two more effects keep it live: one calls `setView` when `center` or
`zoom` change, the other rebuilds the marker layer when `markers` changes. The map is torn down on
unmount — the mount effect's cleanup calls the handle's `remove()`, Leaflet's own teardown of every
DOM node and listener it attached.

### A failed Leaflet load

`import("leaflet")` can reject — a network blip, an ad blocker, a CDN outage on whatever serves the
app's own bundle — and `leaflet-map.ts`'s `mountLeafletMap` (the mount effect's whole body, factored
out so this is testable with no browser) never lets that rejection escape unhandled. It calls
`onLoadError` instead of throwing, and mounts nothing.

`onLoadError` is a port, not markup this component renders, because the right way to tell a visitor
matters to the host page, not to this component: a toast, a logged event, a silent retry, or nothing
a visitor ever sees — the same reasoning `charts/`'s `CompareChart` already applies to its own
`onError`. Left unset, it logs the error to the console, so a failure is never silent even for a
caller that supplies nothing. Either way, the box and the list both stay exactly as usable as they
already were: the box keeps its size — nothing about it depended on Leaflet having loaded — and the
list keeps listing every place, since it is plain data this component already had.

## Keyboard and screen readers

**The map's own pins are the keyboard and screen-reader path.** Every pin is a real Tab stop
(`role="button"`, `tabindex="0"`, both set by Leaflet's own `keyboard: true` option on the marker),
named by the marker's `label` through an explicit `aria-label` this package sets, and a real Enter or
Space press on a focused pin calls `onMarkerClick` — Space calls `preventDefault` first so the page
does not scroll. The plain list beside the map is **not** interactive: no row is a button, none has a
click handler, and none is in the Tab order. It exists because the issue asks for "a plain list of
the same places" as a second, always-visible overview — the same information the pins carry, laid
out as ordinary text rather than as controls.

Two things worth being precise about, because an earlier version of this package got both wrong:

1. **Leaflet does not activate a bare marker from the keyboard on its own.** `keyboard: true` gives a
   marker's icon element `tabindex="0"` and `role="button"`, which is what makes it reachable — but
   Leaflet's own key-press handling for a marker (`_onKeyPress` in `leaflet-src.js`) exists only
   inside `bindPopup`, and calling it opens a popup. A marker with no popup bound does nothing on
   Enter or Space without more work. That work is `leaflet-map.ts`'s `addMarker`: a `keydown`
   listener, added directly to the DOM element Leaflet created (`marker.getElement()`, read back
   after `addTo`), that calls `onMarkerClick` on Enter or Space.
2. **A marker's `title` is a real accessible-name source, just not the one this package uses.**
   Leaflet copies the `title` option onto the icon element, which does give assistive technology a
   name — but this package sets `aria-label` explicitly as well, which browsers' accessible-name
   computation prefers over `title` when both are present. `title` stays for what it is actually for:
   a native tooltip on mouse hover. The pin's name a screen reader announces comes from `aria-label`.

`pages/checks/map.ts` proves this in a real browser: Tab from the focused map reaches every pin, in
marker order, each with the accessible name equal to its `label` (read through the DevTools
`Accessibility` domain, not the DOM, because that domain is what actually computes the name the way a
screen reader would); a real Space press and a real Enter press each call `onMarkerClick` with the
focused pin's `id`.

## What a new `markers` identity costs

The marker-sync effect depends on `markers` alone, not on `onMarkerClick`'s identity — the callback
is read through a ref (`onMarkerClickRef` in `map.tsx`) that is always kept current, so a caller
passing a fresh inline arrow function on every render (the catalogue's own demo card does exactly
that) never causes a rebuild by itself.

`markers` is a different matter: the effect clears and rebuilds the **whole** marker layer whenever
`markers` is a new array, whether or not the places it lists actually changed. Passing a literal
array in JSX (`markers={[...]}`) or otherwise creating a new array on every render therefore rebuilds
every pin on every render — every DOM node, every listener, every `aria-label` — even when nothing
about the data moved. Keep `markers` referentially stable (a `useMemo`, a value from state that is
only replaced when it really changes, or a module-level constant for fixture data, as the catalogue's
own card does) unless a rebuild on every render is genuinely acceptable.

## Leaflet's stylesheet

Leaflet's tiles and pins are positioned by CSS it ships (`leaflet/dist/leaflet.css`); without it,
tiles render at the wrong size and in the wrong place. This package does not inject that stylesheet
for you — a component that silently mutated `<head>` would be surprising, and this library's other
CSS-bearing package (`theme/`) does not do that either.

**The one route: add `leaflet` as your own dependency, at the version this package pins
(`leaflet@1.9.4`), and include its stylesheet in your own build.** Concretely, that is:

```bash
deno add npm:leaflet@1.9.4   # or: npm i leaflet@1.9.4
```

then, in whatever your build treats as CSS entry points:

```ts
import "leaflet/dist/leaflet.css"
```

For a bundler that resolves CSS imports itself (Vite, webpack, and anything Node-based), that single
import is the whole of it — the same shape [`charts/README.md`](../charts/README.md) documents for
`d3`. For a Deno build that compiles its own stylesheet the way this repository's `pages/build.ts`
does — reading a stylesheet's bytes directly with `Deno.readTextFile` rather than handing the import
to a bundler — you need `import.meta.resolve("leaflet/dist/leaflet.css")` to resolve at all, which
needs **your own** `deno.json` to declare Leaflet twice, the same way `map/deno.json` does for its
own reasons:

```jsonc
"imports": {
  "leaflet": "npm:leaflet@1.9.4",
  "leaflet/": "npm:/leaflet@1.9.4/"
}
```

and a lockfile that has actually resolved it — run any task that imports `leaflet` once, or
`deno install`, before the first build that reads the stylesheet this way — plus `--allow-read` on
whatever reads the file (Deno's own npm cache, unless you vendor `node_modules` with
`"nodeModulesDir": "auto"`). None of this is `@preact-components/map`'s to provide: it is exactly
what installing Leaflet yourself, for your own build, requires — this package neither re-exports
Leaflet's CSS nor gives you a shortcut around declaring the dependency you are, in substance, already
taking on the moment you render tiles.

`pages/build.ts` reads `map/leaflet-css.ts` directly, by a relative import — that file is not part of
this package's published surface (see `map/deno.json`'s `publish.exclude`) precisely because it only
works inside this workspace, where the pins above already exist in the root repository's own
resolution. It is not a route available to, or intended for, an external consumer.

## Security

Leaflet accepts HTML strings in several places — a `DivIcon`'s `html`, popups, tooltips, the built-in
attribution control — and this component never lets caller data reach any of them as markup.

- **`MapMarker.label`** is rendered as text everywhere it appears: as the matching list row's own
  text content (a JSX child, escaped the way Preact escapes any text node), as a pin's `aria-label`
  and `title` attributes (element property/attribute assignment, never parsed as HTML), and read back
  only as `event.key`/`.id` inside the pin's own `keydown` listener — nothing about that listener
  turns any string into markup either. `label` is never passed to Leaflet's `DivIcon` `html` option
  or built into an HTML string. A marker's icon DOM is built with `document.createElement`/
  `appendChild` in `leaflet-map.ts`, and the resulting `Element` — never a string — is what `DivIcon`
  receives; Leaflet appends an `Element` it is given rather than parsing it with `innerHTML` (only a
  string `html` option is parsed that way), so there is no HTML-string step for a label to reach even
  indirectly. `map/map.test.tsx` and `map/marker-list.test.tsx` both render a marker whose `label` is
  `<img src=x onerror="alert(1)">` and assert the output contains no `<img` tag — only the escaped
  text.
- **`attribution`** is **plain text, always** — not an HTML prop, and there is no second prop that
  accepts markup. Leaflet's own attribution control is switched off entirely
  (`attributionControl: false`); this component renders `attribution` itself, as a JSX text child of
  a `<p>` that is a sibling of Leaflet's container, never handed to Leaflet's control or any other
  HTML-string sink. If a tile provider's terms ask for a clickable link in the credit line, this prop
  cannot carry one — that is deliberate, not an oversight: naming a second, HTML-accepting prop
  (`attributionHtml`, say) would be the honest way to add that later, so a caller could never mistake
  one for the other. `map/map.test.tsx` covers the same injection case as `label` above.
- **`tileUrl`** is a URL template, handed to Leaflet's `L.tileLayer` unmodified. It is not treated as
  markup anywhere, but it is still caller-controlled: nothing in this component fetches it during a
  server render (the tile layer is created only inside the mount effect, in a browser), so an SSR
  request is never made to a `tileUrl` an application computed from a request the server saw.

## Accessible name of the map region

The element Leaflet mounts into carries `role="group"` and `aria-label={label}` (default `"Map"`),
set once in this component's own JSX rather than in an effect, so it is present from the first
render. Leaflet's own keyboard panning (`L.Map`'s `keyboard` option, default `true`, left untouched)
makes that same element focusable and gives arrow-key/`+`/`-` navigation over the tiles — a different
feature from marker selection, and one Leaflet already implements reasonably, so this package neither
disables nor reimplements it. From a freshly focused map, Tab therefore visits every marker pin, in
order, and only then the zoom control (labelled by `zoomInLabel`/`zoomOutLabel`) — measured, not
assumed. The reason is fixed at map construction, before this package's own code runs at all:
`L.Map`'s `initialize` calls `_initPanes()`, which appends the pane that eventually holds every
marker directly to the map's container, and only afterwards calls `_initControlPos()`, which appends
a _second_, later sibling — `.leaflet-control-container`, the zoom buttons' real parent — to that
same container. Markers added later land inside the pane, earlier in the container's children; the
control the map already carries lands after it. Neither the order this package calls `addTo` in, nor
`zoomControl: false` plus a hand-built control, changes that structural fact.

The default zoom control is switched off and rebuilt by hand in `createLeafletMap` purely to reach
its `zoomInTitle`/`zoomOutTitle` options — there is no way to pass those through `L.Map`'s own
constructor options or to change them on the control after it is built.

## The credit line's own pointer behaviour

A plain Leaflet map's own, built-in attribution control sits _inside_ the map's container, in the
region Leaflet's wheel-zoom handler watches. Leaflet applies `disableClickPropagation` to that
control, which stops a click from reaching the map underneath — but not a wheel event, so scrolling
the wheel over a plain map's own credit line still zooms the map underneath it. This component's
credit line is a sibling of Leaflet's container instead, never a descendant of it — the same
placement that keeps it from ever being collapsed, hidden or scrolled by anything Leaflet does to its
own panes, and that makes it a real hit-test target `document.elementFromPoint` can find. Sitting
outside the container, it is also outside the region Leaflet's own wheel handler watches at all, so a
wheel over it scrolls the _page_, the way a wheel over any other piece of chrome next to the map
already would — not the leaky zoom-through a plain Leaflet map has. A drag started on the credit line
selects its text rather than panning the map, for the same reason: it is ordinary page text, not part
of what Leaflet's own drag handling watches. Neither is treated as a defect needing map-specific
pointer handling of its own; both are what a normal piece of page chrome next to the map already
does.

## Do I need Leaflet?

Only if you import `@preact-components/map`. `leaflet`/`leaflet/` and `@types/leaflet` are pinned in
`map/deno.json` alone, the same isolation `charts/deno.json` gives `d3` — see
[`charts/README.md`](../charts/README.md) → "Do I need d3?" for the identical reasoning applied here.
Neither `ui/` nor `charts/` imports `map/`, and the root import map carries no Leaflet entry, so
neither of them can pick it up by accident. Checked with `deno info` against each package's own entry
point (`ui/+index.ts`, `charts/+index.ts`) rather than by reading their source for a `leaflet` import
— see the pull request that added this package for the exact commands and their output.

## The list heading's level is fixed

`MarkerList` renders its heading as an `<h3>`, unconditionally. This mirrors the level `ui-guide/`'s
own catalogue happens to nest a card's content at today, but it is not something this component can
verify about a caller's own page: a `Map` placed directly under an `<h1>` gets a heading that skips
`<h2>`. Left this way deliberately rather than adding a `headingLevel` prop no other component in
this library has needed yet — see `docs/no-third-party-components.md` for the general bias against
adding a knob before a real caller needs it. A future consumer whose page structure needs a different
level is a reason to add one; this package having only one caller today is not.

## Tests

```bash
deno task test              # from the repository root, what CI runs
deno test --allow-read --allow-env map/   # this package alone
```

`map.test.tsx` and `marker-list.test.tsx` render with `preact-render-to-string` and assert on real
markup — the server-rendered box, the attribution and marker-label escaping, the list's plain
(non-interactive) rows and their names, the English defaults and their overrides. `leaflet-map.test.ts`
covers the parts of the Leaflet-facing module that need no `document` — the status → class lookup,
checked against `theme/preset.css`, and `mountLeafletMap`'s failure path, driven with a fake `load`
that rejects, asserting `onLoadError` is called exactly once with the real error and nothing throws.
Everything else in `leaflet-map.ts` needs `document`, which this repository's test runner does not
provide (see `AGENTS.md`). `leaflet-css.test.ts` reads the real, pinned `leaflet.css` and asserts a
distinctive rule from it, so a broken resolution path fails here rather than silently shipping an
empty stylesheet.

What none of that proves — a real map mounting, tiles loading from the local preview server, the
attribution staying visible, the pin count matching the marker count, and the pins' own keyboard path
actually calling `onMarkerClick` with the right `id` — is `pages/checks/map.ts`'s job, driven in a
real browser by `deno task --cwd pages verify`.
