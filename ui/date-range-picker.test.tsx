import type { JSX } from "preact"
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  DateRangePicker,
  type DateRangePickerLabels,
  type DateRangePickerProps,
  type DateRangePickerTimeProps,
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

/** Same shape as {@link renderPicker}, for the `withTime` cases. */
function renderTimePicker(overrides: Partial<DateRangePickerTimeProps> = {}): string {
  return render(
    <DateRangePicker
      withTime
      range={null}
      onChange={() => {}}
      timeZone="Europe/Paris"
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

/**
 * `DateRangePickerProps` keeps naming the day-only shape, unchanged since before `withTime`
 * existed — this is a compile-time proof of that, not a runtime one. Each declaration below is a
 * shape an existing caller of this component could already have written; if any of them stopped
 * type-checking, `deno task ts:check` (and `deno test`, which type-checks this file before running
 * it) would fail here before a single assertion ran. The one exported name that *did* need to
 * change is {@link AnyDateRangePickerProps} in `date-range-picker.tsx`'s own doc — the type
 * {@link DateRangePicker} itself takes, so it could grow the `withTime` shape without this one,
 * the name most existing code already names, changing what it means.
 */

/** A wrapper that fixes the zone — the commonest shape a wrapper component around this one takes. */
function UtcDateRangePicker(props: Omit<DateRangePickerProps, "timeZone">): JSX.Element {
  return <DateRangePicker {...props} timeZone="UTC" />
}

/** Reading a prop straight off the props type, the way a caller that only reads `presets` would. */
function presetCount(props: DateRangePickerProps): number {
  return props.presets.length
}

/** Indexed access for a handler type, the way a caller typing a standalone `onChange` would. */
const onRangeChange: DateRangePickerProps["onChange"] = (range) => range.from

describe("DateRangePickerProps", () => {
  it("still compiles the wrapper, prop-read and indexed-access shapes above", () => {
    // The proof already happened above, at compile time. This assertion only keeps the three
    // declarations from being unused exports a linter would flag, and gives the compile-time proof
    // a place in the test report.
    expect(typeof UtcDateRangePicker).toBe("function")
    expect(typeof presetCount).toBe("function")
    expect(typeof onRangeChange).toBe("function")
  })
})

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

  it("falls back to English for every label when the caller passes none", () => {
    // The labels rule this library holds: a caller who says nothing gets English, and nothing
    // throws for want of copy. `labels` is left out of the props entirely here, which is also what
    // proves the prop is optional — the file would not type-check if it were not.
    const html = render(
      <DateRangePicker
        range={null}
        onChange={() => {}}
        timeZone="Europe/Paris"
        presets={presets}
      />,
    )

    expect(html).toContain("Any dates")
    expect(html).toContain('aria-label="Date range"')
    expect(html).toContain(">From</label>")
    expect(html).toContain(">To</label>")
    expect(html).toContain(">Apply</button>")
    expect(html).toContain(">Cancel</button>")
  })

  it("takes one overridden label without demanding the other five", () => {
    const html = renderPicker({ labels: { placeholder: "All time" } })

    expect(html).toContain("All time")
    expect(html).not.toContain("Any dates")
    expect(html).toContain(">From</label>")
    expect(html).toContain(">Apply</button>")
  })

  it("keeps the English default for a label passed as undefined", () => {
    // A caller building the object from optional values hands over an explicit `undefined`, which a
    // spread would take as the value. Read key by key, it is the same as saying nothing.
    const html = renderPicker({ labels: { placeholder: undefined, apply: "Commit" } })

    expect(html).toContain("Any dates")
    expect(html).toContain(">Commit</button>")
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

  it("marks Custom as pressed when the caller says the custom range is the chosen one", () => {
    // The markup half of the `aria-pressed` fix. The other half — the button going from unpressed
    // to pressed as the fields come into use — is a signal write no string render executes, and is
    // proven in `pages/checks/ui.ts`.
    const html = renderPicker({ selectedPreset: "custom" })

    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Custom<\/button>/)
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1)
  })

  it("gives the panel a focus target of its own, for a preset list with nothing in it", () => {
    // The last resort of the focus-on-open rule: with no preset to land on, focus goes to the
    // group, and a group is only focusable if something made it so.
    const html = renderPicker({ presets: [] })

    expect(html).toMatch(/<div id="[^"]*-panel" tabindex="-1"/)
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

  it(
    "renders a chosen range identically to before withTime existed, byte for byte",
    () => {
      // Captured from this exact prop set before `withTime` was added (`PR #142`'s own evidence),
      // then generated ids normalised to "ID" — `useId()` is not stable across separate `render`
      // calls in one process, and every other test here reads ids back out rather than pinning them.
      const html = renderPicker({
        range: { from: "2026-08-01", to: "2026-08-23" },
        selectedPreset: "last-7-days",
        dataE2E: "snap-1",
      }).replace(/P\d+-\d+/g, "ID")

      expect(html).toBe(
        `<div class="relative inline-flex text-left"><button type="button" class="inline-flex items-center rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 px-2 py-2 text-xs min-w-48 justify-between gap-2 truncate" aria-expanded="false" aria-controls="ID-panel" data-e2e="snap-1"><span>2026-08-01 → 2026-08-23</span><span aria-hidden="true">▾</span></button><div id="ID-panel" tabindex="-1" hidden role="group" aria-label="Date range" class="absolute z-10 mt-2 w-80 rounded-md bg-white p-3 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-gray-600"><div class="flex flex-wrap gap-1"><button type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 px-2 py-2 text-xs" aria-pressed="false" data-e2e="date-range-preset-today">Today</button><button type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-2 text-xs bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100" aria-pressed="true" data-e2e="date-range-preset-last-7-days">Last 7 days</button><button type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 px-2 py-2 text-xs" aria-pressed="false" data-e2e="date-range-preset-custom">Custom</button></div><div class="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-600"><div><label class="block text-xs font-medium text-gray-700 dark:text-gray-300" for="ID-from">From</label><input id="ID-from" type="date" class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" value="2026-08-01" data-e2e="date-range-from"/></div><div><label class="block text-xs font-medium text-gray-700 dark:text-gray-300" for="ID-to">To</label><input id="ID-to" type="date" class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" value="2026-08-23" data-e2e="date-range-to"/></div><div class="flex justify-end gap-2"><button type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 px-2 py-2 text-xs">Cancel</button><button data-e2e="date-range-apply" type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-purple-900 text-white hover:bg-purple-800 dark:bg-purple-700 dark:hover:bg-purple-600 px-2 py-2 text-xs">Apply</button></div></div></div></div>`,
      )
    },
  )

  it(
    "renders the empty, all-defaults state identically to before withTime existed, byte for byte",
    () => {
      const html = renderPicker().replace(/P\d+-\d+/g, "ID")

      expect(html).toBe(
        `<div class="relative inline-flex text-left"><button type="button" class="inline-flex items-center rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 px-2 py-2 text-xs min-w-48 justify-between gap-2 truncate" aria-expanded="false" aria-controls="ID-panel"><span>Pick a range</span><span aria-hidden="true">▾</span></button><div id="ID-panel" tabindex="-1" hidden role="group" aria-label="Date range" class="absolute z-10 mt-2 w-80 rounded-md bg-white p-3 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-gray-600"><div class="flex flex-wrap gap-1"><button type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 px-2 py-2 text-xs" aria-pressed="false" data-e2e="date-range-preset-today">Today</button><button type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 px-2 py-2 text-xs" aria-pressed="false" data-e2e="date-range-preset-last-7-days">Last 7 days</button><button type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 px-2 py-2 text-xs" aria-pressed="false" data-e2e="date-range-preset-custom">Custom</button></div><div class="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-600"><div><label class="block text-xs font-medium text-gray-700 dark:text-gray-300" for="ID-from">From</label><input id="ID-from" type="date" class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" value data-e2e="date-range-from"/></div><div><label class="block text-xs font-medium text-gray-700 dark:text-gray-300" for="ID-to">To</label><input id="ID-to" type="date" class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" value data-e2e="date-range-to"/></div><div class="flex justify-end gap-2"><button type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 px-2 py-2 text-xs">Cancel</button><button disabled data-e2e="date-range-apply" type="button" class="inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-purple-900 text-white hover:bg-purple-800 dark:bg-purple-700 dark:hover:bg-purple-600 px-2 py-2 text-xs">Apply</button></div></div></div></div>`,
      )
    },
  )
})

describe("DateRangePicker, withTime", () => {
  it("renders From and To as datetime-local fields, not date fields", () => {
    const html = renderTimePicker()

    expect(html.match(/type="datetime-local"/g)?.length).toBe(2)
    expect(html).not.toContain('type="date"')
  })

  it("always shows the custom fields, with no presets prop to opt in", () => {
    // Unlike day mode, withTime never gates the fields behind a caller-supplied "custom" entry —
    // see DateRangePickerTimeProps' own doc for why there is no presets prop in this mode at all.
    const html = renderTimePicker()

    expect(html.match(/type="datetime-local"/g)?.length).toBe(2)
    expect(html).toContain("Apply")
    expect(html).toContain("Cancel")
  })

  it("shows Last hour and Last 24 hours, English by default", () => {
    const html = renderTimePicker()

    expect(html).toContain('data-e2e="date-range-preset-last-hour"')
    expect(html).toContain('data-e2e="date-range-preset-last-24-hours"')
    expect(html).toMatch(
      /<button[^>]*data-e2e="date-range-preset-last-hour"[^>]*>Last hour<\/button>/,
    )
    expect(html).toMatch(
      /<button[^>]*data-e2e="date-range-preset-last-24-hours"[^>]*>Last 24 hours<\/button>/,
    )
  })

  it("does not show the sub-day presets without withTime", () => {
    const html = renderPicker()

    expect(html).not.toContain("date-range-preset-last-hour")
    expect(html).not.toContain("date-range-preset-last-24-hours")
    expect(html).not.toContain("Last hour")
    expect(html).not.toContain("Last 24 hours")
  })

  it("overrides the sub-day presets' labels through labels.lastHour and labels.last24Hours", () => {
    const html = renderTimePicker({ labels: { lastHour: "60 minutes", last24Hours: "1 day" } })

    expect(html).toContain("60 minutes")
    expect(html).toContain("1 day")
    expect(html).not.toContain("Last hour")
    expect(html).not.toContain("Last 24 hours")
  })

  it("marks last-hour or last-24-hours pressed through selectedPreset", () => {
    const html = renderTimePicker({ selectedPreset: "last-24-hours" })

    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1)
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Last 24 hours<\/button>/)
  })

  it("presses neither time preset when the caller says the custom fields are the chosen one", () => {
    const html = renderTimePicker({ selectedPreset: "custom" })

    // No "Custom" button exists in this mode — the fields are always present — so nothing reads
    // aria-pressed="true" here; `selectedPreset: "custom"` only matters to the two time presets,
    // and neither of them is the caller's choice.
    expect(html.match(/aria-pressed="true"/g)).toBeNull()
  })

  it("shows the chosen timed range as ISO wall clock by default", () => {
    const html = renderTimePicker({
      range: { from: "2026-08-01T09:00", to: "2026-08-01T18:00" },
    })

    expect(html).toContain("2026-08-01T09:00 → 2026-08-01T18:00")
  })

  it("uses the caller's range formatter for a timed range", () => {
    const html = renderTimePicker({
      range: { from: "2026-08-01T09:00", to: "2026-08-01T18:00" },
      formatRange: (range) => `${range.from} until ${range.to}`,
    })

    expect(html).toContain("2026-08-01T09:00 until 2026-08-01T18:00")
  })

  it("seeds the datetime-local fields from the controlled value", () => {
    const html = renderTimePicker({
      range: { from: "2026-08-01T09:00", to: "2026-08-01T18:00" },
    })

    expect(html).toContain('value="2026-08-01T09:00"')
    expect(html).toContain('value="2026-08-01T18:00"')
  })

  it("keeps apply disabled while the datetime draft is empty", () => {
    const html = renderTimePicker()

    expect(html).toMatch(/<button[^>]*disabled[^>]*>Apply<\/button>/)
  })

  it("enables apply once the controlled range seeds a complete datetime draft", () => {
    const html = renderTimePicker({
      range: { from: "2026-08-01T09:00", to: "2026-08-01T18:00" },
    })

    expect(html).toMatch(/<button[^>]*>Apply<\/button>/)
  })

  it("keeps apply disabled for a reversed datetime draft, the same rule the day fields follow", () => {
    const html = renderTimePicker({
      range: { from: "2026-08-01T18:00", to: "2026-08-01T09:00" },
    })

    expect(html).toMatch(/<button[^>]*disabled[^>]*>Apply<\/button>/)
  })

  it("keeps the same focus-contract markup as day mode: a group panel, not a menu", () => {
    const html = renderTimePicker()

    expect(html).toContain('role="group"')
    expect(html).not.toContain("aria-haspopup")
    expect(html).not.toContain('role="menu"')
    expect(html).toMatch(/<div id="[^"]*-panel" tabindex="-1"/)
  })
})
