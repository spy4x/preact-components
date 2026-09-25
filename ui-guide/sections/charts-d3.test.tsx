import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UIGuide } from "../+index.tsx"

describe("the charts page's d3 cards", () => {
  it("server-render each d3 chart as a placeholder inside its slot, and a line for each d3 example", () => {
    const html = render(<UIGuide hash="#/charts" />)

    // Two `D3LineChart`s and one `CompareChart`, each placeholder directly inside the slot the
    // server/browser text check leaves out.
    expect(html.match(/data-e2e="d3-chart-slot"><div data-e2e="d3-chart-placeholder"/g)?.length)
      .toBe(3)
    // The colours, time labels, `yDomainFor` and `assertD3Available` examples.
    expect(
      html.match(/&lt;computed in the browser: needs charts\/d3-line-chart, which imports d3>/g)
        ?.length,
    ).toBe(4)
  })

  it("serve wording that stays true without JavaScript: nothing promises a load", () => {
    const html = render(<UIGuide hash="#/charts" />)

    const placeholders = [...html.matchAll(/data-e2e="d3-chart-placeholder"[^>]*>([^<]*)</g)]
      .map(([, text]) => text)
    expect(placeholders).toEqual([
      "Revenue, k€: drawn in the browser with d3",
      "Revenue with a gap for missing values: drawn in the browser with d3",
      "Revenue, k€: drawn in the browser with d3",
    ])
    const outputs = [...html.matchAll(/data-e2e="example-output"[^>]*><code>([^<]*)</g)]
      .map(([, text]) => text)
    expect(outputs.filter((text) => /&lt;loading/i.test(text))).toEqual([])
  })
})
