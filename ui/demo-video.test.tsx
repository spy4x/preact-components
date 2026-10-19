import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DemoVideo, type DemoVideoProps } from "./demo-video.tsx"

const PROPS: DemoVideoProps = {
  title: "Creating an invoice",
  poster: { src: "/demo.webp", width: 1280, height: 720 },
  sources: [
    { src: "/demo.webm", type: "video/webm" },
    { src: "/demo.mp4", type: "video/mp4" },
  ],
}

describe("DemoVideo", () => {
  it("renders the poster inside a link to the first source, with no video element", () => {
    const html = render(<DemoVideo {...PROPS} />)
    expect(html).toMatch(/^<a href="\/demo\.webm" aria-label="Play video: Creating an invoice"/)
    expect(html).toContain('src="/demo.webp"')
    expect(html).not.toContain("<video")
    expect(html).not.toContain("<source")
    expect(html).not.toContain("/demo.mp4")
  })

  it("gives the poster its size and keeps the box at the poster's aspect", () => {
    const html = render(<DemoVideo {...PROPS} />)
    expect(html).toMatch(/<img [^>]*width="1280" height="720"/)
    expect(html).toContain('style="aspect-ratio:1280 / 720;"')
  })

  it("loads the poster lazily by default and eagerly, at high priority, with eager", () => {
    const lazy = render(<DemoVideo {...PROPS} />)
    expect(lazy).toContain('loading="lazy"')
    expect(lazy).not.toContain("fetchpriority")
    const eager = render(<DemoVideo {...PROPS} eager />)
    expect(eager).toContain('loading="eager"')
    expect(eager).toContain('fetchpriority="high"')
  })

  it("passes the poster's srcset and sizes to the image", () => {
    const html = render(
      <DemoVideo
        {...PROPS}
        poster={{ ...PROPS.poster, srcset: "/demo-640.webp 640w", sizes: "100vw" }}
      />,
    )
    expect(html).toMatch(/<img [^>]*srcset="\/demo-640\.webp 640w" sizes="100vw"/)
  })

  it("hides the play mark from assistive tech and leaves the poster decorative", () => {
    const html = render(<DemoVideo {...PROPS} />)
    expect(html).toMatch(/<img [^>]* alt(?:="")? /)
    expect(html).toMatch(/<span aria-hidden="true"[^>]*><span [^>]*rounded-full bg-scrim/)
  })

  it("words the link's name with playLabel", () => {
    expect(render(<DemoVideo {...PROPS} playLabel="Watch" />)).toContain(
      'aria-label="Watch: Creating an invoice"',
    )
  })

  it("appends the caller's class after its own", () => {
    expect(render(<DemoVideo {...PROPS} class="rounded-lg" />)).toMatch(
      /^<a [^>]*class="relative block w-full overflow-hidden group [^"]* rounded-lg"/,
    )
  })

  it("puts the caller's other attributes, such as analytics data attributes, on the play link", () => {
    const html = render(
      <DemoVideo
        {...PROPS}
        id="intro-clip"
        data-umami-event="play-demo"
        data-umami-event-item="seed"
      />,
    )
    expect(html).toMatch(
      /^<a id="intro-clip" data-umami-event="play-demo" data-umami-event-item="seed" href="\/demo\.webm"/,
    )
  })

  it("throws without a source", () => {
    expect(() => render(<DemoVideo {...PROPS} sources={[]} />)).toThrow(
      "DemoVideo needs at least one source",
    )
  })
})
