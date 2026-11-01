import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { WindowFrame } from "./window-frame.tsx"

describe("WindowFrame", () => {
  it("wraps the content in a figure with the caption as its figcaption", () => {
    const html = render(
      <WindowFrame variant="browser" title="app.example.com" caption="The dashboard">
        <img src="/shot.png" alt="Dashboard" />
      </WindowFrame>,
    )
    expect(html).toMatch(/^<figure /)
    expect(html).toMatch(/<figcaption[^>]*>The dashboard<\/figcaption><\/figure>$/)
    expect(html).toContain('<img src="/shot.png" alt="Dashboard"/>')
  })

  it("renders no figcaption without a caption", () => {
    expect(render(<WindowFrame variant="phone">x</WindowFrame>)).not.toContain("<figcaption")
  })

  it("hides the browser's bar, with its address, from assistive tech", () => {
    const html = render(<WindowFrame variant="browser" title="app.example.com">x</WindowFrame>)
    expect(html).toMatch(/<div aria-hidden="true"[^>]*>(?:(?!<\/div>).)*app\.example\.com/)
  })

  it("draws the terminal dark in both themes, its title hidden and its output a named, focusable group", () => {
    const html = render(
      <WindowFrame variant="terminal" title="deploy.sh">$ deno task deploy</WindowFrame>,
    )
    expect(html).toMatch(/<div class="dark /)
    expect(html).toMatch(/<div aria-hidden="true"[^>]*>(?:(?!<\/div>).)*deploy\.sh/)
    expect(html).toMatch(
      /<div role="group" aria-label="deploy\.sh" tabindex="0" class="[^"]*overflow-x-auto[^"]*font-mono/,
    )
  })

  it("names the terminal's output Terminal when it has no title", () => {
    expect(render(<WindowFrame variant="terminal">ls</WindowFrame>)).toContain(
      'aria-label="Terminal"',
    )
  })

  it("hides the phone's speaker from assistive tech and keeps a fixed aspect", () => {
    const html = render(<WindowFrame variant="phone">x</WindowFrame>)
    expect(html).toContain("aspect-[9/19]")
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*rounded-full bg-track"/)
    // A small speaker high in the bezel, not the wide grey pill it was.
    expect(html).toMatch(/<span aria-hidden="true" class="absolute start-1\/2 top-2 h-1 w-10 /)
  })

  it("puts the phone's speaker in a deeper top bezel, before the screen, not inside it", () => {
    const html = render(<WindowFrame variant="phone">x</WindowFrame>)
    // The speaker is the bezel's child, before the screen, not inside the screen with the content.
    expect(html).toMatch(
      /class="relative [^"]*\bpt-4\b[^"]*"><span aria-hidden="true"[^>]*><\/span><div class="[^"]*overflow-hidden[^"]*">x<\/div>/,
    )
  })

  it("draws the phone dark in both themes, not in the flipping foreground colour", () => {
    const html = render(<WindowFrame variant="phone">x</WindowFrame>)
    // `bg-foreground` turned the body near-white on a dark page (spy4x/seed: "super-weird" phone).
    expect(html).toContain("bg-scrim-strong")
    expect(html).not.toContain("bg-foreground")
  })

  it("rounds the phone's screen at the card radius, so a heading in its top corner stays whole", () => {
    const html = render(<WindowFrame variant="phone">x</WindowFrame>)
    const screen = html.match(/<div class="([^"]*overflow-hidden[^"]*)">x<\/div>/)![1].split(" ")
    // A phone-sized radius (2rem) cut the "N" off a "Notes" heading at 160 px wide (spy4x/seed#384).
    expect(screen.filter((name) => name.startsWith("rounded"))).toEqual(["rounded-xl"])
  })

  it("draws the plain frame as the browser's rounded border and surface with no bar", () => {
    const html = render(
      <WindowFrame variant="plain" title="app.example.com">
        <img src="/shot.png" alt="Dashboard" />
      </WindowFrame>,
    )
    const box = render(<WindowFrame variant="browser">x</WindowFrame>).match(
      /^<figure [^>]*><div class="([^"]*)"/,
    )![1]
    expect(box).toContain("rounded-xl")
    expect(box).toContain("bg-surface")
    expect(html).toContain(`<div class="${box}"><img src="/shot.png" alt="Dashboard"/></div>`)
    expect(html).not.toContain("aria-hidden")
    expect(html).not.toContain("app.example.com")
  })

  it("draws the plain and browser frames' edge from the border-frame token, never a dark: border", () => {
    for (const variant of ["plain", "browser"] as const) {
      const box = render(<WindowFrame variant={variant}>x</WindowFrame>).match(
        /^<figure [^>]*><div class="([^"]*)"/,
      )![1].split(" ")

      expect(box).toContain("border")
      expect(box).toContain("border-frame")
      expect(box.filter((name) => /^(?:dark:)?border-(?!frame$)/.test(name))).toEqual([])
    }
  })

  it("merges the caller's class into the figure", () => {
    expect(render(<WindowFrame variant="browser" class="max-w-3xl">x</WindowFrame>)).toMatch(
      /^<figure class="[^"]*max-w-3xl"/,
    )
  })
})
