import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { PageTitle } from "./page-title.tsx"

describe("PageTitle", () => {
  it("renders the heading text", () => {
    expect(render(<PageTitle>Reports</PageTitle>)).toContain("Reports")
  })

  it("uses an h1 with the default typography and no outer margin", () => {
    const html = render(<PageTitle>Reports</PageTitle>)

    expect(html).toMatch(/^<h1/)
    expect(html).toContain("text-2xl")
    expect(html).not.toMatch(/class="[^"]*\bm[trblxy]?-/)
  })

  it("lets the caller replace a default utility", () => {
    const html = render(<PageTitle class="text-xl">Reports</PageTitle>)

    expect(html).toContain("text-xl")
    expect(html).not.toContain(" text-2xl ")
  })

  it("renders child elements alongside the text", () => {
    const html = render(
      <PageTitle>
        Reports <span data-e2e="count">12</span>
      </PageTitle>,
    )

    expect(html).toContain('data-e2e="count"')
    expect(html).toContain("12")
  })
})
