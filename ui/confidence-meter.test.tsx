import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { clampConfidence, ConfidenceMeter } from "./confidence-meter.tsx"

describe("clampConfidence", () => {
  it("bands a high score", () => {
    expect(clampConfidence(90)).toEqual({ value: 90, tier: "high" })
  })

  it("bands a medium score", () => {
    expect(clampConfidence(60)).toEqual({ value: 60, tier: "medium" })
  })

  it("bands a low score", () => {
    expect(clampConfidence(10)).toEqual({ value: 10, tier: "low" })
  })

  it("treats the band edges as inclusive", () => {
    expect(clampConfidence(75).tier).toBe("high")
    expect(clampConfidence(74.9).tier).toBe("medium")
    expect(clampConfidence(50).tier).toBe("medium")
    expect(clampConfidence(49.9).tier).toBe("low")
  })

  it("clamps scores above the range", () => {
    expect(clampConfidence(140)).toEqual({ value: 100, tier: "high" })
  })

  it("clamps scores below the range", () => {
    expect(clampConfidence(-20)).toEqual({ value: 0, tier: "low" })
  })

  it("bands NaN as low rather than throwing", () => {
    expect(clampConfidence(Number.NaN).tier).toBe("low")
  })
})

describe("ConfidenceMeter", () => {
  it("renders the clamped percentage", () => {
    expect(render(<ConfidenceMeter value={140} />)).toContain("100%")
  })

  it("renders the fill width in the server-rendered markup", () => {
    expect(render(<ConfidenceMeter value={42} />)).toContain("width:42%")
  })

  it("exposes the score as a progress bar", () => {
    const html = render(<ConfidenceMeter value={42} />)

    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="42"')
    expect(html).toContain('aria-valuemin="0"')
    expect(html).toContain('aria-valuemax="100"')
  })

  it("paints the fill with the confidence gradient", () => {
    const html = render(<ConfidenceMeter value={80} />)

    expect(html).toContain("bg-gradient-to-r")
    expect(html).toContain("from-red-500")
    expect(html).toContain("to-green-500")
  })

  it("colours the percentage by tier", () => {
    expect(render(<ConfidenceMeter value={80} />)).toContain("text-green-600")
    expect(render(<ConfidenceMeter value={60} />)).toContain("text-yellow-600")
    expect(render(<ConfidenceMeter value={10} />)).toContain("text-red-600")
  })

  it("spells the tier out for assistive tech", () => {
    expect(render(<ConfidenceMeter value={80} />)).toContain("High confidence")
  })

  it("renders the caption when given", () => {
    expect(render(<ConfidenceMeter value={80} label="based on 12 signals" />))
      .toContain("based on 12 signals")
  })

  it("rounds the displayed percentage", () => {
    expect(render(<ConfidenceMeter value={66.7} />)).toContain("67%")
  })

  it("appends a caller class", () => {
    expect(render(<ConfidenceMeter value={50} class="mt-4" />)).toContain("mt-4")
  })
})
