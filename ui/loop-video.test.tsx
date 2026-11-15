import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { LoopVideo, type LoopVideoProps } from "./loop-video.tsx"
import { LoopVideoButton } from "./loop-video-button.tsx"

const DARK = "(prefers-color-scheme: dark)"

const PROPS: LoopVideoProps = {
  title: "A note saved in one window appears in the other",
  name: "Realtime sync",
  poster: {
    src: "/loop-light.webp",
    width: 1440,
    height: 900,
    dark: { srcset: "/loop-dark.webp", media: DARK },
  },
  sources: [
    { src: "/loop-light.webm", type: "video/webm" },
    { src: "/loop-light.mp4", type: "video/mp4" },
  ],
  darkSources: [{ src: "/loop-dark.webm", type: "video/webm" }],
}

describe("LoopVideo", () => {
  it("renders a themed picture on the server, with no video and no button", () => {
    const html = render(<LoopVideo {...PROPS} />)
    expect(html).toContain(
      `<picture class="contents"><source media="${DARK}" srcset="/loop-dark.webp"/>`,
    )
    expect(html).toMatch(/<img src="\/loop-light\.webp"[^>]* width="1440" height="900"/)
    expect(html).not.toContain("<video")
    expect(html).not.toContain("<button")
    expect(html).not.toContain(".webm")
  })

  it("names the still with the title until the clip takes over", () => {
    const html = render(<LoopVideo {...PROPS} />)
    expect(html).toContain(`alt="${PROPS.title}"`)
    expect(html).not.toContain("aria-hidden")
  })

  it("renders a plain img without a dark poster", () => {
    const { darkSources: _, ...light } = PROPS
    const html = render(<LoopVideo {...light} poster={{ ...PROPS.poster, dark: undefined }} />)
    expect(html).not.toContain("<picture")
    expect(html).toContain("<img ")
  })

  it("joins the caller's class and renders no style attribute a strict CSP blocks", () => {
    const html = render(<LoopVideo {...PROPS} class="rounded-lg" />)
    expect(html).toMatch(/^<div class="relative block w-full overflow-hidden rounded-lg">/)
    expect(html).not.toMatch(/\sstyle=/)
  })

  it("throws without a source", () => {
    expect(() => render(<LoopVideo {...PROPS} sources={[]} />)).toThrow(
      "LoopVideo needs at least one source",
    )
  })

  it("throws for dark sources without a dark poster, which holds their media query", () => {
    expect(() => render(<LoopVideo {...PROPS} poster={{ ...PROPS.poster, dark: undefined }} />))
      .toThrow("LoopVideo's darkSources need poster.dark")
  })
})

describe("LoopVideoButton", () => {
  const button = (playing: boolean, labels: { pauseLabel?: string; playLabel?: string } = {}) =>
    render(
      <LoopVideoButton
        playing={playing}
        name="Realtime sync"
        pauseLabel={labels.pauseLabel ?? "Pause animation"}
        playLabel={labels.playLabel ?? "Play animation"}
        onToggle={() => {}}
      />,
    )

  it("is named Pause animation: {name} while the clip plays", () => {
    expect(button(true)).toContain(
      '<button type="button" aria-label="Pause animation: Realtime sync"',
    )
  })

  it("is named Play animation: {name} while the clip is stopped", () => {
    expect(button(false)).toContain(
      '<button type="button" aria-label="Play animation: Realtime sync"',
    )
  })

  it("words its name with the caller's labels", () => {
    expect(button(true, { pauseLabel: "Stop" })).toContain('aria-label="Stop: Realtime sync"')
    expect(button(false, { playLabel: "Go" })).toContain('aria-label="Go: Realtime sync"')
  })

  it("shows the same words in a hint hidden from assistive tech", () => {
    expect(button(true)).toMatch(
      /<span aria-hidden="true" class="[^"]*"><span class="[^"]*">Pause animation: Realtime sync<\/span><\/span>/,
    )
  })

  it("is 44 px round at the bottom-end corner, inset 12 px, so it mirrors in right-to-left", () => {
    const html = button(true)
    expect(html).toMatch(/^<span class="group\/loop absolute end-3 bottom-3">/)
    expect(html).toMatch(/<button [^>]*class="[^"]*\bsize-11\b[^"]*\brounded-full\b/)
  })
})
