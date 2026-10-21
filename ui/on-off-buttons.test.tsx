import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import type { VNode } from "preact"
import { OnOffButtons, type OnOffButtonsProps } from "./on-off-buttons.tsx"

describe("OnOffButtons", () => {
  it("reports each half through onChange", () => {
    const seen: boolean[] = []
    pressHalves({ value: true, onChange: (on) => seen.push(on) })

    expect(seen).toEqual([true, false])
  })

  it("still reports through the deprecated onSwitch", () => {
    const seen: boolean[] = []
    pressHalves({ value: true, onSwitch: (on) => seen.push(on) })

    expect(seen).toEqual([true, false])
  })

  it("still takes the group's name from the deprecated label, and prefers ariaLabel", () => {
    expect(render(<OnOffButtons onChange={() => {}} label="Old" />)).toContain('aria-label="Old"')
    expect(render(<OnOffButtons onChange={() => {}} label="Old" ariaLabel="New" />))
      .toContain('aria-label="New"')
  })

  it("renders both halves", () => {
    const html = render(<OnOffButtons onChange={() => {}} />)

    expect(html).toContain(">ON<")
    expect(html).toContain(">OFF<")
  })

  it("marks the ON half as selected", () => {
    const html = render(<OnOffButtons value onChange={() => {}} />)

    // The primary fill stays in the class list; the selection fill is important, so it wins.
    expect(countOccurrences(html, " bg-selected! ")).toBe(1)
    expect(html).toContain("text-selected-foreground!")
    expect(html).toContain("hover:bg-selected-hover!")
  })

  it("marks the OFF half as selected", () => {
    const html = render(<OnOffButtons value={false} onChange={() => {}} />)

    expect(countOccurrences(html, " bg-selected! ")).toBe(1)
  })

  it("leaves both halves unselected when value is undefined", () => {
    expect(render(<OnOffButtons onChange={() => {}} />)).not.toContain("bg-selected")
  })

  it("says which half is pressed with aria-pressed, not only with colour", () => {
    expect(pressed(render(<OnOffButtons value onChange={() => {}} />))).toEqual(["true", "false"])
    expect(pressed(render(<OnOffButtons value={false} onChange={() => {}} />)))
      .toEqual(["false", "true"])
  })

  it("reports neither half pressed when value is undefined", () => {
    expect(pressed(render(<OnOffButtons onChange={() => {}} />))).toEqual(["false", "false"])
  })

  it("names the pair as a group after its two labels by default", () => {
    const html = render(<OnOffButtons onChange={() => {}} onLabel="Active" offLabel="Archived" />)

    expect(html).toContain('<div role="group" aria-label="Active / Archived"')
  })

  it("names the group with the caller's label", () => {
    const html = render(<OnOffButtons onChange={() => {}} ariaLabel="Rows to show" />)

    expect(html).toContain('<div role="group" aria-label="Rows to show"')
  })

  it("renders the amounts under the labels", () => {
    const html = render(<OnOffButtons value onChange={() => {}} amount={{ on: 12, off: 3 }} />)

    expect(html).toContain(">12<")
    expect(html).toContain(">3<")
  })

  it("omits the amounts when none are given", () => {
    expect(render(<OnOffButtons value onChange={() => {}} />)).not.toContain("text-xs")
  })

  it("squares the halves off against each other", () => {
    const html = render(<OnOffButtons value onChange={() => {}} />)

    expect(html).toContain("rounded-r-none")
    expect(html).toContain("rounded-l-none")
    expect(html).toContain("-ml-px")
  })

  it("uses the caller's labels", () => {
    const html = render(
      <OnOffButtons value onChange={() => {}} onLabel="Active" offLabel="Archived" />,
    )

    expect(html).toContain(">Active<")
    expect(html).toContain(">Archived<")
  })

  it("stacks the label above the amount", () => {
    expect(render(<OnOffButtons value onChange={() => {}} amount={{ on: 1, off: 2 }} />))
      .toContain("flex-col")
  })
})

/**
 * Press the ON half, then the OFF half, on the vnode the component returned: a rendered string has
 * no handlers.
 *
 * @param props The pair's props.
 * @throws When a half carries no click handler.
 */
function pressHalves(props: OnOffButtonsProps): void {
  const group = OnOffButtons(props) as VNode<{ children: VNode<{ onClick?: () => void }>[] }>
  for (const half of group.props.children) {
    if (half.props.onClick === undefined) throw new TypeError("a half has no click handler")
    half.props.onClick()
  }
}

/** The `aria-pressed` value of each button, in document order. */
function pressed(html: string): string[] {
  return [...html.matchAll(/<button[^>]*aria-pressed="([^"]*)"/g)].map((match) => match[1])
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
