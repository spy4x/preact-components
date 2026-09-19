import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  DateRangePicker,
  type DateRangePickerLabels,
  type DateRangePickerProps,
  type DateRangePresetOption,
} from "./date-range-picker.tsx"

const labels: DateRangePickerLabels = {
  menuLabel: "Date range",
  placeholder: "Pick a range",
  from: "From",
  to: "To",
  apply: "Apply",
  cancel: "Cancel",
}

const presets: readonly DateRangePresetOption[] = [
  { preset: "today", label: "Today" },
  { preset: "last-7-days", label: "Last 7 days" },
  { preset: "custom", label: "Custom" },
]

/** The three props every case has to supply; `render` drops handlers, so nothing is clickable here. */
function renderPicker(overrides: Partial<DateRangePickerProps> = {}): string {
  return render(
    <DateRangePicker
      range={null}
      onChange={() => {}}
      timeZone="Europe/Paris"
      presets={presets}
      labels={labels}
      {...overrides}
    />,
  )
}

/** Id of the panel the trigger controls, read back from the markup so the test stays id-agnostic. */
function panelIdOf(html: string): string {
  return html.match(/aria-controls="([^"]+)"/)?.[1] ?? ""
}

describe("DateRangePicker", () => {
  it("shows the caller's placeholder while no range is chosen", () => {
    const html = renderPicker()

    expect(html).toContain("Pick a range")
  })

  it("shows the chosen range as ISO dates by default", () => {
    const html = renderPicker({ range: { from: "2026-08-01", to: "2026-08-23" } })

    expect(html).toContain("2026-08-01 → 2026-08-23")
    expect(html).not.toContain("Pick a range")
  })

  it("uses the caller's range formatter when given one", () => {
    const html = renderPicker({
      range: { from: "2026-08-01", to: "2026-08-23" },
      formatRange: (range) => `${range.from} until ${range.to}`,
    })

    expect(html).toContain("2026-08-01 until 2026-08-23")
  })

  it("starts closed and points the trigger at the panel", () => {
    const html = renderPicker()
    const panelId = panelIdOf(html)

    expect(html).toContain('aria-expanded="false"')
    expect(panelId).not.toBe("")
    expect(html).toContain(`id="${panelId}"`)
    expect(html).toContain("hidden")
  })

  it("claims no haspopup role it cannot honour: the panel is a group, not a menu", () => {
    const html = renderPicker()

    expect(html).not.toContain("aria-haspopup")
    expect(html).toContain('role="group"')
  })

  it("names the trigger and the panel for assistive tech", () => {
    const html = renderPicker()

    expect(html).toContain('aria-label="Date range"')
    expect(html).toContain('role="group"')
  })

  it("keeps a form-submitting button out of the trigger", () => {
    expect(renderPicker()).toMatch(/<button type="button"/)
  })

  it("renders every caller label and none of its own", () => {
    const french: DateRangePickerLabels = {
      menuLabel: "Plage de dates",
      placeholder: "Choisir une plage",
      from: "Du",
      to: "Au",
      apply: "Appliquer",
      cancel: "Annuler",
    }
    const html = renderPicker({
      labels: french,
      presets: [{ preset: "today", label: "Aujourd'hui" }, {
        preset: "custom",
        label: "Personnalisé",
      }],
    })

    for (const copy of Object.values(french)) expect(html).toContain(copy)
    expect(html).toContain("Aujourd'hui")
    expect(html).toContain("Personnalisé")
    expect(html).not.toContain("Apply")
    expect(html).not.toContain("Cancel")
    expect(html).not.toContain("Pick a range")
  })

  it("lists the presets in the order it was given", () => {
    const html = renderPicker()
    const order = ["Today", "Last 7 days", "Custom"].map((label) => html.indexOf(label))

    expect(order.every((index) => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it("marks every preset unpressed when no preset is selected", () => {
    expect(renderPicker()).not.toContain('aria-pressed="true"')
  })

  it("marks only the selected preset as pressed", () => {
    const html = renderPicker({ selectedPreset: "last-7-days" })

    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1)
    expect(html.match(/aria-pressed="false"/g)?.length).toBe(2)
    expect(html).toContain("bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100")
  })

  it("renders two date fields when the preset list carries custom", () => {
    const html = renderPicker()

    expect(html.match(/type="date"/g)?.length).toBe(2)
    expect(html).toContain("Apply")
    expect(html).toContain("Cancel")
  })

  it("omits the custom fields when the preset list has no custom entry", () => {
    const html = renderPicker({ presets: [{ preset: "today", label: "Today" }] })

    expect(html).not.toContain('type="date"')
    expect(html).not.toContain("Apply")
    expect(html).toContain("Today")
  })

  it("associates each field label with its own input", () => {
    const html = renderPicker()
    const fromId = html.match(/<label[^>]*for="([^"]+)">From<\/label>/)?.[1] ?? ""
    const toId = html.match(/<label[^>]*for="([^"]+)">To<\/label>/)?.[1] ?? ""

    expect(fromId).not.toBe("")
    expect(toId).not.toBe("")
    expect(fromId).not.toBe(toId)
    expect(html).toContain(`<input id="${fromId}"`)
    expect(html).toContain(`<input id="${toId}"`)
  })

  it("keeps apply disabled while the custom range is empty", () => {
    const html = renderPicker()

    expect(html).toContain("disabled")
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Apply<\/button>/)
  })

  it("enables apply once the controlled range seeds a complete draft", () => {
    const html = renderPicker({ range: { from: "2026-08-01", to: "2026-08-23" } })

    expect(html).toContain('value="2026-08-01"')
    expect(html).toContain('value="2026-08-23"')
    expect(html).toMatch(/<button[^>]*>Apply<\/button>/)
  })

  it("wraps the custom panel in no menu semantics, which could not hold form controls", () => {
    expect(renderPicker()).not.toContain('role="menu"')
    expect(renderPicker()).not.toContain('role="menuitem"')
  })

  it("carries the caller's utilities and test hook", () => {
    const html = renderPicker({ class: "mt-4", dataE2E: "range-picker" })

    expect(html).toContain("mt-4")
    expect(html).toContain('data-e2e="range-picker"')
    expect(html).toContain('data-e2e="date-range-preset-last-7-days"')
  })
})
