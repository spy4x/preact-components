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
 * **The map is torn down on unmount, and never built at all if the component is already gone by the
 * time Leaflet finishes loading.** The mount effect's cleanup calls the live handle's `remove()`,
 * which is Leaflet's own teardown — every DOM node and listener it attached comes off with it. A
 * `cancelled` flag, read by `mountLeafletMap` through a closure passed in as `isCancelled`, is
 * checked *before* the map is built, not only afterwards — so a `leaflet` module that resolves after
 * the component unmounts is never mounted into the (by then detached) container at all, rather than
 * being mounted and immediately torn down.
 *
 * **A failed `import("leaflet")`, or a throw while building the map, never throws out of this
 * component.** `mountLeafletMap` (`leaflet-map.ts`) reports either through `onLoadError` instead —
 * see that prop's own doc for why a port, rather than markup this component renders. Nothing calls
 * `onLoadError` once the component has already unmounted, for the same reason nothing builds a map
 * at that point either. The box and the list both stay exactly as usable as
 * they were before the failure.
 *
 * **Changing `center`, `zoom` or `markers` after mount updates the live map** — issue #143's own
 * words — rather than tearing it down and remounting: two effects below call `setView`/`setMarkers`
 * on the handle the mount effect produced, gated on `ready` so they do nothing until that handle
 * exists. The marker effect depends on `markers` alone, not on `onMarkerClick`'s identity — see
 * `onMarkerClickRef` below — so a caller passing a fresh inline arrow on every render (the catalogue's
 * own demo does) does not rebuild every pin on every render. It *does* rebuild the whole layer
 * whenever `markers` itself is a new array, whether or not its contents actually changed — `markers`
 * is expected to be referentially stable across renders that do not change what is plotted; see
 * `map/README.md` → "What a new `markers` identity costs".
 *
 * **Keyboard and screen readers.** See `leaflet-map.ts`'s own doc and `map/README.md` → "Keyboard and
 * screen readers": the map's own pins are the operable, named form of every marker (real Tab stops,
 * `role="button"`, `aria-label`), and the plain list this component always renders beside the tile
 * layer is a non-interactive overview of the same places.
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

import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import { type LeafletMapHandle, mountLeafletMap, type ZoomLabels } from "./leaflet-map.ts"
import { MarkerList } from "./marker-list.tsx"
import type { MapCenter, MapMarker } from "./types.ts"

export type { MapCenter, MapMarker, MapMarkerStatus } from "./types.ts"

export interface MapProps {
  /** Point the map centres on. */
  center: MapCenter
  /** Leaflet zoom level. */
  zoom: number
  /** Places to plot, and to list. See `map/README.md` → "What a new `markers` identity costs" for
   * what changing this array's identity, rather than its contents, does. */
  markers: MapMarker[]
  /** Called with a marker's `id` when its pin is activated — a pointer click, or a real Enter or
   * Space press while the pin has focus. */
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
  /** Leaflet's zoom-in control's tooltip and accessible name. Defaults to `"Zoom in"`. */
  zoomInLabel?: string
  /** Leaflet's zoom-out control's tooltip and accessible name. Defaults to `"Zoom out"`. */
  zoomOutLabel?: string
  /**
   * Called, never thrown, if Leaflet fails to load — a network blip, an ad blocker, a CDN outage on
   * whatever serves the dynamic `import("leaflet")` chunk — or if building the map throws once it
   * has. Never called at all once the component has unmounted: there is nowhere useful for the error
   * to go by then, the same reason a map is not built into an unmounted component's detached
   * container either. The box and the list both stay exactly as usable as before the failure; this
   * port is where the application decides whether that becomes a toast, a logged event, a retry, or
   * nothing a visitor ever sees. Defaults to logging the error to the console, so a failure is never
   * silent even for a caller that supplies nothing. Read once, at mount — see `mountArgsFrom`.
   */
  onLoadError?: (error: unknown) => void
}

/** {@link MapProps.onLoadError}'s default: visible in the console, silent to a visitor. */
function logLoadError(error: unknown): void {
  console.error("@spy4x/preact-map: Leaflet failed to load", error)
}

/** Everything the mount effect passes to `mountLeafletMap` that comes from this component's props,
 * resolved in one place. */
export interface MountArgs {
  tileUrl: string
  center: MapCenter
  zoom: number
  zoomLabels: ZoomLabels
  onLoadError: (error: unknown) => void
}

/**
 * Resolve {@link MountArgs} from `Map`'s own (already-defaulted) props.
 *
 * Exported and tested directly, on its own: nothing inside the mount effect below is observable
 * from a test, since effects never run under `preact-render-to-string` (see `AGENTS.md`). The tests
 * prove what this function returns. They do not prove that the effect hands that result to
 * `mountLeafletMap`: a no-op swapped in for `args.onLoadError` inside the effect would pass every
 * test, so that one line is covered by reading it.
 *
 * It also doubles as the one place that states `tileUrl`, `zoomInLabel` and `zoomOutLabel` — and now
 * `onLoadError` alongside them — are read once, at mount: the effect closes over whatever this
 * returned on the render that created it, and never reads a later one.
 */
export function mountArgsFrom(
  { tileUrl, center, zoom, zoomInLabel, zoomOutLabel, onLoadError }: {
    tileUrl: string
    center: MapCenter
    zoom: number
    zoomInLabel: string
    zoomOutLabel: string
    onLoadError: (error: unknown) => void
  },
): MountArgs {
  return {
    tileUrl,
    center,
    zoom,
    zoomLabels: { zoomInLabel, zoomOutLabel },
    onLoadError,
  }
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
    zoomInLabel = "Zoom in",
    zoomOutLabel = "Zoom out",
    onLoadError = logLoadError,
  }: MapProps,
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<LeafletMapHandle | null>(null)
  const [ready, setReady] = useState(false)

  // The latest `onMarkerClick`, read by every pin's own listener through one stable wrapper function
  // — see `setMarkers`'s call below. Written directly during render (not inside an effect): Preact,
  // unlike React's strict mode, never renders a function body twice for one commit, so this plain
  // assignment is not racy, and it is what lets the marker effect below depend on `markers` alone.
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  // Mounts once. `tileUrl`, the zoom labels and `onLoadError` are read only here, at mount, via
  // `mountArgsFrom` — see that function's own doc. `center`, `zoom` and `markers` are the props the
  // issue names as ones that update a live map; swapping the tile provider, relabelling the zoom
  // control or changing what a load failure reports to after mount is not a behaviour this component
  // promises, so all three are deliberately left out of the dependency list below.
  //
  // `mountLeafletMap` (in `leaflet-map.ts`) is the whole body of this effect, factored out so a
  // failed `import("leaflet")` — or a component that unmounts while it is still loading — is
  // testable without a browser: it never throws, calls `onLoadError` instead of throwing (unless
  // already cancelled by then), and never builds a map at all once `isCancelled` reads true. `cancelled`
  // is read through a closure (`() => cancelled`), not copied, so `mountLeafletMap` always sees this
  // effect's current value even though the flag can flip to `true` while it is still awaiting `load()`.
  useEffect(() => {
    let cancelled = false
    if (!containerRef.current) return

    const args = mountArgsFrom({ tileUrl, center, zoom, zoomInLabel, zoomOutLabel, onLoadError })

    mountLeafletMap(
      () => import("leaflet"),
      containerRef.current,
      args.tileUrl,
      args.center,
      args.zoom,
      args.zoomLabels,
      args.onLoadError,
      () => cancelled,
    ).then((handle) => {
      if (cancelled || !handle) {
        handle?.remove()
        return
      }
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
    handleRef.current?.setMarkers(markers, (id) => onMarkerClickRef.current(id))
    // `onMarkerClick` deliberately absent: `onMarkerClickRef` always holds the latest one, so rebuilding
    // the whole marker layer over an identity change that carries no new places would be wasted work.
  }, [ready, markers])

  return (
    <div class="space-y-4">
      <div class={cn(BOX_BASE, DEFAULT_SIZE, className)} data-e2e="map-box">
        <div ref={containerRef} class="absolute inset-0" role="group" aria-label={label} />
        <p
          class="absolute right-0 bottom-0 z-[1000] rounded-tl bg-white/80 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-gray-900/80 dark:text-gray-300"
          data-e2e="map-attribution"
        >
          {attribution}
        </p>
      </div>
      <MarkerList markers={markers} label={listLabel} />
    </div>
  )
}
