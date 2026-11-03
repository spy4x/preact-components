import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createFormatters } from "@spy4x/time/format"
import { FormatContext } from "./format.tsx"
import { PostList, type PostListItem } from "./post-list.tsx"

const POSTS: PostListItem[] = [
  {
    href: "/blog/second",
    title: "Second post",
    description: "What changed.",
    publishedAt: "2026-10-02T23:30:00.000Z",
    readMinutes: 6,
  },
  { href: "/blog/first", title: "First post", publishedAt: "2026-09-01T08:00:00.000Z" },
]

const COVER = {
  src: "/covers/second.webp",
  srcset: "/covers/second-640.webp 640w, /covers/second.webp 1600w",
  sizes: "(min-width: 640px) 192px, calc(100vw - 32px)",
  width: 1600,
  height: 900,
}

const FORMAT = createFormatters({ locale: "en-GB", timeZone: "Asia/Tokyo" })

function renderList(node: preact.ComponentChildren): string {
  return render(<FormatContext.Provider value={FORMAT}>{node}</FormatContext.Provider>)
}

describe("PostList", () => {
  it("shows each post's day, reading time, title link and description, in order", () => {
    const html = renderList(<PostList posts={POSTS} />)
    expect(html.indexOf("Second post")).toBeLessThan(html.indexOf("First post"))
    expect(html).toContain('<a href="/blog/second"')
    expect(html).toContain(">Second post</a></h2>")
    expect(html).toContain("2026</time> · 6 min read")
    expect(html).toContain("What changed.")
    expect(html).toContain('class="mt-1 line-clamp-2')
  })

  it("marks a post's title and description with its language and direction, not its date", () => {
    const html = renderList(<PostList posts={[{ ...POSTS[0], lang: "en" }]} />)
    expect(html).toContain('<a href="/blog/second"')
    expect(html).toMatch(/<a href="\/blog\/second"[^>]* lang="en" dir="auto">Second post<\/a>/)
    expect(html).toMatch(
      /<p class="mt-1 line-clamp-2[^"]*" lang="en" dir="auto">What changed\.<\/p>/,
    )
    expect(html.match(/lang="en"/g)?.length).toBe(2)
    expect(html).toMatch(/<p class="text-sm text-muted tabular-nums"><time/)
  })

  it("takes a post's own dir over auto, and marks nothing when it names no language", () => {
    const ltr = renderList(<PostList posts={[{ ...POSTS[0], lang: "en", dir: "ltr" }]} />)
    expect(ltr.match(/dir="ltr"/g)?.length).toBe(2)
    expect(ltr).not.toContain('dir="auto"')
    const plain = renderList(<PostList posts={POSTS} />)
    expect(plain).not.toContain("lang=")
    expect(plain).not.toContain("dir=")
  })

  it("dates a post by its UTC day, whatever zone the formatter reads in", () => {
    const html = renderList(<PostList posts={POSTS} />)
    expect(html).toContain('<time datetime="2026-10-02T23:30:00.000Z">2 Oct 2026</time>')
  })

  it("leaves out the reading time and the description a post does not have", () => {
    const html = renderList(<PostList posts={[POSTS[1]]} />)
    expect(html).not.toContain("min read")
    expect(html).not.toContain("line-clamp-2")
  })

  it("makes the whole row the link's target with a stretched link", () => {
    const html = renderList(<PostList posts={POSTS} />)
    expect(html).toContain('<li class="relative')
    expect(html).toContain("after:absolute after:inset-0")
  })

  it("takes its heading level, list name and reading-time words", () => {
    const html = renderList(
      <PostList
        posts={POSTS}
        headingLevel={3}
        label="Read next"
        labels={{ readTime: (n) => `${n} Min. Lesezeit` }}
      />,
    )
    expect(html).toContain('<ul aria-label="Read next"')
    expect(html).toContain("</a></h3>")
    expect(html).toContain("6 Min. Lesezeit")
  })

  it("draws a post's cover as a decorative, sized, lazy picture beside its text", () => {
    const html = renderList(<PostList posts={[{ ...POSTS[0], image: COVER }, POSTS[1]]} />)
    const img = html.match(/<img [^>]*>/)?.[0] ?? ""
    expect(img).toContain('src="/covers/second.webp"')
    expect(img).toContain('srcset="/covers/second-640.webp 640w, /covers/second.webp 1600w"')
    expect(img).toContain('sizes="(min-width: 640px) 192px, calc(100vw - 32px)"')
    expect(img).toContain('width="1600"')
    expect(img).toContain('height="900"')
    // `preact-render-to-string` writes `alt=""` as the bare attribute `alt`.
    expect(img).toMatch(/ alt(?=[\s>])/)
    expect(img).toContain('loading="lazy"')
    expect(img).toContain('decoding="async"')
    expect(img).not.toContain("fetchpriority")
    expect(img).toContain("order-first aspect-video")
    expect(img).toContain("sm:order-none sm:w-48")
    expect(img).toContain("rounded-card border border-subtle bg-surface")
    expect(html).toContain('<li class="relative flex flex-col gap-4')
    expect(html.match(/<img /g)?.length).toBe(1)
  })

  it("loads the first row's cover at once with eagerFirst, and the rest lazily", () => {
    const html = renderList(
      <PostList
        posts={[{ ...POSTS[0], image: COVER }, { ...POSTS[1], image: COVER }]}
        eagerFirst
      />,
    )
    const [first, second] = html.match(/<img [^>]*>/g) ?? []
    expect(first).toContain('loading="eager"')
    expect(first).toContain('fetchpriority="high"')
    expect(second).toContain('loading="lazy"')
    expect(second).not.toContain("fetchpriority")
  })

  it("renders a row without a cover exactly as before, with no placeholder", () => {
    const html = renderList(<PostList posts={[{ ...POSTS[0], image: COVER }, POSTS[1]]} />)
    const plain = renderList(<PostList posts={[POSTS[1]]} />)
    const row = (list: string) => list.slice(list.lastIndexOf("<li"), list.lastIndexOf("</ul>"))
    expect(row(html)).toBe(row(plain))
    expect(row(plain)).toMatch(/^<li class="relative border-b border-subtle py-6"><p /)
  })

  it("renders nothing for no posts, so the page draws its own empty state", () => {
    expect(renderList(<PostList posts={[]} />)).toBe("")
  })
})
