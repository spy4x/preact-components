/**
 * `RailShell` — a third page frame beside `Shell` and `SiteHeader`: a labelled sidebar from `lg`, a
 * narrower rail of icons with tooltips from `md` to `lg`, both with a pinned primary action and
 * optional caller zones at their top and bottom, and a bottom tab bar of at most five slots on a
 * phone, whose last slot, "More", opens a native `<dialog>` holding whatever did not fit.
 *
 * It differs from its two siblings in shape, not in rules. `Shell` is a signed-in app's header,
 * side navigation and `<details>` drawer; `SiteHeader` is a public site's top bar collapsing into
 * the same kind of `<details>` panel. Neither has a rail or a bottom tab bar, so this is a new
 * component rather than a mode of either. The overflow uses a modal `<dialog>` — the pattern
 * `ui/lightbox.tsx` already relies on — because a modal gets Escape,
 * inert background content and a top layer from the browser, where the `<details>` disclosure the
 * other two shells share would have to rebuild all three.
 *
 * Props and ports only: items, the current key or path, the primary action and every label arrive
 * from the caller; a button item reaches the app's router through the `navigate` port, and a link
 * item reaches it through the `navigateLink` port when the caller passes one. The rail and
 * the tab bar switch at Tailwind's `md` breakpoint in CSS, so the server render already carries both
 * and nothing reads the window while rendering. Every colour is a theme token read through `var()`
 * with the default palette's value as its fallback — the same pattern `theme/preset.css` uses — so
 * the shell follows whichever palette the page sets and still draws without the preset, keeping
 * this package free of a `theme/` dependency.
 */

import { cn } from "@spy4x/preact-cn"
import { type IconProps, IconXMark } from "@spy4x/preact-icons"
import { followLinkClick, isPlainClick } from "@spy4x/preact-ui/link"
import type { ComponentChildren, ComponentType, JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { isCurrentLink } from "./site-header.tsx"

/** One destination in {@link RailShellProps.items}, or the {@link RailShellProps.primary} action. */
export interface RailShellItem {
  /** Stable identity: compared with {@link RailShellProps.currentKey} and handed to `navigate`. */
  key: string
  /** Visible text under the icon, and the entry's accessible name. */
  label: string
  /**
   * Rendered as a link when given, which is what keeps the shell working with no JavaScript. With
   * no `href` the entry is a button that calls {@link RailShellProps.navigate} with {@link key}.
   */
  href?: string
  /**
   * Drawn above the label. A component rather than an element, because every entry is drawn in two
   * places — the rail and the tab bar or its overlay — and one element can only be mounted once.
   */
  Icon?: ComponentType<IconProps>
  /**
   * A count drawn as a badge, such as unread notifications: on the icon's corner in the rail and
   * the tab bar, at the end of the row in the sidebar and the overlay. It is also spoken, after
   * the label, in the entry's accessible name ({@link RailShellLabels.counter}). Omitted for
   * `undefined`, `0` or a negative number; shown as "99+" past 99, while the name keeps the count.
   */
  counter?: number
}

/**
 * Where a sidebar slot is being drawn: the labelled sidebar from `lg`, the icon rail from `md` to
 * `lg`, or the phone overlay. `Shell`'s `ShellSidebarPlace` names its own two places.
 */
export type RailShellSidebarPlace = "sidebar" | "rail" | "overlay"

/**
 * {@link RailShellProps.moreTab}: what the phone bar's last slot shows in place of the three dots,
 * such as the signed-in person's avatar, and a count on it.
 */
export interface RailShellMoreTab {
  /**
   * Drawn above the slot's label in place of the dots, hidden from assistive technology: the
   * label names the slot. An element, because the slot is drawn once.
   */
  icon?: ComponentChildren
  /** A count on the slot's corner, spoken in its name like {@link RailShellItem.counter}. */
  counter?: number
}

/** Every string `RailShell` prints that is not data the caller supplied. */
export interface RailShellLabels {
  /** `aria-label` of the rail's and the tab bar's `<nav>`. Defaults to `"Main navigation"`. */
  nav?: string
  /**
   * `aria-label` of the desktop column's `<aside>`, the landmark that holds the slots and the
   * navigation. Defaults to `"Sidebar"`.
   */
  sidebar?: string
  /**
   * The tab bar's last slot, which opens the overlay. Defaults to `"More"`. An app whose overlay
   * holds the account sets `"Account"`, with {@link RailShellProps.moreTab} for its avatar.
   */
  more?: string
  /** The overlay's heading, which is also its accessible name. Defaults to `"More"`. */
  moreDialog?: string
  /** The overlay's close button's accessible name. Defaults to `"Close"`. */
  close?: string
  /** The skip link's visible text. Defaults to `"Skip to content"`. */
  skipToContent?: string
  /**
   * The words a counter adds to an entry's accessible name, after its label and a comma. Defaults
   * to the bare number, so "Notifications, 3"; `(count) => \`${count} unread\`` gives
   * "Notifications, 3 unread".
   */
  counter?: (count: number) => string
}

/**
 * Everything `RailShell` draws comes from here: the destinations, which one is current, the primary
 * action, the `navigate` port for entries without an `href` and the `navigateLink` port for entries
 * with one, the page itself, and every label.
 * Nothing is read from app state or the window.
 */
export interface RailShellProps {
  /** The destinations, in display order. The first four become tabs when the phone bar overflows. */
  items: readonly RailShellItem[]
  /** The current item's key. Marks it with `aria-current="page"`. */
  currentKey?: string
  /** Compared with every `href` by exact equality, like `Shell`'s `currentPath`. */
  currentPath?: string
  /**
   * The one visually distinct action: pinned at the top of the rail, and on a phone either the
   * bar's last slot or the first entry of the overlay — see {@link tabBarSlots}.
   */
  primary?: RailShellItem
  /** Port for an entry with no `href`: receives that entry's key. */
  navigate?: (key: string) => void
  /**
   * Port to the app's client router for an entry with an `href`. Given, a plain left click on that
   * link — primary button, no Ctrl, Meta, Shift or Alt, nothing earlier cancelled it, and the link
   * points at this page's origin — calls it with the entry's key and `href` and cancels the
   * browser's own navigation. Every other click, a middle click included, stays the browser's, so
   * "open in a new tab" still works. Left out, every link is an ordinary link.
   */
  navigateLink?: (key: string, href: string) => void
  /**
   * Caller content at the top of the desktop column, such as a workspace switcher, and at the top
   * of the phone overlay. Called once per place, because one element can only be mounted in one
   * place; use `place` to keep ids unique and to draw a compact form in the 72 px rail.
   */
  sidebarTop?: (place: RailShellSidebarPlace) => ComponentChildren
  /**
   * Caller content pinned to the bottom of the desktop column, such as notifications and
   * `AccountMenu`, and at the end of the phone overlay. Called once per place, like `sidebarTop`.
   */
  sidebarBottom?: (place: RailShellSidebarPlace) => ComponentChildren
  /** The phone bar's last slot's icon and counter; its words are `labels.more`. */
  moreTab?: RailShellMoreTab
  /**
   * The app's own top bar — brand, pickers, the user menu. The house layout has none: the
   * sidebar's slots hold those. Rendered in a `<header>` above `<main>`
   * and outside it, so it is the page's banner landmark and the skip link jumps past it. Left out,
   * there is no `<header>`.
   */
  header?: ComponentChildren
  /** The page. Lands inside a `<main>` this component owns, the skip link's target. */
  children: ComponentChildren
  labels?: RailShellLabels
  /** Utilities merged over the root element's own, e.g. `min-h-full` inside a bounded frame. */
  class?: string
}

/** The tab bar's slot count, "More" included. */
export const TAB_BAR_SLOTS = 5

/** What {@link tabBarSlots} decides for the phone bar. */
export interface TabBarSplit {
  /** Entries drawn as tabs, in order. The primary action is among them only when everything fits. */
  tabs: RailShellItem[]
  /** Entries behind "More", primary action first. Empty means the bar has no "More" slot. */
  more: RailShellItem[]
}

/**
 * Split the entries between the phone tab bar and its "More" overlay.
 *
 * Every entry fits when the items plus the primary action number {@link TAB_BAR_SLOTS} or fewer,
 * and then there is no "More". Otherwise the first four items are tabs and "More" holds the primary
 * action followed by the remaining items. Counting the primary action is what keeps it reachable on
 * a phone in every case: with exactly five items and a primary action, a bar that showed all five
 * items would have no slot left for it.
 *
 * `reserveMore` keeps the last slot for "More" whatever the count, for an overlay that holds
 * more than entries (`RailShell`'s sidebar slots): then only four entries fit as tabs.
 */
export function tabBarSlots(
  items: readonly RailShellItem[],
  primary?: RailShellItem,
  reserveMore = false,
): TabBarSplit {
  const entries = primary ? [...items, primary] : [...items]
  const room = reserveMore ? TAB_BAR_SLOTS - 1 : TAB_BAR_SLOTS
  if (entries.length <= room) return { tabs: entries, more: [] }
  const tabs = items.slice(0, TAB_BAR_SLOTS - 1)
  const rest = items.slice(TAB_BAR_SLOTS - 1)
  return { tabs, more: primary ? [primary, ...rest] : rest }
}

/** Whether an entry is the current page, by key or by path. */
function isCurrent(
  item: RailShellItem,
  currentKey: string | undefined,
  currentPath: string | undefined,
): boolean {
  if (currentKey !== undefined && item.key === currentKey) return true
  return item.href !== undefined && isCurrentLink(item.href, currentPath)
}

/** Whether a counter is drawn at all: a positive number. */
function hasCount(counter: number | undefined): counter is number {
  return typeof counter === "number" && counter > 0
}

/**
 * Where an entry is drawn; each place lays out the icon and label differently. `rail` is the
 * desktop column, which is an icon rail from `md` and a labelled sidebar from `lg`.
 */
type Place = "rail" | "tab" | "sheet"

const entryBase =
  "flex min-w-0 cursor-pointer items-center rounded-md text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
const entryPlace: Record<Place, string> = {
  rail:
    "group/entry relative w-full flex-col justify-center gap-1 px-1 py-3 text-center lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 lg:text-left lg:text-sm",
  // No side padding in a tab, and 1 px on each side of its `<li>`: the 4 px each used to take made
  // a nine-letter label such as "Dashboard" truncate in a fifth of a 390 px bar. The bar's two
  // outer ends keep 4 px, so the first and last tabs' focus ring stays on screen.
  tab: "relative h-full w-full flex-col justify-center gap-1 px-0 py-1 text-center",
  sheet: "w-full gap-3 px-3 py-3 text-sm",
}
/** The label beside or under the icon. In the rail, an entry with an icon names itself silently. */
const labelPlace: Record<Place, (hasIcon: boolean) => string> = {
  rail: (hasIcon) =>
    hasIcon
      ? "max-lg:sr-only lg:min-w-0 lg:flex-1 lg:truncate"
      : "min-w-0 max-w-full line-clamp-2 break-words lg:flex-1 lg:line-clamp-none lg:truncate",
  tab: () => "min-w-0 max-w-full truncate tracking-tight",
  sheet: () => "min-w-0 flex-1 truncate",
}
/** The counter's badge: on the icon's corner in the rail and the tab bar, at the row's end else. */
const badgePlace: Record<Place, string> = {
  rail: "max-lg:absolute max-lg:top-1 max-lg:left-1/2 max-lg:ml-2 lg:ml-auto",
  tab: "absolute top-1 left-1/2 ml-2",
  sheet: "ml-auto",
}
const surface = "bg-[var(--color-surface,oklch(1_0_0))]"
const rule = "border-[color:var(--color-border-subtle,oklch(0.928_0.006_264.531))]"
const entryIdle =
  "text-[color:var(--color-muted-foreground,oklch(0.551_0.027_264.364))] hover:bg-[var(--color-canvas,oklch(0.985_0.002_247.839))]"
const entryCurrent = "bg-[var(--color-canvas,oklch(0.985_0.002_247.839))] font-semibold"
const entryPrimary =
  "bg-[var(--color-primary,oklch(0.381_0.176_304.987))] text-[color:var(--color-primary-foreground,oklch(0.977_0.014_308.299))] hover:opacity-90"
const badge =
  "h-5 min-w-5 shrink-0 rounded-full bg-[var(--color-primary,oklch(0.381_0.176_304.987))] px-1 text-center text-xs leading-5 font-semibold text-[color:var(--color-primary-foreground,oklch(0.977_0.014_308.299))]"
/**
 * The rail's tooltip: shown on hover and keyboard focus between `md` and `lg` only, where the label
 * is not drawn. Escape hides it through the column's `data-tips-hidden` (see `RailShell`).
 *
 * It is `fixed`, so the scrolling list does not clip it, at the entry's right edge and vertical
 * middle, which `placeTip` writes onto the entry as `--rail-tip-x` and `--rail-tip-y` on hover and
 * focus. Before hydration nothing writes them, and it is not shown. The surface's left padding is
 * a bridge, so the pointer can rest on the hint.
 */
const tooltipSurface =
  "fixed top-[var(--rail-tip-y)] left-[var(--rail-tip-x)] z-40 hidden -translate-y-1/2 pl-2 group-data-[tip-placed]/entry:group-hover/entry:block group-data-[tip-placed]/entry:group-focus-visible/entry:block group-data-[tips-hidden]/rail:invisible lg:hidden!"
const tooltipBubble =
  "block whitespace-nowrap rounded-md bg-[var(--color-foreground,oklch(0.13_0.028_261.692))] px-2 py-1 text-xs font-medium text-[color:var(--color-canvas,oklch(0.967_0.003_264.542))]"

/** "99+" past 99: a badge has room for three characters. The accessible name keeps the count. */
function badgeText(count: number): string {
  return count > 99 ? "99+" : String(count)
}

/**
 * An entry's accessible name with its count, "Notes, 3", or `undefined` without a count, so the
 * entry is named by its content. An `aria-label` rather than hidden text after the label: Chromium
 * joins a visually hidden (absolutely positioned) span to the name with a space, "Notes , 3".
 */
function countedName(
  label: string,
  count: number | undefined,
  counterWords: (count: number) => string,
): string | undefined {
  return hasCount(count) ? `${label}, ${counterWords(count)}` : undefined
}

/** A counter as the eye gets it: a badge hidden from assistive technology. */
function CounterBadge({ count, place }: { count: number; place: Place }): JSX.Element {
  return (
    <span class={cn(badge, badgePlace[place])} aria-hidden="true" data-e2e="rail-shell-counter">
      {badgeText(count)}
    </span>
  )
}

/**
 * One entry: a link when it has an `href`, followed through `navigateLink` on a plain click when
 * that port is given, and a button through `navigate` otherwise.
 */
function Entry(
  { item, place, current, primary, navigate, navigateLink, onChoose, counterWords }: {
    item: RailShellItem
    place: Place
    current: boolean
    primary: boolean
    navigate?: (key: string) => void
    navigateLink?: (key: string, href: string) => void
    /** Runs after the entry is chosen — the overlay closes itself through this. */
    onChoose?: () => void
    counterWords: (count: number) => string
  },
): JSX.Element {
  const { Icon, label, href, key, counter } = item
  const name = countedName(label, counter, counterWords)
  const className = cn(
    entryBase,
    entryPlace[place],
    primary ? entryPrimary : current ? entryCurrent : entryIdle,
  )
  const content = (
    <>
      {Icon && (
        <span class="flex shrink-0" aria-hidden="true">
          <Icon class="size-6" />
        </span>
      )}
      <span class={labelPlace[place](Icon !== undefined)}>{label}</span>
      {hasCount(counter) && <CounterBadge count={counter} place={place} />}
      {place === "rail" && Icon && (
        <span class={tooltipSurface} aria-hidden="true" data-e2e="rail-shell-tooltip">
          <span class={tooltipBubble}>{label}</span>
        </span>
      )}
    </>
  )

  if (href !== undefined) {
    return (
      <a
        href={href}
        aria-current={current ? "page" : undefined}
        aria-label={name}
        class={className}
        onClick={(event) => {
          // The anchor's own address, as the browser would follow it, decides the origin test.
          followLinkClick(event, {
            href: event.currentTarget.href,
            navigate: navigateLink && (() => navigateLink(key, href)),
          })
          onChoose?.()
        }}
        data-e2e="rail-shell-entry"
      >
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      aria-label={name}
      class={className}
      onClick={() => {
        navigate?.(key)
        onChoose?.()
      }}
      data-e2e="rail-shell-entry"
    >
      {content}
    </button>
  )
}

/** Dots for the "More" slot; drawn here so the package gains no icon it does not already have. */
function MoreDots(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" class="size-6 shrink-0" aria-hidden="true">
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  )
}

/** The attribute that hides the rail's tooltips after Escape, until the next hover or focus. */
const TIPS_HIDDEN = "data-tips-hidden"

/**
 * Write where the rail's tooltip goes onto the entry under `target`, if any: its right edge and
 * vertical middle in the window, read when the hint is about to show, so a scrolled list or page
 * never leaves it behind. `data-tip-placed` lets the tooltip show once the place is written.
 */
function placeTip(target: EventTarget | null): void {
  const entry = (target as Element | null)?.closest?.(`[data-e2e="rail-shell-entry"]`)
  if (!(entry instanceof HTMLElement)) return
  const box = entry.getBoundingClientRect()
  entry.style.setProperty("--rail-tip-x", `${box.right}px`)
  entry.style.setProperty("--rail-tip-y", `${box.top + box.height / 2}px`)
  entry.setAttribute("data-tip-placed", "")
}

/**
 * The frame: a skip link, the desktop column from `md` up, the caller's `header` above the page,
 * the page in `<main>`, the phone tab bar below `md`, and the "More" overlay.
 *
 * **The desktop column has three zones,** inside an `<aside>` named by `labels.sidebar`, so the
 * slots' controls sit in a landmark as the navigation does. `sidebarTop` at the top, the primary
 * action and the
 * items in the `<nav>` between, `sidebarBottom` at the bottom. The column sticks to the top at the
 * window's full height (`--rail-shell-height`, `100dvh` unless a caller sets it), so the bottom
 * zone stays in view on a long page; from `lg` the `<nav>` scrolls on its own when the items do
 * not fit. The column is a 72 px rail of icons from `md` and a 240 px sidebar with labels from
 * `lg`. Each slot is called once per place it is drawn, `"rail"` and `"sidebar"` here and
 * `"overlay"` on a phone, and CSS shows the one that fits the width, so the server render already
 * carries both. A caller that scrolls the shell inside a box of its own sets
 * `--rail-shell-height` to that box's height.
 *
 * **The rail names its icons.** Between `md` and `lg` an entry with an icon hides its label
 * visually, keeps it as its accessible name, and shows it as a tooltip on hover and on keyboard
 * focus. Escape hides the tooltip without moving focus, and it comes back on the next hover or
 * focus. The list between the two slots scrolls on its own when the window is too short for it,
 * as on a phone held sideways; the tooltip is `fixed`, so the scroll box does not clip it.
 *
 * **The header is a banner, and the skip link skips it.** `header` lands in a `<header>` that sits
 * beside `<main>`, never inside it, so placed at page level it is the document's banner landmark.
 * The skip link comes first in tab order and targets `<main>`, so one Enter moves focus past the
 * desktop column and the header's controls straight to the page.
 *
 * **Nothing overlaps the page.** The desktop column is a column in the layout, not a fixed layer.
 * The tab bar sticks to the bottom but keeps its place in the flow, so the page's last line always
 * ends above it, and it pads itself by the device's bottom safe-area inset. Below `md` the shell
 * also gives the root element a bottom scroll padding of the bar's height (the preset's
 * `pc-scroll-pb-tab-bar`), so a control a person tabs to near the bottom of the window scrolls
 * into view above the bar instead of behind it. That holds when the window scrolls the page, which
 * is how a page frame is used; a caller that scrolls the shell inside a box of its own sets the
 * same utility on that box.
 *
 * **The overlay is a modal `<dialog>`.** It holds `sidebarTop`, the entries that did not fit and
 * `sidebarBottom`; with either slot given, the bar keeps its last slot for it even when every
 * entry would fit. "More" opens it with `showModal()`, which moves focus to the first control
 * inside it; Escape closes it natively; a click on the backdrop closes it here, which works because
 * the dialog has no padding and its content fills it, so only a backdrop click has the dialog
 * itself as its target. Choosing an entry, the close button, or a plain click on any link inside
 * it closes it too. Every way of closing ends in the `close` event, whose handler returns focus to
 * "More". Chromium also restores focus to "More" by itself when a modal dialog closes, so in
 * Chromium no check can tell the component's part from the browser's; the handler is there for
 * engines that do not. With no JavaScript, "More" and the close button still work in a browser
 * that supports `command`/`commandfor` invokers — `pages/checks/system.ts` proves it in Chromium
 * with script execution disabled — and every entry with an `href` is a link.
 */
export function RailShell(props: RailShellProps): JSX.Element {
  const {
    items,
    currentKey,
    currentPath,
    primary,
    navigate,
    navigateLink,
    sidebarTop,
    sidebarBottom,
    moreTab,
    header,
    children,
    labels,
    class: className,
  } = props
  const navLabel = labels?.nav ?? "Main navigation"
  const sidebarLabel = labels?.sidebar ?? "Sidebar"
  const moreLabel = labels?.more ?? "More"
  const dialogLabel = labels?.moreDialog ?? "More"
  const closeLabel = labels?.close ?? "Close"
  const skipLabel = labels?.skipToContent ?? "Skip to content"
  const counterWords = labels?.counter ?? String

  const contentId = useId()
  const dialogId = useId()
  const headingId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const columnRef = useRef<HTMLElement>(null)

  // Escape hides the rail's tooltip while the pointer or focus is on the column; the key is not
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

  const hasSlots = sidebarTop !== undefined || sidebarBottom !== undefined
  const { tabs, more } = tabBarSlots(items, primary, hasSlots)
  const hasOverlay = more.length > 0 || hasSlots
  const moreHoldsCurrent = more.some((item) =>
    item !== primary && isCurrent(item, currentKey, currentPath)
  )
  const close = () => dialogRef.current?.close()
  const entryPorts = { navigate, navigateLink, counterWords }

  return (
    <div
      class={cn(
        "flex min-h-dvh flex-col md:flex-row max-md:[:root:has(&)]:pc-scroll-pb-tab-bar",
        className,
      )}
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
        class={cn("group/rail hidden shrink-0 border-r md:block md:w-18 lg:w-60", rule, surface)}
        onFocusIn={(event) => {
          placeTip(event.target)
          showTips()
        }}
        onPointerOver={(event) => placeTip(event.target)}
        onPointerOut={(event) => {
          // Leaving an entry, not moving between the parts inside it, makes the next hover fresh.
          const entry = (event.target as Element).closest?.(`[data-e2e="rail-shell-entry"]`)
          if (entry && !entry.contains(event.relatedTarget as Node | null)) showTips()
        }}
        data-e2e="rail-shell-column"
      >
        <div class="sticky top-0 z-20 flex h-[var(--rail-shell-height,100dvh)] flex-col gap-2 p-2">
          {sidebarTop && (
            <div class="shrink-0" data-e2e="rail-shell-top">
              <div class="lg:hidden">{sidebarTop("rail")}</div>
              <div class="max-lg:hidden">{sidebarTop("sidebar")}</div>
            </div>
          )}
          <nav
            aria-label={navLabel}
            class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1"
            // A shown tooltip follows its entry when the list scrolls, as it does when focus moves
            // to an entry out of view.
            onScroll={(event) =>
              event.currentTarget.querySelectorAll("[data-tip-placed]").forEach(placeTip)}
            data-e2e="rail-shell-rail"
          >
            {primary && (
              <Entry
                item={primary}
                place="rail"
                current={isCurrent(primary, currentKey, currentPath)}
                primary
                {...entryPorts}
              />
            )}
            <ul class="flex flex-col gap-1">
              {items.map((item, index) => (
                <li key={`${index}-${item.key}`}>
                  <Entry
                    item={item}
                    place="rail"
                    current={isCurrent(item, currentKey, currentPath)}
                    primary={false}
                    {...entryPorts}
                  />
                </li>
              ))}
            </ul>
          </nav>
          {sidebarBottom && (
            <div class="shrink-0" data-e2e="rail-shell-bottom">
              <div class="lg:hidden">{sidebarBottom("rail")}</div>
              <div class="max-lg:hidden">{sidebarBottom("sidebar")}</div>
            </div>
          )}
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        {header !== undefined && <header data-e2e="rail-shell-header">{header}</header>}
        <main
          id={contentId}
          tabindex={-1}
          class="min-w-0 flex-1 focus:outline-none"
          data-e2e="rail-shell-content"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label={navLabel}
        class={cn(
          "sticky bottom-0 z-10 shrink-0 border-t pb-safe md:hidden",
          rule,
          surface,
        )}
        data-e2e="rail-shell-tabbar"
      >
        <ul class="flex min-h-16">
          {tabs.map((item, index) => (
            <li key={`${index}-${item.key}`} class="min-w-0 flex-1 px-px py-1 first:pl-1 last:pr-1">
              <Entry
                item={item}
                place="tab"
                current={isCurrent(item, currentKey, currentPath)}
                primary={item === primary}
                {...entryPorts}
              />
            </li>
          ))}
          {hasOverlay && (
            <li class="min-w-0 flex-1 px-px py-1 first:pl-1 last:pr-1">
              <button
                ref={moreRef}
                type="button"
                aria-haspopup="dialog"
                aria-controls={dialogId}
                aria-label={countedName(moreLabel, moreTab?.counter, counterWords)}
                command="show-modal"
                commandfor={dialogId}
                class={cn(entryBase, entryPlace.tab, moreHoldsCurrent ? entryCurrent : entryIdle)}
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
                {hasCount(moreTab?.counter) && <CounterBadge count={moreTab.counter} place="tab" />}
              </button>
            </li>
          )}
        </ul>
      </nav>

      {hasOverlay && (
        <dialog
          ref={dialogRef}
          id={dialogId}
          aria-labelledby={headingId}
          class={cn(
            "m-0 mt-auto max-h-[80dvh] w-full max-w-none rounded-t-lg border-t p-0 text-[inherit] backdrop:bg-scrim backdrop:opacity-80",
            rule,
            surface,
          )}
          onClick={(event) => {
            if (event.target === dialogRef.current) return close()
            // A link in a caller's slot leaves this page as an entry does, so the sheet closes;
            // a modified click opens elsewhere and leaves it open.
            const link = (event.target as Element).closest?.("a[href]")
            if (link && isPlainClick(event)) close()
          }}
          onClose={() => moreRef.current?.focus()}
          data-e2e="rail-shell-dialog"
        >
          <div class="flex flex-col gap-2 p-3 pb-safe-3">
            <div class="flex items-center justify-between gap-2">
              <h2 id={headingId} class="px-2 text-sm font-semibold">{dialogLabel}</h2>
              <button
                type="button"
                aria-label={closeLabel}
                command="close"
                commandfor={dialogId}
                class={cn(
                  "flex size-10 cursor-pointer items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2",
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
            {sidebarTop && <div data-e2e="rail-shell-overlay-top">{sidebarTop("overlay")}</div>}
            {more.length > 0 && (
              <ul class="flex flex-col gap-1">
                {more.map((item, index) => (
                  <li key={`${index}-${item.key}`}>
                    <Entry
                      item={item}
                      place="sheet"
                      current={isCurrent(item, currentKey, currentPath)}
                      primary={item === primary}
                      onChoose={close}
                      {...entryPorts}
                    />
                  </li>
                ))}
              </ul>
            )}
            {sidebarBottom && (
              <div data-e2e="rail-shell-overlay-bottom">{sidebarBottom("overlay")}</div>
            )}
          </div>
        </dialog>
      )}
    </div>
  )
}
