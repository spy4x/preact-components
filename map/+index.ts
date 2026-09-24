/**
 * `@preact-components/map` — `Map`, a Leaflet tile layer with markers, plus the plain-text list of
 * the same places that is its keyboard and screen-reader path. See `README.md`.
 *
 * `MarkerList` is not exported here: the issue this package implements (#143) asks for `Map` alone,
 * and `MarkerList` has no behaviour of its own apart from the map it accompanies — `Map` already
 * renders one beside every tile layer. Promoting it to its own public export, with its own catalogue
 * card, is a decision for a future issue with a real standalone need, not one to take speculatively
 * here.
 *
 * Leaflet's own stylesheet is not re-exported here either — `@preact-components/map/leaflet-css` is a
 * separate, Deno-only subpath, so importing this barrel never touches `Deno.readTextFile`. See
 * `README.md` → "Leaflet's stylesheet".
 */

export { Map, type MapCenter, type MapMarker, type MapMarkerStatus, type MapProps } from "./map.tsx"
