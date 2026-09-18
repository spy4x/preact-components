import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { LoadingSkeleton } from "./loading-skeleton.tsx"

describe("LoadingSkeleton", () => {
  it("hides the whole placeholder tree from assistive tech", () => {
    expect(render(<LoadingSkeleton />)).toContain('aria-hidden="true"')
  })

  it("renders three placeholder cards by default", () => {
    expect(countOccurrences(render(<LoadingSkeleton />), "w-5/6")).toBe(3)
  })

  it("renders the requested number of cards", () => {
    expect(countOccurrences(render(<LoadingSkeleton rows={5} />), "w-5/6")).toBe(5)
    expect(render(<LoadingSkeleton rows={0} />)).not.toContain("w-5/6")
  })

  it("keeps the header card when there are no repeated rows", () => {
    expect(render(<LoadingSkeleton rows={0} />)).toContain("animate-pulse")
  })

  it("pulses every bar", () => {
    const html = render(<LoadingSkeleton rows={1} />)

    expect(countOccurrences(html, "animate-pulse")).toBeGreaterThanOrEqual(5)
  })

  it("appends a caller class", () => {
    expect(render(<LoadingSkeleton class="mt-0" />)).toContain("mt-0")
  })
})

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
