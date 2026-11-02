import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { YouTubeVideo, type YouTubeVideoProps } from "./youtube-video.tsx"

const PROPS: YouTubeVideoProps = {
  videoId: "abc_DEF-123",
  title: "A product tour",
  poster: { src: "/tour.webp", width: 1280, height: 720 },
}

describe("YouTubeVideo", () => {
  it("renders the caller's poster inside a link to the watch page, with no iframe", () => {
    const html = render(<YouTubeVideo {...PROPS} />)
    expect(html).toMatch(
      /^<a href="https:\/\/www\.youtube\.com\/watch\?v=abc_DEF-123" aria-label="Play video: A product tour"/,
    )
    expect(html).toContain('src="/tour.webp"')
    expect(html).not.toContain("<iframe")
    expect(html).not.toContain("youtube-nocookie")
    expect(html).not.toContain("ytimg")
  })

  it("sizes the box by the poster's width and height, with no style attribute a strict CSP blocks", () => {
    const html = render(<YouTubeVideo {...PROPS} />)
    expect(html).toMatch(/<img [^>]*width="1280" height="720"/)
    expect(html).not.toMatch(/\sstyle=/)
  })

  it("loads the poster lazily by default and eagerly, at high priority, with eager", () => {
    const lazy = render(<YouTubeVideo {...PROPS} />)
    expect(lazy).toContain('loading="lazy"')
    expect(lazy).not.toContain("fetchpriority")
    const eager = render(<YouTubeVideo {...PROPS} eager />)
    expect(eager).toContain('loading="eager"')
    expect(eager).toContain('fetchpriority="high"')
  })

  it("hides the play mark and the decorative poster from assistive tech", () => {
    const html = render(<YouTubeVideo {...PROPS} />)
    expect(html).toMatch(/<img [^>]* alt(?:="")? aria-hidden="true" /)
    expect(html).toMatch(/<span aria-hidden="true"[^>]*><span [^>]*rounded-full bg-scrim/)
  })

  it("words the link's name with playLabel", () => {
    expect(render(<YouTubeVideo {...PROPS} playLabel="Watch" />)).toContain(
      'aria-label="Watch: A product tour"',
    )
  })

  it("escapes the video id in the link", () => {
    expect(render(<YouTubeVideo {...PROPS} videoId="a&b=c" />)).toContain(
      'href="https://www.youtube.com/watch?v=a%26b%3Dc"',
    )
  })

  it("puts the caller's other attributes on the play link and appends its class", () => {
    const html = render(
      <YouTubeVideo {...PROPS} id="tour" data-umami-event="play" class="rounded-lg" />,
    )
    expect(html).toMatch(/^<a id="tour" data-umami-event="play" href=/)
    expect(html).toMatch(/class="relative block w-full overflow-hidden group [^"]* rounded-lg"/)
  })

  it("throws when the video id is empty", () => {
    expect(() => render(<YouTubeVideo {...PROPS} videoId="" />)).toThrow(
      "YouTubeVideo needs a videoId",
    )
  })
})
