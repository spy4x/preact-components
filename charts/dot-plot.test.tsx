import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { dotPercent, DotPlot, type DotPlotRow } from "./dot-plot.tsx"

const rows: DotPlotRow[] = [
  { id: "a", label: "Alpha", value: 25, detail: "2024 survey" },
  { id: "b", label: "Beta", value: null },
  { id: "c", label: "Gamma", value: 75, muted: true, note: "Small sample" },
]

function count(html: string, needle: RegExp): number {
  return html.match(needle)?.length ?? 0
}

describe("dotPercent", () => {
  it("places a value on the scale", () => {
    expect(dotPercent(25, [0, 100])).toBe(25)
    expect(dotPercent(0, [-10, 10])).toBe(50)
    expect(dotPercent(1, [0, 3])).toBe(33.33)
  })

  it("clamps a value outside the domain to the nearer end", () => {
    expect(dotPercent(-5, [0, 10])).toBe(0)
    expect(dotPercent(50, [0, 10])).toBe(100)
  })

  it("puts everything at zero for an empty, reversed or non-finite domain", () => {
    expect(dotPercent(5, [10, 10])).toBe(0)
    expect(dotPercent(5, [10, 0])).toBe(0)
    expect(dotPercent(NaN, [0, 10])).toBe(0)
  })
})

describe("DotPlot", () => {
  it("reads as a list: labels, details and values are text, only the tracks are hidden", () => {
    const html = render(<DotPlot rows={rows} domain={[0, 100]} ariaLabel="Scores" />)
    expect(html).toMatch(/<ul role="list" aria-label="Scores"/)
    expect(count(html, /<li /g)).toBe(3)
    expect(html).toContain(">Alpha<")
    expect(html).toContain(">2024 survey<")
    expect(html).toContain(">25<")
    // Each row's track, plus the scale's ends under the list.
    expect(count(html, /<span aria-hidden="true" class="relative h-5">/g)).toBe(3)
  })

  it("places each dot at its value along the domain", () => {
    const html = render(<DotPlot rows={rows} domain={[0, 100]} />)
    const rowOf = (label: string) => html.slice(html.indexOf(`>${label}<`)).split("</li>")[0]
    expect(rowOf("Alpha")).toMatch(/data-dot="true"[^>]*style="left:25%/)
    expect(rowOf("Gamma")).toMatch(/data-dot="true"[^>]*style="left:75%/)
  })

  it("draws no dot for a row with no value and prints the missing label instead", () => {
    const html = render(<DotPlot rows={rows} domain={[0, 100]} missingLabel="Not measured" />)
    expect(count(html, /data-dot="true"/g)).toBe(2)
    expect(html).toContain(">Not measured<")
  })

  it("draws a muted row's dot hollow and prints its note", () => {
    const html = render(<DotPlot rows={rows} domain={[0, 100]} />)
    const muted = html.slice(html.indexOf('data-muted="true"'))
    expect(muted).toContain(">Small sample<")
    expect(muted).toMatch(/data-dot[^>]*style="[^"]*background:var\(--color-surface/)
  })

  it("draws the summary row bolder, after a hairline, with a larger dot", () => {
    const html = render(
      <DotPlot rows={rows} domain={[0, 100]} summary={{ id: "all", label: "All", value: 50 }} />,
    )
    expect(count(html, /<li /g)).toBe(4)
    const summary = html.slice(html.indexOf('data-dot-row="summary"') - 200)
    expect(summary).toMatch(/border-t border-subtle/)
    expect(summary).toMatch(/font-semibold[^"]*">All</)
    expect(summary).toMatch(/data-dot="true" class="[^"]*size-4/)
  })

  it("shades each band behind every row and names it in the legend", () => {
    const html = render(
      <DotPlot
        rows={rows}
        domain={[0, 100]}
        bands={[{ from: 20, to: 40, label: "Typical range", strength: 2 }]}
      />,
    )
    expect(count(html, /left:20%;width:20%;background:color-mix\(in oklab, [^;]* 60%/g)).toBe(3)
    expect(html).toMatch(
      /<li class="flex items-center gap-2"><span aria-hidden="true"[^>]*><\/span>Typical range<\/li>/,
    )
  })

  it("draws a band given high end first the same as one given low end first", () => {
    const html = render(
      <DotPlot
        rows={rows}
        domain={[0, 100]}
        bands={[{ from: 40, to: 20, label: "Reversed", strength: 1 }]}
      />,
    )
    expect(count(html, /left:20%;width:20%;background:color-mix/g)).toBe(3)
  })

  it("mixes the lighter band at 45% of the text colour into the surface", () => {
    const light = render(
      <DotPlot
        rows={rows}
        domain={[0, 100]}
        bands={[{ from: 0, to: 10, label: "L", strength: 1 }]}
      />,
    )
    expect(light).toMatch(/color-mix\(in oklab, var\(--color-foreground[^%]*\) 45%/)
  })

  it("draws the zero rule only when asked and when zero lies inside the domain", () => {
    const rule = /class="absolute inset-y-0 w-px/g
    expect(count(render(<DotPlot rows={rows} domain={[-50, 50]} zero />), rule)).toBe(3)
    expect(render(<DotPlot rows={rows} domain={[-50, 50]} zero />)).toContain("left:50%")
    expect(count(render(<DotPlot rows={rows} domain={[-50, 50]} />), rule)).toBe(0)
    expect(count(render(<DotPlot rows={rows} domain={[0, 100]} zero />), rule)).toBe(0)
  })

  it("prints the scale's ends with the value format", () => {
    const html = render(<DotPlot rows={rows} domain={[0, 100]} format={(value) => `${value}%`} />)
    expect(html).toContain("<span>0%</span><span>100%</span>")
  })
})
