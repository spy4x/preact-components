import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { PageTitle } from "./page-title.tsx"

describe("PageTitle", () => {
  it("renders the heading text", () => {
    expect(render(<PageTitle>Reports</PageTitle>)).toContain("Reports")
  })

  it("uses an h1 with the default typography", () => {
    const html = render(<PageTitle>Reports</PageTitle>)

    expect(html).toMatch(/^<h1/)
    expect(html).toContain("text-2xl")
    expect(html).toContain("mb-6")
  })

  it("lets the caller replace the layout utilities", () => {
    const html = render(<PageTitle class="mb-0 ml-12">Reports</PageTitle>)

    expect(html).toContain("mb-0")
    expect(html).toContain("ml-12")
    expect(html).not.toContain("mb-6")
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
