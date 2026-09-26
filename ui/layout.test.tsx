import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { SPACING_GAPS, type SpacingGap } from "@spy4x/preact-theme/spacing"
import { render } from "preact-render-to-string"
import { Cluster, Grid, Page, Section, Stack } from "./layout.tsx"

/** The root element's tag name. */
function rootTag(html: string): string {
  return /^<([a-z0-9]+)/.exec(html)?.[1] ?? ""
}

/** The root element's classes, one per entry. */
function rootClasses(html: string): string[] {
  const openingTag = /^<[a-z0-9]+([^>]*)>/.exec(html)?.[1] ?? ""
  return (/ class="([^"]*)"/.exec(openingTag)?.[1] ?? "").split(" ")
}

const gaps = Object.keys(SPACING_GAPS) as SpacingGap[]

describe("Stack", () => {
  it("renders a column with the md gap by default", () => {
    const html = render(<Stack>a</Stack>)
    expect(rootTag(html)).toBe("div")
    expect(rootClasses(html)).toEqual(["flex", "flex-col", "gap-4"])
  })

  it("turns every named gap into the step SPACING_GAPS names", () => {
    for (const gap of gaps) {
      expect(rootClasses(render(<Stack gap={gap} />))).toContain(`gap-${SPACING_GAPS[gap]}`)
    }
  })

  it("renders the element as names and passes attributes through", () => {
    const html = render(
      <Stack as="ul" id="list" aria-label="Items" class="bg-surface">
        <li>a</li>
      </Stack>,
    )
    expect(html).toBe(
      `<ul id="list" aria-label="Items" class="flex flex-col gap-4 bg-surface"><li>a</li></ul>`,
    )
  })
})

describe("Cluster", () => {
  it("renders a wrapping, centred row with the sm gap by default", () => {
    expect(rootClasses(render(<Cluster>a</Cluster>))).toEqual([
      "flex",
      "flex-wrap",
      "items-center",
      "justify-start",
      "gap-2",
    ])
  })

  it("maps align, justify and gap to their classes", () => {
    const classes = rootClasses(render(<Cluster align="baseline" justify="between" gap="lg" />))
    expect(classes).toEqual(["flex", "flex-wrap", "items-baseline", "justify-between", "gap-6"])
  })

  it("maps every align and every justify value", () => {
    const align = { start: "items-start", center: "items-center", end: "items-end" } as const
    for (const [value, expected] of Object.entries(align)) {
      expect(rootClasses(render(<Cluster align={value as keyof typeof align} />))).toContain(
        expected,
      )
    }
    expect(rootClasses(render(<Cluster align="stretch" />))).toContain("items-stretch")
    for (const value of ["start", "center", "end"] as const) {
      expect(rootClasses(render(<Cluster justify={value} />))).toContain(`justify-${value}`)
    }
  })

  it("renders the element as names", () => {
    expect(rootTag(render(<Cluster as="nav" />))).toBe("nav")
  })
})

describe("Grid", () => {
  it("fills the row with 16rem columns and the md gap by default", () => {
    expect(rootClasses(render(<Grid />))).toEqual([
      "grid",
      "grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]",
      "gap-4",
    ])
  })

  it("maps each minimum column width and the gap", () => {
    expect(rootClasses(render(<Grid minColumnWidth="sm" gap="xl" />))).toEqual([
      "grid",
      "grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]",
      "gap-8",
    ])
    expect(rootClasses(render(<Grid minColumnWidth="lg" />))).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]",
    )
  })

  it("renders the element as names", () => {
    expect(rootTag(render(<Grid as="ul" />))).toBe("ul")
  })
})

describe("Page", () => {
  it("renders a centred column with the page gutter and the xl gap between sections", () => {
    const html = render(<Page>a</Page>)
    expect(rootTag(html)).toBe("div")
    expect(rootClasses(html)).toEqual([
      "mx-auto",
      "flex",
      "w-full",
      "max-w-6xl",
      "flex-col",
      "gap-8",
      "px-4",
      "sm:px-6",
      "lg:px-8",
    ])
  })

  it("renders the element as names and keeps the caller's classes", () => {
    const html = render(<Page as="main" class="bg-canvas" />)
    expect(rootTag(html)).toBe("main")
    expect(rootClasses(html)).toContain("bg-canvas")
  })
})

describe("Section", () => {
  it("renders a section named by its h2, then its description and children", () => {
    const html = render(
      <Section title="Billing" description="Where invoices go.">
        <p>body</p>
      </Section>,
    )
    const id = /<h2 id="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toBe(
      `<section aria-labelledby="${id}" class="flex flex-col gap-4">` +
        `<header class="flex flex-col gap-1"><h2 id="${id}" class="h2">Billing</h2>` +
        `<p class="text-muted text-sm">Where invoices go.</p></header><p>body</p></section>`,
    )
  })

  it("renders no header and no name when there is no title or description", () => {
    expect(render(<Section>x</Section>)).toBe(`<section class="flex flex-col gap-4">x</section>`)
  })

  it("renders a description without a heading and leaves the section unnamed", () => {
    const html = render(<Section description="Only words." />)
    expect(html).not.toContain("aria-labelledby")
    expect(html).toContain(`<header class="flex flex-col gap-1"><p`)
  })

  it("renders the heading at the level asked for, styled for that level", () => {
    expect(render(<Section title="T" headingLevel={3} />)).toMatch(/<h3 id="[^"]+" class="h3">T/)
    expect(render(<Section title="T" headingLevel={4} />)).toMatch(/<h4 id="[^"]+" class="h4">T/)
  })

  it("renders the element as names and keeps a caller's own label when it has no title", () => {
    const html = render(<Section as="article" aria-labelledby="outer" />)
    expect(html).toBe(`<article aria-labelledby="outer" class="flex flex-col gap-4"></article>`)
  })

  it("names an article or an aside by its heading, and never a div", () => {
    expect(render(<Section as="article" title="T" />)).toMatch(/^<article aria-labelledby="[^"]+"/)
    expect(render(<Section as="aside" title="T" />)).toMatch(/^<aside aria-labelledby="[^"]+"/)
    const div = render(<Section as="div" title="T" />)
    expect(div).toMatch(/^<div class="flex flex-col gap-4"><header/)
    expect(div).not.toContain("aria-labelledby")
  })

  it("refuses, as a type error, an element that cannot hold the section's header", () => {
    // Each line fails `deno check` without its directive; an unused directive fails it too.
    // @ts-expect-error a list cannot hold a <header>
    render(<Section as="ul" />)
    // @ts-expect-error a list cannot hold a <header>
    render(<Section as="ol" />)
    // @ts-expect-error a list item is not a section
    render(<Section as="li" />)
    // @ts-expect-error a header cannot hold a header
    render(<Section as="header" />)
    // @ts-expect-error a footer cannot hold a header
    render(<Section as="footer" />)
  })

  it("gives two sections on one page different heading ids", () => {
    const html = render(
      <div>
        <Section title="A" />
        <Section title="B" />
      </div>,
    )
    const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(2)
  })
})
