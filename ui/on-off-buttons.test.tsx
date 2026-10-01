import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { OnOffButtons } from "./on-off-buttons.tsx"

describe("OnOffButtons", () => {
  it("renders both halves", () => {
    const html = render(<OnOffButtons onSwitch={() => {}} />)

    expect(html).toContain(">ON<")
    expect(html).toContain(">OFF<")
  })

  it("marks the ON half as selected", () => {
    const html = render(<OnOffButtons value onSwitch={() => {}} />)

    // The primary fill stays in the class list; the selection fill is important, so it wins.
    expect(countOccurrences(html, " bg-selected! ")).toBe(1)
    expect(html).toContain("text-selected-foreground!")
    expect(html).toContain("hover:bg-selected-hover!")
  })

  it("marks the OFF half as selected", () => {
    const html = render(<OnOffButtons value={false} onSwitch={() => {}} />)

    expect(countOccurrences(html, " bg-selected! ")).toBe(1)
  })

  it("leaves both halves unselected when value is undefined", () => {
    expect(render(<OnOffButtons onSwitch={() => {}} />)).not.toContain("bg-selected")
  })

  it("renders the amounts under the labels", () => {
    const html = render(<OnOffButtons value onSwitch={() => {}} amount={{ on: 12, off: 3 }} />)

    expect(html).toContain(">12<")
    expect(html).toContain(">3<")
  })

  it("omits the amounts when none are given", () => {
    expect(render(<OnOffButtons value onSwitch={() => {}} />)).not.toContain("text-xs")
  })

  it("squares the halves off against each other", () => {
    const html = render(<OnOffButtons value onSwitch={() => {}} />)

    expect(html).toContain("rounded-r-none")
    expect(html).toContain("rounded-l-none")
    expect(html).toContain("-ml-px")
  })

  it("uses the caller's labels", () => {
    const html = render(
      <OnOffButtons value onSwitch={() => {}} onLabel="Active" offLabel="Archived" />,
    )

    expect(html).toContain(">Active<")
    expect(html).toContain(">Archived<")
  })

  it("stacks the label above the amount", () => {
    expect(render(<OnOffButtons value onSwitch={() => {}} amount={{ on: 1, off: 2 }} />))
      .toContain("flex-col")
  })
})

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
