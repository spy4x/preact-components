# `@spy4x/preact-map`

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
import { Map } from "@spy4x/preact-map"
```

Leaflet's stylesheet also has to reach the page — see "Leaflet's stylesheet" below, which is a
separate step from importing the component.

## Props

| Prop               | Type                           | Default                             | Notes                                                                                                                      |
| ------------------ | ------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `center`           | `{ lat: number; lng: number }` | required                            | View centre.                                                                                                               |
| `zoom`             | `number`                       | required                            | Leaflet zoom level.                                                                                                        |
| `markers`          | `MapMarker[]`                  | required                            | `{ id, lat, lng, label, status? }` — see below. See "What a new `markers` identity costs".                                 |
| `onMarkerClick`    | `(id: string) => void`         | required                            | Called from a pin's pointer click, or a real Enter or Space press while the pin has focus.                                 |
| `tileUrl`          | `string`                       | required                            | Tile URL template, e.g. `"https://tile.example.com/{z}/{x}/{y}.png"`. No default — the application picks its own provider. |
| `attribution`      | `string`                       | required                            | The tile provider's required credit line, rendered as **plain text** — see "Security".                                     |
| `class`            | `string`                       | —                                   | Extra classes on the map's own box; this is what sizes it (default `h-80 w-full`).                                         |
| `label`            | `string`                       | `"Map"`                             | Accessible name of the map region.                                                                                         |
| `listLabel`        | `string`                       | `"Places"`                          | Heading over the plain-text list.                                                                                          |
| `listHeadingLevel` | `2 \| 3 \| 4 \| 5 \| 6`        | `3`                                 | That heading's level, so it fits the page's outline.                                                                       |
| `statusLabels`     | `{ on?, off?, unknown? }`      | `"on"`, `"off"`, `"status unknown"` | The status word each pin's name and each list row say after the label. See "Keyboard and screen readers".                  |
| `zoomInLabel`      | `string`                       | `"Zoom in"`                         | Leaflet's zoom-in control's tooltip and accessible name.                                                                   |
| `zoomOutLabel`     | `string`                       | `"Zoom out"`                        | Leaflet's zoom-out control's tooltip and accessible name.                                                                  |
| `onLoadError`      | `(error: unknown) => void`     | logs to the console                 | Called if `import("leaflet")` fails. See "A failed Leaflet load" below.                                                    |

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
`zoom` change, the other brings the pins in line with `markers` when it changes. The map is torn down on
unmount — the mount effect's cleanup calls the handle's `remove()`, Leaflet's own teardown of every
DOM node and listener it attached.

### A failed Leaflet load

`import("leaflet")` can reject — a network blip, an ad blocker, a CDN outage on whatever serves the
app's own bundle — and `leaflet-map.ts`'s `mountLeafletMap` (the mount effect's whole body, factored
out so this is testable with no browser) never lets that rejection escape unhandled. It calls
`onLoadError` instead of throwing, and mounts nothing.

`onLoadError` is a port, not markup this component renders, because the right way to tell a visitor
matters to the host page, not to this component: a toast, a logged event, a silent retry, or nothing
a visitor ever sees. Left unset, it logs the error to the console, so a failure is never silent even for a
caller that supplies nothing. Either way, the box and the list both stay exactly as usable as they
already were: the box keeps its size — nothing about it depended on Leaflet having loaded — and the
list keeps listing every place, since it is plain data this component already had.

## Keyboard and screen readers

**The map's own pins are the keyboard and screen-reader path.** Every pin is a real Tab stop
(`role="button"`, `tabindex="0"`, both set by Leaflet's own `keyboard: true` option on the marker),
named by the marker's `label` and its status word (`"London depot, on"`) through an explicit
`aria-label` this package sets, and a real Enter or
Space press on a focused pin calls `onMarkerClick` — Space calls `preventDefault` first so the page
does not scroll. The plain list beside the map is **not** interactive: no row is a button, none has a
click handler, and none is in the Tab order. It exists because the issue asks for "a plain list of
the same places" as a second, always-visible overview — the same information the pins carry, laid
out as ordinary text rather than as controls. Each row says its status in words too, as visually
hidden text after the label, so neither path leaves the status to colour alone. `statusLabels`
replaces the English words.

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

`pages/checks/map.ts` proves in a real browser that Tab from the focused map reaches every pin, in
marker order, that each pin's name comes from `aria-label` (read through the DevTools
`Accessibility` domain, which computes the name the way a screen reader would), and that a real
Space press and a real Enter press each call `onMarkerClick` with the focused pin's `id`.
`pages/e2e/map.spec.ts` proves that each pin's name and each list row say the label and the status
word, and that a focused pin keeps focus when `markers` changes.

## What a new `markers` identity costs

The marker-sync effect depends on `markers` and the status words, not on `onMarkerClick`'s identity — the callback
is read through a ref (`onMarkerClickRef` in `map.tsx`) that is always kept current, so a caller
passing a fresh inline arrow function on every render (the catalogue's own demo card does exactly
that) never causes a rebuild by itself.

`markers` is matched by `id`: a marker that stays keeps its pin and DOM element, updated in place
(position, tooltip, name, status colour), and only markers that came or went are added or removed.
A focused pin that stays therefore keeps focus while the data around it changes. A new array still
costs one pass over every marker, so keep `markers` referentially stable (a `useMemo`, a value from
state that is only replaced when it really changes, or a module-level constant for fixture data, as
the catalogue's own card does) rather than writing a literal array in JSX.

— see the pull request that added this package for the exact commands and their output.

## The list heading's level

`MarkerList` renders its heading as an `<h3>` by default; `listHeadingLevel` picks another level, so
a `Map` placed directly under an `<h1>` does not skip `<h2>`.

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

The guide's axe scan (`pages/e2e/ui-guide.spec.ts`) skips one rule on one element: the colour
contrast of the credit line. The credit line is opaque and sits over tiles that Leaflet blends with
`plus-lighter`, a blend mode axe 4.13 has no formula for. On that element axe throws, and then
reports no contrast for the whole page, so the page scan runs every rule except contrast on the
credit line. `pages/e2e/map.spec.ts` measures its contrast with axe instead, in the dark theme
only, with the tiles kept away, which is also what a reader sees when the tile server is down. In
the light theme nothing measures the credit line's contrast.
