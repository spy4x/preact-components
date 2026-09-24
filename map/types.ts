/** One of the three states {@link MapMarker} carries a colour for — see `theme/preset.css`'s
 * `.status-on`/`.status-off`/`.status-unknown` rules. A marker with no `status` is treated as
 * `"unknown"`, the same colour the theme already uses for that state. */
export type MapMarkerStatus = "on" | "off" | "unknown"

/** One place `Map` shows, on the tile layer and in the plain-text list beside it. */
export interface MapMarker {
  /** Stable identity, passed back to `onMarkerClick` and used as this marker's React/Preact key. */
  id: string
  /** Latitude, in degrees. */
  lat: number
  /** Longitude, in degrees. */
  lng: number
  /**
   * This place's name, shown as the list item's own text and, on hover, as the map pin's native
   * tooltip. Always rendered as text — see `map/README.md` → "Security".
   */
  label: string
  /** Defaults to `"unknown"` when omitted. */
  status?: MapMarkerStatus
}

/** A point `Map` centres on. Plain `{ lat, lng }` rather than a Leaflet `LatLng`, so a caller never
 * needs Leaflet's types merely to hold a coordinate. */
export interface MapCenter {
  lat: number
  lng: number
}
