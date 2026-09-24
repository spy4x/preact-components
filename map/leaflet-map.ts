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
 * **Marker keyboard access lives on the pins themselves** — see `map/README.md` → "Keyboard and
 * screen readers" for the full reasoning. Each pin gets `keyboard: true`, which is Leaflet's own
 * option: it sets `tabindex="0"` and `role="button"` on the marker's icon element
 * (`leaflet-src.js:7914-7917`), putting every pin in the page's Tab order the moment it mounts. What
 * Leaflet does **not** do is activate a bare marker on a key press — its `_onKeyPress` handler exists
 * only inside `bindPopup` (`leaflet-src.js:10489`, `:10595`) and opens a popup, not a marker with
 * none bound. So this file adds its own `keydown` listener, directly on the icon element Leaflet
 * created (`marker.getElement()`), that calls `onMarkerClick` on a real Enter or Space press. `title`
 * gives a mouse user a native hover tooltip; `aria-label`, set on the same element, is what actually
 * names the pin to a screen reader — `title` alone is a weaker, overridable name source Chromium's
 * accessible-name computation prefers `aria-label` over.
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
 * The wrapper itself carries no `aria-hidden`: it sits inside the icon element {@link addMarker} names
 * with `aria-label`, and its own content would otherwise still reach a screen reader's fallback name
 * computation if the label were ever missing. Only the decorative dot — colour alone, nothing an
 * assistive technology should read as text — is `aria-hidden`.
 *
 * @param status The marker's status; `STATUS_WRAPPER_CLASS` colours it.
 */
export function buildMarkerIconElement(status: MapMarkerStatus): HTMLElement {
  const wrapper = document.createElement("span")
  wrapper.className = STATUS_WRAPPER_CLASS[status]

  const dot = document.createElement("span")
  dot.className = MARKER_DOT_CLASSES
  dot.setAttribute("aria-hidden", "true")
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
 * `keyboard: true` is Leaflet's own option, and it is what puts the marker in the Tab order with
 * `role="button"` (see this file's own doc). `click` is wired through Leaflet's own event, for a
 * pointer interaction; `keydown` is wired by hand, directly on the DOM element Leaflet created,
 * because Leaflet has nothing built in that activates a bare marker from the keyboard — only Enter
 * and Space call `onMarkerClick`, and Space calls `preventDefault` first so the page does not scroll
 * under a keyboard user the way an unhandled Space on a focused element normally would.
 *
 * `marker.getElement()` only returns a node once the marker has been added to a map, which is why
 * this reads it back *after* `addTo` rather than building the listener into the icon up front.
 *
 * @param L The Leaflet module.
 * @param layer The layer group markers are added to.
 * @param marker The marker to add.
 * @param onMarkerClick Called with the marker's `id` on a pointer click, or a real Enter/Space press.
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
    keyboard: true,
    title: marker.label,
  })
  leafletMarker.on("click", () => onMarkerClick(marker.id))
  leafletMarker.addTo(layer)

  const element = leafletMarker.getElement()
  if (element) {
    element.setAttribute("aria-label", marker.label)
    // A stable hook for a browser check to identify which pin is which — never read by anything in
    // this package itself, and irrelevant to any accessibility API.
    element.setAttribute("data-marker-id", marker.id)
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return
      if (event.key === " ") event.preventDefault()
      onMarkerClick(marker.id)
    })
  }
}

/** The two zoom-control tooltips {@link createLeafletMap} takes — see `Map`'s `zoomInLabel`/
 * `zoomOutLabel` props, which is where their English defaults live. */
export interface ZoomLabels {
  zoomInLabel: string
  zoomOutLabel: string
}

/**
 * Create the live map: the Leaflet instance, its tile layer and an empty marker layer group, mounted
 * into `container`. Leaflet's own attribution control is switched off — `map.tsx` renders the credit
 * line itself, as plain text next to (not inside) Leaflet's own DOM, so it is never subject to
 * Leaflet's attribution control being collapsed, hidden, or scrolled out of its corner.
 *
 * The default zoom control is switched off too and replaced with one built by hand, because that is
 * the only way to reach its `zoomInTitle`/`zoomOutTitle` options — `L.Map`'s own constructor options
 * have no equivalent, and the control cannot be reconfigured once built. Leaflet's defaults for those
 * two ("Zoom in", "Zoom out") are English-only and would otherwise be the one pair of controls in
 * this component's Tab order with no label prop at all.
 *
 * @param L The Leaflet module, already loaded.
 * @param container The element Leaflet mounts into — emptied and owned by Leaflet from this call on.
 * @param tileUrl Tile URL template, handed to `L.tileLayer` unmodified.
 * @param center Initial view centre.
 * @param zoom Initial zoom.
 * @param zoomLabels The zoom control's two tooltip/accessible-name strings.
 */
export function createLeafletMap(
  L: LeafletModule,
  container: HTMLElement,
  tileUrl: string,
  center: MapCenter,
  zoom: number,
  zoomLabels: ZoomLabels,
): LeafletMapHandle {
  const map = L.map(container, {
    attributionControl: false,
    zoomControl: false,
    center: [center.lat, center.lng],
    zoom,
  })
  L.control.zoom({
    zoomInTitle: zoomLabels.zoomInLabel,
    zoomOutTitle: zoomLabels.zoomOutLabel,
  }).addTo(map)
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
