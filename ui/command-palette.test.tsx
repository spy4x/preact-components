import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { IconMoon, IconPlus } from "@spy4x/preact-icons"
import {
  CommandPalette,
  type CommandPaletteOption,
  defaultCommandPaletteLabels,
  defaultCommandPaletteMatchLabels,
  groupOptions,
  matchOption,
  matchOptions,
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

describe("matchOptions", () => {
  const options = [
    option("Combobox", { detail: "Forms" }),
    option("Toast", { detail: "Feedback" }),
    option("Date picker", { aliases: ["calendar", "календарь"] }),
    option("Badge", { detail: "Tables and lists" }),
  ]
  const labels = (query: string) => matchOptions(options, query).map((found) => found.label)

  it("forgives one typo: combobx finds Combobox", () => {
    expect(labels("combobx")).toEqual(["Combobox"])
    expect(matchOption("combobx", options[0])).toBe("typo")
  })

  it("reads a query typed in the other keyboard layout: ещфые finds Toast", () => {
    expect(labels("ещфые")).toEqual(["Toast"])
    expect(matchOption("ещфые", options[1])).toBe("layout")
  })

  it("finds words in any order, and an option by an alias in either alphabet", () => {
    expect(labels("picker date")).toEqual(["Date picker"])
    expect(matchOption("picker date", options[2])).toBe("words")
    expect(labels("календ")).toEqual(["Date picker"])
    expect(matchOption("calendar", options[2])).toBe("alias")
  })

  it("lists a name match before an option whose detail alone holds the query", () => {
    const withDetail = [option("Lists", { detail: "Display" }), ...options]
    expect(matchOptions(withDetail, "list").map((found) => found.label)).toEqual([
      "Lists",
      "Badge",
    ])
    expect(matchOption("list", options[3])).toBe("detail")
  })

  it("matches every option for an empty query, up to the limit, and says no kind for it", () => {
    expect(labels("  ")).toHaveLength(4)
    expect(matchOptions(options, "", 2).map((found) => found.label)).toEqual([
      "Combobox",
      "Toast",
    ])
    expect(matchOption("", options[0])).toBeUndefined()
  })

  it("returns nothing for an option the query does not match", () => {
    expect(labels("zzzz")).toEqual([])
    expect(matchOption("zzzz", options[0])).toBeUndefined()
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

  it("lists grouped options in a list group named by its heading, in a role-less list item", () => {
    const html = render(<CommandPalette options={options} onSelect={() => {}} />)
    const heading = html.match(
      /<li role="none"><ul role="group" aria-labelledby="([^"]+)"><li id="([^"]+)" role="presentation"[^>]*>Components</,
    )
    expect(heading).not.toBeNull()
    expect(heading?.[1]).toBe(heading?.[2])
    // The unheaded option comes first, so it is the first option the arrows reach.
    expect(html.indexOf(">Home<")).toBeLessThan(html.indexOf(">Badge<"))
  })

  it("makes the listbox the results' scroll box, so the box that scrolls is the combobox's popup", () => {
    const html = render(<CommandPalette options={options} onSelect={() => {}} />)
    const listbox = html.match(/<ul id="([^"]+)" role="listbox"[^>]*class="([^"]*)"/)
    expect(listbox?.[2].split(" ")).toContain("overflow-y-auto")
    expect(html).toContain(`aria-controls="${listbox?.[1]}"`)
    expect(html.match(/overflow-y-auto/g)).toHaveLength(1)
  })

  it("draws the field as a text combobox with a search keyboard, so no second clear button shows", () => {
    const html = render(<CommandPalette options={options} onSelect={() => {}} />)
    expect(html).toMatch(
      /<input type="text" inputmode="search" enterkeyhint="search" role="combobox"/,
    )
    expect(html).not.toContain(`type="search"`)
  })

  it("gives the close button a 44 px touch target below sm and 36 px from sm", () => {
    const html = render(<CommandPalette options={options} onSelect={() => {}} dataE2E="palette" />)
    const close = html.match(
      /<button type="button" aria-label="[^"]+" data-e2e="palette-close" class="([^"]*)"/,
    )
    expect(close?.[1].split(" ")).toEqual(expect.arrayContaining(["size-11", "sm:size-9"]))
  })

  it("names each result after its option's id, so another option in a row gets another id", () => {
    const html = render(
      <CommandPalette
        options={[option("Home", { id: "home page" }), option("Badge")]}
        onSelect={() => {}}
      />,
    )
    expect(html).toMatch(/<li id="[^"]+-result-home%20page" role="option"/)
    expect(html).toMatch(/<li id="[^"]+-result-Badge" role="option"/)
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

  it("filters with the forgiving matcher by default and marks how each result matched", () => {
    const html = render(
      <CommandPalette
        options={[option("Combobox"), option("Toast")]}
        defaultQuery="combobx"
        onSelect={() => {}}
      />,
    )
    expect(html).toMatch(/<li id="[^"]+-result-Combobox" role="option"[^>]* data-match="typo"/)
    expect(html).not.toContain(">Toast<")
    // Without `showMatch` the kind stays an attribute; no word is drawn.
    expect(html).not.toContain(defaultCommandPaletteMatchLabels.typo)
  })

  it("shows how a result matched in words with showMatch, taking them from matchLabels", () => {
    const html = render(
      <CommandPalette
        options={[option("Toast")]}
        defaultQuery="ещфые"
        showMatch
        matchLabels={{ layout: "Wrong layout" }}
        onSelect={() => {}}
      />,
    )
    expect(html).toMatch(/data-match="layout"[^>]*>.*>Toast<.*>Wrong layout</)
  })

  it("draws the field trigger with its placeholder and hint at every width", () => {
    const html = render(
      <CommandPalette options={options} trigger="field" onSelect={() => {}} dataE2E="palette" />,
    )
    const trigger = html.match(
      /<button[^>]*data-e2e="palette-open" class="([^"]*)"[^>]*>(.*?)<\/button>/,
    )
    expect(trigger?.[1].split(" ")).toEqual(expect.arrayContaining(["w-full", "border-subtle"]))
    // No class switches at `sm`: the field is the same at every width.
    expect(trigger?.[1].split(" ").filter((name) => name.startsWith("sm:"))).toEqual([])
    expect(trigger?.[2]).toContain(
      `<span class="min-w-0 flex-1 truncate text-start">${defaultCommandPaletteLabels.placeholder}</span>`,
    )
    expect(trigger?.[2]).not.toContain("hidden sm:")
  })

  it("gives both triggers a 44 px touch target on a phone and the library's focus ring", () => {
    for (const shape of ["field", "button"] as const) {
      const html = render(
        <CommandPalette options={options} trigger={shape} onSelect={() => {}} dataE2E="palette" />,
      )
      const classes = html.match(/data-e2e="palette-open" class="([^"]*)"/)?.[1].split(" ")
      expect(classes, shape).toEqual(expect.arrayContaining([
        "max-sm:min-h-11",
        "focus-visible:ring-2",
        "focus-visible:ring-offset-2",
        "focus-visible:outline-hidden",
      ]))
      if (shape === "button") expect(classes).toContain("max-sm:min-w-11")
    }
  })

  it("appends the caller's class to the trigger's own, unmerged", () => {
    const html = render(
      <CommandPalette options={options} class="w-80!" onSelect={() => {}} dataE2E="palette" />,
    )
    const trigger = html.match(/data-e2e="palette-open" class="([^"]*)"/)?.[1].split(" ")
    expect(trigger?.slice(-1)).toEqual(["w-80!"])
    expect(trigger).toContain("sm:w-56")
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

describe("CommandPalette command rows", () => {
  /** The `<li>` of the result `id` and everything inside it, from the rendered HTML. */
  const rowOf = (html: string, id: string) =>
    html.match(new RegExp(`<li id="[^"]+-result-${id}" role="option".*?</li>`))?.[0] ?? ""

  it("names a row by its label alone and describes it by its detail, state and hint", () => {
    const html = render(
      <CommandPalette
        options={[option("Theme", { detail: "Look", state: "Dark", hint: "Setting" })]}
        onSelect={() => {}}
      />,
    )
    const row = rowOf(html, "Theme")
    const id = row.match(/<li id="([^"]+)"/)?.[1]
    expect(row).toContain(`aria-labelledby="${id}-label"`)
    expect(row).toContain(`aria-describedby="${id}-detail ${id}-state ${id}-hint"`)
    expect(row).toMatch(new RegExp(`id="${id}-state"[^>]*><span class="truncate">Dark</span>`))
  })

  it("keeps an icon slot on every row of a group where one row has an icon", () => {
    const html = render(
      <CommandPalette
        options={[
          option("Theme", { group: "Settings", icon: IconMoon }),
          option("Language", { group: "Settings" }),
          option("Home", { group: "Pages" }),
        ]}
        onSelect={() => {}}
      />,
    )
    const slot = /<span aria-hidden="true" class="flex size-4 shrink-0[^"]*">/
    expect(rowOf(html, "Theme")).toMatch(slot)
    expect(rowOf(html, "Theme")).toContain("<svg")
    expect(rowOf(html, "Language")).toMatch(slot)
    expect(rowOf(html, "Language")).not.toContain("<svg")
    expect(rowOf(html, "Home")).not.toMatch(slot)
  })

  it("announces a row's kbd in aria-keyshortcuts and draws its keys only from sm", () => {
    const html = render(
      <CommandPalette
        options={[option("New note", { kbd: "ctrl+n", icon: IconPlus })]}
        onSelect={() => {}}
      />,
    )
    const row = rowOf(html, "New%20note")
    expect(row).toContain(`aria-keyshortcuts="Control+N"`)
    expect(row).toMatch(
      /<span class="hidden sm:contents"><span aria-hidden="true" data-hotkey-hint /,
    )
  })

  it("lists a disabled row with its reason in place of its detail, and no badge or keys", () => {
    const html = render(
      <CommandPalette
        options={[
          option("Sync now", {
            detail: "Every device",
            disabledReason: "Needs a connection",
            state: "Off",
            kbd: "ctrl+s",
          }),
        ]}
        onSelect={() => {}}
      />,
    )
    const row = rowOf(html, "Sync%20now")
    const id = row.match(/<li id="([^"]+)"/)?.[1]
    expect(row).toContain(`aria-disabled="true"`)
    expect(row).toContain(`aria-describedby="${id}-detail"`)
    expect(row).toContain(">Needs a connection<")
    for (const absent of ["Every device", ">Off<", "aria-keyshortcuts", "data-hotkey-hint"]) {
      expect(row).not.toContain(absent)
    }
    expect(row).not.toContain("hover:bg-hover")
    expect(row).toMatch(/class="line-clamp-2 [^"]*text-muted"/)
  })

  it("says a changed state as the label and the state by default", () => {
    expect(defaultCommandPaletteLabels.stateChanged("Theme", "Dark")).toBe("Theme: Dark")
  })
})
