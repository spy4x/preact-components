/**
 * `@spy4x/preact-map` — `Map`, a Leaflet tile layer with markers. Each pin is a real Tab stop,
 * named by its `label`, and a real Enter or Space press on a focused pin calls `onMarkerClick` — the
 * pins are the keyboard and screen-reader path. `Map` also renders a plain, non-interactive list of
 * the same places beside the tile layer, as an always-visible overview rather than a second control
 * surface. See `README.md`.
 *
 * `MarkerList` is not exported here: the issue this package implements (#143) asks for `Map` alone,
 * and `MarkerList` has no behaviour of its own apart from the map it accompanies — `Map` already
 * renders one beside every tile layer. Promoting it to its own public export, with its own catalogue
 * card, is a decision for a future issue with a real standalone need, not one to take speculatively
 * here.
 *
 * Leaflet's own stylesheet is not re-exported here: it is not part of this package's published
 * surface at all. See `README.md` → "Leaflet's stylesheet" for the one route that works for an
 * external consumer.
 */

export { Map, type MapCenter, type MapMarker, type MapMarkerStatus, type MapProps } from "./map.tsx"
