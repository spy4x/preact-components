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
import type { ComponentChildren, JSX } from "preact"
import { lazyModule, type LazyModuleState } from "../lazy.ts"

/** `@spy4x/preact-map`, loaded when the first card that needs it mounts. */
export const mapModule = lazyModule(() => import("@spy4x/preact-map"))

/**
 * What the Map card shows until the package has loaded, or instead of it when the load failed.
 *
 * The box has the height `Map` gives its own box by default, so the page does not move when the map
 * replaces it. The wording holds without JavaScript too: with scripts off the served box never
 * changes, so it says where the map is drawn rather than promising a load.
 *
 * @param props.state The module's load state; only `loading` and `failed` reach here.
 * @param props.label The map's accessible name, so the placeholder says which map goes here.
 */
function MapPending(
  { state, label }: { state: LazyModuleState<unknown>; label: string },
): JSX.Element {
  if (state.status === "failed") {
    return (
      <p role="alert" data-e2e="map-failed" class="text-sm text-red-700 dark:text-red-400">
        {label}: the map package did not load — {state.message}
      </p>
    )
  }
  return (
    <div
      data-e2e="map-placeholder"
      class="flex h-80 w-full items-center justify-center rounded-primary border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
    >
      {/* One text node, so the served and the hydrated text read the same while it shows. */}
      {`${label}: drawn in the browser with Leaflet`}
    </div>
  )
}

/**
 * The one element that holds the Map card's placeholder and, once loaded, the map itself.
 *
 * It stays the same element across the swap, so `pages/checks/ui-guide.ts` can leave exactly this
 * part out when it compares the served text of the card with the browser's.
 *
 * @param props.children The placeholder or the map.
 */
function MapSlot({ children }: { children: ComponentChildren }): JSX.Element {
  return <div data-e2e="map-slot">{children}</div>
}

/**
 * `Map`, loaded on first mount.
 *
 * @param props The map's own props, passed through unchanged.
 */
export function LazyMap(props: MapProps): JSX.Element {
  const state = mapModule.use()
  if (state.status !== "loaded") {
    return (
      <MapSlot>
        <MapPending state={state} label={props.label ?? "Map"} />
      </MapSlot>
    )
  }
  const { Map } = state.module
  return (
    <MapSlot>
      <Map {...props} />
    </MapSlot>
  )
}
