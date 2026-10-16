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

  it("hides the phone's notch from assistive tech and keeps a fixed aspect", () => {
    const html = render(<WindowFrame variant="phone">x</WindowFrame>)
    expect(html).toContain("aspect-[9/19]")
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*rounded-full bg-foreground"/)
  })

  it("merges the caller's class into the figure", () => {
    expect(render(<WindowFrame variant="browser" class="max-w-3xl">x</WindowFrame>)).toMatch(
      /^<figure class="[^"]*max-w-3xl"/,
    )
  })
})
