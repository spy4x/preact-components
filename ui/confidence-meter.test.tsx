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

  it("clamps the ends of the range", () => {
    expect(clampConfidence(0)).toEqual({ value: 0, tier: "low" })
    expect(clampConfidence(100)).toEqual({ value: 100, tier: "high" })
  })

  it("clamps scores above the range", () => {
    expect(clampConfidence(140)).toEqual({ value: 100, tier: "high" })
  })

  it("clamps scores below the range", () => {
    expect(clampConfidence(-20)).toEqual({ value: 0, tier: "low" })
  })

  it("treats a NaN score as unmeasurable rather than a low band", () => {
    expect(clampConfidence(Number.NaN)).toEqual({ value: null, tier: null })
  })

  it("treats a missing score as unmeasurable", () => {
    expect(clampConfidence(null)).toEqual({ value: null, tier: null })
    expect(clampConfidence(undefined)).toEqual({ value: null, tier: null })
  })

  it("treats an infinite score as unmeasurable rather than a maximal one", () => {
    expect(clampConfidence(Number.POSITIVE_INFINITY)).toEqual({ value: null, tier: null })
    expect(clampConfidence(Number.NEGATIVE_INFINITY)).toEqual({ value: null, tier: null })
  })

  it("returns a null value and tier together or not at all", () => {
    const readings: (number | null | undefined)[] = [
      0,
      42,
      100,
      1e9,
      -1e9,
      Number.NaN,
      null,
      undefined,
    ]

    for (const reading of readings) {
      const { value, tier } = clampConfidence(reading)
      expect(value === null).toBe(tier === null)
    }
  })
})

describe("ConfidenceMeter", () => {
  const unknownReadings: [string, number | null | undefined][] = [
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["null", null],
    ["undefined", undefined],
  ]

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

  it("keeps the boundary scores on the legacy markup", () => {
    const empty = render(<ConfidenceMeter value={0} />)
    expect(empty).toContain('aria-valuenow="0"')
    expect(empty).toContain("width:0%")
    expect(empty).toContain(">0%<")

    const full = render(<ConfidenceMeter value={100} />)
    expect(full).toContain('aria-valuenow="100"')
    expect(full).toContain("width:100%")
    expect(full).toContain(">100%<")

    const low = render(<ConfidenceMeter value={-20} />)
    expect(low).toContain('aria-valuenow="0"')
    expect(low).toContain("width:0%")
  })

  it("renders a known score without a NaN anywhere in the markup", () => {
    const html = render(<ConfidenceMeter value={42} />)

    expect(html).not.toContain("NaN")
    expect(html).not.toContain("Infinity")
  })

  for (const [name, reading] of unknownReadings) {
    it(`publishes no reading when the score is ${name}`, () => {
      // The whole markup is searched, so a `NaN` in any attribute, style or text node fails here.
      const html = render(<ConfidenceMeter value={reading} />)

      expect(html).not.toContain("NaN")
      expect(html).not.toContain("Infinity")
      expect(html).not.toContain("aria-valuenow")
      expect(html).not.toContain("width:")
      expect(html).not.toContain("%")
    })

    it(`paints no fill when the score is ${name}`, () => {
      const html = render(<ConfidenceMeter value={reading} />)

      expect(html).not.toContain("bg-gradient-to-r")
      expect(html).toContain("bg-gray-200")
    })

    it(`stays a nameable progress bar when the score is ${name}`, () => {
      const html = render(<ConfidenceMeter value={reading} />)

      expect(html).toContain('role="progressbar"')
      expect(html).toContain('aria-valuemin="0"')
      expect(html).toContain('aria-valuemax="100"')
      expect(html).toContain("Unknown confidence")
    })

    it(`keeps the caption and the caller class when the score is ${name}`, () => {
      const html = render(
        <ConfidenceMeter value={reading} label="based on 12 signals" class="mt-4" />,
      )

      expect(html).toContain("based on 12 signals")
      expect(html).toContain("mt-4")
    })

    it(`claims no tier when the score is ${name}`, () => {
      const html = render(<ConfidenceMeter value={reading} />)

      expect(html).not.toContain("Low confidence")
      expect(html).not.toContain("Medium confidence")
      expect(html).not.toContain("High confidence")
      expect(html).not.toContain("text-red-600")
      expect(html).not.toContain("text-yellow-600")
      expect(html).not.toContain("text-green-600")
    })
  }

  it("omits the reading when no score is passed at all", () => {
    const html = render(<ConfidenceMeter />)

    expect(html).not.toContain("aria-valuenow")
    expect(html).not.toContain("width:")
    expect(html).not.toContain("%")
    expect(html).toContain('role="progressbar"')
    expect(html).toContain("Unknown confidence")
  })

  it("recovers the fill and the percentage once a reading arrives", () => {
    const html = render(
      <>
        <ConfidenceMeter value={Number.NaN} />
        <ConfidenceMeter value={60} />
      </>,
    )

    expect(html).toContain('aria-valuenow="60"')
    expect(html).toContain("width:60%")
    expect(html).toContain(">60%<")
    expect(html).toContain("Medium confidence")
  })
})
