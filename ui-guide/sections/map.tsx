/**
 * The Map section.
 *
 * One card, one component. The card reaches `Map` only through `LazyMap` (`map-leaflet.tsx`), so the
 * package, and Leaflet with it, loads only when the map page is shown (#315); the card's
 * server-rendered form is a sized placeholder box. Confirming the map loads, the tiles draw and the markers become live pins needs a browser,
 * which `pages/checks/map.ts` is; `map/map.test.tsx` proves the box, the list and the escaping of
 * caller data.
 *
 * The tiles come from the shell (`../map-tiles.ts`): OpenStreetMap's by default, so the published
 * guide draws a real map, or whatever provider the host passes as `mapTiles`. The demo site's
 * browser checks pass one tiny local image there, so `deno task verify`'s browser phase never
 * reaches past the preview server — see issue #143's security requirement.
 */

import type { MapMarker } from "@spy4x/preact-map"
import { useSignal } from "@preact/signals"
import { Stack } from "@spy4x/preact-ui"
import { useContext } from "preact/hooks"
import { MapTilesContext } from "../map-tiles.ts"
import type { DemoFragment } from "../registry.ts"
import { LazyMap } from "./map-leaflet.tsx"

/** Three places, one of each status, so every `status-*` colour the theme defines has a marker. */
const PLACES: MapMarker[] = [
  { id: "depot", lat: 51.5074, lng: -0.1278, label: "London depot", status: "on" },
  { id: "warehouse", lat: 48.8566, lng: 2.3522, label: "Paris warehouse", status: "off" },
  { id: "outpost", lat: 52.5200, lng: 13.4050, label: "Berlin outpost" },
]

/**
 * `Map` wired to a signal, so `onMarkerClick` — from a pin's click, or Enter or Space while a pin
 * has focus — has something visible to echo.
 */
function MapInteractiveDemo() {
  const lastClicked = useSignal("none yet")
  const tiles = useContext(MapTilesContext)

  return (
    <Stack gap="sm" data-e2e="map-interactive">
      <LazyMap
        center={{ lat: 50, lng: 5 }}
        zoom={4}
        markers={PLACES}
        onMarkerClick={(id) => lastClicked.value = id}
        tileUrl={tiles.url}
        attribution={tiles.attribution}
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        onMarkerClick: <span data-e2e="map-last-clicked">{lastClicked.value}</span>
      </p>
    </Stack>
  )
}

export const mapDemos = {
  Map: {
    summary:
      "Markers on a map, from plain data, with a list of the same places under it; you pick the tile provider and give its credit line.",
    wide: true,
    props: [
      { name: "center", type: "{ lat, lng }", description: "The point the map centres on." },
      { name: "zoom", type: "number", description: "The starting zoom level." },
      {
        name: "markers",
        type: "MapMarker[]",
        description: "The places: an `id`, `lat`, `lng`, a `label` and an optional `status`.",
      },
      {
        name: "onMarkerClick",
        type: "(id: string) => void",
        description: "Called with a marker's `id` when its pin is clicked or pressed.",
      },
      {
        name: "tileUrl",
        type: "string",
        description: "The tile provider's URL template, with `{z}`, `{x}` and `{y}`.",
      },
      {
        name: "attribution",
        type: "string",
        description: "The credit line the tile provider requires.",
      },
    ],
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
