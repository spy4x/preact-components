/**
 * The Map section.
 *
 * One card, one component. The card reaches `Map` only through `LazyMap` (`map-leaflet.tsx`), so the
 * package, and Leaflet with it, loads only when the map page is shown (#315); the card's
 * server-rendered form is a sized placeholder box, the same honesty note `charts.tsx`'s d3 islands
 * carry. Confirming the map loads, the tiles draw and the markers become live pins needs a browser,
 * which `pages/checks/map.ts` is; `map/map.test.tsx` proves the box, the list and the escaping of
 * caller data.
 *
 * The tile URL is a **relative** path with no `{z}/{x}/{y}` placeholders — `map-demo/tile.png`, one
 * tiny local image `pages/build.ts` copies into the artefact, requested unchanged for every tile
 * Leaflet asks for. Relative, so it resolves against whatever base the page is served at (a local
 * preview, or the deployed GitHub Pages site) with no signal or effect needed to compute it, and
 * local, so `deno task verify`'s browser phase never reaches past the preview server — see issue
 * #143's security requirement.
 */

import type { MapMarker } from "@spy4x/preact-map"
import { useSignal } from "@preact/signals"
import type { DemoFragment } from "../registry.ts"
import { LazyMap } from "./map-leaflet.tsx"

/** Three places, one of each status, so every `status-*` colour the theme defines has a marker. */
const PLACES: MapMarker[] = [
  { id: "depot", lat: 51.5074, lng: -0.1278, label: "London depot", status: "on" },
  { id: "warehouse", lat: 48.8566, lng: 2.3522, label: "Paris warehouse", status: "off" },
  { id: "outpost", lat: 52.5200, lng: 13.4050, label: "Berlin outpost" },
]

/** A tile with no `{z}/{x}/{y}` in it: Leaflet requests this exact path for every tile it draws. */
const LOCAL_TILE_URL = "map-demo/tile.png"

/**
 * `Map` wired to a signal so `onMarkerClick` — from a pin's pointer click, or a real Enter or Space
 * press while a pin has focus — has something visible to echo, the same shape
 * `CalendarInteractiveDemo` in `system.tsx` uses for `onSelectDate`.
 */
function MapInteractiveDemo() {
  const lastClicked = useSignal("none yet")

  return (
    <div class="space-y-3" data-e2e="map-interactive">
      <LazyMap
        center={{ lat: 50, lng: 5 }}
        zoom={4}
        markers={PLACES}
        onMarkerClick={(id) => lastClicked.value = id}
        tileUrl={LOCAL_TILE_URL}
        attribution="© Example tile provider"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        onMarkerClick: <span data-e2e="map-last-clicked">{lastClicked.value}</span>
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Tab reaches each pin on the map, in marker order; activating one — a click, or a real Enter
        or Space press while it has focus — updates the id above. The list below the map is a plain,
        non-interactive overview of the same places, not a second set of controls. A public tile
        provider needs a real internet connection and its own required credit line, e.g.{" "}
        <code class="break-all">
          tileUrl="https://tile.openstreetmap.org/{"{z}"}/{"{x}"}/{"{y}"}.png"
        </code>{" "}
        with <code>attribution="© OpenStreetMap contributors"</code>{" "}
        — this card uses a local tile instead so the guide never depends on one.
      </p>
    </div>
  )
}

export const mapDemos = {
  Map: {
    summary:
      "Markers on a Leaflet tile layer, from plain `{ id, lat, lng, label, status? }` data, plus the plain-text list of the same places beside it — the map's own pins, not the list, are the keyboard and screen-reader path (see `map/README.md`). `tileUrl` and `attribution` are both required: the application picks its own tile provider, and providers require the credit line shown. Server-renders as an empty, sized box.",
    snippet: `<Map
  center={{ lat: 50, lng: 5 }}
  zoom={4}
  markers={[{ id: "depot", lat: 51.5, lng: -0.13, label: "London depot", status: "on" }]}
  onMarkerClick={(id) => select(id)}
  tileUrl="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution="© OpenStreetMap contributors"
/>`,
    render: () => <MapInteractiveDemo />,
  },
} satisfies DemoFragment
