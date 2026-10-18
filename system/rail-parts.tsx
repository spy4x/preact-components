/**
 * The parts `Rail` and `AppShell` share: the cell and tooltip classes, one navigation entry, the
 * counter badge, and the tooltip's placement. Internal to this package, so it is not in the
 * package's exports; import `Rail` or `AppShell` instead. `rail.tsx` re-exports `RailCell` and the
 * focus ring (as `railFocusRing`) for content in `Rail`'s slots.
 *
 * Every colour is a theme token read through `var()` with the default palette's value as its
 * fallback, the pattern `theme/preset.css` uses, so the rail follows whichever palette the page
 * sets and still draws without the preset.
 *
 * @module
 */

import { cn } from "@spy4x/preact-cn"
import { followLinkClick } from "@spy4x/preact-ui/link"
import { type ComponentChildren, createContext, type JSX } from "preact"
import { useContext } from "preact/hooks"
import type { RailCurrent, RailItem, RailVariant } from "./rail.tsx"

/** Where an entry is drawn: the desktop column, the phone tab bar, or the phone sheet. */
export type EntryPlace = "rail" | "tab" | "sheet"

/**
 * The keyboard focus ring: the components' ring colour (`--color-ring`, the accent, step 400 in the
 * dark palettes), which stands 3:1 or more off the rail in every palette. Tailwind's `outline-2`
 * sets no colour, so without it the browser draws its own ring, near-black on a dark rail.
 */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring,var(--color-accent-900,oklch(0.381_0.176_304.987)))]"

/** The column's and the tab bar's surface. */
export const surface = "bg-[var(--color-surface,oklch(1_0_0))]"

/** The hairline between the column or the tab bar and the page. */
export const rule = "border-[color:var(--color-border-subtle,oklch(0.928_0.006_264.531))]"

/** The hairline between the sheet's sections. */
export const sectionRule =
  "divide-y divide-[color:var(--color-border-subtle,oklch(0.928_0.006_264.531))]"

/**
 * An entry at rest: a muted icon, the canvas step and the foreground under the pointer. Ink's hover
 * step is its current row's surface, so in the rail ink hovers on the card step instead and the
 * current cell keeps a fill of its own.
 */
export const entryIdle =
  "text-[color:var(--color-muted-foreground,oklch(0.551_0.027_264.364))] hover:bg-[var(--color-hover,oklch(0.967_0.003_264.542))] [[data-theme=ink]_&]:hover:bg-[var(--color-surface-card)] hover:text-[color:var(--color-foreground,oklch(0.13_0.028_261.692))]"

/**
 * The current entry: a tint of the accent (step 100 in light, the selected tint in dark) with its
 * text and icon in the selected colour, so it differs from a hovered entry's neutral fill. Ink sets
 * its own pair, `--color-surface-active` behind and `--color-nav-active` on top, and they win.
 * Forced colours drop every fill, so there a 2 px outline in the text colour marks it instead.
 */
export const entryCurrent =
  "bg-[var(--color-surface-active,var(--color-accent-100,oklch(0.946_0.033_307.174)))] dark:bg-[var(--color-surface-active,var(--color-selected-soft,color-mix(in_oklab,oklch(0.381_0.176_304.987)_30%,transparent)))] text-[color:var(--color-nav-active,var(--color-selected-text,var(--color-accent-900,oklch(0.381_0.176_304.987))))] font-semibold forced-colors:outline-2 forced-colors:outline-solid forced-colors:outline-[CanvasText]"

/**
 * The primary action: `Button`'s primary fill. In the dark palettes that fill, step 600, is about
 * 2.7:1 against the rail's surface, so a border in step 400 draws its edge at 3:1 or more.
 */
export const entryPrimary =
  "border border-transparent bg-[var(--color-accent-900,oklch(0.381_0.176_304.987))] text-[color:var(--color-accent-foreground,oklch(1_0_0))] hover:bg-[var(--color-accent-800,oklch(0.438_0.218_303.724))] dark:border-[color:var(--color-accent-400,oklch(0.714_0.203_305.504))] dark:bg-[var(--color-accent-600,oklch(0.558_0.288_302.321))] dark:hover:bg-[var(--color-accent-700,oklch(0.496_0.265_301.924))]"

/** What every entry shares: a rounded, focusable cell whose colours ease under motion-safe. */
const entryBase = cn(
  "relative flex min-w-0 cursor-pointer items-center rounded-[var(--radius-primary,0.5rem)] text-xs font-medium motion-safe:transition-colors motion-safe:duration-150",
  focusRing,
)

/**
 * A desktop cell of the icons variant: a 48 px square with the icon centred. On a screen with no
 * hover, where a tooltip cannot appear, it takes the labels variant's shape instead.
 */
export const iconsCell =
  "size-12 justify-center [@media(hover:none)]:h-auto [@media(hover:none)]:min-h-14 [@media(hover:none)]:w-16 [@media(hover:none)]:flex-col [@media(hover:none)]:gap-1 [@media(hover:none)]:px-0 [@media(hover:none)]:py-2"

/**
 * A desktop cell of the labels variant: 64 px wide, at least 56 tall, the label under the icon.
 * No side padding, so a label has the whole 64 px: "Dashboard" fits on one line.
 */
export const labelsCell = "min-h-14 w-16 flex-col justify-center gap-1 px-0 py-2 text-center"

/** The cell classes of each variant in the desktop column. */
export const railCell: Record<RailVariant, string> = { icons: iconsCell, labels: labelsCell }

const entryPlace: Record<Exclude<EntryPlace, "rail">, string> = {
  // No side padding in a tab, and 1 px on each side of its `<li>`: the 4 px each used to take made
  // a nine-letter label such as "Dashboard" truncate in a fifth of a 390 px bar. The bar's two
  // outer ends keep 4 px, so the first and last tabs' focus ring stays on screen.
  tab: "h-full w-full flex-col justify-center gap-1 px-0 py-1 text-center",
  sheet: "min-h-11 w-full gap-3 px-3 py-2 text-sm",
}

/**
 * The label's text in a desktop cell, centred under the icon. It wraps only between words, and a
 * single word wider than the cell, such as "Notifications", is hyphenated where the browser has a
 * dictionary for the page's `lang`; it is never split between two letters with no hyphen. In the
 * labels variant it stops at two lines and ends in an ellipsis. In the icons variant on a screen
 * with no hover, the label is shown with `overflow: visible`, which cancels both: a word wider
 * than the cell overflows it slightly, inside the 72 px column, and is not clipped.
 */
const cellLabelText =
  "min-w-0 max-w-full text-center leading-4 tracking-tight line-clamp-2 break-normal hyphens-auto text-ellipsis"

/**
 * The label in each place. In the icons variant it is visually hidden and names the cell; on a
 * screen with no hover it shows under the icon, as in the labels variant. A desktop entry with no
 * icon always shows its label.
 */
function labelClasses(place: EntryPlace, variant: RailVariant, hasIcon: boolean): string {
  if (place === "tab") return "min-w-0 max-w-full truncate tracking-tight"
  if (place === "sheet") return "min-w-0 flex-1 truncate"
  if (variant === "labels" || !hasIcon) return cellLabelText
  return cn(cellLabelText, "sr-only [@media(hover:none)]:not-sr-only")
}

/**
 * A counter's badge: the accent in light, step 400 with dark text in the dark palettes. A ring in
 * the surface colour makes it read as cut out of the icon it sits on.
 */
const badge =
  "h-5 min-w-5 shrink-0 rounded-full bg-[var(--color-accent-900,oklch(0.381_0.176_304.987))] px-1 text-center text-xs leading-5 font-semibold text-[color:var(--color-accent-foreground,oklch(1_0_0))] dark:bg-[var(--color-accent-400,oklch(0.714_0.203_305.504))] dark:text-[color:var(--color-canvas,oklch(0.21_0.034_264.665))]"
const badgeRing = "ring-2 ring-[color:var(--color-surface,oklch(1_0_0))]"

/** Where the badge sits: on the icon's top-right corner, or at the end of a sheet row. */
function badgeClasses(place: EntryPlace, variant: RailVariant): string {
  if (place === "sheet") return cn(badge, "ml-auto")
  if (place === "tab" || variant === "labels") {
    return cn(badge, badgeRing, "absolute top-1 left-1/2 ml-2")
  }
  return cn(badge, badgeRing, "absolute top-1 right-1")
}

/**
 * The tooltip of a desktop cell. It is `fixed`, so the scrolling list does not clip it, at the
 * column's right edge plus 8 px and the cell's vertical middle, which {@link placeTip} writes onto it
 * as `--rail-tip-x` and `--rail-tip-y`; until then (`data-placed` missing) it is not drawn at all.
 *
 * It shows 300 ms after the pointer comes to rest on the cell, or at once when the cell's control
 * has keyboard focus, and hides at once when neither holds. The delay is a delay, not an animation,
 * so it stays under reduced motion; only the fade is motion-safe. It is hidden while the cell's
 * menu is open, after Escape (the column's `data-tips-hidden`), and always on a screen with no
 * hover. A transparent strip before it covers the gap back to the cell, so the pointer can rest on
 * the hint (WCAG 1.4.13).
 */
export const tooltip =
  "fixed top-[var(--rail-tip-y)] left-[var(--rail-tip-x)] z-40 block -translate-y-1/2 invisible opacity-0 transition-[visibility] duration-0 motion-safe:transition-[opacity,visibility] motion-safe:duration-150 group-hover/cell:visible group-hover/cell:opacity-100 group-hover/cell:delay-300 group-has-[:focus-visible]/cell:visible group-has-[:focus-visible]/cell:opacity-100 group-has-[:focus-visible]/cell:delay-0 not-data-[placed]:hidden group-has-[[aria-expanded=true]]/cell:hidden group-data-[tips-hidden]/rail:hidden [@media(hover:none)]:hidden before:absolute before:inset-y-0 before:right-full before:w-6"
const tooltipBubble =
  "block max-w-xs rounded-[var(--radius-control,0.375rem)] bg-[var(--color-foreground,oklch(0.13_0.028_261.692))] px-2 py-1 text-xs font-medium text-[color:var(--color-canvas,oklch(0.967_0.003_264.542))] shadow-[var(--shadow-popover,0_10px_15px_-3px_rgb(0_0_0/0.1))]"

/** The wrapper every desktop cell sits in: the hover group its tooltip reads. */
export const cellGroup = "group/cell relative flex flex-col items-center"

/** A desktop cell's tooltip, hidden from assistive technology: the cell's name already says it. */
export function RailTooltip({ children }: { children: ComponentChildren }): JSX.Element {
  return (
    <span class={tooltip} aria-hidden="true" data-rail-tip="" data-e2e="rail-shell-tooltip">
      <span class={tooltipBubble}>{children}</span>
    </span>
  )
}

/**
 * The variant of the `Rail` a cell is drawn in, which `Rail` provides to its slots, so a
 * {@link RailCell} in the labels variant draws no tooltip without the caller saying so. Outside a
 * `Rail` it is `"icons"`, the cell's shape before the labels variant existed.
 */
export const RailVariantContext = createContext<RailVariant>("icons")

/** {@link RailCell}'s props. */
export interface RailCellProps {
  /** The tooltip's words, such as the control's name. Hidden from assistive technology. */
  tip: ComponentChildren
  /** The cell's control, such as a `Dropdown` trigger carrying `railFocusRing`. */
  children: ComponentChildren
  /** `data-e2e` on the cell's wrapper. */
  dataE2E?: string
}

/**
 * A desktop cell for caller content in `Rail`'s `top` or `bottom` slot, drawn like the rail's own:
 * the control with the rail's tooltip beside it, placed by `Rail` 8 px past the column, shown 300 ms
 * after the pointer rests or at once on keyboard focus, and hidden after Escape, while the control's
 * menu is open (`aria-expanded="true"`) and on a screen with no hover. In the labels variant, whose
 * cells print their label, it draws no tooltip, as the rail's own entries do there.
 */
export function RailCell({ tip, children, dataE2E }: RailCellProps): JSX.Element {
  const variant = useContext(RailVariantContext)
  return (
    <div class={cellGroup} data-rail-cell="" data-e2e={dataE2E}>
      {children}
      {variant === "icons" && <RailTooltip>{tip}</RailTooltip>}
    </div>
  )
}

/** Whether a counter is drawn at all: a positive number. */
export function hasCount(counter: number | undefined): counter is number {
  return typeof counter === "number" && counter > 0
}

/** "99+" past 99: a badge has room for three characters. The accessible name keeps the count. */
function badgeText(count: number): string {
  return count > 99 ? "99+" : String(count)
}

/**
 * An entry's accessible name with its count, "Notes, 3 unread", or `undefined` without a count, so
 * the entry is named by its content. An `aria-label` rather than hidden text after the label:
 * Chromium joins a visually hidden (absolutely positioned) span to the name with a space.
 */
export function countedName(
  label: string,
  count: number | undefined,
  counterWords: (count: number) => string,
): string | undefined {
  return hasCount(count) ? `${label}, ${counterWords(count)}` : undefined
}

/** A counter as the eye gets it: a badge hidden from assistive technology. */
export function CounterBadge(
  { count, place, variant = "icons" }: { count: number; place: EntryPlace; variant?: RailVariant },
): JSX.Element {
  return (
    <span class={badgeClasses(place, variant)} aria-hidden="true" data-e2e="rail-shell-counter">
      {badgeText(count)}
    </span>
  )
}

/** Dots for the "More" slot; drawn here so the package gains no icon it does not already have. */
export function MoreDots(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" class="size-6 shrink-0" aria-hidden="true">
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  )
}

/**
 * Which entries are current, and how. An entry whose key is `currentKey`, or whose `href` equals
 * `currentPath`, is the page (`"page"`). With no such entry, the one whose `href` is the longest
 * prefix of `currentPath` up to a `/` holds the page inside its section (`"true"`): a note's page
 * under Notes. `"/"` never claims a section, or it would hold every page.
 */
export function currentStates(
  entries: readonly RailItem[],
  currentKey: string | undefined,
  currentPath: string | undefined,
): Map<RailItem, RailCurrent> {
  const states = new Map<RailItem, RailCurrent>()
  for (const entry of entries) {
    const byKey = currentKey !== undefined && entry.key === currentKey
    const byPath = entry.href !== undefined && currentPath !== undefined &&
      entry.href === currentPath
    if (byKey || byPath) states.set(entry, "page")
  }
  if (states.size > 0 || currentPath === undefined) return states
  let section: RailItem | undefined
  for (const entry of entries) {
    const href = entry.href
    if (href === undefined || href === "/" || !currentPath.startsWith(`${href}/`)) continue
    if (!section || href.length > (section.href ?? "").length) section = entry
  }
  if (section) states.set(section, "true")
  return states
}

/** The shared props of one entry. */
export interface EntryProps {
  item: RailItem
  place: EntryPlace
  variant: RailVariant
  current: RailCurrent | undefined
  primary: boolean
  navigate?: (key: string) => void
  navigateLink?: (key: string, href: string) => void
  /** Runs after the entry is chosen; the sheet closes itself through this. */
  onChoose?: () => void
  counterWords: (count: number) => string
}

/**
 * One entry: a link when it has an `href`, followed through `navigateLink` on a plain click when
 * that port is given, and a button through `navigate` otherwise. In the desktop column it is
 * wrapped in its cell, with the tooltip beside the control rather than inside it, so the control's
 * name stays its label.
 */
export function Entry(props: EntryProps): JSX.Element {
  const { item, place, variant, current, primary, navigate, navigateLink, onChoose, counterWords } =
    props
  const { Icon, label, href, key, counter, attributes } = item
  const name = countedName(label, counter, counterWords)
  const className = cn(
    entryBase,
    place === "rail" ? railCell[variant] : entryPlace[place],
    primary ? entryPrimary : current ? entryCurrent : entryIdle,
  )
  const content = (
    <>
      {Icon && (
        <span class="flex shrink-0" aria-hidden="true">
          <Icon class="size-6" />
        </span>
      )}
      <span class={labelClasses(place, variant, Icon !== undefined)}>{label}</span>
      {hasCount(counter) && <CounterBadge count={counter} place={place} variant={variant} />}
    </>
  )

  const control = href !== undefined
    ? (
      <a
        {...attributes}
        href={href}
        aria-current={current}
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
    : (
      <button
        {...attributes}
        type="button"
        aria-current={current}
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

  if (place !== "rail") return control
  return (
    <div class={cellGroup} data-rail-cell="">
      {control}
      {variant === "icons" && Icon && <RailTooltip>{label}</RailTooltip>}
    </div>
  )
}

/**
 * Write where a cell's tooltip goes: 8 px past the column's right edge, so every tooltip starts on
 * the same line, and at the cell's vertical middle in the window. Read when the hint is about to
 * show, so a scrolled list or page never leaves it behind. `data-placed` lets it show.
 */
export function placeTip(target: EventTarget | null, column: Element | null): void {
  const cell = (target as Element | null)?.closest?.("[data-rail-cell]")
  const tip = cell?.querySelector(":scope > [data-rail-tip]")
  if (!cell || !column || !(tip instanceof HTMLElement)) return
  const box = cell.getBoundingClientRect()
  tip.style.setProperty("--rail-tip-x", `${column.getBoundingClientRect().right + 8}px`)
  tip.style.setProperty("--rail-tip-y", `${box.top + box.height / 2}px`)
  tip.setAttribute("data-placed", "")
}
