/**
 * The shell, rendered to a string: which page a `hash` shows, what its navigation marks, and what a
 * host's props reach. Opening the phone dialog, scrolling and marking a card happen in effects and
 * handlers, which a server render never runs; `pages/checks/ui-guide.ts` drives those in a browser.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UIGuide } from "./shell.tsx"
import { catalogueNames, guidePages } from "./registry.ts"

/** The card ids a render carries, in document order. */
function cardsIn(html: string): string[] {
  return [...html.matchAll(/<article id="demo-([^"]+)"/g)].map((match) => match[1])
}

describe("UIGuide's pages", () => {
  it("renders every card on the all page when the host has not read the address yet", () => {
    const html = render(<UIGuide />)

    expect(html).toContain(`data-guide-page="all"`)
    expect(cardsIn(html).sort()).toEqual([...catalogueNames].sort())
  })

  it("renders the overview, and no card, for an empty hash", () => {
    const html = render(<UIGuide hash="" />)

    expect(html).toContain(`data-guide-page="overview"`)
    expect(cardsIn(html)).toEqual([])
    expect(html).toContain('id="instructions"')
  })

  it("renders one package's page, and only that page's cards, for its route", () => {
    const crud = guidePages.find((page) => page.id === "crud")
    const own = (crud?.sections ?? []).flatMap((section) => section.names)

    const html = render(<UIGuide hash="#/crud" />)

    expect(html).toContain(`data-guide-page="crud"`)
    expect(own.length).toBeGreaterThan(0)
    expect(cardsIn(html)).toEqual(own)
  })

  it("renders a card's own page for a deep link, and the legacy fragment", () => {
    for (const hash of ["#/inputs/toggle-switch", "#toggle-switch", "#demo-ToggleSwitch"]) {
      const html = render(<UIGuide hash={hash} />)
      expect(html, hash).toContain(`data-guide-page="ui"`)
      expect(cardsIn(html), hash).toContain("ToggleSwitch")
      expect(cardsIn(html), hash).not.toContain("CrudEditor")
    }
  })

  it("renders the overview for a first route that names no page", () => {
    expect(render(<UIGuide hash="#/nonsense" />)).toContain(`data-guide-page="overview"`)
  })

  it("says a package with no cards yet has examples coming", () => {
    const html = render(<UIGuide hash="#/cn" />)

    expect(html).toContain(`data-guide-page="cn"`)
    expect(html).toContain("Runnable examples for this package are coming.")
    expect(render(<UIGuide hash="#/cn" labels={{ comingSoon: "Bientôt." }} />)).toContain(
      "Bientôt.",
    )
  })

  it("renders the icon gallery on the icons page", () => {
    const html = render(<UIGuide hash="#/icons" />)

    expect(html).toContain('id="icons"')
    expect(html).toContain('data-icon="IconSearch"')
  })

  it("appends a host's page extra to that page only", () => {
    const extras = { signals: <p data-host-extra="">host demo</p> }

    expect(render(<UIGuide hash="#/signals" pageExtras={extras} />)).toContain("data-host-extra")
    expect(render(<UIGuide hash="#/ui" pageExtras={extras} />)).not.toContain("data-host-extra")
  })
})

describe("UIGuide's navigation", () => {
  it("is a labelled nav listing every page, the one showing marked as the page", () => {
    const html = render(<UIGuide hash="#/theme" />)

    expect(html).toContain('<nav aria-label="Guide"')
    for (const page of guidePages) {
      expect(html, page.id).toContain(`data-guide-page-link="${page.id}"`)
    }
    const current = [...html.matchAll(/aria-current="page" data-guide-page-link="([a-z]+)"/g)]
      .map((match) => match[1])
    expect(current).toEqual(["theme"])
  })

  it("lists the showing page's sections and cards, and marks the card a deep link names", () => {
    const html = render(<UIGuide hash="#/inputs/toggle-switch" />)

    expect(html).toContain('href="#/inputs"')
    expect(html).toContain('href="#/inputs/toggle-switch" aria-current="true"')
    expect(html.match(/aria-current="true"/g)?.length).toBe(1)
    // Another page's cards are not listed while it is not showing.
    expect(html).not.toContain('href="#/crud/crud-editor"')
  })

  it("marks the section a section route names, and no card", () => {
    const html = render(<UIGuide hash="#/fields" />)

    expect(html).toContain('href="#/fields" aria-current="true"')
    expect(html.match(/aria-current="true"/g)?.length).toBe(1)
  })

  it("renders a phone menu button that controls a labelled dialog, with overridable names", () => {
    const html = render(
      <UIGuide hash="" labels={{ nav: "Leitfaden", openNav: "Menü", closeNav: "Schließen" }} />,
    )

    const controls = html.match(
      /aria-haspopup="dialog" aria-expanded="false" aria-controls="([^"]+)"/,
    )
    expect(controls, "the menu button names the dialog it opens").not.toBeNull()
    expect(html).toContain(`<dialog id="${controls?.[1]}" aria-label="Leitfaden"`)
    expect(html).toContain("Menü")
    expect(html).toContain('aria-label="Schließen"')
  })
})
