import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UIGuide } from "../+index.tsx"

describe("the charts page's d3 cards", () => {
  it("server-render a placeholder for each d3 chart and a loading line for each d3 example", () => {
    const html = render(<UIGuide hash="#/charts" />)

    // Two `D3LineChart`s and one `CompareChart`.
    expect(html.match(/data-e2e="d3-chart-loading"/g)?.length).toBe(3)
    // The colours, time labels, `yDomainFor` and `assertD3Available` examples.
    expect(html.match(/&lt;loading charts\/d3-line-chart, which imports d3>/g)?.length).toBe(4)
  })
})
