/**
 * `Rail` — the house page frame's navigation: a 72 px column from `md` at every desktop width, and
 * below `md` a bottom tab bar of at most five slots whose last slot opens a sheet with the rest.
 *
 * Two variants share the column, the cells and the current style. `"icons"`, for apps, draws a
 * 48 px square per destination, names it with visually hidden text and shows the label as a tooltip
 * on hover and keyboard focus. `"labels"`, for a site whose first-time visitors do not know the
 * icons, draws a short label under each icon and has no tooltip, so it needs no script at all. On a
 * screen with no hover, such as a tablet, the icons variant draws the labels too, because a tooltip
 * cannot appear there.
 *
 * Props and ports only: items, the current key or path, the primary action and every label arrive
 * from the caller; a button item reaches the app's router through `navigate`, and a link item
 * through `navigateLink` when the caller passes one. The column and the tab bar switch at
 * Tailwind's `md` breakpoint in CSS, so the server render already carries both and nothing reads
 * the window while rendering.
 *
 * Apps draw `AppShell`, which builds on this; a site draws `Rail` with `variant="labels"` directly.
 *
 * @module
 */

import { cn } from "@spy4x/preact-cn"
import { type IconProps, IconXMark } from "@spy4x/preact-icons"
import { isPlainClick } from "@spy4x/preact-ui/link"
import type { ComponentChildren, ComponentType, JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import {
  countedName,
  CounterBadge,
  currentStates,
  Entry,
  entryCurrent,
  entryIdle,
  focusRing,
  hasCount,
  MoreDots,
  placeTip,
  rule,
  sectionRule,
  surface,
} from "./rail-parts.tsx"

/** {@link RailProps.variant}: icon cells with tooltips, or cells with a label under the icon. */
export type RailVariant = "icons" | "labels"

/**
 * How an entry is current: `"page"` when it is the page itself, `"true"` when the page is inside
 * its section, such as a note's page under Notes. It lands in `aria-current` as is.
 */
export type RailCurrent = "page" | "true"

/** One destination in {@link RailProps.items}, or the {@link RailProps.primary} action. */
export interface RailItem {
  /** Stable identity: compared with {@link RailProps.currentKey} and handed to the ports. */
  key: string
  /** The entry's accessible name: hidden text and a tooltip in the icons variant, visible else. */
  label: string
  /**
   * Rendered as a link when given, which is what keeps the rail working with no JavaScript. With
   * no `href` the entry is a button that calls {@link RailProps.navigate} with {@link key}.
   */
  href?: string
  /**
   * Drawn in the cell. A component rather than an element, because every entry is drawn in two
   * places, the column and the tab bar or its sheet, and one element can only be mounted once.
   */
  Icon?: ComponentType<IconProps>
  /**
   * A count drawn as a badge on the icon's top-right corner, at the end of the row in the sheet,
   * and spoken after the label in the entry's name ({@link RailLabels.counter}). Omitted for
   * `undefined`, `0` or a negative number; shown as "99+" past 99, while the name keeps the count.
   */
  counter?: number
  /** `data-*` attributes passed through to the link or button, such as an analytics hook. */
  attributes?: Record<`data-${string}`, string>
}

/**
 * Where a caller slot is being drawn: the desktop column, or the phone sheet. Each slot is called
 * once per place, because one element can only be mounted once.
 */
export type RailPlace = "rail" | "sheet"

/**
 * {@link RailProps.moreTab}: what the phone bar's last slot shows in place of the three dots, such
 * as the signed-in person's avatar, and a count on it.
 */
export interface RailMoreTab {
  /**
   * Drawn above the slot's label in place of the dots, hidden from assistive technology: the label
   * names the slot. An element, because the slot is drawn once.
   */
  icon?: ComponentChildren
  /** A count on the slot's corner, spoken in its name like {@link RailItem.counter}. */
  counter?: number
}

/** Every string `Rail` prints that is not data the caller supplied. */
export interface RailLabels {
  /** `aria-label` of the column's and the tab bar's `<nav>`. Defaults to `"Main navigation"`. */
  nav?: string
  /** `aria-label` of the column's `<aside>`. Defaults to `"Sidebar"`. */
  sidebar?: string
  /**
   * The tab bar's last slot, which opens the sheet. Defaults to `"More"`. An app whose sheet holds
   * the account sets `"Account"`, with {@link RailProps.moreTab} for its avatar.
   */
  more?: string
  /** The sheet's heading, which is also its accessible name. Defaults to {@link more}. */
  moreDialog?: string
  /** The sheet's close button's accessible name. Defaults to `"Close"`. */
  close?: string
  /** The skip link's visible text. Defaults to `"Skip to content"`. */
  skipToContent?: string
  /**
   * The words a counter adds to an entry's name, after its label and a comma. Defaults to the bare
   * number, so "Notifications, 3"; `(count) => \`${count} unread\`` gives "Notifications, 3 unread".
   */
  counter?: (count: number) => string
}

/** Everything `Rail` draws comes from here. Nothing is read from app state or the window. */
export interface RailProps {
  /** Icon cells with tooltips (`"icons"`, the default) or cells with labels (`"labels"`). */
  variant?: RailVariant
  /** The destinations, in display order. The first ones become tabs on a phone. */
  items: readonly RailItem[]
  /** The current item's key: `aria-current="page"`. */
  currentKey?: string
  /**
   * The current path. An entry whose `href` equals it is the page (`aria-current="page"`); with
   * none, the entry whose `href` is its longest prefix up to a `/` holds the page in its section
   * (`aria-current="true"`). Both get the same fill.
   */
  currentPath?: string
  /**
   * The one visually distinct action: pinned first in the column, and always a tab on a phone, in
   * the bar's centre slot. See {@link tabBarSlots}.
   */
  primary?: RailItem
  /** Port for an entry with no `href`: receives that entry's key. */
  navigate?: (key: string) => void
  /**
   * Port to the app's client router for an entry with an `href`. Given, a plain left click on that
   * link calls it with the entry's key and `href` and cancels the browser's own navigation. Every
   * other click, a middle click included, stays the browser's. Left out, every link is ordinary.
   */
  navigateLink?: (key: string, href: string) => void
  /**
   * The column's top zone, such as a workspace switcher's 40 px tile or a portrait, and the
   * sheet's first section. Called once per place.
   */
  top?: (place: RailPlace) => ComponentChildren
  /**
   * The column's bottom zone, such as the bell and the account menu, and the sheet's last section.
   * Called once per place. With `top` or `bottom` given, the bar keeps its last slot for the sheet.
   */
  bottom?: (place: RailPlace) => ComponentChildren
  /** The phone bar's last slot's icon and counter; its words are `labels.more`. */
  moreTab?: RailMoreTab
  /**
   * A one-line notice docked on top of the tab bar, inside the same sticky element, so it never
   * covers the page: an offline strip, for instance. Shown below `md` only.
   */
  tabBarNotice?: ComponentChildren
  /** The page. Lands inside a `<main>` this component owns, the skip link's target. */
  children: ComponentChildren
  labels?: RailLabels
  /** Utilities merged over the root element's own, e.g. `min-h-full` inside a bounded frame. */
  class?: string
}

/** The tab bar's slot count, the sheet's slot included. */
export const TAB_BAR_SLOTS = 5

/** What {@link tabBarSlots} decides for the phone bar. */
export interface TabBarSplit {
  /** Entries drawn as tabs, in order, the primary action among them in the centre. */
  tabs: RailItem[]
  /** Items behind the last slot, in order. Never the primary action. */
  more: RailItem[]
}

/**
 * Split the entries between the phone tab bar and its sheet.
 *
 * Every entry is a tab when the items plus the primary action number {@link TAB_BAR_SLOTS} or
 * fewer and `reserveMore` is off; then there is no sheet slot. Otherwise the last slot opens the
 * sheet, the primary action keeps a slot, and the first items fill the rest; the sheet holds the
 * items that did not fit. The primary action always takes the bar's centre slot (the left one of
 * the two middle slots in an even bar), so a phone reaches it with the thumb wherever it is.
 *
 * `reserveMore` keeps the last slot for the sheet whatever the count, for a sheet that holds more
 * than entries (`Rail`'s `top` and `bottom` slots): then at most four entries are tabs.
 */
export function tabBarSlots(
  items: readonly RailItem[],
  primary?: RailItem,
  reserveMore = false,
): TabBarSplit {
  const total = items.length + (primary ? 1 : 0)
  const sheetSlot = reserveMore || total > TAB_BAR_SLOTS
  const room = TAB_BAR_SLOTS - (sheetSlot ? 1 : 0) - (primary ? 1 : 0)
  const tabs = items.slice(0, room)
  const more = items.slice(room)
  if (primary) {
    const bar = tabs.length + 1 + (sheetSlot ? 1 : 0)
    tabs.splice(Math.floor((bar - 1) / 2), 0, primary)
  }
  return { tabs, more }
}

/** The attribute that hides the column's tooltips after Escape, until the next hover or focus. */
const TIPS_HIDDEN = "data-tips-hidden"

/**
 * The frame: a skip link, the desktop column from `md` up, the page in `<main>`, the phone tab bar
 * below `md`, and the sheet.
 *
 * **The column has three zones** inside an `<aside>` named by `labels.sidebar`: `top`, then the
 * primary action and the items in the `<nav>`, then `bottom`. Only the `<nav>` scrolls, on its own,
 * when the window is too short; the two other zones never move. The column is 72 px wide plus the
 * device's left safe-area inset, sticks to the top at the window's full height (`--rail-height`,
 * `100dvh` unless a caller that scrolls the frame inside a box of its own sets it), and is a column
 * in the layout, not a layer over the page.
 *
 * **The icons variant names its icons.** Each cell's label is visually hidden text, its name, and
 * shows as a tooltip 8 px past the column 300 ms after the pointer rests on the cell, or at once on
 * keyboard focus. Escape hides it without moving focus and without consuming the key; it comes
 * back on the next hover or focus. The tooltip is `fixed`, so the scrolling list does not clip it,
 * and it follows its cell when the list scrolls.
 *
 * **The current entry is a filled cell,** with `aria-current="page"` or `"true"` (see
 * {@link RailProps.currentPath}); under forced colours a 2 px outline marks it instead.
 *
 * **The tab bar** sticks to the bottom but keeps its place in the flow, pads itself by the device's
 * bottom inset, and below `md` gives the root element the preset's `pc-scroll-pb-tab-bar`, so a
 * control a person tabs to near the bottom scrolls into view above it.
 *
 * **The sheet is a modal `<dialog>`** holding `top`, the items that did not fit and `bottom`, with
 * a hairline between them. The last slot opens it with `showModal()`; Escape closes it natively, a
 * backdrop click closes it here, and so does choosing an entry, the close button, a plain click on
 * any link inside it, or a click on any element marked `data-rail-close`. Every way of closing ends
 * in the `close` event, which returns focus to the last slot. With no JavaScript, the last slot and
 * the close button still work in a browser that supports `command`/`commandfor` invokers, and
 * every entry with an `href` is a link.
 */
export function Rail(props: RailProps): JSX.Element {
  const {
    variant = "icons",
    items,
    currentKey,
    currentPath,
    primary,
    navigate,
    navigateLink,
    top,
    bottom,
    moreTab,
    tabBarNotice,
    children,
    labels,
    class: className,
  } = props
  const navLabel = labels?.nav ?? "Main navigation"
  const sidebarLabel = labels?.sidebar ?? "Sidebar"
  const moreLabel = labels?.more ?? "More"
  const dialogLabel = labels?.moreDialog ?? moreLabel
  const closeLabel = labels?.close ?? "Close"
  const skipLabel = labels?.skipToContent ?? "Skip to content"
  const counterWords = labels?.counter ?? String

  const contentId = useId()
  const dialogId = useId()
  const headingId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const columnRef = useRef<HTMLElement>(null)

  // Escape hides the column's tooltip while the pointer or focus is on the column; the key is not
  // consumed, so whatever else Escape does on the page still happens. One listener on `document`,
  // because a hovered hint is up while focus is anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const column = columnRef.current
      if (event.key !== "Escape" || !column) return
      if (column.matches(":hover") || column.contains(document.activeElement)) {
        column.setAttribute(TIPS_HIDDEN, "")
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])
  const showTips = () => columnRef.current?.removeAttribute(TIPS_HIDDEN)

  const hasSlots = top !== undefined || bottom !== undefined
  const { tabs, more } = tabBarSlots(items, primary, hasSlots)
  const hasSheet = more.length > 0 || hasSlots
  const states = currentStates(primary ? [primary, ...items] : items, currentKey, currentPath)
  const moreHoldsCurrent = more.some((item) => states.has(item))
  const close = () => dialogRef.current?.close()
  const entryPorts = { navigate, navigateLink, counterWords, variant }
  const zonePad = variant === "labels" ? "px-1" : "px-3 [@media(hover:none)]:px-1"

  return (
    <div
      class={cn(
        "flex min-h-dvh flex-col md:flex-row max-md:[:root:has(&)]:pc-scroll-pb-tab-bar",
        className,
      )}
      data-rail-variant={variant}
    >
      <a
        href={`#${contentId}`}
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-surface,oklch(1_0_0))] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
        data-e2e="rail-shell-skip-link"
      >
        {skipLabel}
      </a>

      <aside
        ref={columnRef}
        aria-label={sidebarLabel}
        class={cn("group/rail hidden shrink-0 border-r pl-safe md:block", rule, surface)}
        onFocusIn={(event) => {
          placeTip(event.target, columnRef.current)
          showTips()
        }}
        onPointerOver={(event) => placeTip(event.target, columnRef.current)}
        onPointerOut={(event) => {
          // Leaving a cell, not moving between the parts inside it, makes the next hover fresh.
          const cell = (event.target as Element).closest?.("[data-rail-cell]")
          if (cell && !cell.contains(event.relatedTarget as Node | null)) showTips()
        }}
        data-e2e="rail-shell-column"
      >
        <div class="sticky top-0 z-20 flex h-[var(--rail-height,100dvh)] w-18 flex-col py-3">
          {top && (
            <div
              class={cn("mb-4 flex shrink-0 flex-col items-center", zonePad)}
              data-e2e="rail-shell-top"
            >
              {top("rail")}
            </div>
          )}
          <nav
            aria-label={navLabel}
            class={cn(
              "flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-1 [scrollbar-width:thin]",
              zonePad,
            )}
            // A shown tooltip follows its cell when the list scrolls, as it does when focus moves
            // to a cell out of view.
            onScroll={(event) =>
              event.currentTarget.querySelectorAll("[data-rail-tip][data-placed]").forEach((tip) =>
                placeTip(tip, columnRef.current)
              )}
            data-e2e="rail-shell-rail"
          >
            {primary && (
              <Entry
                item={primary}
                place="rail"
                current={states.get(primary)}
                primary
                {...entryPorts}
              />
            )}
            <ul class="flex flex-col items-center gap-1">
              {items.map((item, index) => (
                <li key={`${index}-${item.key}`}>
                  <Entry
                    item={item}
                    place="rail"
                    current={states.get(item)}
                    primary={false}
                    {...entryPorts}
                  />
                </li>
              ))}
            </ul>
          </nav>
          {bottom && (
            <div
              class={cn("flex shrink-0 flex-col items-center gap-1 pt-1", zonePad)}
              data-e2e="rail-shell-bottom"
            >
              {bottom("rail")}
            </div>
          )}
        </div>
      </aside>

      <main
        id={contentId}
        tabindex={-1}
        class="min-w-0 flex-1 focus:outline-none"
        data-e2e="rail-shell-content"
      >
        {children}
      </main>

      <div class="sticky bottom-0 z-10 shrink-0 md:hidden" data-e2e="rail-shell-dock">
        {tabBarNotice}
        <nav
          aria-label={navLabel}
          class={cn("border-t pb-safe", rule, surface)}
          data-e2e="rail-shell-tabbar"
        >
          <ul class="flex min-h-16">
            {tabs.map((item, index) => (
              <li
                key={`${index}-${item.key}`}
                class="min-w-0 flex-1 px-px py-1 first:pl-1 last:pr-1"
              >
                <Entry
                  item={item}
                  place="tab"
                  current={states.get(item)}
                  primary={item === primary}
                  {...entryPorts}
                />
              </li>
            ))}
            {hasSheet && (
              <li class="min-w-0 flex-1 px-px py-1 first:pl-1 last:pr-1">
                <button
                  ref={moreRef}
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls={dialogId}
                  aria-label={countedName(moreLabel, moreTab?.counter, counterWords)}
                  command="show-modal"
                  commandfor={dialogId}
                  class={cn(
                    "relative flex h-full w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-primary,0.5rem)] px-0 py-1 text-center text-xs font-medium",
                    focusRing,
                    moreHoldsCurrent ? entryCurrent : entryIdle,
                  )}
                  onClick={(event) => {
                    event.preventDefault()
                    const dialog = dialogRef.current
                    if (dialog && !dialog.open) dialog.showModal()
                  }}
                  data-e2e="rail-shell-more"
                >
                  {moreTab?.icon === undefined ? <MoreDots /> : (
                    <span
                      class="flex size-6 shrink-0 items-center justify-center"
                      aria-hidden="true"
                    >
                      {moreTab.icon}
                    </span>
                  )}
                  <span class="min-w-0 max-w-full truncate tracking-tight">{moreLabel}</span>
                  {hasCount(moreTab?.counter) && (
                    <CounterBadge count={moreTab.counter} place="tab" />
                  )}
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>

      {hasSheet && (
        <dialog
          ref={dialogRef}
          id={dialogId}
          aria-labelledby={headingId}
          class={cn(
            "m-0 mt-auto max-h-[80dvh] w-full max-w-none rounded-t-[var(--radius-card,0.75rem)] border-t p-0 text-[inherit] backdrop:bg-scrim backdrop:opacity-80",
            rule,
            surface,
          )}
          onClick={(event) => {
            if (event.target === dialogRef.current) return close()
            const target = event.target as Element
            // A link leaves this page as an entry does, so the sheet closes; a modified click opens
            // elsewhere and leaves it open. A caller's own control asks with `data-rail-close`.
            if (target.closest?.("[data-rail-close]")) return close()
            const link = target.closest?.("a[href]")
            if (link && isPlainClick(event)) close()
          }}
          onClose={() => moreRef.current?.focus()}
          data-e2e="rail-shell-dialog"
        >
          <div class="flex flex-col gap-2 p-3 pb-safe-3">
            <div class="flex items-center justify-between gap-2">
              <h2 id={headingId} class="px-3 text-sm font-semibold">{dialogLabel}</h2>
              <button
                type="button"
                aria-label={closeLabel}
                command="close"
                commandfor={dialogId}
                class={cn(
                  "flex size-11 cursor-pointer items-center justify-center rounded-md",
                  focusRing,
                  entryIdle,
                )}
                onClick={(event) => {
                  event.preventDefault()
                  close()
                }}
                data-e2e="rail-shell-close"
              >
                <span class="flex" aria-hidden="true">
                  <IconXMark class="size-5" />
                </span>
              </button>
            </div>
            <div class={cn("flex flex-col", sectionRule)}>
              {top && (
                <div class="py-2 first:pt-0" data-e2e="rail-shell-overlay-top">{top("sheet")}</div>
              )}
              {more.length > 0 && (
                <ul class="flex flex-col gap-1 py-2 first:pt-0">
                  {more.map((item, index) => (
                    <li key={`${index}-${item.key}`}>
                      <Entry
                        item={item}
                        place="sheet"
                        current={states.get(item)}
                        primary={false}
                        onChoose={close}
                        {...entryPorts}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {bottom && (
                <div class="py-2 first:pt-0" data-e2e="rail-shell-overlay-bottom">
                  {bottom("sheet")}
                </div>
              )}
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
