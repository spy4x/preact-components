import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  CommandPalette,
  type CommandPaletteOption,
  defaultCommandPaletteLabels,
  groupOptions,
  rankOptions,
} from "./command-palette.tsx"

const option = (
  label: string,
  extra: Partial<CommandPaletteOption> = {},
): CommandPaletteOption => ({
  id: label,
  label,
  ...extra,
})

describe("rankOptions", () => {
  const options = [
    option("Data table", { detail: "Display" }),
    option("Table"),
    option("Tabs", { detail: "Navigation" }),
    option("Badge", { detail: "Tables and lists" }),
  ]

  it("ranks an equal name, then a prefix, then a contained name, then a detail", () => {
    expect(rankOptions(options, "table").map((found) => found.label)).toEqual([
      "Table",
      "Data table",
      "Badge",
    ])
    expect(rankOptions(options, "tab").map((found) => found.label)).toEqual([
      "Table",
      "Tabs",
      "Data table",
      "Badge",
    ])
  })

  it("folds case, accents and surrounding spaces", () => {
    expect(rankOptions(options, "  TÁBS ").map((found) => found.label)).toEqual(["Tabs"])
  })

  it("matches every option for an empty query, up to the limit", () => {
    expect(rankOptions(options, "")).toHaveLength(4)
    expect(rankOptions(options, "", 2).map((found) => found.label)).toEqual(["Data table", "Table"])
  })
})

describe("groupOptions", () => {
  it("lists unheaded options first, then groups in the order they first appear", () => {
    const groups = groupOptions([
      option("Open", { group: "Actions" }),
      option("Home"),
      option("Badge", { group: "Components" }),
      option("Close", { group: "Actions" }),
    ])
    expect(groups.map((group) => [group.label, group.options.map((found) => found.label)]))
      .toEqual([
        [undefined, ["Home"]],
        ["Actions", ["Open", "Close"]],
        ["Components", ["Badge"]],
      ])
  })
})

describe("CommandPalette", () => {
  const options = [option("Badge", { group: "Components", hint: "Component" }), option("Home")]

  it("draws a trigger named by its placeholder, with the first hotkey as its hint", () => {
    const html = render(<CommandPalette options={options} onSelect={() => {}} dataE2E="palette" />)
    expect(html).toContain(`aria-label="${defaultCommandPaletteLabels.placeholder}"`)
    expect(html).toContain(`data-e2e="palette-open"`)
    expect(html).toMatch(/<kbd[^>]*>\/<\/kbd>/)
  })

  it("draws no hotkey hint and announces no hotkey when the hotkeys are turned off", () => {
    const html = render(<CommandPalette options={options} onSelect={() => {}} hotkeys={[]} />)
    expect(html).not.toContain("<kbd")
    expect(html).not.toContain("aria-keyshortcuts")
  })

  it("announces every hotkey on the trigger and shows the first as a button's hotkey hint", () => {
    const html = render(<CommandPalette options={options} onSelect={() => {}} />)
    expect(html).toMatch(/<button[^>]*\saria-keyshortcuts="\/ Control\+K"/)
    expect(html).toMatch(
      /<span class="hidden sm:contents"><span aria-hidden="true" data-hotkey-hint class="hidden pointer-fine:inline-flex"><kbd[^>]*>\/<\/kbd><\/span><\/span><\/button>/,
    )
  })

  it("takes the hint's words from kbdLabels", () => {
    const html = render(
      <CommandPalette
        options={options}
        onSelect={() => {}}
        hotkeys={["mod+k"]}
        kbdLabels={{ ctrl: "Strg" }}
      />,
    )
    expect(html).toMatch(/<kbd[^>]*>Strg<\/kbd>/)
  })

  it("lists grouped options under a heading that names their group", () => {
    const html = render(<CommandPalette options={options} onSelect={() => {}} />)
    const heading = html.match(
      /<li role="group" aria-labelledby="([^"]+)"><div id="([^"]+)"[^>]*>Components</,
    )
    expect(heading).not.toBeNull()
    expect(heading?.[1]).toBe(heading?.[2])
    // The unheaded option comes first, so it is the first option the arrows reach.
    expect(html.indexOf(">Home<")).toBeLessThan(html.indexOf(">Badge<"))
  })

  it("takes every word from labels", () => {
    const html = render(
      <CommandPalette
        options={[]}
        onSelect={() => {}}
        labels={{ search: "Suche", placeholder: "Suchen…", close: "Schließen", empty: "Nichts" }}
      />,
    )
    for (const word of ["Suche", "Suchen…", "Schließen", "Nichts"]) expect(html).toContain(word)
    expect(html).not.toContain(defaultCommandPaletteLabels.empty)
  })

  it("refuses both data modes at once, and neither, as a type error", () => {
    const search = () => Promise.resolve(options)
    // @ts-expect-error: `options` and `search` together.
    void (<CommandPalette options={options} search={search} onSelect={() => {}} />)
    // @ts-expect-error: neither `options` nor `search`.
    void <CommandPalette onSelect={() => {}} />
    void <CommandPalette search={search} debounce={50} onSelect={() => {}} />
  })
})
