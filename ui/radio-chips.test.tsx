import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { type RadioChipOption, RadioChips } from "./radio-chips.tsx"
import { ToggleChips } from "./toggle-chips.tsx"

const options: RadioChipOption[] = [
  { value: "all", label: "All tools", id: "mode-all", inputAttributes: { "data-event": "all" } },
  { value: "read-only", label: "Read only", id: "mode-read-only" },
  { value: "none", label: "None", disabled: true },
]

/** Each radio's opening tag, in the order of the chips. */
function radios(html: string): string[] {
  return html.match(/<input[^>]*>/g) ?? []
}

/** The classes of the first element whose opening tag starts with `tag`. */
function classesOf(html: string, tag: string): string[] {
  const element = html.match(new RegExp(`<${tag}[^>]*>`))?.[0] ?? ""
  return element.match(/\sclass="([^"]*)"/)?.[1]?.split(" ") ?? []
}

describe("RadioChips", () => {
  it("renders a fieldset named by its legend, with one native radio per option sharing the name", () => {
    const html = render(<RadioChips legend="Which tools" name="mode" options={options} />)

    expect(html).toMatch(/^<fieldset[^>]*><legend class="pc-label mb-2">Which tools<\/legend>/)
    const inputs = radios(html)
    expect(inputs.length).toBe(3)
    for (const input of inputs) {
      expect(input).toContain(`type="radio"`)
      expect(input).toContain(`name="mode"`)
      expect(input).toContain(`class="sr-only"`)
    }
    expect(html).toMatch(
      /<label[^>]*><input[^>]*value="all"[^>]*\/><svg.*?<\/svg>All tools<\/label>/,
    )
  })

  it("checks the default option in the server markup, with no script and no ARIA state", () => {
    const html = render(
      <RadioChips legend="Mode" name="mode" options={options} defaultValue="read-only" />,
    )

    const checkedInputs = radios(html).filter((input) => / checked(\s|\/|>)/.test(input))
    expect(checkedInputs.length).toBe(1)
    expect(checkedInputs[0]).toContain(`value="read-only"`)
    expect(html).not.toContain("<script")
    expect(html).not.toMatch(/aria-(checked|pressed)|role=|tabindex/i)
  })

  it("checks the controlled value over the default", () => {
    const html = render(
      <RadioChips
        legend="Mode"
        name="mode"
        options={options}
        defaultValue="read-only"
        value="all"
        onChange={() => {}}
      />,
    )

    const checkedInputs = radios(html).filter((input) => / checked(\s|\/|>)/.test(input))
    expect(checkedInputs.length).toBe(1)
    expect(checkedInputs[0]).toContain(`value="all"`)
  })

  it("puts each option's id and extra attributes on its radio, and disables a disabled option", () => {
    const [all, readOnly, none] = radios(
      render(<RadioChips legend="Mode" name="mode" options={options} />),
    )

    expect(all).toContain(`id="mode-all"`)
    expect(all).toContain(`data-event="all"`)
    expect(readOnly).toContain(`id="mode-read-only"`)
    expect(none).toMatch(/ disabled(\s|\/|>)/)
    expect(all).not.toMatch(/ disabled(\s|\/|>)/)
  })

  it("keeps the component's own type and name over an option's extra attributes", () => {
    const [input] = radios(
      render(
        <RadioChips
          legend="Mode"
          name="mode"
          options={[{ value: "a", label: "A", inputAttributes: { type: "checkbox", name: "x" } }]}
        />,
      ),
    )

    expect(input).toContain(`type="radio"`)
    expect(input).toContain(`name="mode"`)
    expect(input).not.toContain("checkbox")
  })

  it("hides the legend visually when asked, and takes the caller's legend and row classes", () => {
    const hidden = render(<RadioChips legend="Mode" name="mode" options={options} hideLegend />)
    const styled = render(
      <RadioChips
        legend="Mode"
        name="mode"
        options={options}
        legendClass="font-semibold"
        optionsClass="lg:flex-col"
        class="mt-5"
      />,
    )

    expect(hidden).toContain(`<legend class="sr-only">Mode</legend>`)
    expect(styled).toContain(`<fieldset class="mt-5">`)
    expect(styled).toContain(`<legend class="font-semibold">Mode</legend>`)
    expect(styled).toContain(`<div class="flex flex-wrap gap-2 lg:flex-col">`)
  })

  it("draws the chip at ToggleChips' size and surface, and the checked chip in its pressed look", () => {
    const chip = classesOf(
      render(<RadioChips legend="Mode" name="mode" options={options} />),
      "label",
    )
    const toggle = classesOf(
      render(<ToggleChips options={[{ value: "a", label: "a" }]} value={[]} onChange={() => {}} />),
      "button",
    )
    const pressed = classesOf(
      render(
        <ToggleChips options={[{ value: "a", label: "a" }]} value={["a"]} onChange={() => {}} />,
      ),
      "button",
    )
    const shared = ["min-h-11", "sm:min-h-8", "px-3", "rounded-md", "text-xs", "border"]
    const surface = ["bg-surface", "text-foreground", "border-subtle", "hover:bg-hover"]

    expect(toggle).toEqual(expect.arrayContaining([...shared, ...surface]))
    expect(chip).toEqual(expect.arrayContaining([...shared, ...surface]))
    for (const name of ["bg-selected", "text-selected-foreground", "border-transparent"]) {
      expect(pressed).toContain(name)
      expect(chip).toContain(`has-[:checked]:${name}`)
    }
  })

  it("shows the check and the focus ring from the radio's own state", () => {
    const html = render(<RadioChips legend="Mode" name="mode" options={options} />)
    const chip = classesOf(html, "label")

    expect(classesOf(html, "svg")).toEqual(
      expect.arrayContaining(["hidden", "group-has-[:checked]/chip:block"]),
    )
    expect(chip).toContain("group/chip")
    expect(chip).toEqual(
      expect.arrayContaining(["has-[:focus-visible]:ring-2", "has-[:focus-visible]:ring-focus"]),
    )
  })
})
