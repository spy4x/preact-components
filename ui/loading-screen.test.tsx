import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { LoadingScreen } from "./loading-screen.tsx"

describe("LoadingScreen", () => {
  it("covers the viewport", () => {
    const html = render(<LoadingScreen />)

    expect(html).toContain("fixed inset-0")
    expect(html).toContain("z-50")
  })

  it("defaults to generic copy rather than app-specific wording", () => {
    const html = render(<LoadingScreen />)

    expect(html).toContain("Loading…")
    expect(html).toContain("Please wait…")
    expect(html).not.toContain("financial")
  })

  it("takes a caller message", () => {
    expect(render(<LoadingScreen message="Importing" />)).toContain("Importing")
  })

  it("drops the description when it is nulled out", () => {
    const html = render(<LoadingScreen description={null} />)

    expect(html).toContain("Loading…")
    expect(html).not.toContain("Please wait…")
  })

  it("renders the spinner inline without its block padding", () => {
    const html = render(<LoadingScreen />)

    expect(html).toContain("animate-spin")
    expect(html).not.toContain("py-10")
  })

  it("appends a caller class to the overlay", () => {
    expect(render(<LoadingScreen class="bg-blue-50" />)).toContain("bg-blue-50")
  })
})
