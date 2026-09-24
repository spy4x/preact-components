# `@preact-components/map`

`Map` — markers on a Leaflet tile layer, plotted from plain data, plus the plain-text list of the
same places that is the component's real keyboard and screen-reader interface.

Extracted per [issue #143](https://github.com/spy4x/preact-components/issues/143), which reverses
the `docs/not-building.md` entry recorded when `Map` was first evaluated: the blocker then was that
the one existing version loaded Leaflet from a `<script>` tag and depended on one framework's "am I
in the browser?" flag. Neither is true here — Leaflet is a real, exactly-pinned npm dependency of
this package alone, and the component finds out it is in a browser the same way every other
DOM-touching component in this library does: by rendering nothing browser-specific until an effect
runs.

## Install

```tsx
import { Map } from "@preact-components/map"
```

Leaflet's stylesheet also has to reach the page — see "Leaflet's stylesheet" below, which is a
separate step from importing the component.

## Props

| Prop            | Type                           | Default    | Notes                                                                                                                      |
| --------------- | ------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `center`        | `{ lat: number; lng: number }` | required   | View centre.                                                                                                               |
| `zoom`          | `number`                       | required   | Leaflet zoom level.                                                                                                        |
| `markers`       | `MapMarker[]`                  | required   | `{ id, lat, lng, label, status? }` — see below.                                                                            |
| `onMarkerClick` | `(id: string) => void`         | required   | Called from a pin's pointer click and from the matching list row's activation.                                             |
| `tileUrl`       | `string`                       | required   | Tile URL template, e.g. `"https://tile.example.com/{z}/{x}/{y}.png"`. No default — the application picks its own provider. |
| `attribution`   | `string`                       | required   | The tile provider's required credit line, rendered as **plain text** — see "Security".                                     |
| `class`         | `string`                       | —          | Extra classes on the map's own box; this is what sizes it (default `h-80 w-full`).                                         |
| `label`         | `string`                       | `"Map"`    | Accessible name of the map region.                                                                                         |
| `listLabel`     | `string`                       | `"Places"` | Heading over the plain-text list.                                                                                          |

`MapMarker.status` is `"on" | "off" | "unknown"`, optional; a marker with no `status` is treated as
`"unknown"` — the same colour `theme/preset.css` already gives that state.

## Server rendering, and what happens after hydration

Leaflet touches `window` the instant it is imported, so `map.tsx` never imports it at module scope.
It is loaded with a dynamic `import()` inside the component's mount effect, which — like every
`useEffect` — never runs while `preact-render-to-string` renders the component to a string. The
server, and the page's very first paint before that `import()` resolves, both see an empty box at
whatever size `class` gives it. Nothing about the box's size changes once Leaflet mounts inside it,
because the size comes from that one class and nothing else touches it.

Once Leaflet has loaded, the mount effect creates the map, its tile layer and an empty marker layer
group, and two more effects keep it live: one calls `setView` when `center` or `zoom` change, the
other rebuilds the marker layer when `markers` changes. The map is torn down on unmount — the mount
effect's cleanup calls the handle's `remove()`, Leaflet's own teardown of every DOM node and listener
it attached.

## Why the list, not the pins, is the keyboard path

The issue asks for two things: every marker reachable by Tab with a name, and a plain list beside the
map "because a map alone is a poor experience for someone who cannot see it." This package delivers
both through **one** mechanism rather than two, and the decision is worth stating plainly because the
issue's wording could be read as asking for the map's own pins to be independently tabbable too.

**The plain list `Map` always renders is the keyboard and screen-reader interface.** Every row is a
real `<button>`, in the page's Tab order from the first render, named by the marker's `label` as
text, and its activation — mouse, Enter, Space, or an assistive technology's own gesture — calls
`onMarkerClick`. The map's own pins are pointer-only: each is `aria-hidden`, and each answers a
pointer click by calling the same `onMarkerClick`, but none of them carries `tabindex` or a role, so
none of them is a second, separate stop in the page's Tab order.

Two reasons this is the better shape, not a shortcut:

1. **Leaflet's own keyboard support for a marker is Enter-only and undocumented past that.** Its
   `keyboard` option (default `true`) puts `tabindex="0"` and `role="button"` on the marker's icon
   element, with no accessible name of its own (a `DivIcon` sets no `aria-label`, and `alt` only
   applies to an `<img>`-backed `Icon`) and no Space support — inconsistent with every other keyboard
   control in this library, which activates on a real Space press (see `AGENTS.md`'s measured browser
   facts). Reimplementing it well means writing real keyboard handling on an element Leaflet also
   wants to position, animate and hit-test — solvable, but it duplicates almost everything the list
   already does correctly, for a second, worse copy of the same interaction.
2. **A screen-reader user tabbing through twice the stops for the same set of places is not double
   the access — it is noise.** A map pin conveys nothing non-visually beyond "a button, unnamed
   unless this package adds a name," while the list row is a normal, ordered, named control. Giving
   both a tab stop for the same place is the kind of "technically operable" the library's own
   accessibility policy (`AGENTS.md` → "Component rules", `docs/no-third-party-components.md` →
   "Accessibility is ours") asks not to stop at.

So `keyboard: false` is passed to every Leaflet marker this package creates, deliberately opting out
of Leaflet's own handling rather than leaving a half-consistent version of it in place, and the pin's
wrapper element carries `aria-hidden="true"`. `pages/checks/map.ts` proves the list side of this: every
row is reachable by Tab in marker order, each has an accessible name, and activating one by keyboard
calls `onMarkerClick` with that marker's `id`.

## Leaflet's stylesheet

Leaflet's tiles and pins are positioned by CSS it ships (`leaflet/dist/leaflet.css`); without it,
tiles render at the wrong size and in the wrong place. This package does not inject that stylesheet
for you — a component that silently mutated `<head>` would be surprising, and this library's other
CSS-bearing package (`theme/`) does not do that either. Two routes, depending on what your build can
do:

1. **Add `leaflet` as your own dependency, at the version this package pins (`leaflet@1.9.4`), and
   import its CSS in your own build** — `import "leaflet/dist/leaflet.css"` (Vite, Node, or a Deno app
   with its own `leaflet` import-map entry). This is the same shape
   [`charts/README.md`](../charts/README.md) documents for `d3`: this package's own `deno.json` pins
   Leaflet so `@preact-components/map` resolves and bundles on its own, and a second, explicit
   dependency in your app is what lets your own build reach one more file of a package you already
   effectively depend on.
2. **`@preact-components/map/leaflet-css`'s `leafletStylesheet()`** — an async function that reads
   `leaflet/dist/leaflet.css` from the exact copy this package's own `deno.json` pins, with
   `Deno.readTextFile`. Deno-only, and not re-exported from the package's main barrel — importing
   `@preact-components/map` itself never touches `Deno.readTextFile`, only a build that reaches for
   this specific subpath does. This is what `pages/build.ts` uses, so the demo gets Leaflet's real,
   unmodified stylesheet without this repository's own build declaring its own `leaflet` dependency
   (`map/deno.json` pins Leaflet "and nowhere else" in this workspace — see its own comment).

Either route ships Leaflet's CSS byte-for-byte; neither copies it into this package or `theme/`,
which would be a second place a future Leaflet upgrade could drift from.

## Security

Leaflet accepts HTML strings in several places — a `DivIcon`'s `html`, popups, tooltips, the built-in
attribution control — and this component never lets caller data reach any of them as markup.

- **`MapMarker.label`** is rendered as text everywhere it appears: as the matching list row's own
  text content (a JSX child, escaped the way Preact escapes any text node) and, natively, as a marker
  pin's `title` attribute (an element property assignment, never parsed as HTML). It is never passed
  to Leaflet's `DivIcon` `html` option or built into an HTML string. A marker's icon DOM is built with
  `document.createElement`/`appendChild` in `leaflet-map.ts`, and the resulting `Element` — never a
  string — is what `DivIcon` receives; Leaflet appends an `Element` it is given rather than parsing it
  with `innerHTML` (only a string `html` option is parsed that way), so there is no HTML-string step
  for a label to reach even indirectly. `map/map.test.tsx` and `map/marker-list.test.tsx` both render
  a marker whose `label` is `<img src=x onerror="alert(1)">` and assert the output contains no `<img`
  tag and no `onerror=` attribute — only the escaped text.
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
render. Leaflet's own keyboard panning (`Map`'s `keyboard` option, default `true`, left untouched)
makes that same element focusable and gives arrow-key/`+`/`-` navigation over the tiles — a different
feature from marker selection, and one Leaflet already implements reasonably, so this package neither
disables nor reimplements it.

## Do I need Leaflet?

Only if you import `@preact-components/map`. `leaflet`/`leaflet/` and `@types/leaflet` are pinned in
`map/deno.json` alone, the same isolation `charts/deno.json` gives `d3` — see
[`charts/README.md`](../charts/README.md) → "Do I need d3?" for the identical reasoning applied here.
Neither `ui/` nor `charts/` imports `map/`, and the root import map carries no Leaflet entry, so
neither of them can pick it up by accident. Checked with `deno info` against each package's own entry
point (`ui/+index.ts`, `charts/+index.ts`) rather than by reading their source for a `leaflet` import
— see the pull request that added this package for the exact commands and their output.

## Tests

```bash
deno task test              # from the repository root, what CI runs
deno test --allow-read --allow-env map/   # this package alone
```

`map.test.tsx` and `marker-list.test.tsx` render with `preact-render-to-string` and assert on real
markup — the server-rendered box, the attribution and marker-label escaping, the list's buttons and
their names, the English defaults and their overrides. `leaflet-map.test.ts` covers the one part of
the Leaflet-facing module that is plain data (the status → class lookup, checked against
`theme/preset.css`) rather than DOM construction — everything else in `leaflet-map.ts` needs
`document`, which this repository's test runner does not provide (see `AGENTS.md`). `leaflet-css.test.ts`
reads the real, pinned `leaflet.css` and asserts a distinctive rule from it, so a broken resolution
path fails here rather than silently shipping an empty stylesheet.

What none of that proves — a real map mounting, tiles loading from the local preview server, the
attribution staying visible, and the list's keyboard path actually calling `onMarkerClick` — is
`pages/checks/map.ts`'s job, driven in a real browser by `deno task --cwd pages verify`.
