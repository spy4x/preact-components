/**
 * `Map` — markers on a Leaflet tile layer, with a plain-text list of the same places beside it.
 *
 * **Server-renderable.** Leaflet touches `window` the moment it is imported (issue #143), so nothing
 * here imports it at module scope: the mount effect below loads it with a dynamic `import()`, which
 * never runs during a server render (`useEffect` bodies do not run under `preact-render-to-string`)
 * and only runs once, in a browser, after hydration. The server (and the first paint, before that
 * `import()` resolves) sees an empty box at the size `class` gives it — the box's size comes from
 * that class alone, so nothing about it changes once Leaflet mounts inside it.
 *
 * **The map is torn down on unmount.** The mount effect's cleanup calls the live handle's `remove()`,
 * which is Leaflet's own teardown — every DOM node and listener it attached comes off with it. A
 * `cancelled` flag guards the case where the component unmounts while the dynamic `import()` is still
 * in flight, so a `leaflet` module that resolves after that point is never mounted at all.
 *
 * **Changing `center`, `zoom` or `markers` after mount updates the live map** — issue #143's own
 * words — rather than tearing it down and remounting: two effects below call `setView`/`setMarkers`
 * on the handle the mount effect produced, gated on `ready` so they do nothing until that handle
 * exists.
 *
 * **Keyboard and screen readers.** See `leaflet-map.ts` and `marker-list.tsx`'s own docs, and
 * `map/README.md` → "Why the list, not the pins, is the keyboard path": the plain list this component
 * always renders beside the tile layer is the operable, named form of every marker; the map's own
 * pins are `aria-hidden` and pointer-only.
 *
 * **The credit line is always visible.** Leaflet's built-in attribution control is switched off
 * (`leaflet-map.ts`'s `createLeafletMap`); the text below renders the `attribution` prop itself, as a
 * sibling of the tile layer rather than inside Leaflet's own DOM, so it exists from the first render —
 * server included — and cannot be collapsed, hidden or scrolled by anything Leaflet does to its own
 * panes.
 *
 * **Security.** `label` and `attribution` are rendered as JSX text children, which Preact escapes the
 * same way it escapes any other text node — never as markup, and never through
 * `dangerouslySetInnerHTML` or an HTML string. See `map/README.md` → "Security" for the full
 * reasoning, including why the map's own pins build their DOM with `document.createElement` rather
 * than an HTML string.
 */

import { cn } from "@preact-components/cn"
import type { JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import { createLeafletMap, type LeafletMapHandle } from "./leaflet-map.ts"
import { MarkerList } from "./marker-list.tsx"
import type { MapCenter, MapMarker } from "./types.ts"

export type { MapCenter, MapMarker, MapMarkerStatus } from "./types.ts"

export interface MapProps {
  /** Point the map centres on. */
  center: MapCenter
  /** Leaflet zoom level. */
  zoom: number
  /** Places to plot, and to list. */
  markers: MapMarker[]
  /** Called with a marker's `id` when its pin or its list row is activated. */
  onMarkerClick: (id: string) => void
  /**
   * Tile URL template, handed to Leaflet's `L.tileLayer` unmodified — e.g.
   * `"https://tile.example.com/{z}/{x}/{y}.png"`. Required: the application picks its own tile
   * provider, this component has no default one.
   */
  tileUrl: string
  /**
   * The tile provider's required credit line. Always rendered as **plain text** — HTML in this
   * string is shown literally, character for character, never parsed as markup. See
   * `map/README.md` → "Security" if a provider's terms ask for a link: this prop cannot carry one,
   * by design.
   */
  attribution: string
  /** Extra classes on the map's own box. This is what controls its size, e.g. `"h-64 w-full"` — the
   * box has no size of its own beyond the small default below. */
  class?: string
  /** Accessible name of the map region. Defaults to `"Map"`. */
  label?: string
  /** Heading over the plain-text list of markers. Defaults to `"Places"`. */
  listLabel?: string
}

/** The box's size when `class` does not override it — roomy enough to be useful in a demo, and
 * exactly what makes the server-rendered box already the size the mounted map will be. */
const DEFAULT_SIZE = "h-80 w-full"

const BOX_BASE =
  "relative overflow-hidden rounded-primary border border-subtle bg-gray-100 dark:bg-gray-800"

/** See this file's own doc. */
export function Map(
  {
    center,
    zoom,
    markers,
    onMarkerClick,
    tileUrl,
    attribution,
    class: className,
    label = "Map",
    listLabel = "Places",
  }: MapProps,
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<LeafletMapHandle | null>(null)
  const [ready, setReady] = useState(false)

  // Mounts once. `tileUrl` is read only here, at mount, because the issue names `center`, `zoom` and
  // `markers` as the props that update a live map — swapping the tile provider after mount is not a
  // behaviour this component promises, so it is deliberately left out of the dependency list below.
  useEffect(() => {
    let cancelled = false

    import("leaflet").then((leafletModule) => {
      if (cancelled || !containerRef.current) return
      const handle = createLeafletMap(leafletModule, containerRef.current, tileUrl, center, zoom)
      handleRef.current = handle
      setReady(true)
    })

    return () => {
      cancelled = true
      handleRef.current?.remove()
      handleRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    handleRef.current?.setView(center, zoom)
  }, [ready, center.lat, center.lng, zoom])

  useEffect(() => {
    if (!ready) return
    handleRef.current?.setMarkers(markers, onMarkerClick)
  }, [ready, markers, onMarkerClick])

  return (
    <div class="space-y-4">
      <div class={cn(BOX_BASE, DEFAULT_SIZE, className)} data-e2e="map-box">
        <div ref={containerRef} class="absolute inset-0" role="group" aria-label={label} />
        <p
          class="pointer-events-none absolute right-0 bottom-0 z-[1000] rounded-tl bg-white/80 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-gray-900/80 dark:text-gray-300"
          data-e2e="map-attribution"
        >
          {attribution}
        </p>
      </div>
      <MarkerList markers={markers} onMarkerClick={onMarkerClick} label={listLabel} />
    </div>
  )
}
