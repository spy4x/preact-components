import { join } from "@spy4x/preact-cn/join"
import { isTypingTarget } from "@spy4x/platform/browser/hotkeys"
import { IconChevronDown } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { Badge } from "./badge.tsx"
import { useLabels } from "./i18n.tsx"

/** The words {@link Dock} adds to the caller's label. */
export interface DockLabels {
  /** The toggle's accessible name while there is a count. Default: `"Decisions: 3"`. */
  toggle: (label: string, count: number) => string
}

const DOCK_LABELS: DockLabels = {
  toggle: (label, count) => `${label}: ${count}`,
}

/** Props of {@link Dock}. */
export interface DockProps {
  /** Whether the dock is expanded. */
  open: boolean
  /** Called with the state the reader asked for: the toggle, or Escape inside the dock. */
  onOpenChange: (open: boolean) => void
  /** What the dock holds, such as `"Decisions"`: the toggle's text and the region's name. */
  label: string
  /** How many items wait, shown as a badge on the toggle. Left out, there is no badge. */
  count?: number
  /** A fixed row above the scrolling content, such as the item's position and arrows. */
  header?: ComponentChildren
  /** The content, which scrolls between the header and the bottom edge. */
  children?: ComponentChildren
  /**
   * Called with `true` when focus moves into the dock and `false` when it leaves, such as to turn
   * the content's own single keys on only while the reader is in the dock.
   */
  onFocusWithinChange?: (inside: boolean) => void
  /** Replaces the English toggle name. */
  labels?: Partial<DockLabels>
  /** Classes added to the panel. */
  class?: string
}

/**
 * The custom property the dock publishes on the root element: its height with the gap below it,
 * which `Toastr`'s bottom corners and `RailShell`'s page add to their own bottom offset.
 */
const HEIGHT_PROPERTY = "--pc-dock-height"

/**
 * The fixed layer: full width below `md`, sitting on `RailShell`'s tab bar; from `md` 1rem from the
 * bottom and end edges. The tab bar's room (`--pc-tab-bar-room`) holds a 24 px fade band and 8 px
 * of focus clearance above the bar itself, which the dock covers, so it sits 2rem lower than that
 * room. Clicks pass through the layer's empty part.
 */
const LAYER =
  "pointer-events-none fixed inset-x-0 bottom-[max(0px,calc(var(--pc-tab-bar-room,0px)-(--spacing(8))))] z-30 flex justify-end md:px-4 md:pb-4"

/**
 * The panel: a sheet with rounded top corners below `md`, a card from `md`. Expanded, it is 24rem
 * wide from `md` and at most 80 % of the window's height below `md`, `min(70dvh, 36rem)` from it.
 * Collapsed, it is 16rem wide from `md`, so it hides less of the page.
 */
const PANEL =
  "pointer-events-auto flex w-full flex-col overflow-hidden rounded-t-[var(--radius-card,0.75rem)] border border-b-0 border-subtle bg-surface text-foreground shadow-popover md:rounded-card md:border-b"

const PANEL_OPEN = "max-h-[80dvh] md:w-96 md:max-h-[min(70dvh,36rem)]"

const PANEL_CLOSED = "md:w-64"

const TOGGLE =
  "flex min-h-11 w-full shrink-0 cursor-pointer items-center gap-2 px-4 py-2 text-start text-sm font-semibold hover:bg-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"

/** The body slides up a little as it opens, through `@starting-style`; not under reduced motion. */
const BODY =
  "flex min-h-0 flex-1 flex-col border-t border-subtle transition-[translate,opacity] duration-200 ease-out motion-safe:starting:translate-y-4 motion-safe:starting:opacity-0"

/** Whether Escape belongs to the field it was pressed in: a text field with text in it. */
function fieldKeepsEscape(target: HTMLElement): boolean {
  if (!isTypingTarget(target)) return false
  const text = "value" in target ? String(target.value) : target.textContent ?? ""
  return text !== ""
}

/**
 * A non-modal panel pinned to the bottom-end corner of every page, for something that waits for the
 * reader wherever they are, such as decisions to answer one at a time. Collapsed, it is one button
 * with the label and a count; expanded, a region named by the label, with a fixed header and a
 * scrolling body. It never takes focus, and never moves it when its content changes.
 *
 * Escape inside it collapses it and puts focus on the toggle, except in a text field with text in
 * it. It is a hotkey scope (`data-hotkey-scope`): a page's single-key shortcuts do not fire while
 * focus is inside it, and a `Button` hotkey inside it fires only from inside it.
 *
 * It publishes its height as `--pc-dock-height` on the root element, so `Toastr`'s bottom corners
 * stack above it and `RailShell`'s page pads its bottom by it. Render one dock per page.
 *
 * @param props See {@link DockProps}.
 */
export function Dock(props: DockProps): JSX.Element {
  const {
    open,
    onOpenChange,
    label,
    count,
    header,
    children,
    onFocusWithinChange,
    labels,
    class: className,
  } = props
  const words = useLabels("Dock", DOCK_LABELS, labels, { toggle: ["label", "count"] })
  const layer = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const focusInside = useRef(false)
  const bodyId = useId()

  useEffect(() => {
    const element = layer.current
    if (element === null) return
    const root = document.documentElement.style
    const publish = () => root.setProperty(HEIGHT_PROPERTY, `${element.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.removeProperty(HEIGHT_PROPERTY)
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open || event.key !== "Escape" || event.defaultPrevented) return
    if (fieldKeepsEscape(event.target as HTMLElement)) return
    event.preventDefault()
    onOpenChange(false)
    toggle.current?.focus()
  }

  const focusMoved = (inside: boolean) => {
    if (focusInside.current === inside) return
    focusInside.current = inside
    onFocusWithinChange?.(inside)
  }

  return (
    <div ref={layer} class={LAYER} data-hotkey-scope="" data-e2e="dock">
      <div
        role={open ? "region" : undefined}
        aria-label={open ? label : undefined}
        class={join(PANEL, open ? PANEL_OPEN : PANEL_CLOSED, className)}
        onKeyDown={onKeyDown}
        onFocusIn={() => focusMoved(true)}
        onFocusOut={(event) =>
          focusMoved(layer.current?.contains(event.relatedTarget as Node | null) ?? false)}
      >
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          aria-label={count === undefined ? undefined : words.toggle(label, count)}
          class={TOGGLE}
          onClick={() => onOpenChange(!open)}
          data-e2e="dock-toggle"
        >
          <span class="min-w-0 truncate">{label}</span>
          {count !== undefined && (
            <Badge
              text={String(count)}
              tone={count > 0 ? "primaryStrong" : "neutral"}
              class="tabular-nums"
            />
          )}
          <IconChevronDown
            class={join("ms-auto size-4 motion-safe:transition-transform", !open && "rotate-180")}
          />
        </button>
        {open && (
          <div id={bodyId} class={BODY} data-e2e="dock-body">
            {header !== undefined && (
              <div class="shrink-0 border-b border-subtle px-4 py-2">{header}</div>
            )}
            <div class="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          </div>
        )}
      </div>
    </div>
  )
}
