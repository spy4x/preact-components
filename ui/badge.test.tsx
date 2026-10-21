import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  Badge,
  BADGE_TONE_OF_COLOR,
  badgeClasses,
  type BadgeColor,
  type BadgeProps,
} from "./badge.tsx"
import { StatusMark } from "./status-mark.tsx"

describe("Badge", () => {
  it("fills with the primary tone by default", () => {
    const html = render(<Badge text="paid" />)

    expect(html).toMatch(/[" ]bg-selected[" ]/)
    expect(html).toContain("text-selected-foreground")
    expect(html).toContain("paid")
  })

  it("draws an outline badge's border and text in its light shade, with no fill", () => {
    const html = render(<Badge text="draft" tone="danger" variant="outline" />)

    expect(html).toContain("border-red-700")
    expect(html).toContain("text-red-700")
    expect(html).not.toMatch(/[" ]bg-red-/)
  })

  it("renders a filled tone by name", () => {
    const html = render(<Badge text="open" tone="success" />)

    expect(html).toContain("bg-success")
    expect(html).toContain("text-(--color-success-foreground)")
  })

  it("draws the filled neutral badge in the foreground colour, which the dark track needs", () => {
    const html = render(<Badge text="draft" tone="neutral" />)

    expect(html).toContain("bg-track")
    expect(html).toContain("text-foreground")
    expect(html).not.toContain("text-muted")
  })

  it("keeps the caller's class alongside the palette", () => {
    const html = render(<Badge text="vip" class="uppercase tracking-wide" />)

    expect(html).toContain("uppercase tracking-wide")
    expect(html).toMatch(/[" ]bg-selected[" ]/)
  })

  it("lets the caller's class win over a conflicting default", () => {
    const html = render(<Badge text="tiny" class="text-sm" />)

    expect(html).toContain("text-sm")
    expect(html).not.toContain("text-xs")
  })

  it("shows its text in the case the caller gave, with no capitalisation", () => {
    const html = render(<Badge text="Not verified" />)

    expect(html).toContain(">Not verified<")
    expect(html).not.toMatch(/class="[^"]*\bcapitalize\b/)
  })

  it("renders the badge as a span", () => {
    expect(render(<Badge text="x" />)).toMatch(/^<span/)
  })

  it("renders a text badge as a span carrying badgeClasses and nothing else", () => {
    expect(render(<Badge text="x" tone="neutral" />)).toBe(
      `<span class="${badgeClasses("neutral")}">x</span>`,
    )
  })

  it("holds a StatusMark and a link as children, in the badge's own classes", () => {
    const html = render(
      <Badge tone="neutral">
        <StatusMark status="ready" label="Passing" />
        <a href="/ci">CI</a>
      </Badge>,
    )

    expect(html).toMatch(/^<span class="[^"]*bg-track[^"]*">/)
    expect(html).toContain(render(<StatusMark status="ready" label="Passing" />))
    expect(html).toContain(`<a href="/ci">CI</a>`)
  })

  it("puts a gap between element children, which a text badge does not get", () => {
    const html = render(
      <Badge>
        <span>a</span>
        <span>b</span>
      </Badge>,
    )

    expect(html).toMatch(/^<span class="[^"]*\bgap-1\b/)
    expect(render(<Badge text="a" />)).not.toContain("gap-")
  })

  it("lets the caller's gap win over the element gap", () => {
    const html = render(
      <Badge class="gap-2">
        <span>a</span>
      </Badge>,
    )

    expect(html).toMatch(/[" ]gap-2[" ]/)
    expect(html).not.toMatch(/[" ]gap-1[" ]/)
  })

  it("renders the whole badge as a link with a focus ring when given href", () => {
    const html = render(
      <Badge href="https://ci.example.com" tone="neutral">
        <StatusMark status="ready" label="Passing" />
      </Badge>,
    )

    expect(html).toMatch(/^<a href="https:\/\/ci.example.com" class="/)
    expect(html).toContain("focus-visible:ring-2")
    expect(html).toContain("focus-visible:ring-focus")
    expect(html).toContain("focus-visible:ring-offset-focus")
    expect(html).toContain("bg-track")
    expect(html).toMatch(/Passing<\/span><\/a>$/)
  })

  it("refuses, as a type error, a badge with neither text nor children or with both", () => {
    // @ts-expect-error: a badge needs a text label or element content
    const empty = <Badge tone="neutral" />
    // @ts-expect-error: a text label and element content at once
    const both = <Badge text="x">y</Badge>

    expect(empty.type).toBe(Badge)
    expect(both.type).toBe(Badge)
  })

  it("keeps BadgeProps an interface an app can extend, with text a required string", () => {
    interface AppBadgeProps extends BadgeProps {
      tooltip?: string
    }
    const textLength = (props: AppBadgeProps) => props.text.length

    expect(textLength({ text: "paid", tooltip: "settled" })).toBe(4)
  })

  it("draws no focus ring on a badge without href", () => {
    expect(render(<Badge text="x" />)).not.toContain("focus-visible:")
  })
})

describe("Badge's deprecated color and type", () => {
  it("draws every old colour name as the tone it maps to", () => {
    for (const [color, tone] of Object.entries(BADGE_TONE_OF_COLOR)) {
      for (const variant of ["filled", "outline"] as const) {
        expect(render(<Badge text="x" color={color as BadgeColor} type={variant} />))
          .toBe(render(<Badge text="x" tone={tone} variant={variant} />))
      }
    }
  })

  it("lets tone and variant win over color and type", () => {
    expect(render(<Badge text="x" tone="danger" color="green" variant="filled" type="outline" />))
      .toBe(render(<Badge text="x" tone="danger" />))
  })

  it("still takes an old colour name in badgeClasses", () => {
    expect(badgeClasses("purpleNav", "outline")).toBe(badgeClasses("primaryStrong", "outline"))
    expect(badgeClasses("red")).toBe(badgeClasses("danger"))
  })

  it("draws primaryStrong, the old purpleNav, the same in both variants", () => {
    expect(badgeClasses("primaryStrong")).toBe(badgeClasses("primaryStrong", "outline"))
    expect(badgeClasses("primaryStrong")).toContain("bg-accent-900")
  })
})

describe("badgeClasses", () => {
  it("returns the same classes Badge renders", () => {
    const html = render(<Badge text="open" tone="success" variant="outline" />)

    expect(html).toContain(`class="${badgeClasses("success", "outline")}"`)
  })
})
