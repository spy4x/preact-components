import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { IconSprout } from "@spy4x/preact-icons"
import { render } from "preact-render-to-string"
import { BrandMark } from "./brand-mark.tsx"

describe("BrandMark", () => {
  it("draws the glyph in a tile at the card radius filled with the accent, hidden from assistive tech", () => {
    const html = render(<BrandMark Icon={IconSprout} name="Acme" />)
    const tile = html.match(/<span class="([^"]*)" aria-hidden="true"><svg/)
    expect(tile).not.toBeNull()
    const classes = tile![1].split(" ")
    expect(classes).toContain("rounded-card")
    expect(classes).toContain("bg-accent-900")
    expect(classes).toContain("text-accent-foreground")
  })

  it("prints the name as text after the tile, in weight 500", () => {
    const html = render(<BrandMark Icon={IconSprout} name="Acme" />)
    expect(html).toMatch(/^<span class="[^"]*\bfont-medium\b[^"]*"/)
    expect(html).toMatch(/<\/svg><\/span><span>Acme<\/span><\/span>$/)
  })

  it("merges the caller's class over the root's own", () => {
    const html = render(<BrandMark Icon={IconSprout} name="Acme" class="text-lg font-semibold" />)
    expect(html).toMatch(/^<span class="[^"]*\btext-lg\b[^"]*"/)
    expect(html).not.toMatch(/^<span class="[^"]*\bfont-medium\b/)
  })
})
