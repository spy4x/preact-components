/**
 * The front page (#400), rendered to a string: its counts come from the registry and nowhere else,
 * its links point where they say, and the live mini app renders on the server with nothing open.
 * Keyboard, focus and layout are `pages/checks/ui-guide.ts`'s, in a real browser.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { iconNames } from "./icons.tsx"
import { MINI_PROJECTS } from "./mini-app.tsx"
import {
  defaultCardCount,
  defaultIconCount,
  defaultStats,
  JSR_SCOPE_URL,
  libraryPackageIds,
  overviewTotals,
} from "./overview.tsx"
import {
  catalogueSections,
  demoRegistry,
  guidePages,
  helperPackageIds,
  type PartialDemoRegistry,
} from "./registry.ts"
import { UIGuide } from "./shell.tsx"

const REPOSITORY = "https://example.com/owner/library"
const AUTHOR = { name: "A. Maker", href: "https://example.com/maker" }

/** The complete registry without the cards of one package's page. */
function withoutPage(id: string): PartialDemoRegistry {
  const page = guidePages.find((candidate) => candidate.id === id)!
  const dropped = new Set(page.sections.flatMap((section) => section.names))
  return Object.fromEntries(Object.entries(demoRegistry).filter(([name]) => !dropped.has(name)))
}

/** Component cards a registry carries, counted here the long way round. */
function componentCards(registry: PartialDemoRegistry): number {
  let count = 0
  for (const section of catalogueSections) {
    if (section.kind !== "component") continue
    for (const name of section.names) if (name in registry) count++
  }
  return count
}

/** The overview's own markup: from its root to the end of the page column. */
function overviewOf(html: string): string {
  const start = html.indexOf(`data-e2e="ui-guide-overview"`)
  const end = html.indexOf(`data-e2e="ui-guide-footer"`)
  expect(start, "the overview is rendered").toBeGreaterThan(-1)
  expect(end, "the footer follows it").toBeGreaterThan(start)
  return html.slice(html.lastIndexOf("<", start), end)
}

/** The text of the element that opens at `marker`, found by counting its tag's nesting. */
function elementText(html: string, marker: string): string {
  const at = html.indexOf(marker)
  const open = html.lastIndexOf("<", at)
  const tag = /^<([a-z0-9]+)/.exec(html.slice(open))![1]
  let depth = 0
  const pattern = new RegExp(`<(/?)${tag}[\\s>]`, "g")
  pattern.lastIndex = open
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[1] ? -1 : 1
    if (depth === 0) return html.slice(open, match.index).replace(/<[^>]+>/g, "")
  }
  throw new Error(`no end for ${marker}`)
}

/**
 * The overview's words with the computed counts, the code and the live demo taken out: what is left
 * is prose a person wrote, which must carry no number.
 */
function handWrittenText(overview: string): string {
  const app = [
    overview.indexOf(`data-overview-part="app"`),
    overview.indexOf(`data-overview-part="why"`),
  ]
  return (overview.slice(0, app[0]) + overview.slice(app[1]))
    .replace(/<pre[\s\S]*?<\/pre>/g, "")
    .replace(/<code[\s\S]*?<\/code>/g, "")
    .replace(/<p [^>]*data-overview-stats[^>]*>[^<]*<\/p>/g, "")
    .replace(/<span [^>]*data-(?:count|step)=[^>]*>[^<]*<\/span>/g, "")
    // Attribute values are not words on the page: ids, classes and hrefs carry digits.
    .replace(/<[^>]+>/g, " ")
    // The publisher's scope is a name that happens to hold a digit, and the design rules name the
    // major version of Tailwind the theme is written for: a version, not a count.
    .replaceAll("@spy4x", "@scope")
    .replaceAll("Tailwind 4 ", "Tailwind ")
}

describe("the overview's counts", () => {
  it("prints the totals computed from the registry and the icon set", () => {
    const html = render(<UIGuide hash="#/" />)
    const stats = elementText(html, "data-overview-stats")

    expect(stats).toBe(
      `${componentCards(demoRegistry)} components · ${iconNames.length} icons · ` +
        `${libraryPackageIds.length} packages`,
    )
  })

  it("counts fewer components when the registry carries fewer", () => {
    const trimmed = withoutPage("charts")
    const html = render(<UIGuide hash="#/" registry={trimmed} />)

    expect(componentCards(trimmed)).toBeLessThan(componentCards(demoRegistry))
    expect(elementText(html, "data-overview-stats")).toContain(
      `${componentCards(trimmed)} components`,
    )
    expect(elementText(html, `data-count="charts"`)).toBe("Examples coming")
    expect(overviewTotals(trimmed).components).toBe(componentCards(trimmed))
  })

  it("counts every package a reader can install: each page's, then the helper packages", () => {
    const pages = guidePages.filter((page) => page.id !== "overview").map((page) => page.id)
    const helpersWithoutPage = helperPackageIds.filter((id) => !(pages as string[]).includes(id))

    expect([...libraryPackageIds]).toEqual([...pages, ...helpersWithoutPage])
  })

  it("writes no number of its own into the English totals", () => {
    const line = defaultStats({ cards: 1, components: 101, icons: 202, packages: 303 })

    expect(line.match(/\d+/g)).toEqual(["101", "202", "303"])
    expect(defaultCardCount(404).match(/\d+/g)).toEqual(["404"])
    expect(defaultIconCount(505).match(/\d+/g)).toEqual(["505"])
  })

  it("prints each package tile's count from the page's own cards", () => {
    const html = render(<UIGuide hash="#/" />)
    for (const page of guidePages.filter((each) => each.id !== "overview")) {
      const cards = page.sections.reduce((total, section) => total + section.names.length, 0)
      const expected = page.id === "icons"
        ? defaultIconCount(iconNames.length)
        : cards > 0
        ? defaultCardCount(cards)
        : "Examples coming"
      expect(elementText(html, `data-count="${page.id}"`), page.id).toBe(expected)
    }
  })

  it("carries no hand-written number anywhere else in its words", () => {
    const words = handWrittenText(overviewOf(render(<UIGuide hash="#/" repository={REPOSITORY} />)))

    expect(words.length, "the overview's prose was read").toBeGreaterThan(500)
    expect(words.match(/[^\s]*\d[^\s]*/g) ?? []).toEqual([])
  })

  it("finds a number a person writes into the overview's words", () => {
    const html = render(
      <UIGuide hash="#/" labels={{ tagline: "Over 60 components for Deno apps." }} />,
    )

    expect(handWrittenText(overviewOf(html)).match(/[^\s]*\d[^\s]*/g)).toEqual(["60"])
  })
})

describe("the overview's and the footer's links", () => {
  it("links the repository, its licence, its usage guide and every README", () => {
    const html = render(<UIGuide hash="#/" repository={REPOSITORY} author={AUTHOR} />)

    expect(html).toMatch(new RegExp(`<a href="${REPOSITORY}"[^>]*data-e2e="ui-guide-star"`))
    expect(html).toMatch(new RegExp(`<a href="${REPOSITORY}"[^>]*data-e2e="ui-guide-repository"`))
    expect(html).toMatch(new RegExp(`<a href="${REPOSITORY}"[^>]*data-footer-link="repository"`))
    expect(html).toContain(`href="${REPOSITORY}/blob/main/LICENSE"`)
    expect(html).toContain(`href="${REPOSITORY}/blob/main/docs/usage.md"`)
    for (const id of libraryPackageIds) {
      expect(html, id).toContain(`href="${REPOSITORY}/blob/main/${id}/README.md"`)
    }
    expect(html).toMatch(new RegExp(`<a href="${JSR_SCOPE_URL}"[^>]*data-footer-link="jsr"`))
    expect(html).toContain(`href="https://github.com/Eirene"`)
  })

  it("links the author from the header and the footer, in the author's name", () => {
    const html = render(<UIGuide hash="#/ui" author={AUTHOR} />)

    expect(html).toMatch(
      new RegExp(`<a href="${AUTHOR.href}"[^>]*data-e2e="ui-guide-author">Made by A. Maker<`),
    )
    expect(html).toMatch(
      new RegExp(`<a href="${AUTHOR.href}"[^>]*data-footer-link="author">Made by A. Maker<`),
    )
  })

  it("leaves out the links a host gave no address for, and sends READMEs to JSR", () => {
    const html = render(<UIGuide hash="#/" />)

    expect(html).not.toContain(`data-e2e="ui-guide-star"`)
    expect(html).not.toContain(`data-e2e="ui-guide-author"`)
    expect(html).not.toContain(`data-footer-link="repository"`)
    expect(html).not.toContain(`data-footer-link="author"`)
    expect(html).toContain(">MIT licence</span>")
    expect(html).toContain(`href="${JSR_SCOPE_URL}/preact-ui"`)
  })

  it("puts the footer on every page", () => {
    for (const page of guidePages) {
      const html = render(<UIGuide hash={`#/${page.id === "overview" ? "" : page.id}`} />)
      expect(html.match(/data-e2e="ui-guide-footer"/g)?.length, page.id).toBe(1)
    }
  })
})

describe("the live mini app", () => {
  it("renders every starting row on the server, with no toast and no dialog open", () => {
    const html = render(<UIGuide hash="#/" />)
    const app = html.slice(
      html.indexOf(`data-e2e="mini-app"`),
      html.indexOf(`data-overview-part="why"`),
    )

    for (const project of MINI_PROJECTS) expect(app, project.name).toContain(`>${project.name}<`)
    expect(app, "the toast stack is there and empty").toMatch(
      /data-e2e="mini-app-toasts"[^>]*><\/div>/,
    )
    expect(app).not.toContain("<dialog")
  })
})
