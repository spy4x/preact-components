import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ToggleChips, toggleChipSelection } from "./toggle-chips.tsx"

const options = [
  { value: "work", label: "work" },
  { value: "home", label: "home" },
  { value: "iOS", label: "iOS", disabled: true },
]

describe("toggleChipSelection", () => {
  it("adds a chip that was not pressed, in the order of the options", () => {
    expect(toggleChipSelection(options, ["home"], "work")).toEqual(["work", "home"])
  })

  it("removes a chip that was pressed", () => {
    expect(toggleChipSelection(options, ["work", "home"], "work")).toEqual(["home"])
  })
})

describe("ToggleChips", () => {
  it("renders a named group of buttons with aria-pressed from the value", () => {
    const html = render(<ToggleChips options={options} value={["home"]} onChange={() => {}} />)

    expect(html).toContain(`role="group" aria-label="Filters"`)
    expect(html.match(/<button type="button"/g)?.length).toBe(3)
    expect(html).toMatch(/aria-pressed="false"[^>]*>work</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>home</)
  })

  it("marks the one chip of a single-select group that matches the value", () => {
    const html = render(
      <ToggleChips mode="single" options={options} value="work" onChange={() => {}} />,
    )

    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1)
    expect(html).toMatch(/aria-pressed="true"[^>]*>work</)
  })

  it("draws a pressed chip as a filled badge and an unpressed one as a grey outline", () => {
    const html = render(
      <ToggleChips options={options} value={["home"]} color="green" onChange={() => {}} />,
    )
    const home = html.match(/<button[^>]*>home</)?.[0] ?? ""
    const work = html.match(/<button[^>]*>work</)?.[0] ?? ""

    expect(home).toContain("bg-green-600")
    expect(work).toContain("border-control")
    expect(work).not.toContain("bg-green-600")
  })

  it("gives an unpressed chip readable hover text, and a pressed one none", () => {
    const html = render(<ToggleChips options={options} value={["home"]} onChange={() => {}} />)
    const home = html.match(/<button[^>]*>home</)?.[0] ?? ""
    const work = html.match(/<button[^>]*>work</)?.[0] ?? ""

    expect(work).toContain("hover:text-foreground")
    expect(work).toContain("hover:bg-hover")
    expect(home).not.toContain("hover:text-foreground")
  })

  it("keeps the caller's case rather than capitalising like Badge", () => {
    const html = render(<ToggleChips options={options} value={[]} onChange={() => {}} />)

    expect(html).toContain("normal-case")
    expect(html).not.toMatch(/class="[^"]*\bcapitalize\b/)
  })

  it("disables a disabled option and takes the caller's group name", () => {
    const html = render(
      <ToggleChips options={options} value={[]} label="Tags" onChange={() => {}} />,
    )

    expect(html).toContain(`aria-label="Tags"`)
    expect(html).toMatch(/<button[^>]* disabled[ >][^>]*>iOS</)
    expect(html).not.toMatch(/<button[^>]* disabled[ >][^>]*>work</)
  })
})
