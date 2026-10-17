import { useSignal } from "@preact/signals"
import { cn } from "@spy4x/preact-cn"
import { type ComponentChildren, createContext, type JSX } from "preact"
import { useContext, useEffect, useId, useRef } from "preact/hooks"

export interface TableProps {
  /** Cells of the single header row, normally `<th>` elements. */
  headerSlot: ComponentChildren
  /** One entry per body row; each entry is the row's `<td>` list. */
  bodySlots: ComponentChildren[]
  /**
   * Optional identity of each body row, one per entry in `bodySlots`, in the same order.
   *
   * Given, each `<tr>` is keyed by its entry here instead of by its position, so when the caller
   * reorders `bodySlots` — a sort, a page turn, a row inserted above — Preact moves the row's DOM
   * element, and whatever that element holds (a ticked checkbox, a half-typed input, focus, a
   * component's own state), along with it. Omitted, rows are keyed by position, as they always
   * were: state then stays at its old position and describes whichever row lands there.
   *
   * Keys have to be distinct within one table, the ordinary rule for any keyed list; that is not
   * checked. A length that differs from `bodySlots`' is: it throws, because a row with no key of its
   * own would silently fall back to position and bring the bug back for that row alone.
   */
  bodyKeys?: readonly (string | number)[]
  /** Optional `<tfoot>` content. */
  footerSlot?: ComponentChildren
  /**
   * Optional `<caption>` content, the table's accessible name.
   *
   * Omitted, `null` or `false` — the three ways a conditional expression such as
   * `caption={title && title}` says "nothing" — no `<caption>` is rendered at all, the same as
   * Preact renders none of those three as content anywhere else. A caller naming the table through
   * `aria-label`/`aria-labelledby` on a wrapper is unaffected. Anything else passed renders, `0`
   * and `""` included, so a caller whose caption happens to be falsy-but-real still gets one.
   * `captionClass` is how a caller hides it visually (`"sr-only"`) while keeping it for assistive
   * tech; this primitive applies no caption styling of its own beyond the browser default.
   *
   * It also names the scroll area while the table is wider than it (see {@link Table}).
   */
  caption?: ComponentChildren
  /** Extra utilities for the `<caption>`. Ignored when `caption` is omitted. */
  captionClass?: string
  /** Sets `data-e2e` on every body row, for end-to-end selectors. */
  rowDataE2E?: string
  class?: string
}

const wrapper = "bg-surface ring-1 ring-subtle rounded-lg pb-px overflow-x-auto min-h-[300px]"

/** The components' focus ring, drawn while the scroll area is a Tab stop and a keyboard is on it. */
const scrollerFocus =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"

/**
 * Whether `caption` means "render one", as opposed to one of the three values a conditional
 * expression produces for "nothing": `undefined`, `null` and `false`. Anything else — including
 * `0` and `""` — renders, so a caller whose real caption happens to be falsy still gets one.
 */
function hasCaption(caption: ComponentChildren): boolean {
  return caption !== undefined && caption !== null && caption !== false
}

/** The `id` of the table's `<caption>`, from the scroll frame that names itself by it. */
const CaptionId = createContext<string | undefined>(undefined)

/**
 * The sideways-scrolling box around the table, a Tab stop while the table is wider than it.
 *
 * A component of its own, so `Table` itself calls no hook: it stays a function that can be called
 * outside a render, which is how its tests read the row keys off the tree it returns. The caption's
 * `id` reaches the caption through {@link CaptionId}, because the caption is one of the children.
 *
 * @param props `named`: whether the table has a caption to name the box by; the caller's class;
 * the table.
 * @returns The box.
 */
function ScrollFrame(
  { named, class: className, children }: {
    named: boolean
    class?: string
    children: ComponentChildren
  },
): JSX.Element {
  const captionId = useId()
  const box = useRef<HTMLDivElement>(null)
  const fits = useSignal(false)

  useEffect(() => {
    const node = box.current
    if (!node) return
    const measure = () => {
      fits.value = node.scrollWidth <= node.clientWidth
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    // The box keeps its size when only the table's width changes (new rows, a late web font).
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    return () => observer.disconnect()
  }, [])

  const scrolls = !fits.value

  return (
    <div
      ref={box}
      role={scrolls && named ? "region" : undefined}
      aria-labelledby={scrolls && named ? captionId : undefined}
      tabIndex={scrolls ? 0 : undefined}
      class={cn(wrapper, scrolls && scrollerFocus, className)}
    >
      <CaptionId.Provider value={captionId}>{children}</CaptionId.Provider>
    </div>
  )
}

/** The table's `<caption>`, carrying the `id` its scroll frame is named by. */
function TableCaption(
  { class: className, children }: { class?: string; children: ComponentChildren },
): JSX.Element {
  return <caption id={useContext(CaptionId)} class={className}>{children}</caption>
}

/**
 * Table shell with header, body and optional footer slots.
 *
 * Rows are rendered from `bodySlots`, so the caller keeps control of cell content while the
 * primitive owns the divider, hover and spacing utilities. The wrapper scrolls horizontally
 * instead of overflowing the page on narrow screens. Pass `bodyKeys` whenever rows can reorder
 * and carry state of their own; without it a body row is keyed by its position.
 *
 * While the table is wider than its wrapper, the wrapper is a Tab stop, so a keyboard can reach it
 * and scroll it with the arrow keys, and it draws the components' focus ring. With a `caption` it is
 * also a `region` named by that caption; without one it has no role and no name, since none is
 * known. The server cannot know whether the table fits, so it renders the scrolling form, which is
 * right when no script runs. After mount the wrapper is measured, and again whenever it or the
 * table changes size: while the table fits, the Tab stop, the role and the name are dropped,
 * because a stop with nothing to scroll does nothing.
 */
export function Table(
  {
    headerSlot,
    bodySlots,
    bodyKeys,
    footerSlot,
    caption,
    captionClass,
    rowDataE2E,
    class: className,
  }: TableProps,
): JSX.Element {
  if (bodyKeys !== undefined && bodyKeys.length !== bodySlots.length) {
    throw new Error(
      `Table: bodyKeys has ${bodyKeys.length} entries for ${bodySlots.length} bodySlots; ` +
        "give every body row a key, or none",
    )
  }

  const named = hasCaption(caption)

  return (
    <ScrollFrame named={named} class={className}>
      <table class="min-w-full divide-y divide-subtle">
        {named && <TableCaption class={captionClass}>{caption}</TableCaption>}
        <thead class="bg-canvas">
          <tr class="*:whitespace-nowrap *:px-6 *:py-3 text-sm font-medium text-foreground">
            {headerSlot}
          </tr>
        </thead>
        <tbody class="divide-y divide-subtle bg-surface pc-focus-offset-surface">
          {bodySlots.map((bodySlot, index) => (
            <tr
              key={bodyKeys === undefined ? index : bodyKeys[index]}
              class="text-sm *:px-6 *:py-4 hover:bg-hover"
              data-e2e={rowDataE2E}
            >
              {bodySlot}
            </tr>
          ))}
        </tbody>
        {footerSlot && <tfoot class="bg-canvas">{footerSlot}</tfoot>}
      </table>
    </ScrollFrame>
  )
}
