import { cn } from "@spy4x/preact-cn"
import { IconCheck, IconMinus, IconXMark } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"

/** How far a product covers one capability. */
export type ComparisonValue = "yes" | "partial" | "no"

/** One capability of a {@link ComparisonTable}: a row, with one value per product. */
export interface ComparisonRow {
  /** The capability's name, the row's header cell. */
  capability: string
  /** One value per product, in the order of `products`. */
  values: readonly ComparisonValue[]
  /** A short qualifier shown under the capability's name. */
  note?: string
}

/** Every English word a {@link ComparisonTable} draws, each one replaceable. */
export interface ComparisonTableLabels {
  /** The label of a `"yes"` cell. */
  yes: string
  /** The label of a `"partial"` cell. */
  partial: string
  /** The label of a `"no"` cell. */
  no: string
  /** What `"yes"` means, in the legend. */
  yesMeaning: string
  /** What `"partial"` means, in the legend. */
  partialMeaning: string
  /** What `"no"` means, in the legend. */
  noMeaning: string
  /** The legend list's accessible name. */
  legend: string
  /** The header of the first column, over the capabilities. */
  capability: string
  /** The small word under the first product's name that marks it as the caller's own. */
  ours: string
  /** The term over the method paragraph. */
  method: string
  /** The term over the fit paragraph. */
  fit: string
  /** The sentence that dates the comparison, given the formatted date. */
  checkedOn: (date: string) => string
}

/** The English defaults of {@link ComparisonTableLabels}. */
export const defaultComparisonTableLabels: ComparisonTableLabels = {
  yes: "Yes",
  partial: "Partial",
  no: "No",
  yesMeaning: "built in",
  partialMeaning: "with limits, or through an add-on",
  noMeaning: "not offered",
  legend: "Legend",
  capability: "Capability",
  ours: "Ours",
  method: "Method",
  fit: "Fit",
  checkedOn: (date) => `Checked on ${date}.`,
}

export interface ComparisonTableProps {
  /** The table's caption, its accessible name. */
  caption: ComponentChildren
  /** The products compared, one column each. The first is the caller's own and is highlighted. */
  products: readonly string[]
  /** The capabilities, one row each; every row has one value per product. */
  rows: readonly ComparisonRow[]
  /** When the comparison was last checked against each product's own pages. */
  checkedOn: Date
  /** How the comparison was made: what was read, and what each value requires. */
  method: ComponentChildren
  /** Who the caller's product is not for. Omitted, no fit paragraph is drawn. */
  fit?: ComponentChildren
  /** BCP 47 locale the date is formatted in. Defaults to `"en"`. */
  locale?: string
  /**
   * Time zone the date is formatted in. Defaults to `"UTC"`, so the server and the browser print
   * the same day.
   */
  timeZone?: string
  /** Replaces any of the English words; see {@link ComparisonTableLabels}. */
  labels?: Partial<ComparisonTableLabels>
  class?: string
}

const ICONS = { yes: IconCheck, partial: IconMinus, no: IconXMark } as const
const ICON_TONE = {
  yes: "text-success",
  partial: "text-warning",
  no: "text-muted",
} as const
const VALUES: readonly ComparisonValue[] = ["yes", "partial", "no"]

/** A value's icon and its visible label: the label, not the colour, carries the meaning. */
function ValueMark(
  { value, labels }: { value: ComparisonValue; labels: ComparisonTableLabels },
): JSX.Element {
  const Icon = ICONS[value]
  return (
    <span class="inline-flex items-center gap-2" data-value={value}>
      <Icon class={cn("size-4", ICON_TONE[value])} />
      <span class="text-foreground">{labels[value]}</span>
    </span>
  )
}

/** The highlight of the caller's own column, header and body alike. */
const OURS = "bg-selected-soft"
/** A cell of the first column, held in place while the rest scrolls under it. */
const STICKY = "sticky left-0 z-10 bg-surface text-left"
const CELL = "border-b border-subtle px-3 py-3 sm:px-4"

/**
 * A comparison of capabilities across products, for a public page: a legend, a real `<table>`
 * and the method and fit that make it trustworthy.
 *
 * The table has a caption, a column header per product (`scope="col"`) and a row header per
 * capability (`scope="row"`). Every cell shows an icon and a visible "Yes", "Partial" or "No", so
 * colour is never the only signal, and the caller's own column says "Ours" under its name besides
 * being tinted. It renders on the server and needs no JavaScript. On a narrow screen the table
 * scrolls sideways inside its own focusable container with the capability column held in place;
 * the page itself never scrolls sideways.
 *
 * @throws When a row's `values` and `products` differ in length: a missing value would shift every
 * later cell under the wrong product.
 */
export function ComparisonTable(
  {
    caption,
    products,
    rows,
    checkedOn,
    method,
    fit,
    locale = "en",
    timeZone = "UTC",
    labels,
    class: className,
  }: ComparisonTableProps,
): JSX.Element {
  const words = { ...defaultComparisonTableLabels, ...labels }
  const captionId = useId()
  for (const row of rows) {
    if (row.values.length !== products.length) {
      throw new Error(
        `ComparisonTable: "${row.capability}" has ${row.values.length} values for ` +
          `${products.length} products; give every row one value per product`,
      )
    }
  }
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }).format(checkedOn)

  return (
    <div class={cn("flex min-w-0 max-w-full flex-col gap-4", className)}>
      <ul aria-label={words.legend} class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {VALUES.map((value) => (
          <li key={value} class="inline-flex items-center gap-2">
            <ValueMark value={value} labels={words} />
            <span class="text-muted">{words[`${value}Meaning`]}</span>
          </li>
        ))}
      </ul>
      <div
        role="region"
        aria-labelledby={captionId}
        tabIndex={0}
        data-e2e="comparison-scroller"
        class="max-w-full overflow-x-auto rounded-lg bg-surface ring-1 ring-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"
      >
        <table class="min-w-full border-separate border-spacing-0 text-sm [&_tbody>tr:last-child>*]:border-b-0">
          <caption
            id={captionId}
            class="px-3 py-3 text-left font-semibold text-foreground sm:px-4"
          >
            {caption}
          </caption>
          <thead>
            <tr>
              <th scope="col" class={cn(CELL, STICKY, "font-medium text-muted")}>
                {words.capability}
              </th>
              {products.map((product, index) => (
                <th
                  key={index}
                  scope="col"
                  class={cn(
                    CELL,
                    "whitespace-nowrap text-left font-semibold text-foreground",
                    index === 0 && OURS,
                  )}
                  data-ours={index === 0 ? "" : undefined}
                >
                  {product}
                  {index === 0 && (
                    <span class="block text-xs font-medium text-muted">
                      {words.ours}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row" class={cn(CELL, STICKY, "min-w-32 font-medium text-foreground")}>
                  {row.capability}
                  {row.note && <span class="block text-xs font-normal text-muted">{row.note}</span>}
                </th>
                {row.values.map((value, index) => (
                  <td
                    key={index}
                    class={cn(CELL, "whitespace-nowrap", index === 0 && OURS)}
                  >
                    <ValueMark value={value} labels={words} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl class="flex flex-col gap-3 text-sm">
        <div>
          <dt class="font-semibold text-foreground">{words.method}</dt>
          <dd class="text-muted">
            {words.checkedOn(date)} {method}
          </dd>
        </div>
        {fit !== undefined && fit !== null && fit !== false && (
          <div>
            <dt class="font-semibold text-foreground">{words.fit}</dt>
            <dd class="text-muted">{fit}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
