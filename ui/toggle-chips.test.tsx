import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ToggleChips, toggleChipSelection } from "./toggle-chips.tsx"

/** Each chip's classes, in the order of the chips. */
function chipClasses(html: string): string[][] {
  return (html.match(/<button[^>]*>/g) ?? []).map((tag) =>
    tag.match(/\sclass="([^"]*)"/)?.[1]?.split(" ") ?? []
  )
}

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
    expect(html).toMatch(/aria-pressed="true"[^>]*>(<svg.*?<\/svg>)?home</)
  })

  it("marks the one chip of a single-select group that matches the value", () => {
    const html = render(
      <ToggleChips mode="single" options={options} value="work" onChange={() => {}} />,
    )

    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1)
    expect(html).toMatch(/aria-pressed="true"[^>]*>(<svg.*?<\/svg>)?work</)
  })

  it("draws a pressed chip as a filled badge and an unpressed one in the full text colour on the surface", () => {
    const html = render(
      <ToggleChips options={options} value={["home"]} color="green" onChange={() => {}} />,
    )
    const [work, home] = chipClasses(html)

    expect(home).toContain("bg-success")
    expect(work).toEqual(
      expect.arrayContaining(["bg-surface", "text-foreground", "border-subtle", "hover:bg-hover"]),
    )
    expect(work).not.toContain("text-muted")
    expect(work).not.toContain("border-control")
    expect(work).not.toContain("bg-success")
  })

  it("shows a check before a pressed chip's text, and none on an unpressed chip", () => {
    const html = render(<ToggleChips options={options} value={["home"]} onChange={() => {}} />)

    expect(html).toMatch(
      /aria-pressed="true"[^>]*><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>home</,
    )
    expect(html).toMatch(/aria-pressed="false"[^>]*>work</)
    expect(html.match(/<svg/g)?.length).toBe(1)
  })

  it("makes every chip a 44 px touch target on a phone and badge height from sm up", () => {
    const chips = chipClasses(
      render(<ToggleChips options={options} value={["home"]} onChange={() => {}} />),
    )

    expect(chips.length).toBe(3)
    for (const classes of chips) {
      expect(classes).toEqual(expect.arrayContaining(["min-h-11", "sm:min-h-8", "px-3"]))
      expect(classes).not.toContain("px-2")
    }
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
