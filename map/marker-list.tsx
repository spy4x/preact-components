/**
 * The plain-text list of {@link MapMarker}s that always renders beside `Map`'s tile layer.
 *
 * This is presentational, not interactive: the issue's own words are "a plain list of the same
 * places", and the map's own pins are the keyboard and screen-reader path to each one — see
 * `map/README.md` → "Keyboard and screen readers" for the reasoning. No row is a button, none carries
 * a click handler, and none is in the Tab order; a mouse user who wants to act on a place clicks its
 * pin, and a keyboard or screen-reader user Tabs to it there too. What this list gives every visitor,
 * sighted or not, is the same overview: every place's name and status, in one ordinary, readable
 * block of text, with nothing behind an interaction a map alone would require.
 */

import { cn } from "@preact-components/cn"
import type { JSX } from "preact"
import { MARKER_DOT_CLASSES, STATUS_WRAPPER_CLASS } from "./leaflet-map.ts"
import type { MapMarker } from "./types.ts"

export interface MarkerListProps {
  /** The same markers `Map` plots. */
  markers: readonly MapMarker[]
  /** Heading over the list. Defaults to `"Places"`. */
  label?: string
  /** Extra classes on the list's own wrapper. */
  class?: string
}

/** One marker's row: the same status dot the map pin shows, plus the label as real text. */
function MarkerListItem({ marker }: { marker: MapMarker }): JSX.Element {
  const status = marker.status ?? "unknown"
  return (
    <li class="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200">
      <span class={cn(STATUS_WRAPPER_CLASS[status], "inline-flex shrink-0")}>
        <span class={MARKER_DOT_CLASSES} aria-hidden="true" />
      </span>
      {marker.label}
    </li>
  )
}

/** See this file's own doc. */
export function MarkerList(
  { markers, label = "Places", class: className }: MarkerListProps,
): JSX.Element {
  return (
    <div class={cn("space-y-2", className)} data-e2e="map-marker-list">
      <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</h3>
      <ul class="space-y-1">
        {markers.map((marker) => <MarkerListItem key={marker.id} marker={marker} />)}
      </ul>
    </div>
  )
}
