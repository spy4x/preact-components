/**
 * The plain-text list of {@link MapMarker}s that always renders beside `Map`'s tile layer.
 *
 * This, not the map's own pins, is the keyboard and screen-reader path to every marker — see
 * `map/README.md` → "Why the list, not the pins, is the keyboard path" for why. Every list item is a
 * real `<button>`: it is in the page's Tab order from the first render (server or client, since this
 * component holds no ref and touches no DOM API), its accessible name is the marker's `label` as
 * text — never markup, see "Security" in the same README — and activating it, by mouse, Enter, Space
 * or an assistive technology's own activation gesture, calls the same `onMarkerClick` port a click on
 * the matching pin calls.
 */

import { cn } from "@preact-components/cn"
import type { JSX } from "preact"
import { MARKER_DOT_CLASSES, STATUS_WRAPPER_CLASS } from "./leaflet-map.ts"
import type { MapMarker } from "./types.ts"

export interface MarkerListProps {
  /** The same markers `Map` plots. */
  markers: readonly MapMarker[]
  /** Called with a marker's `id` when its list item is activated. */
  onMarkerClick: (id: string) => void
  /** Heading over the list. Defaults to `"Places"`. */
  label?: string
  /** Extra classes on the list's own wrapper. */
  class?: string
}

/** One marker's row: the same status dot the map pin shows, plus the label as real text. */
function MarkerListItem(
  { marker, onMarkerClick }: { marker: MapMarker; onMarkerClick: (id: string) => void },
): JSX.Element {
  const status = marker.status ?? "unknown"
  return (
    <li>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-primary px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
        onClick={() => onMarkerClick(marker.id)}
      >
        <span class={cn(STATUS_WRAPPER_CLASS[status], "inline-flex shrink-0")}>
          <span class={MARKER_DOT_CLASSES} aria-hidden="true" />
        </span>
        {marker.label}
      </button>
    </li>
  )
}

/** See this file's own doc. */
export function MarkerList(
  { markers, onMarkerClick, label = "Places", class: className }: MarkerListProps,
): JSX.Element {
  return (
    <div class={cn("space-y-2", className)} data-e2e="map-marker-list">
      <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</h3>
      <ul class="space-y-1">
        {markers.map((marker) => (
          <MarkerListItem key={marker.id} marker={marker} onMarkerClick={onMarkerClick} />
        ))}
      </ul>
    </div>
  )
}
