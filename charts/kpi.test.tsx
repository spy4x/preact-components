import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Kpi, KpiGrid } from "./kpi.tsx"

function count(html: string, needle: string): number {
  return html.split(needle).length - 1
}

describe("Kpi", () => {
  it("renders the label, value and caption", () => {
    const html = render(<Kpi label="Conversion" value="54.2%" sub="1 240 visits" />)

    expect(html).toContain("Conversion")
    expect(html).toContain("54.2%")
    expect(html).toContain("1 240 visits")
  })

  it("accepts a numeric value", () => {
    expect(render(<Kpi label="Orders" value={1234} />)).toContain("1234")
  })

  it("omits the caption when there is none", () => {
    const withSub = render(<Kpi label="Orders" value={1} sub="since the reset" />)
    const withoutSub = render(<Kpi label="Orders" value={1} />)

    expect(count(withSub, "<div")).toBe(4)
    expect(count(withoutSub, "<div")).toBe(3)
  })

  it("defaults to the accent tone", () => {
    const html = render(<Kpi label="a" value={1} />)

    expect(html).toContain("text-accent-900")
  })

  it("maps every tone to its own colour", () => {
    const tones = {
      accent: "text-accent-900",
      positive: "text-success",
      warning: "text-warning",
      negative: "text-danger",
      neutral: "text-foreground",
    } as const

    for (const [tone, className] of Object.entries(tones)) {
      const html = render(<Kpi label="a" value={1} tone={tone as keyof typeof tones} />)

      expect(html).toContain(className)
    }
  })

  it("draws the status tones in theme tokens alone, with no fixed colour or dark override", () => {
    for (const tone of ["positive", "warning", "negative"] as const) {
      const html = render(<Kpi label="a" value={1} tone={tone} />)

      expect(html).not.toMatch(/\b(?:text|dark:text)-(?:red|green|orange|amber)-\d{2,3}\b/)
      expect(html).not.toContain("dark:text-")
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

  it("lets the caller's padding replace the default instead of competing with it", () => {
    const html = render(<Kpi label="a" value={1} class="px-6" />)

    expect(html).toContain("px-6")
    expect(html).not.toContain("px-4")
  })
})

describe("Kpi change", () => {
  /** The change line's opening tag and its contents, up to its closing `</div>`. */
  function changeLine(html: string): string {
    const line = html.match(/<div [^>]*data-kpi-change[^>]*>.*?<\/div>/)?.[0]
    if (line === undefined) throw new Error(`no change line in ${html}`)
    return line
  }

  /** The value's `<div>`, the second in the card. */
  function valueTag(html: string): string {
    return [...html.matchAll(/<div [^>]*>/g)][2][0]
  }

  it("draws the change in words under the value, before the caption", () => {
    const html = render(
      <Kpi
        label="Visits"
        value="1,240"
        sub="all sources"
        change={{ text: "+120 vs previous 30 days", direction: "up" }}
      />,
    )

    expect(changeLine(html)).toContain("<span>+120 vs previous 30 days</span>")
    expect(html.indexOf("1,240")).toBeLessThan(html.indexOf("+120"))
    expect(html.indexOf("+120")).toBeLessThan(html.indexOf("all sources"))
  })

  it("gives each direction its own icon, hidden from a screen reader", () => {
    const paths = new Set<string>()
    for (const direction of ["up", "down", "flat"] as const) {
      const line = changeLine(
        render(<Kpi label="a" value={1} change={{ text: "words", direction }} />),
      )

      expect(line).toContain(`data-kpi-change="${direction}"`)
      expect(line).toMatch(/<svg [^>]*aria-hidden="true"/)
      paths.add(line.match(/ d="([^"]+)"/)?.[1] ?? "")
    }

    expect(paths.size).toBe(3)
  })

  it("colours only the change line, keeping the value in the foreground colour", () => {
    const html = render(
      <Kpi
        label="Order clicks"
        value={52}
        tone="negative"
        change={{ text: "−3 vs previous 30 days", direction: "down", tone: "negative" }}
      />,
    )

    expect(valueTag(html)).toContain("text-foreground")
    expect(valueTag(html)).not.toContain("text-danger")
    expect(changeLine(html)).toContain("text-danger")
  })

  it("mutes a change whose tone the caller left out", () => {
    const line = changeLine(
      render(<Kpi label="a" value={1} change={{ text: "No change", direction: "flat" }} />),
    )

    expect(line).toContain("text-muted")
  })

  it("leaves the tone on the value when there is no change", () => {
    const html = render(<Kpi label="a" value={1} tone="positive" />)

    expect(valueTag(html)).toContain("text-success")
    expect(html).not.toContain("data-kpi-change")
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

  it("lets the caller's gap replace the default", () => {
    expect(render(<KpiGrid class="gap-6">{null}</KpiGrid>)).toContain(`class="grid gap-6"`)
  })
})
