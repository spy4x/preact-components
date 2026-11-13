import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { SegmentedControl, type SegmentedOption } from "./segmented-control.tsx"

const periods: SegmentedOption[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
]

/** Every `<button …>` opening tag, in order. */
function segments(html: string): string[] {
  return [...html.matchAll(/<button [^>]*>/g)].map((match) => match[0])
}

describe("SegmentedControl", () => {
  it("renders a radio group of one radio per option", () => {
    const html = render(
      <SegmentedControl ariaLabel="Period" options={periods} value="30" onChange={() => {}} />,
    )

    expect(html).toMatch(/^<div role="radiogroup" aria-label="Period"/)
    expect(segments(html).every((tag) => tag.includes('role="radio"'))).toBe(true)
    expect(segments(html).length).toBe(3)
  })

  it("checks the chosen option alone and makes it the one tab stop", () => {
    const html = render(
      <SegmentedControl ariaLabel="Period" options={periods} value="30" onChange={() => {}} />,
    )
    const [seven, thirty, ninety] = segments(html)

    expect(thirty).toContain('aria-checked="true"')
    expect(thirty).toContain('tabindex="0"')
    for (const other of [seven, ninety]) {
      expect(other).toContain('aria-checked="false"')
      expect(other).toContain('tabindex="-1"')
    }
  })

  it("marks the chosen segment with a check as well as the fill", () => {
    const html = render(
      <SegmentedControl ariaLabel="Period" options={periods} value="90" onChange={() => {}} />,
    )

    expect(html.split("<svg").length - 1).toBe(1)
    expect(html).toMatch(/aria-checked="true"[^>]*class="[^"]*\bbg-selected\b[^"]*"><svg/)
  })

  it("is at least 44 px tall on a phone", () => {
    const html = render(
      <SegmentedControl ariaLabel="Period" options={periods} value="7" onChange={() => {}} />,
    )

    expect(segments(html).every((tag) => /\bmin-h-11\b/.test(tag))).toBe(true)
  })

  it("gives the tab stop to the first segment when the value matches none", () => {
    const html = render(
      <SegmentedControl ariaLabel="Period" options={periods} value="365" onChange={() => {}} />,
    )
    const [seven, thirty, ninety] = segments(html)

    expect(seven).toContain('tabindex="0"')
    expect(thirty).toContain('tabindex="-1"')
    expect(ninety).toContain('tabindex="-1"')
    expect(html).not.toContain('aria-checked="true"')
  })
})
