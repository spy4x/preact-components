/**
 * The plain-text list of {@link MapMarker}s that always renders beside `Map`'s tile layer.
 *
 * This is presentational, not interactive: the issue's own words are "a plain list of the same
 * places", and the map's own pins are the keyboard and screen-reader path to each one — see
 * `map/README.md` → "Keyboard and screen readers" for the reasoning. No row is a button, none carries
 * a click handler, and none is in the Tab order; a mouse user who wants to act on a place clicks its
 * pin, and a keyboard or screen-reader user Tabs to it there too. What this list gives every visitor,
 * sighted or not, is the same overview: every place's name and status, in one ordinary, readable
 * block of text, with nothing behind an interaction a map alone would require. The status is said in
 * words, visually hidden after the label, as well as shown by the dot's colour.
 */

import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { DEFAULT_STATUS_LABELS, MARKER_DOT_CLASSES, STATUS_WRAPPER_CLASS } from "./leaflet-map.ts"
import type { MapMarker, MapMarkerStatus } from "./types.ts"

export interface MarkerListProps {
  /** The same markers `Map` plots. */
  markers: readonly MapMarker[]
  /** Heading over the list. Defaults to `"Places"`. */
  label?: string
  /** The heading's level, so it fits the page's outline. Defaults to `3`. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** The status words each row says after its label. Defaults to `"on"`, `"off"` and
   * `"status unknown"`. */
  statusLabels?: Partial<Record<MapMarkerStatus, string>>
  /** Extra classes on the list's own wrapper. */
  class?: string
}

/** One marker's row: the same status dot the map pin shows, plus the label and status as text. */
function MarkerListItem(
  { marker, statusLabel }: { marker: MapMarker; statusLabel: string },
): JSX.Element {
  const status = marker.status ?? "unknown"
  return (
    <li class="flex items-center gap-2 px-2 py-1 text-sm text-foreground">
      <span class={cn(STATUS_WRAPPER_CLASS[status], "inline-flex shrink-0")}>
        <span class={MARKER_DOT_CLASSES} aria-hidden="true" />
      </span>
      {marker.label}
      <span class="sr-only">, {statusLabel}</span>
    </li>
  )
}

/** See this file's own doc. */
export function MarkerList(
  { markers, label = "Places", headingLevel = 3, statusLabels, class: className }: MarkerListProps,
): JSX.Element {
  const Heading = `h${headingLevel}` as "h3"
  const words = { ...DEFAULT_STATUS_LABELS, ...statusLabels }
  return (
    <div class={cn("space-y-2", className)} data-e2e="map-marker-list">
      <Heading class="text-sm font-medium text-foreground">{label}</Heading>
      <ul class="space-y-1">
        {markers.map((marker) => (
          <MarkerListItem
            key={marker.id}
            marker={marker}
            statusLabel={words[marker.status ?? "unknown"]}
          />
        ))}
      </ul>
    </div>
  )
}
