/**
 * The imperative half of `Map`: everything that touches Leaflet or the DOM directly.
 *
 * Kept out of `map.tsx` so the component itself only holds refs and effects — every function here
 * takes the objects it needs as arguments rather than reading `document`/`window` on its own, except
 * where building a marker's icon genuinely requires `document.createElement` (Leaflet's `DivIcon`
 * takes either an HTML string, parsed with `innerHTML`, or a real `Element` it appends as-is; this
 * file always builds the latter, so nothing here ever turns a string into markup — see
 * `map/README.md` → "Security"). Nothing in this file runs from `map.tsx` except inside an effect, so
 * none of it runs during a server render.
 *
 * Marker keyboard access is deliberately **not** implemented on the map's own pins — see
 * `map/README.md` → "Why the list, not the pins, is the keyboard path" for the reasoning. Each pin
 * here is `aria-hidden`, not focusable (`keyboard: false`), and answers a mouse or touch click by
 * calling the same `onMarkerClick` port the plain list next to the map calls.
 */

import type * as Leaflet from "leaflet"
import type { MapCenter, MapMarker, MapMarkerStatus } from "./types.ts"

/** The `leaflet` module, loaded once via the dynamic `import()` in `map.tsx`'s mount effect. */
export type LeafletModule = typeof Leaflet

/** The wrapper class `.status-on`/`.status-off`/`.status-unknown .map-marker` in `theme/preset.css`
 * reads for a marker's colour, keyed by {@link MapMarkerStatus} so a status this union does not name
 * is a type error rather than an unstyled pin. */
export const STATUS_WRAPPER_CLASS: Record<MapMarkerStatus, string> = {
  on: "status-on",
  off: "status-off",
  unknown: "status-unknown",
}

/**
 * Utility classes the marker's own dot carries, alongside the theme's `map-marker` class: shape and
 * size come from here, colour from the `status-*` ancestor {@link STATUS_WRAPPER_CLASS} names.
 * `theme/preset.css` styles only `background-color` on `.map-marker` — it never sets a shape — so a
 * dot with no size/shape utilities of its own would be a zero-by-zero box.
 */
export const MARKER_DOT_CLASSES =
  "map-marker block size-4 rounded-full border-2 border-white shadow-sm"

/** A live Leaflet map this module created, and the operations `map.tsx`'s effects need on it. */
export interface LeafletMapHandle {
  /** Move the view without recreating the map or its tile layer. */
  setView(center: MapCenter, zoom: number): void
  /** Replace every marker with the given list — the whole layer is cleared and rebuilt each call,
   * which is simple and correct for the marker counts this component is for; nothing here claims to
   * diff efficiently for a marker set large enough to make that matter. */
  setMarkers(markers: readonly MapMarker[], onMarkerClick: (id: string) => void): void
  /** Tear the map down — removes every DOM node and listener Leaflet attached. Idempotent. */
  remove(): void
}

/**
 * Build one marker's icon: a status wrapper around the themed dot, as a real `Element` rather than an
 * HTML string. Passing an `Element` to `L.divIcon({ html })` is what lets Leaflet append it with
 * `appendChild` instead of parsing a string with `innerHTML` — see this file's own doc.
 *
 * The wrapper is `aria-hidden`: this pin is not the keyboard/screen-reader path for its marker (the
 * plain list is), so it carries no accessible name of its own. `title` is set on the *marker*, not
 * this element, by {@link addMarker} — Leaflet copies a `title` option onto the icon element itself,
 * which gives a mouse user a native tooltip with the place's name without this function reaching into
 * `marker.getElement()` after the fact.
 *
 * @param status The marker's status; `STATUS_WRAPPER_CLASS` colours it.
 */
export function buildMarkerIconElement(status: MapMarkerStatus): HTMLElement {
  const wrapper = document.createElement("span")
  wrapper.className = STATUS_WRAPPER_CLASS[status]
  wrapper.setAttribute("aria-hidden", "true")

  const dot = document.createElement("span")
  dot.className = MARKER_DOT_CLASSES
  wrapper.appendChild(dot)

  return wrapper
}

/** Square size, in pixels, of one marker's icon box — see {@link buildMarkerIconElement}. Leaflet
 * centres a `divIcon` on its coordinate by default when no `iconAnchor` is given, which is what a
 * round status dot wants. */
const ICON_SIZE: [number, number] = [20, 20]

/**
 * Add one marker to a layer group.
 *
 * `keyboard: false` is deliberate — see this file's own doc and `map/README.md`. `click` is wired
 * through Leaflet's own event, which only fires for a real pointer interaction; nothing here invents
 * a synthetic activation path a keyboard could also trigger, since the pin is not meant to be reached
 * that way.
 *
 * @param L The Leaflet module.
 * @param layer The layer group markers are added to.
 * @param marker The marker to add.
 * @param onMarkerClick Called with the marker's `id` on a pointer click.
 */
function addMarker(
  L: LeafletModule,
  layer: Leaflet.LayerGroup,
  marker: MapMarker,
  onMarkerClick: (id: string) => void,
): void {
  const icon = L.divIcon({
    html: buildMarkerIconElement(marker.status ?? "unknown"),
    className: "",
    iconSize: ICON_SIZE,
  })

  const leafletMarker = L.marker([marker.lat, marker.lng], {
    icon,
    keyboard: false,
    title: marker.label,
  })
  leafletMarker.on("click", () => onMarkerClick(marker.id))
  leafletMarker.addTo(layer)
}

/**
 * Create the live map: the Leaflet instance, its tile layer and an empty marker layer group, mounted
 * into `container`. Leaflet's own attribution control is switched off — `map.tsx` renders the credit
 * line itself, as plain text next to (not inside) Leaflet's own DOM, so it is never subject to
 * Leaflet's attribution control being collapsed, hidden, or scrolled out of its corner.
 *
 * @param L The Leaflet module, already loaded.
 * @param container The element Leaflet mounts into — emptied and owned by Leaflet from this call on.
 * @param tileUrl Tile URL template, handed to `L.tileLayer` unmodified.
 * @param center Initial view centre.
 * @param zoom Initial zoom.
 */
export function createLeafletMap(
  L: LeafletModule,
  container: HTMLElement,
  tileUrl: string,
  center: MapCenter,
  zoom: number,
): LeafletMapHandle {
  const map = L.map(container, {
    attributionControl: false,
    center: [center.lat, center.lng],
    zoom,
  })
  L.tileLayer(tileUrl, { attribution: "" }).addTo(map)
  const markerLayer = L.layerGroup().addTo(map)

  return {
    setView(nextCenter, nextZoom) {
      map.setView([nextCenter.lat, nextCenter.lng], nextZoom)
    },
    setMarkers(markers, onMarkerClick) {
      markerLayer.clearLayers()
      for (const marker of markers) addMarker(L, markerLayer, marker, onMarkerClick)
    },
    remove() {
      map.remove()
    },
  }
}
