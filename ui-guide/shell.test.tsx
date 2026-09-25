/**
 * The shell, rendered to a string: which page a `hash` shows, what its navigation marks, and what a
 * host's props reach. Opening the phone dialog, scrolling and marking a card happen in effects and
 * handlers, which a server render never runs; `pages/checks/ui-guide.ts` drives those in a browser.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { options } from "preact"
import { render } from "preact-render-to-string"
import { UIGuide, type UIGuideProps } from "./shell.tsx"
import { catalogueNames, demoRegistry, guidePages } from "./registry.ts"

/** The complete registry without the cards of one package's page. */
function withoutPage(id: string): UIGuideProps["registry"] {
  const page = guidePages.find((candidate) => candidate.id === id)!
  const dropped = new Set(page.sections.flatMap((section) => section.names))
  return Object.fromEntries(Object.entries(demoRegistry).filter(([name]) => !dropped.has(name)))
}

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

  it("opens the page that holds a bare fragment's section or gallery", () => {
    expect(render(<UIGuide hash="#icons" />)).toContain(`data-guide-page="icons"`)
    expect(render(<UIGuide hash="#inputs" />)).toContain(`data-guide-page="ui"`)
    expect(render(<UIGuide hash="#crud" />)).toContain(`data-guide-page="crud"`)
  })

  it("renders the overview for a first route that names no page", () => {
    expect(render(<UIGuide hash="#/nonsense" />)).toContain(`data-guide-page="overview"`)
  })

  it("says a package with no card in the registry has examples coming", () => {
    expect(render(<UIGuide hash="#/cn" />)).not.toContain("Runnable examples for this package")

    const registry = withoutPage("cn")
    const html = render(<UIGuide hash="#/cn" registry={registry} />)

    expect(html).toContain(`data-guide-page="cn"`)
    expect(html).toContain("Runnable examples for this package are coming.")
    expect(render(<UIGuide hash="#/cn" registry={registry} labels={{ comingSoon: "Bientôt." }} />))
      .toContain(
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

/** One link the shell rendered: its href, its attributes, and the click handler it was given. */
interface RenderedLink {
  href: string
  props: Record<string, unknown>
  onClick?: (event: { preventDefault: () => void }) => void
}

/**
 * Every `<a>` the shell creates while rendering, recorded as it is created, so a test can call a
 * link's own click handler the way a browser would.
 *
 * @param props The props to render the shell with.
 * @returns The links, in creation order.
 */
function linksOf(props: UIGuideProps): RenderedLink[] {
  const links: RenderedLink[] = []
  const previous = options.vnode
  options.vnode = (vnode) => {
    if (vnode.type === "a") {
      const linkProps = vnode.props as Record<string, unknown>
      links.push({
        href: String(linkProps.href),
        props: linkProps,
        onClick: linkProps.onClick as RenderedLink["onClick"],
      })
    }
    previous?.(vnode)
  }
  try {
    render(<UIGuide {...props} />)
  } finally {
    options.vnode = previous
  }
  return links
}

/** Click a rendered link, and report whether it cancelled the browser's own navigation. */
function click(link: RenderedLink | undefined): { prevented: boolean } {
  let prevented = false
  link?.onClick?.({ preventDefault: () => prevented = true })
  return { prevented }
}

describe("UIGuide's navigate port", () => {
  it("routes a navigation link and an overview card through navigate, not the address", () => {
    const navigated: string[] = []
    const links = linksOf({ hash: "", navigate: (href) => navigated.push(href) })

    const navLink = links.find((link) => link.props["data-guide-page-link"] === "crud")
    const overviewCard = links.find((link) =>
      link.href === "#/crud" && link.props["data-guide-page-link"] === undefined
    )
    expect(navLink, "the navigation links the CRUD page").toBeDefined()
    expect(overviewCard, "the overview has a card for the CRUD page").toBeDefined()

    expect(click(navLink).prevented, "the nav link cancels the browser's navigation").toBe(true)
    expect(click(overviewCard).prevented, "so does the overview card").toBe(true)
    expect(navigated).toEqual(["#/crud", "#/crud"])
  })

  it("leaves every link a plain link when the host passes no navigate", () => {
    const links = linksOf({ hash: "" })
    const navLink = links.find((link) => link.props["data-guide-page-link"] === "crud")

    expect(click(navLink).prevented).toBe(false)
  })
})

describe("UIGuide's own copy", () => {
  it("prints the overview's counts in English, or through the labels when given", () => {
    const english = render(<UIGuide hash="" registry={withoutPage("cn")} />)
    expect(english).toMatch(/\d+ live cards · \d+ icons · \d+ packages/)
    expect(english).toMatch(/>\d+ cards</)
    expect(english).toContain(">Examples coming<")

    const french = render(
      <UIGuide
        hash=""
        registry={withoutPage("cn")}
        labels={{
          stats: ({ cards }) => `${cards} fiches`,
          cardCount: (count) => `${count} fiches`,
          iconCount: (count) => `${count} icônes`,
          examplesComing: "Exemples à venir",
        }}
      />,
    )
    expect(french).not.toContain("live cards")
    expect(french).not.toMatch(/>\d+ cards</)
    expect(french).toMatch(/>\d+ icônes</)
    expect(french).toContain(">Exemples à venir<")
  })

  it("puts a skip link to the page ahead of every navigation link, with its own name", () => {
    const html = render(<UIGuide hash="#/ui" labels={{ skipToContent: "Aller au contenu" }} />)

    const skip = html.match(/<a href="#([^"]+)"[^>]*data-e2e="ui-guide-skip"[^>]*>Aller au contenu/)
    expect(skip, "the skip link is rendered with its label").not.toBeNull()
    expect(html.indexOf("ui-guide-skip")).toBeLessThan(html.indexOf("data-guide-page-link"))
    expect(html, "the link's target is on the page").toContain(`id="${skip?.[1]}"`)
  })
})
