/**
 * The Charts section.
 *
 * A placeholder: the section is being written, and this is the one card that exists so far. `Bars`
 * is the honest choice for a first card — it takes `data` and nothing else, and it renders plain
 * markup with no JavaScript, which is the claim the rest of the package is going to have to prove.
 *
 * The components still to be demonstrated are listed in `PENDING_DEMOS` in `../registry.ts`, so a
 * reader sees the gap on the page and `deno check` keeps the list honest.
 *
 * The import is the component's own subpath rather than the package barrel: the barrel also carries
 * the two d3 islands.
 */

import { type BarDatum, Bars } from "@preact-components/charts/bars"
import type { DemoFragment } from "../registry.ts"

/** A handful of rows in the shape `Bars` takes — no helper, no fetch, no scale to compute. */
const bars: BarDatum[] = [
  { label: "alpha", value: 41 },
  { label: "beta", value: 27 },
  { label: "gamma", value: 12 },
  { label: "delta", value: 6 },
]

export const chartsDemos = {
  Bars: {
    summary:
      "Placeholder — this section is being written. A labelled bar chart from `data` alone, rendered as a table of proportions: no d3, no client JavaScript, no width to measure.",
    snippet: `<Bars data={[{ label: "alpha", value: 41 }]} title="Top planes" />`,
    render: () => <Bars data={bars} title="Planes shot down" />,
  },
} satisfies DemoFragment<"Bars">
