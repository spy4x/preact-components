import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import en from "./i18n/en.ts"
import de from "./i18n/de.ts"
import { I18nContext } from "./i18n.tsx"
import {
  NumberStepper,
  numberStepperKey,
  numberStepperLabels,
  type NumberStepperProps,
  type NumberStepperRange,
} from "./number-stepper.tsx"

function stepper(props: Partial<NumberStepperProps> = {}): string {
  return render(
    <NumberStepper value={3} onChange={() => {}} max={10} label="Parallel jobs" {...props} />,
  )
}

/** The spinbutton's opening tag. */
function spinbutton(html: string): string {
  return html.match(/<div[^>]*role="spinbutton"[^>]*>/)?.[0] ?? ""
}

/** The opening tag of the button with this accessible name. */
function button(html: string, name: string): string {
  return html.match(new RegExp(`<button[^>]*aria-label="${name}"[^>]*>`))?.[0] ?? ""
}

/** Whether an opening tag carries the `disabled` attribute, not only a `disabled:` class. */
function isDisabled(tag: string): boolean {
  return /\sdisabled(=""|\s|>)/.test(tag)
}

const RANGE: NumberStepperRange = { min: 0, max: 10, step: 1, largeStep: 3 }

describe("NumberStepper", () => {
  it("renders one focusable spinbutton named by its label, with its value and range", () => {
    const box = spinbutton(stepper())
    expect(box).toContain(`tabindex="0"`)
    expect(box).toContain(`aria-label="Parallel jobs"`)
    expect(box).toContain(`aria-valuenow="3"`)
    expect(box).toContain(`aria-valuemin="0"`)
    expect(box).toContain(`aria-valuemax="10"`)
    expect(box).toContain(`aria-valuetext="3"`)
  })

  it("takes its name from aria-labelledby and its help from aria-describedby", () => {
    const box = spinbutton(
      stepper({ label: undefined, "aria-labelledby": "jobs", "aria-describedby": "jobs-hint" }),
    )
    expect(box).toContain(`aria-labelledby="jobs"`)
    expect(box).toContain(`aria-describedby="jobs-hint"`)
    expect(box).not.toContain("aria-label=")
  })

  it("refuses to render without a name", () => {
    expect(() => stepper({ label: undefined })).toThrow("label")
  })

  it("shows and announces the zero label for 0", () => {
    const html = stepper({ value: 0, zeroLabel: "Off" })
    expect(spinbutton(html)).toContain(`aria-valuenow="0"`)
    expect(spinbutton(html)).toContain(`aria-valuetext="Off"`)
    expect(html).toMatch(/role="spinbutton"[^>]*>Off<\/div>/)
  })

  it("reads 0 as a number when no zero label is set", () => {
    const html = stepper({ value: 0 })
    expect(spinbutton(html)).toContain(`aria-valuetext="0"`)
    expect(html).toMatch(/role="spinbutton"[^>]*>0<\/div>/)
  })

  it("keeps the zero label to 0 alone", () => {
    expect(spinbutton(stepper({ value: 1, zeroLabel: "Off" }))).toContain(`aria-valuetext="1"`)
  })

  it("disables − at the minimum and + at the maximum, and neither in between", () => {
    const low = stepper({ value: 0 })
    expect(isDisabled(button(low, "Decrease"))).toBe(true)
    expect(isDisabled(button(low, "Increase"))).toBe(false)
    const high = stepper({ value: 10 })
    expect(isDisabled(button(high, "Decrease"))).toBe(false)
    expect(isDisabled(button(high, "Increase"))).toBe(true)
    const middle = stepper({ value: 5 })
    expect(isDisabled(button(middle, "Decrease"))).toBe(false)
    expect(isDisabled(button(middle, "Increase"))).toBe(false)
  })

  it("keeps − and + out of the tab order", () => {
    const html = stepper()
    expect(button(html, "Decrease")).toContain(`tabindex="-1"`)
    expect(button(html, "Increase")).toContain(`tabindex="-1"`)
  })

  it("disables both buttons and marks the spinbutton disabled when disabled", () => {
    const html = stepper({ disabled: true })
    expect(isDisabled(button(html, "Decrease"))).toBe(true)
    expect(isDisabled(button(html, "Increase"))).toBe(true)
    expect(spinbutton(html)).toContain(`aria-disabled="true"`)
    expect(spinbutton(stepper())).not.toContain("aria-disabled")
  })

  it("shows an out-of-range or fractional value clamped to a whole number", () => {
    const over = stepper({ value: 15 })
    expect(spinbutton(over)).toContain(`aria-valuenow="10"`)
    expect(isDisabled(button(over, "Increase"))).toBe(true)
    expect(spinbutton(stepper({ value: -4 }))).toContain(`aria-valuenow="0"`)
    expect(spinbutton(stepper({ value: 2.6 }))).toContain(`aria-valuenow="3"`)
  })

  it("writes the number in Arabic digits and still finds 0 by the number", () => {
    const seven = stepper({ value: 7, locale: "ar-EG", zeroLabel: "إيقاف" })
    expect(spinbutton(seven)).toContain(`aria-valuetext="٧"`)
    expect(spinbutton(seven)).toContain(`aria-valuenow="7"`)
    const zero = stepper({ value: 0, locale: "ar-EG", zeroLabel: "إيقاف" })
    expect(spinbutton(zero)).toContain(`aria-valuetext="إيقاف"`)
    expect(isDisabled(button(zero, "Decrease"))).toBe(true)
    const plainZero = stepper({ value: 0, locale: "ar-EG" })
    expect(spinbutton(plainZero)).toContain(`aria-valuetext="٠"`)
  })

  it("speaks the catalog's language when one is provided", () => {
    const german = createTranslator({ language: "de", catalogs: [{ source: en, translation: de }] })
    const html = render(
      <I18nContext.Provider value={german}>
        <NumberStepper value={3} onChange={() => {}} max={10} label="Jobs" />
      </I18nContext.Provider>,
    )
    expect(html).toContain(`aria-label="${de["NumberStepper.decrease"]}"`)
    expect(html).toContain(`aria-label="${de["NumberStepper.increase"]}"`)
    expect(html).not.toContain("Decrease")
  })

  it("keeps its English defaults equal to the catalog", () => {
    for (const [field, text] of Object.entries(numberStepperLabels)) {
      expect(en[`NumberStepper.${field}` as keyof typeof en]).toBe(text)
    }
  })
})

describe("numberStepperKey", () => {
  it("steps up with ArrowUp and ArrowRight, down with ArrowDown and ArrowLeft", () => {
    expect(numberStepperKey("ArrowUp", 4, RANGE, false)).toBe(5)
    expect(numberStepperKey("ArrowRight", 4, RANGE, false)).toBe(5)
    expect(numberStepperKey("ArrowDown", 4, RANGE, false)).toBe(3)
    expect(numberStepperKey("ArrowLeft", 4, RANGE, false)).toBe(3)
  })

  it("swaps ArrowLeft and ArrowRight in right-to-left, but not ArrowUp and ArrowDown", () => {
    expect(numberStepperKey("ArrowLeft", 4, RANGE, true)).toBe(5)
    expect(numberStepperKey("ArrowRight", 4, RANGE, true)).toBe(3)
    expect(numberStepperKey("ArrowUp", 4, RANGE, true)).toBe(5)
    expect(numberStepperKey("ArrowDown", 4, RANGE, true)).toBe(3)
  })

  it("moves by the large step with PageUp and PageDown, stopping at the ends", () => {
    expect(numberStepperKey("PageUp", 4, RANGE, false)).toBe(7)
    expect(numberStepperKey("PageDown", 4, RANGE, false)).toBe(1)
    expect(numberStepperKey("PageUp", 9, RANGE, false)).toBe(10)
    expect(numberStepperKey("PageDown", 1, RANGE, false)).toBe(0)
  })

  it("goes to the minimum with Home and the maximum with End", () => {
    expect(numberStepperKey("Home", 4, { ...RANGE, min: 2 }, false)).toBe(2)
    expect(numberStepperKey("End", 4, RANGE, false)).toBe(10)
  })

  it("holds the value at an edge rather than passing it", () => {
    expect(numberStepperKey("ArrowUp", 10, RANGE, false)).toBe(10)
    expect(numberStepperKey("ArrowDown", 0, RANGE, false)).toBe(0)
  })

  it("sets a typed digit that is in range, and ignores one outside it", () => {
    expect(numberStepperKey("0", 4, RANGE, false)).toBe(0)
    expect(numberStepperKey("7", 4, RANGE, false)).toBe(7)
    expect(numberStepperKey("9", 4, { ...RANGE, max: 5 }, false)).toBeUndefined()
    expect(numberStepperKey("0", 4, { ...RANGE, min: 1 }, false)).toBeUndefined()
  })

  it("leaves every other key alone", () => {
    for (const key of ["Tab", "Enter", " ", "a", "Shift", "-", "+", "10", "٣"]) {
      expect(numberStepperKey(key, 4, RANGE, false)).toBeUndefined()
    }
  })
})
