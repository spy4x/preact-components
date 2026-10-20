import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { LazySlot } from "./lazy-slot.tsx"

const SLOT = { label: "Revenue", drawnWith: "d3", module: "the chart module", e2e: "demo" }

describe("LazySlot", () => {
  it("shows a placeholder naming the component and what draws it while the module loads", () => {
    const html = render(
      <LazySlot state={{ status: "loading" }} boxClass="min-h-48" {...SLOT}>
        {() => <svg />}
      </LazySlot>,
    )

    expect(html).toMatch(
      /^<div data-e2e="demo-slot"><div data-e2e="demo-placeholder" class="[^"]*min-h-48/,
    )
    expect(html).toContain(">Revenue: drawn in the browser with d3</div>")
    expect(html).not.toContain("<svg")
  })

  it("shows a danger-toned alert naming what did not load and why when the load failed", () => {
    const html = render(
      <LazySlot state={{ status: "failed", message: "offline" }} boxClass="" {...SLOT}>
        {() => <svg />}
      </LazySlot>,
    )

    expect(html).toMatch(/^<div data-e2e="demo-slot"><div data-e2e="demo-failed" role="alert"/)
    // The theme's danger tokens, so an app's repainted danger colour and the ink palette apply.
    expect(html).toContain("border-danger bg-danger-soft")
    expect(html).not.toMatch(/red-\d/)
    expect(html.replace(/<[^>]+>/g, "")).toBe("Revenue: the chart module did not load — offline")
  })

  it("renders the loaded module's component inside the same slot and drops the placeholder", () => {
    const html = render(
      <LazySlot state={{ status: "loaded", module: { title: "chart" } }} boxClass="" {...SLOT}>
        {({ title }) => <svg aria-label={title} />}
      </LazySlot>,
    )

    expect(html).toBe(`<div data-e2e="demo-slot"><svg aria-label="chart"></svg></div>`)
  })
})
