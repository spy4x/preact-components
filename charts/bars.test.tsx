import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { type BarDatum, barPercent, Bars } from "./bars.tsx"

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

    expect(titled).toContain(
      '<caption class="mb-2 text-left text-sm font-medium">Top products</caption>',
    )
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
})
