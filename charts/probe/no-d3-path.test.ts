/**
 * The assertion half of the no-d3 probe: the SVG path, imported for real.
 *
 * `probe/no-d3-dependency.ts` copies this file next to a scratch import map in which the `d3`
 * specifier points at a path that does not exist, then runs it with `deno test`. Every import below
 * therefore has to resolve — transitively, through every module it pulls in — without `d3`. If any
 * of these modules ever gains a d3 import, this suite stops resolving and the probe fails.
 *
 * The imports are not unused: `assertReachable` is given each binding, so the module graph the test
 * claims to have walked is the graph Deno actually loaded. A bare `import "…"` would be erased by
 * the type checker and could pass against a file that never loaded.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  assertD3Available,
  barPercent,
  Bars,
  type BarsProps,
  DonutChart,
  donutGeometry,
  Kpi,
  KpiGrid,
  LineChart,
  MISSING_D3_LINE_ERROR,
  seriesColor,
  useInView,
  yDomainFor,
} from "../+svg.ts"
import { DEFAULT_D3_LINE_CHART_COLORS } from "../d3-line-chart-core.ts"
import { KpiGrid as KpiGridDirect } from "../kpi.tsx"
import { previousPeriod, timeSeriesPointSchema } from "../payload.ts"
import { niceScale, ticks } from "../scales.ts"
import { TIME_FRAMES } from "../time-series.ts"

/** Referencing a binding keeps it in the module graph a type checker would otherwise prune. */
function assertReachable(id: string, value: unknown): void {
  expect(typeof value, `${id} is exported`).not.toBe("undefined")
}

describe("the d3-free import graph", () => {
  it("loads every zero-dependency module and its svg barrel with d3 unresolvable", () => {
    assertReachable("barPercent", barPercent)
    assertReachable("Bars", Bars)
    assertReachable("DonutChart", DonutChart)
    assertReachable("donutGeometry", donutGeometry)
    assertReachable("Kpi", Kpi)
    assertReachable("KpiGrid", KpiGrid)
    assertReachable("KpiGrid (subpath)", KpiGridDirect)
    assertReachable("LineChart", LineChart)
    assertReachable("seriesColor", seriesColor)
    assertReachable("useInView", useInView)
    assertReachable("previousPeriod", previousPeriod)
    assertReachable("timeSeriesPointSchema", timeSeriesPointSchema)
    assertReachable("niceScale", niceScale)
    assertReachable("ticks", ticks)
    assertReachable("assertD3Available", assertD3Available)
    assertReachable("MISSING_D3_LINE_ERROR", MISSING_D3_LINE_ERROR)
    assertReachable("DEFAULT_D3_LINE_CHART_COLORS (subpath)", DEFAULT_D3_LINE_CHART_COLORS)
    expect(TIME_FRAMES, "TIME_FRAMES is exported").toEqual(["minutes", "hours", "days"])
  })

  it("still computes, rather than merely importing", () => {
    expect(ticks(0, 10)).toEqual([0, 2, 4, 6, 8, 10])
    expect(barPercent(25, 100)).toBe(25)
    expect(yDomainFor([{ timeGroup: 0, value: 10 }])).toEqual([0, 12])
    expect(
      previousPeriod({
        from: new Date("2024-03-05T12:00:00Z"),
        to: new Date("2024-03-05T13:00:00Z"),
      }),
    )
      .toEqual({
        from: new Date("2024-03-05T11:00:00Z"),
        to: new Date("2024-03-05T12:00:00Z"),
      })
  })

  it("keeps the props of a d3-free component type-checkable without d3", () => {
    const props: BarsProps = { data: [{ label: "a", value: 1 }] }

    expect(props.data).toHaveLength(1)
  })
})
