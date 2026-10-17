/**
 * `RailShell` — the icons variant of `Rail` under its earlier name and slot props, kept so an app
 * can move to `AppShell` in its own time.
 *
 * It draws exactly what `<Rail variant="icons">` draws: the 72 px column from `md` at every desktop
 * width, the phone tab bar and its sheet. The 240 px labelled sidebar from `lg`, the current
 * entry's left bar and the `header` slot are gone: the house layout has one rail width, marks the
 * current entry with its fill alone, and has no top bar. App code draws `AppShell`; the boundary
 * rule's `forbiddenNames` (`@spy4x/preact-system/boundary`) can fail a test that imports this.
 *
 * @module
 */

import type { ComponentChildren, JSX } from "preact"
import {
  Rail,
  type RailItem,
  type RailLabels,
  type RailMoreTab,
  type RailPlace,
  TAB_BAR_SLOTS,
  tabBarSlots,
  type TabBarSplit,
} from "./rail.tsx"

export { TAB_BAR_SLOTS, tabBarSlots, type TabBarSplit }

/** One destination in {@link RailShellProps.items}: a `Rail` item. */
export type RailShellItem = RailItem

/** Where a sidebar slot is being drawn: the desktop column, or the phone overlay. */
export type RailShellSidebarPlace = "rail" | "overlay"

/** {@link RailShellProps.moreTab}: a `Rail` more tab. */
export type RailShellMoreTab = RailMoreTab

/** Every string `RailShell` prints that is not data the caller supplied: `Rail`'s labels. */
export type RailShellLabels = RailLabels

/** `Rail`'s props with the slots under their earlier names. */
export interface RailShellProps {
  /** The destinations, in display order. */
  items: readonly RailShellItem[]
  /** The current item's key. */
  currentKey?: string
  /** The current path; see `RailProps.currentPath`. */
  currentPath?: string
  /** The one visually distinct action, pinned first and centred in the phone bar. */
  primary?: RailShellItem
  /** Port for an entry with no `href`: receives that entry's key. */
  navigate?: (key: string) => void
  /** Port to the app's client router for an entry with an `href`. */
  navigateLink?: (key: string, href: string) => void
  /** The column's top zone and the overlay's first section. Called once per place. */
  sidebarTop?: (place: RailShellSidebarPlace) => ComponentChildren
  /** The column's bottom zone and the overlay's last section. Called once per place. */
  sidebarBottom?: (place: RailShellSidebarPlace) => ComponentChildren
  /** The phone bar's last slot's icon and counter; its words are `labels.more`. */
  moreTab?: RailShellMoreTab
  /** The page. Lands inside a `<main>`. */
  children: ComponentChildren
  labels?: RailShellLabels
  /** Utilities merged over the root element's own. */
  class?: string
}

/** `Rail`'s place under its earlier name. */
function oldPlace(place: RailPlace): RailShellSidebarPlace {
  return place === "sheet" ? "overlay" : "rail"
}

/** `<Rail variant="icons">` with `sidebarTop` and `sidebarBottom` as its `top` and `bottom`. */
export function RailShell(props: RailShellProps): JSX.Element {
  const { sidebarTop, sidebarBottom, ...rest } = props
  return (
    <Rail
      {...rest}
      variant="icons"
      top={sidebarTop && ((place) => sidebarTop(oldPlace(place)))}
      bottom={sidebarBottom && ((place) => sidebarBottom(oldPlace(place)))}
    />
  )
}
