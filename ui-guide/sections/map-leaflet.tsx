/**
 * The map page's only way to `@spy4x/preact-map`.
 *
 * `Map` starts its dynamic `import("leaflet")` from an effect when it mounts, and hydration mounts
 * every page of the guide, because the served document carries them all. A static import of `Map`
 * therefore made every app that mounts the guide download Leaflet, even on the overview (#315). The
 * map section reaches the package only through the loader here, whose dynamic `import()` runs from
 * an effect one task after a card on the showing page mounts (`../lazy.ts`), so `Map` itself — and
 * Leaflet with it — mounts only once the map page is shown. Until then the card shows a placeholder,
 * on the server and in the browser alike.
 *
 * Types are imported with `import type`, which leaves nothing behind in the bundle.
 */

import type { MapProps } from "@spy4x/preact-map"
import type { JSX } from "preact"
import { lazyModule } from "../lazy.ts"
import { LazySlot } from "../lazy-slot.tsx"

/** `@spy4x/preact-map`, loaded when the first card that needs it mounts. */
export const mapModule = lazyModule(() => import("@spy4x/preact-map"))

/**
 * `Map`, loaded on first mount.
 *
 * Until the package has loaded, the card shows a placeholder with the height `Map` gives its own box
 * by default, so the map keeps the box's place when it replaces it; the list of places then appears
 * below.
 *
 * @param props The map's own props, passed through unchanged.
 */
export function LazyMap(props: MapProps): JSX.Element {
  return (
    <LazySlot
      state={mapModule.use()}
      label={props.label ?? "Map"}
      drawnWith="Leaflet"
      module="the map package"
      e2e="map"
      boxClass="h-80 w-full rounded-primary"
    >
      {({ Map }) => <Map {...props} />}
    </LazySlot>
  )
}
