import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { options, type VNode } from "preact"
import { render } from "preact-render-to-string"
import type { LinkClickEvent } from "./link.tsx"
import { LookGrid } from "./look-grid.tsx"
import { StoryTile, type StoryTileProps } from "./story-tile.tsx"
import { onAppPage } from "./testdata/page-at.ts"

const COVER: NonNullable<StoryTileProps["cover"]> = {
  alt: "Linen shirts drying on a line",
  variants: [
    { url: "/c/linen-480.avif", width: 480, height: 640, type: "image/avif" },
    { url: "/c/linen-960.webp", width: 960, height: 1280, type: "image/webp" },
    { url: "/c/linen-480.webp", width: 480, height: 640, type: "image/webp" },
  ],
}

const POST: StoryTileProps = {
  href: "/blog/linen",
  title: "How to wash linen",
  topic: "Fabrics",
  publishedAt: "2026-10-28T23:30:00Z",
  readMinutes: 4,
  cover: COVER,
}

/** A plain primary click, recording whether it was cancelled. */
function click(overrides: Partial<LinkClickEvent> = {}): LinkClickEvent {
  const event = {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true
    },
    ...overrides,
  }
  return event
}

/** Renders the tile and returns the props of every `<a>` it drew, with its click handler. */
function anchorsOf(tile: StoryTileProps): { href: string; onClick: (e: LinkClickEvent) => void }[] {
  const anchors: { href: string; onClick: (e: LinkClickEvent) => void }[] = []
  const previous = options.vnode
  options.vnode = (vnode: VNode) => {
    if (vnode.type === "a") anchors.push(vnode.props as unknown as (typeof anchors)[number])
    previous?.(vnode)
  }
  try {
    render(<StoryTile {...tile} />)
  } finally {
    options.vnode = previous
  }
  return anchors
}

describe("StoryTile", () => {
  onAppPage()

  it("is one link named by the title, with the topic before it and the date and reading time after", () => {
    const html = render(<StoryTile {...POST} />)
    expect(html.match(/<a /g)?.length).toBe(1)
    expect(html).toMatch(/<h2[^>]*><a href="\/blog\/linen"[^>]*>How to wash linen<\/a><\/h2>/)
    expect(html).toContain('<p class="font-mono text-sm font-medium text-primary">Fabrics</p>')
    expect(html.indexOf(">Fabrics<")).toBeLessThan(html.indexOf("How to wash linen"))
    expect(html).toContain('<time datetime="2026-10-28T23:30:00Z">')
    expect(html.indexOf("How to wash linen")).toBeLessThan(html.indexOf("<time"))
    expect(html).toContain(" · 4 min read</p>")
    // The link stretches over the whole tile, so the cover takes the click too.
    expect(html).toContain('<div class="relative flex')
    expect(html).toContain("after:absolute after:inset-0")
  })

  it("draws the title at weight 600 and the date line muted", () => {
    const html = render(<StoryTile {...POST} />)
    expect(html).toMatch(/<h2 class="font-semibold /)
    expect(html).toMatch(/<p class="text-sm text-muted tabular-nums"><time/)
  })

  it("shows the date of the UTC day, whatever the reader's zone", () => {
    const html = render(<StoryTile {...POST} />)
    expect(html).toMatch(/<time[^>]*>[^<]*28[^<]*<\/time>/)
  })

  it("leaves out the topic and the reading time it is not given", () => {
    const html = render(<StoryTile {...POST} topic={undefined} readMinutes={undefined} />)
    expect(html).not.toContain("font-mono")
    expect(html).not.toContain("·")
  })

  it("draws the cover 3:4 with no border, lazy, from a srcset per type sized for the grid", () => {
    const html = render(<StoryTile {...POST} />)
    expect(html).toContain(
      '<source type="image/avif" srcset="/c/linen-480.avif 480w" sizes="(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"',
    )
    expect(html).toMatch(
      /<img src="\/c\/linen-960.webp" srcset="\/c\/linen-480.webp 480w, \/c\/linen-960.webp 960w"[^>]* width="960" height="1280" alt="Linen shirts drying on a line"/,
    )
    expect(html).toContain('loading="lazy"')
    expect(html).not.toContain("fetchpriority")
    expect(html).toContain('class="block aspect-3/4 w-full object-cover"')
    expect(html).not.toMatch(/<picture[^>]*border/)
  })

  it("loads a priority cover at once, and takes the cover's own sizes", () => {
    const html = render(<StoryTile {...POST} priority cover={{ ...COVER, sizes: "50vw" }} />)
    expect(html).toContain('loading="eager" fetchpriority="high"')
    expect(html).toContain('sizes="50vw"')
  })

  it("draws a typographic cover with no photo: the title heavy at the bottom of a panel, hidden from screen readers", () => {
    const html = render(<StoryTile {...POST} cover={undefined} />)
    expect(html).not.toContain("<img")
    expect(html).toMatch(
      /<div aria-hidden="true" class="flex aspect-3\/4 items-end [^"]*bg-surface[^"]*"><p class="[^"]*font-extrabold[^"]*">How to wash linen<\/p><\/div>/,
    )
    // Still one link, named once.
    expect(html.match(/<a /g)?.length).toBe(1)
  })

  it("crops a lead tile's cover 4:3 from lg and sizes it for two columns", () => {
    const html = render(<StoryTile {...POST} lead />)
    expect(html).toContain('class="block aspect-3/4 w-full object-cover lg:aspect-4/3"')
    expect(html).toContain('sizes="(min-width: 64rem) 67vw, (min-width: 48rem) 50vw, 100vw"')
    expect(render(<StoryTile {...POST} />)).not.toContain("lg:aspect-4/3")
    expect(render(<StoryTile {...POST} cover={undefined} lead />)).toContain("lg:aspect-4/3")
  })

  it("spans two columns of a LookGrid from lg when it leads, and the rest one", () => {
    const html = render(
      <LookGrid>
        <StoryTile {...POST} lead />
        <StoryTile {...POST} href="/blog/b" />
      </LookGrid>,
    )
    expect(html.match(/<li class="lg:col-span-2">/g)?.length).toBe(1)
    expect(html.indexOf('<li class="lg:col-span-2">')).toBe(html.indexOf("<li"))
    expect(html.match(/<li>/g)?.length).toBe(1)
  })

  it("follows a plain click through navigate, and leaves a Ctrl click to the browser", () => {
    const routed: string[] = []
    const [anchor] = anchorsOf({ ...POST, navigate: (href) => routed.push(href) })
    const plain = click()
    anchor.onClick(plain)
    expect(routed).toEqual(["/blog/linen"])
    expect(plain.defaultPrevented).toBe(true)
    const ctrl = click({ ctrlKey: true })
    anchor.onClick(ctrl)
    expect(routed).toEqual(["/blog/linen"])
    expect(ctrl.defaultPrevented).toBe(false)
  })

  it("names the cover for a view transition into the post", () => {
    expect(render(<StoryTile {...POST} viewTransitionName="story-linen" />)).toMatch(
      /<img[^>]*style="view-transition-name:story-linen;"/,
    )
    expect(render(<StoryTile {...POST} cover={undefined} viewTransitionName="story-linen" />))
      .toContain('style="view-transition-name:story-linen;"')
    expect(render(<StoryTile {...POST} />)).not.toContain("view-transition-name")
  })

  it("takes its heading level and words", () => {
    const html = render(
      <StoryTile {...POST} headingLevel={3} labels={{ readTime: (m) => `${m} Min. Lesezeit` }} />,
    )
    expect(html).toContain("</a></h3>")
    expect(html).toContain(" · 4 Min. Lesezeit</p>")
  })

  it("refuses a cover with no stored width", () => {
    expect(() => render(<StoryTile {...POST} cover={{ alt: "", variants: [] }} />)).toThrow(
      "at least one variant",
    )
  })
})
