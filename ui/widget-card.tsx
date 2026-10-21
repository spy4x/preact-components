/**
 * The parts of a dashboard: one card per widget, with its own loading, error and empty states
 * ({@link WidgetCard}), a big number for a stat widget ({@link WidgetStat}), and the grid that lays
 * stat and full-width widgets out in order ({@link DashboardGrid}).
 *
 * Each card fails, loads and goes empty on its own, so one slow or broken widget never blanks the
 * page around it.
 */

import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useState } from "preact/hooks"
import { Button } from "./button.tsx"
import { MoreMenu } from "./page-header.tsx"

/** Where a widget's data stands. */
export type WidgetStatus = "loading" | "error" | "empty" | "ready"

/** How much room a widget takes: a number that shares its row, or a whole row. */
export type WidgetSize = "stat" | "full"

/** What {@link WidgetCard} takes. */
export interface WidgetCardProps {
  /** The widget's name, printed as the card's heading. */
  title: string
  /** Makes the title a link to where the number comes from, such as the list it counts. */
  href?: string
  /** Follows `href` without a page load: the app's router. */
  navigate?: (href: string) => void
  /** One muted line under the title: what the number counts, or "As of 14:02" for a saved copy. */
  caption?: ComponentChildren
  /** The card's own menu: `DropdownItem`s, such as "Hide widget". Omitted, the card has no menu. */
  menu?: ComponentChildren
  /** The menu button's name. Defaults to `` `Actions for ${title}` ``. */
  menuLabel?: string
  status: WidgetStatus
  /** The skeleton's shape and the body's height while it loads. Defaults to `"stat"`. */
  size?: WidgetSize
  /** Said to a screen reader while it loads, such as "Loading the note count". */
  loadingLabel: string
  /** The message when `status` is `"error"`. */
  errorMessage?: string
  /** Reads the widget again; shown as a button under the error. */
  onRetry?: () => void
  /** The retry button's text. Defaults to `"Try again"`. */
  retryLabel?: string
  /** The one line when `status` is `"empty"`, such as "No notes in this range". */
  emptyLabel?: string
  /** How long a load runs before its skeleton shows, in milliseconds. Defaults to 300. */
  skeletonDelay?: number
  /** The title's heading level. Defaults to 2. */
  headingLevel?: 2 | 3 | 4
  /** The widget's content, drawn when `status` is `"ready"`. */
  children?: ComponentChildren
  /** Stamps `data-e2e` on the card. */
  dataE2E?: string
  class?: string
}

const bar = "animate-pulse rounded bg-track motion-reduce:animate-none"
const bodyHeight: Record<WidgetSize, string> = { stat: "min-h-16", full: "min-h-60" }

/**
 * One dashboard widget's card: the title (a link when `href` is set), a muted caption, an optional
 * three-dots menu, and a body that shows the widget, a skeleton while it loads, its error with a
 * retry, or one line when it has nothing to show.
 *
 * The skeleton waits `skeletonDelay` before it appears, so a fast load never flashes; the body keeps
 * the loaded card's height in every state, so nothing jumps when the data arrives. While loading, a
 * screen reader hears `loadingLabel` once, not the skeleton.
 *
 * @param props See {@link WidgetCardProps}.
 */
export function WidgetCard(
  {
    title,
    href,
    navigate,
    caption,
    menu,
    menuLabel,
    status,
    size = "stat",
    loadingLabel,
    errorMessage,
    onRetry,
    retryLabel = "Try again",
    emptyLabel,
    skeletonDelay = 300,
    headingLevel = 2,
    children,
    dataE2E,
    class: className,
  }: WidgetCardProps,
): JSX.Element {
  const headingId = `widget-${useId()}`
  const Heading = `h${headingLevel}` as "h2"
  const showSkeleton = useDelayed(status === "loading", skeletonDelay)

  const onTitleClick = (event: MouseEvent) => {
    if (!navigate || !href || event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(href)
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      aria-busy={status === "loading" ? "true" : undefined}
      data-e2e={dataE2E}
      data-widget-status={status}
      class={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border border-subtle bg-surface p-4",
        className,
      )}
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 flex-col gap-1">
          <Heading id={headingId} class="line-clamp-2 text-sm font-medium text-foreground">
            {href
              ? (
                <a
                  href={href}
                  onClick={onTitleClick}
                  class="rounded-sm underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {title}
                </a>
              )
              : title}
          </Heading>
          {caption ? <p class="text-sm text-muted">{caption}</p> : null}
        </div>
        {menu ? <MoreMenu label={menuLabel ?? `Actions for ${title}`}>{menu}</MoreMenu> : null}
      </div>
      <div class={cn("flex min-w-0 flex-col", bodyHeight[size])}>
        {status === "loading"
          ? (
            <>
              <span class="sr-only" role="status">{loadingLabel}</span>
              {showSkeleton ? <WidgetSkeleton size={size} /> : null}
            </>
          )
          : status === "error"
          ? (
            <div role="alert" class="flex flex-1 flex-col items-start justify-center gap-2">
              <p class="text-sm text-danger">{errorMessage}</p>
              {onRetry
                ? <Button variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</Button>
                : null}
            </div>
          )
          : status === "empty"
          ? <p class="flex flex-1 items-center text-sm text-muted">{emptyLabel}</p>
          : children}
      </div>
    </div>
  )
}

/** The skeleton in the widget's shape: a number and a line, or a chart's plot. */
function WidgetSkeleton({ size }: { size: WidgetSize }): JSX.Element {
  if (size === "stat") {
    return (
      <div class="flex flex-col gap-2" aria-hidden="true" data-widget-skeleton="">
        <div class={cn(bar, "h-8 w-16")} />
        <div class={cn(bar, "h-4 w-32")} />
      </div>
    )
  }
  return (
    <div class="flex flex-1 flex-col gap-2" aria-hidden="true" data-widget-skeleton="">
      <div class={cn(bar, "h-4 w-24")} />
      <div class={cn(bar, "min-h-48 w-full flex-1 rounded-md")} />
    </div>
  )
}

/** `true` once `on` has stayed `true` for `delay` milliseconds; `false` again as soon as it ends. */
function useDelayed(on: boolean, delay: number): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!on) {
      setShown(false)
      return
    }
    const timer = setTimeout(() => setShown(true), Math.max(0, delay))
    return () => clearTimeout(timer)
  }, [on, delay])
  return on && shown
}

/** What {@link WidgetStat} takes. */
export interface WidgetStatProps {
  /** The number, already formatted. */
  value: string | number
  /**
   * The value's accessible name when the printed one is shortened, such as "1,234,567" for
   * "1.2M".
   */
  valueLabel?: string
  /** Muted lines under the number: what it counts, and its change against the period before. */
  lines?: readonly ComponentChildren[]
}

/**
 * A stat widget's body: one large number in tabular figures, then muted lines in the text colour,
 * never coloured as good or bad.
 *
 * @param props See {@link WidgetStatProps}.
 */
export function WidgetStat({ value, valueLabel, lines = [] }: WidgetStatProps): JSX.Element {
  return (
    <div class="flex flex-col gap-1">
      <p class="text-3xl font-semibold tabular-nums text-foreground" aria-label={valueLabel}>
        {value}
      </p>
      {lines.map((line, index) => <p key={index} class="text-sm text-muted">{line}</p>)}
    </div>
  )
}

/** One widget placed by {@link DashboardGrid}. */
export interface DashboardItem {
  id: string
  size: WidgetSize
  /** The widget, usually a {@link WidgetCard}. */
  content: ComponentChildren
}

/** What {@link DashboardGrid} takes. */
export interface DashboardGridProps {
  items: readonly DashboardItem[]
  /** The region's accessible name, such as "Widgets". */
  label: string
  /** The narrowest a stat may get before its row wraps. Defaults to `"10rem"`. */
  minStatWidth?: string
  class?: string
}

/**
 * Lays widgets out in their order: consecutive stats share one row that fills the width (two
 * columns on a phone, as many as fit wider), and a full widget takes a row of its own.
 *
 * @param props See {@link DashboardGridProps}.
 */
export function DashboardGrid(
  { items, label, minStatWidth = "10rem", class: className }: DashboardGridProps,
): JSX.Element {
  return (
    <div role="region" aria-label={label} class={cn("flex flex-col gap-4", className)}>
      {dashboardRows(items).map((row) =>
        row.size === "full"
          ? <div key={row.items[0].id} class="min-w-0">{row.items[0].content}</div>
          : (
            <div
              key={row.items.map((item) => item.id).join(" ")}
              class="grid gap-4"
              style={{
                gridTemplateColumns:
                  `repeat(auto-fit, minmax(min(${minStatWidth}, calc(50% - 0.5rem)), 1fr))`,
              }}
            >
              {row.items.map((item) => <div key={item.id} class="min-w-0">{item.content}</div>)}
            </div>
          )
      )}
    </div>
  )
}

/** One row of a dashboard: a run of stats, or one full widget. */
export interface DashboardRow {
  size: WidgetSize
  items: DashboardItem[]
}

/**
 * Groups widgets into rows, in order: each run of consecutive stats is one row, and each full
 * widget is a row of its own.
 */
export function dashboardRows(items: readonly DashboardItem[]): DashboardRow[] {
  const rows: DashboardRow[] = []
  for (const item of items) {
    const last = rows.at(-1)
    if (item.size === "stat" && last?.size === "stat") last.items.push(item)
    else rows.push({ size: item.size, items: [item] })
  }
  return rows
}
