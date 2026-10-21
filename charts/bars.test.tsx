import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { type BarDatum, barPercent, Bars, barTotal, type StackedBarDatum } from "./bars.tsx"

const data: BarDatum[] = [
  { label: "alpha", value: 4 },
  { label: "beta", value: 2 },
]

function count(html: string, needle: string): number {
  return html.split(needle).length - 1
}

describe("barPercent", () => {
  it("scales against the maximum", () => {
    expect(barPercent(4, 4)).toBe(100)
    expect(barPercent(2, 4)).toBe(50)
    expect(barPercent(1, 3)).toBe(33.33)
  })

  it("clamps negative and oversized values into the track", () => {
    expect(barPercent(-5, 10)).toBe(0)
    expect(barPercent(20, 10)).toBe(100)
  })

  it("returns zero when there is nothing to scale against", () => {
    expect(barPercent(5, 0)).toBe(0)
    expect(barPercent(5, -1)).toBe(0)
    expect(barPercent(5, NaN)).toBe(0)
    expect(barPercent(NaN, 5)).toBe(0)
    expect(barPercent(Infinity, 5)).toBe(0)
  })
})

describe("Bars", () => {
  it("renders one row per datum, scaled against the largest value", () => {
    const html = render(<Bars data={data} />)

    expect(count(html, "<tr")).toBe(2)
    expect(html).toContain("width:100%")
    expect(html).toContain("width:50%")
    expect(html).toContain("alpha")
    expect(html).toContain("beta")
  })

  it("keeps the table transparent, so a dark page's table surface does not box the chart", () => {
    const html = render(<Bars data={data} />)

    expect(html).toMatch(/<table[^>]*class="[^"]*\bbg-transparent\b/)
  })

  it("puts a caller's background on the wrapper, behind the still transparent table", () => {
    const html = render(<Bars data={data} class="bg-surface" />)

    expect(html).toMatch(/^<div class="[^"]*\bbg-surface\b/)
    expect(html).toMatch(/<table[^>]*class="[^"]*\bbg-transparent\b/)
  })

  it("adds a caller's class after its own, so an important utility overrides one of them", () => {
    const html = render(<Bars data={data} class="gap-4!" />)

    expect(html).toMatch(/^<div class="flex flex-col gap-2 [^"]*\bgap-4!"/)
  })

  it("honours a fixed maximum for cross-list comparison", () => {
    const html = render(<Bars data={data} max={8} />)

    expect(html).toContain("width:50%")
    expect(html).toContain("width:25%")
  })

  it("formats the numeric column through the format port", () => {
    const html = render(<Bars data={data} format={(value) => `${value} h`} />)

    expect(html).toContain(">4 h</span>")
    expect(html).toContain(">2 h</span>")
  })

  it("links a label when the datum carries an href", () => {
    const html = render(
      <Bars data={[{ label: "product", value: 1, href: "/products/1" }, ...data]} />,
    )

    expect(html).toContain('href="/products/1"')
    expect(html).toContain(">product</a>")
  })

  it("marks a low-sample row for a stylesheet to dim", () => {
    const html = render(<Bars data={[{ label: "thin", value: 1, lowSample: true }, ...data]} />)

    expect(html).toContain('data-low-sample="true"')
    expect(count(html, "data-low-sample")).toBe(1)
  })

  it("colours bars by rank and honours a per-datum colour", () => {
    const html = render(
      <Bars
        data={[
          ...data,
          { label: "gamma", value: 1, color: "#abcdef" },
          { label: "delta", value: 1 },
        ]}
        colors={["#111111", "#222222"]}
      />,
    )

    // Ranks 0 and 4 wrap onto the first palette entry, rank 3 onto the second, and the datum that
    // names its own colour keeps it.
    expect(count(html, "#111111")).toBe(1)
    expect(count(html, "#222222")).toBe(2)
    expect(count(html, "#abcdef")).toBe(1)
  })

  it("uses the label width prop", () => {
    const html = render(<Bars data={data} labelWidth="12rem" />)

    expect(html).toContain("width:12rem")
  })

  it("renders an empty state without a table", () => {
    const html = render(<Bars data={[]} emptyLabel="Nothing yet" />)

    expect(html).toContain("Nothing yet")
    expect(html).not.toContain("<table")
  })

  it("ignores non-finite values when finding the maximum", () => {
    const html = render(<Bars data={[{ label: "x", value: NaN }, { label: "y", value: 10 }]} />)

    expect(html).toContain("width:0%")
    expect(html).toContain("width:100%")
    expect(html).not.toContain("width:NaN")
  })

  it("names the table for assistive tech", () => {
    const titled = render(<Bars data={data} title="Top products" />)
    const overridden = render(<Bars data={data} ariaLabel="Orders by product" />)

    expect(titled).toContain('<h3 class="text-sm font-medium">Top products</h3>')
    expect(titled).toContain('aria-label="Top products"')
    expect(overridden).toContain('aria-label="Orders by product"')
  })

  it("uses row headers so each bar is labelled", () => {
    const html = render(<Bars data={data} />)

    expect(count(html, '<th scope="row"')).toBe(2)
  })

  it("defaults the track and text colours to theme custom properties", () => {
    const html = render(<Bars data={data} />)

    expect(html).toContain("var(--color-canvas, oklch(0.985 0.002 247.839))")
    expect(html).toContain("var(--color-muted-foreground, oklch(0.551 0.027 264.364))")
  })

  it("puts the palette's custom properties on its wrapper so bar colours follow the theme", () => {
    const html = render(<Bars data={data} />)

    expect(html).toMatch(/^<div class="[^"]*\[--chart-4:#4a3aa7\][^"]*dark:\[--chart-4:#9085e9\]/)
  })

  it("titles the chart with the same heading with data and without, at the level asked for", () => {
    const heading = '<h3 class="text-sm font-medium">Top products</h3>'
    expect(render(<Bars data={data} title="Top products" />)).toContain(heading)
    expect(render(<Bars data={[]} title="Top products" />)).toContain(heading)
    expect(render(<Bars data={data} title="Top products" />)).not.toContain("<caption")

    const level = render(<Bars data={data} title="Top products" headingLevel={2} />)
    expect(level).toContain('<h2 class="text-sm font-medium">Top products</h2>')
  })
})

const stacked: StackedBarDatum[] = [
  { label: "March", segments: [{ series: "Rent", value: 6 }, { series: "Food", value: 2 }] },
  { label: "April", segments: [{ series: "Food", value: 3 }, { series: "Fun", value: 1 }] },
]

describe("barTotal", () => {
  it("sums a stacked row's segments, skipping negative and non-finite ones", () => {
    expect(barTotal(stacked[0])).toBe(8)
    expect(
      barTotal({ label: "x", segments: [{ series: "a", value: -2 }, { series: "b", value: NaN }] }),
    )
      .toBe(0)
    expect(barTotal({ label: "x", value: 5 })).toBe(5)
  })
})

describe("Bars, stacked", () => {
  it("scales each stacked row by its total against the largest total", () => {
    const html = render(<Bars data={stacked} />)
    expect(html).toContain('<span class="flex h-full" style="width:100%;">')
    expect(html).toContain('<span class="flex h-full" style="width:50%;">')
    expect(html).toMatch(/data-series="Rent"[^>]*style="width:75%/)
    expect(html).toMatch(/data-series="Food"[^>]*style="width:25%/)
    // April's total is 4: its segments split its own half-length bar, 3 to 1.
    const april = html.slice(html.indexOf("April"))
    expect(april).toMatch(/data-series="Food"[^>]*style="width:75%/)
    expect(april).toMatch(/data-series="Fun"[^>]*style="width:25%/)
  })

  it("keeps one colour per series across rows, in order of first appearance", () => {
    const html = render(<Bars data={stacked} colors={["red", "green", "blue"]} />)
    expect(count(html, 'data-series="Food" class="block h-full" style="width:25%;background:green'))
      .toBe(1)
    expect(count(html, 'data-series="Food" class="block h-full" style="width:75%;background:green'))
      .toBe(1)
    expect(html).toContain(
      'data-series="Fun" class="block h-full" style="width:25%;background:blue',
    )
  })

  it("names every series in words in a legend, beside its colour", () => {
    const html = render(<Bars data={stacked} colors={["red", "green", "blue"]} />)
    const legend = html.slice(html.indexOf("data-bars-legend"))
    expect(legend).toMatch(/background:red[^>]*><\/span>Rent<\/li>/)
    expect(legend).toMatch(/background:green[^>]*><\/span>Food<\/li>/)
    expect(legend).toMatch(/background:blue[^>]*><\/span>Fun<\/li>/)
  })

  it("prints the total and reads each segment out after it", () => {
    const html = render(<Bars data={stacked} format={(value) => `${value} k`} />)
    expect(html).toContain('8 k<span class="sr-only"> (Rent: 6 k, Food: 2 k)</span>')
  })

  it("draws stacked and single rows in one list", () => {
    const html = render(<Bars data={[...stacked, { label: "May", value: 4 }]} />)
    expect(count(html, "<tr")).toBe(3)
    expect(html).toContain("width:50%;background:var(--color-chart-3")
  })
})

describe("Bars, reference", () => {
  it("draws a dashed line at the reference value on every row and names it in the legend", () => {
    const html = render(<Bars data={data} reference={{ value: 2, label: "Target" }} />)
    expect(count(html, "data-bars-reference")).toBe(2)
    expect(html).toMatch(
      /data-bars-reference="true" class="[^"]*border-dashed[^"]*" style="left:50%/,
    )
    expect(html).toMatch(
      /<li class="flex items-center gap-2"><span[^>]*border-dashed[^>]*><\/span>Target: 2<\/li>/,
    )
  })

  it("stretches the scale so a reference above every bar stays inside the track", () => {
    const html = render(<Bars data={data} reference={{ value: 8, label: "Target" }} />)
    expect(html).toContain("width:50%")
    expect(html).toContain("width:25%")
    expect(html).toMatch(/data-bars-reference="true"[^>]*style="left:100%/)
  })

  it("draws no legend for a plain list", () => {
    expect(render(<Bars data={data} />)).not.toContain("data-bars-legend")
  })
})
