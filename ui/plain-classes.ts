/**
 * Class lists that components share as plain strings, without `cn`, so a component that keeps
 * `tailwind-merge` out of its island, such as `PricingTable`, draws the same pill and the same
 * columns as `Badge` and `Grid`.
 *
 * @module
 */

/** Every badge's shape: a small pill of medium text on one line. */
export const BADGE_BASE =
  "inline-flex items-center border rounded-md px-2 py-1 text-xs whitespace-nowrap font-medium"

/** A grey outline badge's colours: the muted text token on the control border. */
export const BADGE_OUTLINE_GRAY = "border-control text-muted"

/** A filled accent badge's colours, `purple` by default. */
export const BADGE_FILLED_ACCENT = "border-transparent bg-selected text-selected-foreground"

/** A `Grid`'s columns at `minColumnWidth="md"`: as many 16 rem columns as fit. */
export const GRID_COLUMNS_MD = "grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]"
