# Install and use

The reference the [README](../README.md) links to: every package's install line, how the packages
depend on each other, the UI guide as a component, what the accessibility work does and does not
cover, and where the code runs.

## Install

Every package is published at the same version every time, so the caret range a package puts on
its siblings (`^0.1.N`) always resolves to the set published with it — see
[`docs/publishing.md`](./publishing.md). Each package below installs on its own:

```bash
deno add jsr:@spy4x/preact-cn        # class-name join + Tailwind conflict resolution
deno add jsr:@spy4x/preact-icons     # merged icon set
deno add jsr:@spy4x/preact-signals   # stores and state helpers; no components
deno add jsr:@spy4x/preact-theme     # design tokens + Tailwind preset
deno add jsr:@spy4x/preact-charts    # server-rendered charts with tooltips
deno add jsr:@spy4x/preact-system    # app-level pieces: auth form, calendar, shells, SEO head
deno add jsr:@spy4x/preact-ui        # the component set
deno add jsr:@spy4x/preact-crud      # list and editor scaffold for one collection
deno add jsr:@spy4x/preact-map       # map on Leaflet (resolves leaflet)
deno add jsr:@spy4x/preact-ui-guide  # the live component catalogue, mounted in one line
```

Which package imports which sibling, read from the sources: `ui` imports `cn`, `icons` and
`signals`; `system` imports `cn`, `icons` and `ui`; `crud` imports `cn`, `icons`, `signals` and
`ui`; `map` imports `cn`; `ui-guide` imports every other package, for its catalogue.
`cn`, `icons`, `signals`, `theme` and `charts` import no sibling. JSR resolves a package's own
dependencies, so installing `ui` also resolves `cn`, `icons` and `signals` — none needs adding by
hand. `charts`, `crud`, `signals`, `system` and `ui` also import helpers from `spy4x/ts-libs`
(`@spy4x/platform`, `@spy4x/time`, `@spy4x/validation`), which JSR resolves the same way.

For the compiled Tailwind stylesheet — the tokens and design-system classes every component here
renders against — see [`theme/README.md`](../theme/README.md): JSR cannot export a CSS file
directly, so getting it is a short build-script recipe, not a plain `@import`.

## Usage

```tsx
import { Badge } from "@spy4x/preact-ui/badge"

<Badge text="Active" color="green" />
```

Every component's own README under the directories below lists its full prop surface.

The UI guide — the catalogue the demo site shows — is a component too. It has an overview and one
page per package, picked from a side navigation that becomes a dialog on a phone, and an app mounts
it in one line:

```tsx
import { uiGuideRoute } from "@spy4x/preact-ui-guide"

<uiGuideRoute.component />
```

Set `history.scrollRestoration = "manual"` in the host page, so a reload lands on what the address
names. [`ui-guide/README.md`](../ui-guide/README.md) has the props and the route grammar.

## Accessibility

Roles, labels, keyboard handling and focus are written by hand — this repository uses no
third-party component library — and proven in a real browser for the behaviours `pages/checks/`
covers; a package's own README says which behaviours that is. No screen reader has been run
against this repository (#210): what is demonstrated is markup and the order in which the DOM
changes, not what any assistive technology actually speaks.

## Where it runs

Every module is a standard ES module, and nothing a package publishes calls a Deno-only API: the
files that do — build, generation and audit scripts such as `theme/generate.ts`,
`icons/provenance.ts` and `ui-guide/coverage.ts` — are listed under `publish.exclude` in their
package's `deno.json`. A component touches `window` or `document` only inside an effect or an event
handler, so it renders to HTML on a server (`preact-render-to-string`, which is how every test here
renders it) and hydrates in the browser. The browser APIs the components call are standard ones,
among them Clipboard, Geolocation, the Service Worker container, `localStorage`, the History API,
`IntersectionObserver` and `ResizeObserver`. Some are reached through a port the caller can replace,
with the browser's own as the default; others, such as the observers in `charts/` and the History
API in `signals/`, are called directly. Every request a component makes goes to an address the app
supplies: `Avatar`, `ImageGallery`, `Lightbox` and `ZoomableImages` load the image URLs they are
passed, `Map` loads Leaflet with a dynamic `import()`, which the app's own bundle resolves, and
fetches map tiles from the `tileUrl` it is given, and `SWUpdater` registers the service-worker
script it is given, which the browser downloads. No package calls Fetch, Streams or Web Crypto; data
arrives through props. The tests and the build run under Deno 2; running a published package under
Node or Bun through JSR's npm compatibility layer has not been tried.
