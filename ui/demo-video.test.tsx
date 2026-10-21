import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DemoVideo, type DemoVideoProps } from "./demo-video.tsx"
import { DemoVideoClip, playClip } from "./demo-video-clip.tsx"

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

  it("hides the play mark and the decorative poster from assistive tech", () => {
    const html = render(<DemoVideo {...PROPS} />)
    expect(html).toMatch(/<img [^>]* alt(?:="")? aria-hidden="true" /)
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

  describe("the playing clip", () => {
    const clip = () =>
      render(
        <DemoVideoClip
          videoRef={{ current: null }}
          sources={PROPS.sources}
          title={PROPS.title}
          width={1280}
          height={720}
          loop={false}
          onFail={() => {}}
        />,
      )

    it("shows the whole frame, so full screen on another aspect adds bars instead of cutting", () => {
      const html = clip()
      expect(html).toMatch(/^<video [^>]*class="[^"]*\bobject-contain\b/)
      expect(html).not.toContain("object-cover")
    })

    it("is not muted, so the clip plays with its sound", () => {
      expect(clip()).not.toMatch(/^<video [^>]*\bmuted\b/)
    })
  })

  describe("playClip", () => {
    it("plays with sound when the browser allows it", async () => {
      const calls: boolean[] = []
      const video = {
        muted: false,
        play() {
          calls.push(this.muted)
          return Promise.resolve()
        },
      }
      await playClip(video)
      expect(calls).toEqual([false])
      expect(video.muted).toBe(false)
    })

    it("mutes the clip and plays again when the browser refuses sound", async () => {
      const calls: boolean[] = []
      const video = {
        muted: false,
        play() {
          calls.push(this.muted)
          return this.muted
            ? Promise.resolve()
            : Promise.reject(new DOMException("", "NotAllowedError"))
        },
      }
      await playClip(video)
      expect(calls).toEqual([false, true])
      expect(video.muted).toBe(true)
    })

    it("settles without throwing when even the muted play is refused", async () => {
      const video = {
        muted: false,
        play: () => Promise.reject(new DOMException("", "NotAllowedError")),
      }
      await playClip(video)
      expect(video.muted).toBe(true)
    })
  })
})
