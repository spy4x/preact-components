/**
 * `ComparisonTable`'s card, spread into the Display section right before `Table`.
 *
 * What only a browser shows — at 375 px the page does not scroll sideways while the table does,
 * with its first column held in place, and the highlight and the three value labels read in light
 * and dark — is driven by `pages/checks/ui.ts`.
 */

import { type ComparisonRow, ComparisonTable } from "@spy4x/preact-ui"
import type { DemoFragment } from "../registry.ts"

/** Invented products: the guide names no real company. */
const PRODUCTS = ["Tally", "Ledgerly", "Countwise", "Sumbook"] as const

const ROWS: ComparisonRow[] = [
  { capability: "Works offline", values: ["yes", "partial", "no", "yes"] },
  {
    capability: "Export to CSV",
    note: "every field, not a summary",
    values: ["yes", "yes", "partial", "no"],
  },
  { capability: "Shared budgets", values: ["yes", "no", "yes", "partial"] },
  { capability: "Self-hosting", values: ["partial", "no", "no", "no"] },
]

function ComparisonTableDemo() {
  return (
    <ComparisonTable
      caption="How Tally compares"
      products={PRODUCTS}
      rows={ROWS}
      checkedOn={new Date("2026-10-01T00:00:00Z")}
      method="We read each product's official feature, pricing and help pages. Yes means it is built in on the cheapest paid plan; Partial means a limit, an add-on or a higher plan."
      fit="Tally is not for teams over fifty people, or for anyone who needs payroll."
    />
  )
}

export const comparisonTableDemos: DemoFragment = {
  ComparisonTable: {
    summary:
      "A how-we-compare table for a public page: a legend, Yes, Partial or No per product with an icon and a word, and the method and fit that make it honest.",
    wide: true,
    props: [
      {
        name: "products",
        type: "string[]",
        description: "One column each; the first is yours and is highlighted.",
      },
      {
        name: "rows",
        type: `{ capability, values: ("yes" | "partial" | "no")[], note? }[]`,
        description: "One row per capability, with one value per product.",
      },
      { name: "caption", type: "ComponentChildren", description: "The table's name." },
      {
        name: "checkedOn",
        type: "Date",
        description: "When the comparison was checked; printed in the method line.",
      },
      {
        name: "method",
        type: "ComponentChildren",
        description: "What was read, and what each value requires.",
      },
      { name: "fit", type: "ComponentChildren", description: "Who your product is not for." },
      { name: "locale", type: "string", default: `"en"`, description: "The date's locale." },
      {
        name: "labels",
        type: "Partial<ComparisonTableLabels>",
        description:
          "Replaces any English word: the values, the legend, Method, Fit, the date line.",
      },
    ],
    snippet: `<ComparisonTable
  caption="How Tally compares"
  products={["Tally", "Ledgerly", "Countwise", "Sumbook"]}
  rows={[
    { capability: "Works offline", values: ["yes", "partial", "no", "yes"] },
    { capability: "Export to CSV", note: "every field", values: ["yes", "yes", "partial", "no"] },
  ]}
  checkedOn={new Date("2026-10-01")}
  method="We read each product's official feature, pricing and help pages."
  fit="Tally is not for teams over fifty people."
/>`,
    render: () => <ComparisonTableDemo />,
  },
}
