import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  clampProgress,
  formatProgressPercent,
  Progress,
  progressWidthPercent,
} from "./progress.tsx"

describe("clampProgress", () => {
  it("keeps a reading inside the range", () => {
    expect(clampProgress(42)).toEqual({ value: 42, fraction: 0.42 })
  })

  it("reports a complete bar as the whole fraction", () => {
    expect(clampProgress(100)).toEqual({ value: 100, fraction: 1 })
  })

  it("reads the range from max", () => {
    expect(clampProgress(4, 8)).toEqual({ value: 4, fraction: 0.5 })
  })

  it("clamps a reading above max", () => {
    expect(clampProgress(140)).toEqual({ value: 100, fraction: 1 })
  })

  it("clamps a negative reading to zero", () => {
    expect(clampProgress(-20)).toEqual({ value: 0, fraction: 0 })
  })

  it("treats a max of zero as unmeasurable", () => {
    expect(clampProgress(5, 0)).toEqual({ value: null, fraction: null })
  })

  it("treats a negative max as unmeasurable", () => {
    expect(clampProgress(5, -50)).toEqual({ value: null, fraction: null })
  })

  it("treats a NaN reading as unmeasurable rather than zero", () => {
    expect(clampProgress(Number.NaN)).toEqual({ value: null, fraction: null })
  })

  it("treats a missing reading as unmeasurable", () => {
    expect(clampProgress(undefined)).toEqual({ value: null, fraction: null })
    expect(clampProgress(null)).toEqual({ value: null, fraction: null })
  })

  it("clamps an infinite reading to the bound it crosses", () => {
    expect(clampProgress(Number.POSITIVE_INFINITY)).toEqual({ value: 100, fraction: 1 })
    expect(clampProgress(Number.NEGATIVE_INFINITY)).toEqual({ value: 0, fraction: 0 })
  })

  it("treats an infinite max as unmeasurable", () => {
    expect(clampProgress(5, Number.POSITIVE_INFINITY)).toEqual({ value: null, fraction: null })
  })

  it("keeps the fraction in the unit interval for any finite reading", () => {
    for (const value of [-1e9, -1, 0, 0.5, 99.9, 100, 1e9, Number.NaN]) {
      const { fraction } = clampProgress(value, 100)
      if (fraction === null) continue
      expect(fraction >= 0 && fraction <= 1).toBe(true)
    }
  })
})

describe("formatProgressPercent", () => {
  it("formats a fraction as a whole percentage", () => {
    expect(formatProgressPercent(0.667)).toBe("66%")
  })

  it("formats the empty and complete ends", () => {
    expect(formatProgressPercent(0)).toBe("0%")
    expect(formatProgressPercent(1)).toBe("100%")
  })

  it("rounds down, so the printed value never leads the fill", () => {
    expect(formatProgressPercent(0.664)).toBe("66%")
    expect(formatProgressPercent(0.665)).toBe("66%")
    expect(formatProgressPercent(0.999)).toBe("99%")
    expect(formatProgressPercent(0.995)).toBe("99%")
  })

  it("refuses to print outside 0…100", () => {
    expect(formatProgressPercent(1.4)).toBe("100%")
    expect(formatProgressPercent(-0.2)).toBe("0%")
  })

  it("survives a NaN fraction", () => {
    expect(formatProgressPercent(Number.NaN)).toBe("0%")
  })
})

describe("progressWidthPercent", () => {
  it("turns a fraction into a paint-ready percentage", () => {
    expect(progressWidthPercent(0.42)).toBe(42)
  })

  it("keeps one decimal place", () => {
    expect(progressWidthPercent(0.999)).toBe(99.9)
  })

  it("does not leak a float artefact into the declaration", () => {
    expect(progressWidthPercent(1 / 3)).toBe(33.3)
    expect(`${progressWidthPercent(1 / 3)}%`).toBe("33.3%")
  })

  it("clamps outside the unit interval", () => {
    expect(progressWidthPercent(1.4)).toBe(100)
    expect(progressWidthPercent(-0.2)).toBe(0)
  })

  it("reads a missing or non-finite fraction as empty", () => {
    expect(progressWidthPercent(null)).toBe(0)
    expect(progressWidthPercent(Number.NaN)).toBe(0)
    expect(progressWidthPercent(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe("Progress", () => {
  it("does not read the ambient document", () => {
    const globals = globalThis as { document?: unknown; window?: unknown }
    expect(globals.document).toBeUndefined()
    expect(globals.window).toBeUndefined()
    expect(render(<Progress value={10} />)).toContain('role="progressbar"')
  })

  it("exposes the reading as a progress bar", () => {
    const html = render(<Progress value={42} />)

    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="42"')
    expect(html).toContain('aria-valuemin="0"')
    expect(html).toContain('aria-valuemax="100"')
  })

  it("publishes the caller's max", () => {
    const html = render(<Progress value={3} max={12} />)

    expect(html).toContain('aria-valuenow="3"')
    expect(html).toContain('aria-valuemax="12"')
  })

  it("clamps an over-range reading instead of publishing it", () => {
    const html = render(<Progress value={140} />)

    expect(html).toContain('aria-valuenow="100"')
    expect(html).not.toContain('aria-valuenow="140"')
  })

  it("clamps a negative reading to zero", () => {
    expect(render(<Progress value={-5} />)).toContain('aria-valuenow="0"')
  })

  it("renders the fill width in the server-rendered markup", () => {
    expect(render(<Progress value={42} />)).toContain("width:42%")
  })

  it("renders a full-width fill at max", () => {
    expect(render(<Progress value={100} />)).toContain("width:100%")
  })

  it("omits aria-valuenow when the reading is unknown", () => {
    const html = render(<Progress value={Number.NaN} />)

    expect(html).toContain('role="progressbar"')
    expect(html).not.toContain("aria-valuenow")
    expect(html).not.toContain("width:")
  })

  it("omits aria-valuenow when the reading is missing", () => {
    const html = render(<Progress />)

    expect(html).not.toContain("aria-valuenow")
    expect(html).not.toContain("width:")
  })

  it("omits aria-valuenow and the fill when max is unmeasurable", () => {
    const html = render(<Progress value={5} max={0} />)

    expect(html).not.toContain("aria-valuenow")
    expect(html).not.toContain("width:")
  })

  it("falls back to ARIA's implicit range when max is unmeasurable", () => {
    const html = render(<Progress value={5} max={0} />)

    expect(html).toContain('aria-valuemin="0"')
    expect(html).toContain('aria-valuemax="100"')
    expect(html).not.toContain('aria-valuemax="0"')
  })

  it("publishes the caller's max as valuemax for a measurable bar", () => {
    expect(render(<Progress value={5} max={7} />)).toContain('aria-valuemax="7"')
  })

  it("paints the fill with the semantic colour atoms", () => {
    expect(render(<Progress value={50} />)).toContain("bg-primary")
    expect(render(<Progress value={50} tone="success" />)).toContain("bg-success")
    expect(render(<Progress value={50} tone="warning" />)).toContain("bg-warning")
    expect(render(<Progress value={50} tone="danger" />)).toContain("bg-danger")
  })

  it("hardcodes no colour for the fill", () => {
    for (const tone of ["primary", "success", "warning", "danger"] as const) {
      const html = render(<Progress value={50} tone={tone} />)

      expect(html).not.toContain("bg-gradient")
      expect(html).not.toContain("bg-red-")
      expect(html).not.toContain("bg-green-")
      expect(html).not.toContain("bg-yellow-")
      expect(html).not.toContain("bg-purple-")
    }
  })

  it("renders the label above the bar", () => {
    expect(render(<Progress value={50} label="Storage used" id="storage" />)).toContain(
      "Storage used",
    )
  })

  it("names the progressbar from its label", () => {
    const html = render(<Progress value={50} label="Storage used" id="storage" />)

    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-labelledby="storage-label"')
    expect(html).toContain('id="storage-label"')
    expect(html).toContain('class="kpi-label truncate"')
  })

  it("renders the label's span id as the bar id plus a suffix", () => {
    const html = render(<Progress value={50} label="Storage used" id="storage" />)

    expect(html).toContain('id="storage"')
    expect(html).toContain('id="storage-label"')
    expect(html).not.toContain('id="storage-label-label"')
  })

  it("rejects a captioned bar without an id at compile time", () => {
    // @ts-expect-error `label` requires `id`: an unlinked caption leaves the bar unnamed, and
    // ARIA 1.2 requires an accessible name on `progressbar`. Removing the union re-breaks this.
    const unnamed = <Progress value={50} label="Storage used" />

    expect(unnamed).toBeDefined()
  })

  it("rejects an id without a caption at compile time", () => {
    // @ts-expect-error `id` names a caption; on its own it labels nothing.
    const pointless = <Progress value={50} id="storage" />

    expect(pointless).toBeDefined()
  })

  it("does not link a label it did not render", () => {
    expect(render(<Progress value={50} id="storage" label="Storage used" />)).toContain(
      "aria-labelledby",
    )
    expect(render(<Progress value={50} showValue={false} />)).not.toContain("aria-labelledby")
  })

  it("shows the percentage by default", () => {
    expect(render(<Progress value={66.7} />)).toContain("66%")
  })

  it("hides the percentage when asked", () => {
    const html = render(<Progress value={66.7} showValue={false} />)

    expect(html).not.toContain("67%")
    expect(html).not.toContain("num")
  })

  it("shows no percentage for an unknown reading", () => {
    const html = render(<Progress label="Uploading" id="uploading" value={Number.NaN} />)

    expect(html).toContain("Uploading")
    expect(html).not.toContain("%")
  })

  it("renders no percentage for an unmeasurable reading", () => {
    const html = render(<Progress value={5} max={0} />)

    expect(html).not.toContain("num")
    expect(html).not.toContain("justify-between")
  })

  it("renders no header row when there is nothing to put in it", () => {
    const html = render(<Progress value={10} showValue={false} />)

    expect(html).not.toContain("justify-between")
  })

  it("keeps the header row when it carries only a value", () => {
    expect(render(<Progress value={10} />)).toContain("justify-between")
  })

  it("does not round a filling bar up to complete", () => {
    const html = render(<Progress value={999} max={1000} />)

    expect(html).toContain('aria-valuenow="999"')
    expect(html).toContain("width:99.9%")
    expect(html).toContain("99%")
    expect(html).not.toContain("100%")
  })

  it("renders a paint-ready width instead of a float artefact", () => {
    const html = render(<Progress value={1} max={3} />)

    expect(html).toContain("width:33.3%")
    expect(html).not.toContain("33.300000000000004")
  })

  it("keeps the track neutral rather than tone-coloured", () => {
    expect(render(<Progress value={50} tone="danger" />)).toContain("bg-gray-200")
  })

  it("appends a caller class", () => {
    expect(render(<Progress value={50} class="mt-4" />)).toContain("mt-4")
  })
})
