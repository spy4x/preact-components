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

/**
 * The trigger, as `[start tag, markup inside it]`, located exactly.
 *
 * Found by `aria-controls` rather than by being the first `<button>`: the panel holds preset
 * buttons whose attributes must never be mistaken for the trigger's. The scan is index-based
 * because class utilities contain `"`, which a character-class pattern reads as a tag end.
 */
function triggerOf(html: string): [string, string] {
  for (let at = html.indexOf("<button"); at !== -1; at = html.indexOf("<button", at + 1)) {
    const open = html.indexOf(">", at)
    const tag = html.slice(at, open + 1)
    if (!tag.includes("aria-controls=")) continue
    return [tag, html.slice(open + 1)]
  }
  return ["", ""]
}

/**
 * The accessible name the trigger would compute to, as far as rendered markup can decide it.
 *
 * The algorithm, per accname: `aria-labelledby`, else `aria-label`, else the element's own
 * content, with `aria-hidden="true"` subtrees skipped — which is how the `▾` glyph drops out. Only
 * markup is available here; anything a browser adds is out of reach.
 */
function triggerAccessibleName(html: string): string {
  const [tag, content] = triggerOf(html)
  const labelledBy = tag.match(/aria-labelledby="([^"]+)"/)?.[1]
  if (labelledBy !== undefined) {
    return labelledBy
      .split(/\s+/)
      .map((id) => html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1]?.trim() ?? "")
      .join(" ")
      .trim()
  }
  const label = tag.match(/aria-label="([^"]*)"/)?.[1]
  if (label !== undefined) return label

  return (content.match(/^<span>([^<]*)<\/span>/)?.[1] ?? "").trim()
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

  it("names the panel for assistive tech, and lets the trigger be named by its own text", () => {
    const html = renderPicker()

    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Date range"')
    // The label belongs to the panel. On the trigger it would *replace* the range the user reads,
    // which is the WCAG 2.5.3 failure this pins — see the label-in-name cases below.
    expect(triggerOf(html)[0]).not.toContain("aria-label")
    expect(html.match(/aria-label="Date range"/g)?.length).toBe(1)
  })

  it("gives the trigger an accessible name that contains its visible text", () => {
    // WCAG 2.5.3 Label in Name: a user who speaks "Pick a range" must match this control. The
    // placeholder is the whole visible label, so the accessible name is exactly it — no extra aria
    // is needed to satisfy the criterion, and adding a second label is what broke it.
    const html = renderPicker()
    const name = triggerAccessibleName(html)

    expect(name).toBe("Pick a range")
    expect(name).toContain("Pick a range")
    expect(name).not.toContain("Date range")
  })

  it("keeps the visible range inside the accessible name once a range is chosen", () => {
    // The state that actually matters: the visible label is now the range, and an `aria-label`
    // would hide it behind "Date range". The arrow glyph is `aria-hidden` and must not leak in.
    const html = renderPicker({ range: { from: "2026-08-01", to: "2026-08-23" } })
    const name = triggerAccessibleName(html)

    expect(name).toContain("2026-08-01 → 2026-08-23")
    expect(name).not.toContain("▾")
  })

  it("keeps a caller's formatted range and placeholder both inside the accessible name", () => {
    const formatted = renderPicker({
      range: { from: "2026-08-01", to: "2026-08-23" },
      formatRange: (range) => `${range.from} until ${range.to}`,
    })

    expect(triggerAccessibleName(formatted)).toContain("2026-08-01 until 2026-08-23")
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
