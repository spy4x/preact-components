/**
 * The box a card shows where a lazily loaded component goes, and the element that holds it.
 *
 * The map page's Map card reaches its component through a `lazyModule` (`./lazy.ts`), so until the
 * module arrives — on the server, and in the browser until the load resolves — the card shows a
 * placeholder instead, rendered by this component. Another lazily loaded card would use it too.
 */

import type { ComponentChildren, JSX } from "preact"
import { cn } from "@spy4x/preact-cn"
import type { LazyModuleState } from "./lazy.ts"

/** What {@link LazySlot} needs to show a lazily loaded component, or stand in for it. */
export interface LazySlotProps<T> {
  /** The module's load state, from the `lazyModule`'s `use` hook. */
  state: LazyModuleState<T>
  /** The component's accessible name, so the placeholder says which one goes here. */
  label: string
  /** What draws the component in the browser, named in the placeholder: `d3`, `Leaflet`. */
  drawnWith: string
  /** What did not load, for the failure line: `the map package`, `the chart's d3 module`. */
  module: string
  /**
   * Prefix of the `data-e2e` names the browser checks find the pieces by: `<prefix>-slot`,
   * `<prefix>-placeholder` and `<prefix>-failed`.
   */
  e2e: string
  /** Size and corner classes of the placeholder box, so it keeps the place the component takes. */
  boxClass: string
  /** Render the component once the module has loaded. */
  children: (module: T) => ComponentChildren
}

/**
 * A lazily loaded component, or the placeholder or failure line that stands in for it.
 *
 * The outer element stays the same element across the swap, so `pages/checks/ui-guide.ts` can leave
 * exactly this part out when it compares a card's served text with the browser's. The placeholder's
 * wording holds without JavaScript too: with scripts off the served box never changes, so it says
 * where the component is drawn rather than promising a load.
 *
 * @param props See {@link LazySlotProps}.
 */
export function LazySlot<T>(
  { state, label, drawnWith, module, e2e, boxClass, children }: LazySlotProps<T>,
): JSX.Element {
  let content: ComponentChildren
  if (state.status === "loaded") {
    content = children(state.module)
  } else if (state.status === "failed") {
    content = (
      <p role="alert" data-e2e={`${e2e}-failed`} class="text-sm text-red-700 dark:text-red-400">
        {label}: {module} did not load — {state.message}
      </p>
    )
  } else {
    content = (
      <div
        data-e2e={`${e2e}-placeholder`}
        class={cn(
          "flex items-center justify-center border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400",
          boxClass,
        )}
      >
        {/* One text node, so the served and the hydrated text read the same while it shows. */}
        {`${label}: drawn in the browser with ${drawnWith}`}
      </div>
    )
  }
  return <div data-e2e={`${e2e}-slot`}>{content}</div>
}
