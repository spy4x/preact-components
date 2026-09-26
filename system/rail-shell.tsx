/**
 * `RailShell` — a third page frame beside `Shell` and `SiteHeader`: a vertical rail of
 * icon-over-label items with a pinned primary action on wide screens, and a bottom tab bar of at
 * most five slots on a phone, whose last slot, "More", opens a native `<dialog>` holding whatever
 * did not fit.
 *
 * It differs from its two siblings in shape, not in rules. `Shell` is a signed-in app's header,
 * side navigation and `<details>` drawer; `SiteHeader` is a public site's top bar collapsing into
 * the same kind of `<details>` panel. Neither has a rail or a bottom tab bar, so this is a new
 * component rather than a mode of either. The overflow uses a modal `<dialog>` — the pattern
 * `image-lightbox.tsx` (through `ui/lightbox.tsx`) already relies on — because a modal gets Escape,
 * inert background content and a top layer from the browser, where the `<details>` disclosure the
 * other two shells share would have to rebuild all three.
 *
 * Props and ports only: items, the current key or path, the primary action and every label arrive
 * from the caller; a button item reaches the app's router through the `navigate` port. The rail and
 * the tab bar switch at Tailwind's `md` breakpoint in CSS, so the server render already carries both
 * and nothing reads the window while rendering. Every colour is a theme token read through `var()`
 * with the default palette's value as its fallback — the same pattern `theme/preset.css` uses — so
 * the shell follows whichever palette the page sets and still draws without the preset, keeping
 * this package free of a `theme/` dependency.
 */

import { cn } from "@spy4x/preact-cn"
import { type IconProps, IconXMark } from "@spy4x/preact-icons"
import type { ComponentChildren, ComponentType, JSX } from "preact"
import { useId, useRef } from "preact/hooks"
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
}

/** Every string `RailShell` prints that is not data the caller supplied. */
export interface RailShellLabels {
  /** `aria-label` of the rail's and the tab bar's `<nav>`. Defaults to `"Main navigation"`. */
  nav?: string
  /** The tab bar's last slot, which opens the overlay. Defaults to `"More"`. */
  more?: string
  /** The overlay's heading, which is also its accessible name. Defaults to `"More"`. */
  moreDialog?: string
  /** The overlay's close button's accessible name. Defaults to `"Close"`. */
  close?: string
  /** The skip link's visible text. Defaults to `"Skip to content"`. */
  skipToContent?: string
}

/**
 * Everything `RailShell` draws comes from here: the destinations, which one is current, the primary
 * action, the `navigate` port for entries without an `href`, the page itself, and every label.
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
 */
export function tabBarSlots(
  items: readonly RailShellItem[],
  primary?: RailShellItem,
): TabBarSplit {
  const entries = primary ? [...items, primary] : [...items]
  if (entries.length <= TAB_BAR_SLOTS) return { tabs: entries, more: [] }
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

/** Where an entry is drawn; each place lays out the icon and label differently. */
type Place = "rail" | "tab" | "sheet"

const entryBase =
  "flex min-w-0 cursor-pointer items-center rounded-md text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
const entryPlace: Record<Place, string> = {
  rail: "w-full flex-col gap-1 px-1 py-2 text-center",
  tab: "h-full w-full flex-col justify-center gap-1 px-1 py-2 text-center",
  sheet: "w-full gap-3 px-3 py-3 text-sm",
}
const surface = "bg-[var(--color-surface,oklch(1_0_0))]"
const rule = "border-[color:var(--color-border-subtle,oklch(0.928_0.006_264.531))]"
const entryIdle =
  "text-[color:var(--color-muted-foreground,oklch(0.551_0.027_264.364))] hover:bg-[var(--color-canvas,oklch(0.985_0.002_247.839))]"
const entryCurrent = "bg-[var(--color-canvas,oklch(0.985_0.002_247.839))] font-semibold"
const entryPrimary =
  "bg-[var(--color-primary,oklch(0.38_0.17_293))] text-[color:var(--color-primary-foreground,oklch(0.977_0.014_308.299))] hover:opacity-90"

/** One entry: a link when it has an `href`, a button through `navigate` otherwise. */
function Entry(
  { item, place, current, primary, navigate, onChoose }: {
    item: RailShellItem
    place: Place
    current: boolean
    primary: boolean
    navigate?: (key: string) => void
    /** Runs after the entry is chosen — the overlay closes itself through this. */
    onChoose?: () => void
  },
): JSX.Element {
  const { Icon, label, href, key } = item
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
      <span
        class={cn("min-w-0 max-w-full", place === "rail" ? "line-clamp-2 break-words" : "truncate")}
      >
        {label}
      </span>
    </>
  )

  if (href !== undefined) {
    return (
      <a
        href={href}
        aria-current={current ? "page" : undefined}
        class={className}
        onClick={onChoose}
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

/**
 * The frame: a skip link, the rail from `md` up, the page in `<main>`, the phone tab bar below
 * `md`, and the "More" overlay.
 *
 * **Nothing overlaps the page.** The rail is a column in the layout, not a fixed layer, and its
 * contents stick to the top while the page scrolls. The tab bar sticks to the bottom but keeps its
 * place in the flow, so the page's last line always ends above it, and it pads itself by the
 * device's bottom safe-area inset.
 *
 * **The overlay is a modal `<dialog>`.** "More" opens it with `showModal()`, which moves focus to
 * the first control inside it; Escape closes it natively; a click on the backdrop closes it here,
 * which works because the dialog has no padding and its content fills it, so only a backdrop click
 * has the dialog itself as its target. Choosing an entry or the close button closes it too. Every
 * way of closing ends in the `close` event, whose handler returns focus to "More". Chromium also
 * restores focus to "More" by itself when a modal dialog closes, so in Chromium no check can tell
 * the component's part from the browser's; the handler is there for engines that do not. With no
 * JavaScript, "More" and the close button still work in a browser that supports
 * `command`/`commandfor` invokers — `pages/checks/system.ts` proves it in Chromium with script
 * execution disabled — and every entry with an `href` is a link.
 */
export function RailShell(props: RailShellProps): JSX.Element {
  const {
    items,
    currentKey,
    currentPath,
    primary,
    navigate,
    children,
    labels,
    class: className,
  } = props
  const navLabel = labels?.nav ?? "Main navigation"
  const moreLabel = labels?.more ?? "More"
  const dialogLabel = labels?.moreDialog ?? "More"
  const closeLabel = labels?.close ?? "Close"
  const skipLabel = labels?.skipToContent ?? "Skip to content"

  const contentId = useId()
  const dialogId = useId()
  const headingId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)

  const { tabs, more } = tabBarSlots(items, primary)
  const moreHoldsCurrent = more.some((item) =>
    item !== primary && isCurrent(item, currentKey, currentPath)
  )
  const close = () => dialogRef.current?.close()

  return (
    <div class={cn("flex min-h-dvh flex-col md:flex-row", className)}>
      <a
        href={`#${contentId}`}
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-surface,oklch(1_0_0))] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
        data-e2e="rail-shell-skip-link"
      >
        {skipLabel}
      </a>

      <nav
        aria-label={navLabel}
        class={cn("hidden shrink-0 border-r md:block md:w-24", rule, surface)}
        data-e2e="rail-shell-rail"
      >
        <div class="sticky top-0 flex max-h-dvh flex-col gap-2 overflow-y-auto p-2">
          {primary && (
            <Entry
              item={primary}
              place="rail"
              current={isCurrent(primary, currentKey, currentPath)}
              primary
              navigate={navigate}
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
                  navigate={navigate}
                />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main
        id={contentId}
        tabindex={-1}
        class="min-w-0 flex-1 focus:outline-none"
        data-e2e="rail-shell-content"
      >
        {children}
      </main>

      <nav
        aria-label={navLabel}
        class={cn(
          "sticky bottom-0 z-10 shrink-0 border-t pb-safe md:hidden",
          rule,
          surface,
        )}
        data-e2e="rail-shell-tabbar"
      >
        <ul class="flex h-16">
          {tabs.map((item, index) => (
            <li key={`${index}-${item.key}`} class="min-w-0 flex-1 p-1">
              <Entry
                item={item}
                place="tab"
                current={isCurrent(item, currentKey, currentPath)}
                primary={item === primary}
                navigate={navigate}
              />
            </li>
          ))}
          {more.length > 0 && (
            <li class="min-w-0 flex-1 p-1">
              <button
                ref={moreRef}
                type="button"
                aria-haspopup="dialog"
                aria-controls={dialogId}
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
                <MoreDots />
                <span class="min-w-0 max-w-full truncate">{moreLabel}</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {more.length > 0 && (
        <dialog
          ref={dialogRef}
          id={dialogId}
          aria-labelledby={headingId}
          class={cn(
            "m-0 mt-auto max-h-[80dvh] w-full max-w-none rounded-t-lg border-t p-0 text-[inherit] backdrop:bg-black/40",
            rule,
            surface,
          )}
          onClick={(event) => {
            if (event.target === dialogRef.current) close()
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
            <ul class="flex flex-col gap-1">
              {more.map((item, index) => (
                <li key={`${index}-${item.key}`}>
                  <Entry
                    item={item}
                    place="sheet"
                    current={isCurrent(item, currentKey, currentPath)}
                    primary={item === primary}
                    navigate={navigate}
                    onChoose={close}
                  />
                </li>
              ))}
            </ul>
          </div>
        </dialog>
      )}
    </div>
  )
}
