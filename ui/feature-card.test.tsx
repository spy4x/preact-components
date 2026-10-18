import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { IconSprout } from "@spy4x/preact-icons"
import { render } from "preact-render-to-string"
import { FeatureCard } from "./feature-card.tsx"

describe("FeatureCard", () => {
  it("draws the title as an h3 with the given id, labelling the card's article", () => {
    const html = render(<FeatureCard id="sign-in" title="Sign-in">Passkeys and email.</FeatureCard>)
    expect(html).toMatch(/^<div role="article" aria-labelledby="sign-in"/)
    expect(html).toMatch(/<h3 id="sign-in"[^>]*>Sign-in<\/h3>/)
    expect(html).toContain("Passkeys and email.")
  })

  it("draws the title at the heading level it is given", () => {
    const html = render(
      <FeatureCard id="sign-in" title="Sign-in" headingLevel={2}>Text.</FeatureCard>,
    )
    expect(html).toMatch(/<h2 id="sign-in"/)
    expect(html).not.toContain("<h3")
  })

  it("links to href with the default label, described by the heading", () => {
    const html = render(
      <FeatureCard id="sign-in" title="Sign-in" href="/features#sign-in">Text.</FeatureCard>,
    )
    expect(html).toMatch(/<a href="\/features#sign-in" aria-describedby="sign-in"[^>]*>Learn more /)
  })

  it("prints the link label it is given in place of the default", () => {
    const html = render(
      <FeatureCard id="sign-in" title="Sign-in" href="/x" linkLabel="Read the guide">
        Text.
      </FeatureCard>,
    )
    expect(html).toContain("Read the guide")
    expect(html).not.toContain("Learn more")
  })

  it("draws no link when href is not given", () => {
    const html = render(<FeatureCard id="sign-in" title="Sign-in">Text.</FeatureCard>)
    expect(html).not.toContain("<a ")
    expect(html).not.toContain("Learn more")
  })

  it("draws the media after the text, in a block of its own", () => {
    const html = render(
      <FeatureCard id="sign-in" title="Sign-in" media={<img src="/shot.png" alt="The form" />}>
        Text.
      </FeatureCard>,
    )
    expect(html).toMatch(/<\/p><\/div><div class="border-t border-subtle"><img src="\/shot.png"/)
  })

  it("spans two columns from lg only when wide", () => {
    const wide = render(<FeatureCard id="a" title="A" wide>Text.</FeatureCard>)
    const narrow = render(<FeatureCard id="a" title="A">Text.</FeatureCard>)
    expect(wide).toMatch(/^<div [^>]*class="[^"]*\blg:col-span-2\b/)
    expect(narrow).not.toContain("lg:col-span-2")
  })

  it("draws the icon in a tile hidden from assistive technology, and no tile without one", () => {
    const withIcon = render(<FeatureCard id="a" title="A" Icon={IconSprout}>Text.</FeatureCard>)
    const without = render(<FeatureCard id="a" title="A">Text.</FeatureCard>)
    expect(withIcon).toMatch(/<span class="[^"]*\bbg-selected-soft\b[^"]*" aria-hidden="true"><svg/)
    expect(without).not.toContain("<svg")
  })

  it("merges the caller's class onto the card", () => {
    const html = render(<FeatureCard id="a" title="A" class="shadow-raised">Text.</FeatureCard>)
    expect(html).toMatch(/^<div [^>]*class="pc-card [^"]*\bshadow-raised\b/)
  })
})
