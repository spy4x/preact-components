import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Kpi, KpiGrid } from "./kpi.tsx"

function count(html: string, needle: string): number {
  return html.split(needle).length - 1
}

describe("Kpi", () => {
  it("renders the label, value and caption", () => {
    const html = render(<Kpi label="Win rate" value="54.2%" sub="1 240 matches" />)

    expect(html).toContain("Win rate")
    expect(html).toContain("54.2%")
    expect(html).toContain("1 240 matches")
  })

  it("accepts a numeric value", () => {
    expect(render(<Kpi label="Kills" value={1234} />)).toContain("1234")
  })

  it("omits the caption when there is none", () => {
    const withSub = render(<Kpi label="Kills" value={1} sub="since the reset" />)
    const withoutSub = render(<Kpi label="Kills" value={1} />)

    expect(count(withSub, "<div")).toBe(4)
    expect(count(withoutSub, "<div")).toBe(3)
  })

  it("defaults to the accent tone", () => {
    const html = render(<Kpi label="a" value={1} />)

    expect(html).toContain("text-purple-900")
  })

  it("maps every tone to its own colour", () => {
    const tones = {
      accent: "text-purple-900",
      positive: "text-green-700",
      warning: "text-orange-600",
      negative: "text-red-600",
      neutral: "text-gray-700",
    } as const

    for (const [tone, className] of Object.entries(tones)) {
      const html = render(<Kpi label="a" value={1} tone={tone as keyof typeof tones} />)

      expect(html).toContain(className)
    }
  })

  it("uses tabular figures so a row of cards stays aligned", () => {
    expect(render(<Kpi label="a" value={1} />)).toContain("tabular-nums")
  })

  it("keeps the caller's class", () => {
    const html = render(<Kpi label="a" value={1} class="col-span-2" />)

    expect(html).toContain("col-span-2")
    expect(html).toContain("rounded-lg")
  })
})

describe("KpiGrid", () => {
  it("lays the cards out on a responsive grid", () => {
    const html = render(
      <KpiGrid>
        <Kpi label="a" value={1} />
        <Kpi label="b" value={2} />
      </KpiGrid>,
    )

    expect(html).toContain("grid-template-columns:repeat(auto-fit, minmax(10rem, 1fr))")
    expect(count(html, 'class="flex flex-col')).toBe(2)
  })

  it("takes the minimum column width as a prop", () => {
    const html = render(
      <KpiGrid minWidth="14rem">
        <Kpi label="a" value={1} />
      </KpiGrid>,
    )

    expect(html).toContain("minmax(14rem, 1fr)")
  })

  it("keeps the caller's class", () => {
    expect(render(<KpiGrid class="mt-4">{null}</KpiGrid>)).toContain("grid gap-3 mt-4")
  })
})
