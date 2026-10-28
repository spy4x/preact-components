import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Slider, sliderFraction } from "./slider.tsx"

describe("sliderFraction", () => {
  it("places a value along its range", () => {
    expect(sliderFraction(25, 0, 100)).toBe(0.25)
    expect(sliderFraction(1, 0, 3)).toBe(0.3333)
    expect(sliderFraction(15, 10, 20)).toBe(0.5)
  })

  it("clamps a value outside the range to the nearer end", () => {
    expect(sliderFraction(-5, 0, 10)).toBe(0)
    expect(sliderFraction(50, 0, 10)).toBe(1)
  })

  it("puts everything at the start when the range has no width or a bound is not a number", () => {
    expect(sliderFraction(5, 10, 10)).toBe(0)
    expect(sliderFraction(5, 10, 0)).toBe(0)
    expect(sliderFraction(NaN, 0, 10)).toBe(0)
    expect(sliderFraction(5, 0, Infinity)).toBe(0)
  })
})

describe("Slider", () => {
  it("renders a native range input named by its visible label", () => {
    const html = render(<Slider id="rate" label="Rate" value={40} min={0} max={80} step={5} />)
    expect(html).toMatch(/<label for="rate"[^>]*>Rate<\/label>/)
    expect(html).toMatch(/<input id="rate" type="range" min="0" max="80" step="5" value="40"/)
  })

  it("prints the formatted value in tabular figures, hidden from screen readers", () => {
    const html = render(
      <Slider id="rate" label="Rate" value={40} format={(value) => `${value}%`} />,
    )
    expect(html).toMatch(/<span aria-hidden="true" class="pc-num[^"]*">40%<\/span>/)
  })

  it("announces the value through aria-valuetext, from valueText or else from format", () => {
    const formatted = render(<Slider label="Rate" value={2} format={(value) => `${value}×`} />)
    expect(formatted).toContain('aria-valuetext="2×"')
    const spoken = render(
      <Slider
        label="Rate"
        value={2}
        format={(value) => `${value}×`}
        valueText={(value) => `${value} times`}
      />,
    )
    expect(spoken).toContain('aria-valuetext="2 times"')
  })

  it("fills the track up to the thumb's centre in the server markup", () => {
    const html = render(<Slider label="Rate" value={25} />)
    expect(html).toContain("--pc-slider-fill:calc(0.625rem + (100% - 1.25rem) * 0.25)")
  })

  it("draws at most two marks, each at its value, and ties them and the hint to the input", () => {
    const html = render(
      <Slider
        id="rate"
        label="Rate"
        value={50}
        hint="Drag or use the arrow keys."
        marks={[
          { value: 0, label: "None" },
          { value: 50, label: "Typical" },
          { value: 100, label: "Dropped" },
        ]}
      />,
    )
    expect(html).toContain('aria-describedby="rate-marks rate-hint"')
    expect(html).toContain(">None<")
    expect(html).toContain(">Typical<")
    expect(html).not.toContain("Dropped")
    expect(html).toContain("inset-inline-start:calc(0.625rem + (100% - 1.25rem) * 0.5)")
    expect(html).toMatch(/<p id="rate-hint"[^>]*>Drag or use the arrow keys\.<\/p>/)
  })

  it("keeps a mark label at an end aligned to that end, so it stays over the track", () => {
    const html = render(
      <Slider
        label="Rate"
        value={50}
        marks={[{ value: 0, label: "Low" }, { value: 100, label: "High" }]}
      />,
    )
    expect(html).toMatch(/class="[^"]*items-start text-start"[^>]*>(?:(?!<\/span><\/span>).)*Low/)
    expect(html).toMatch(/class="[^"]*-translate-x-full \[&amp;:dir\(rtl\)\]:translate-x-full items-end text-end"[^>]*>.*High/)
  })

  it("describes nothing when it has neither marks nor a hint", () => {
    expect(render(<Slider label="Rate" value={1} />)).not.toContain("aria-describedby")
  })

  it("generates an id when none is given, so the label still names the input", () => {
    const html = render(<Slider label="Rate" value={1} />)
    const id = html.match(/<input id="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`<label for="${id}"`)
  })

  it("disables the input, dims it, and mutes the label and the value", () => {
    const html = render(<Slider label="Rate" value={1} disabled />)
    expect(html).toMatch(/<input[^>]*\sdisabled[\s/>]/)
    expect(html).toMatch(/<input[^>]*class="[^"]*\bopacity-50\b/)
    expect(html).toMatch(/<label for="[^"]+" class="[^"]*\btext-muted\b/)
    expect(html).toMatch(/<span aria-hidden="true" class="pc-num[^"]*\btext-muted\b/)
  })
})
