/**
 * The route echo: the one place the build's guard could pass while checking nothing.
 *
 * A reader that silently returned an empty table would make `pages/build.ts` and `pages/verify.ts`
 * agree about nothing, so every branch below is exercised with the failure it is meant to catch —
 * no echo, a payload that is not JSON, a payload that is not a route table, and a table whose hrefs
 * were tampered with between being written and being read.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { routeTable, routeTableDrift } from "@preact-components/ui-guide/routes"
import { renderRouteTable, ROUTE_TABLE_ID, routeTableFromHtml } from "./route-echo.ts"

/** A document with `payload` inside the echo element, spaced the way the template would render it. */
function documentWith(payload: string): string {
  return `<!DOCTYPE html><html><head>\n    <script type="application/json" id="${ROUTE_TABLE_ID}">${payload}</script>\n  </head><body></body></html>`
}

describe("the route echo", () => {
  it("round-trips the catalogue's own route table", () => {
    const table = routeTable()
    const read = routeTableFromHtml(documentWith(JSON.stringify(table)))

    expect(read.sections.length, "sections read back").toBe(table.sections.length)
    expect(read.demos.length, "demos read back").toBe(table.demos.length)
    expect(read).toEqual(table)
    expect(read.sections.length, "a table with no sections would check nothing")
      .toBeGreaterThan(0)
  })

  it("copes with a payload formatted across lines", () => {
    const table = routeTable()
    const read = routeTableFromHtml(documentWith(JSON.stringify(table, null, 2)))

    expect(read).toEqual(table)
  })

  it("escapes a payload that would close the element it lives in", () => {
    const table = {
      pages: [],
      sections: [],
      demos: [{
        sectionId: "inputs",
        sectionSlug: "inputs",
        name: "Wid</script>get",
        slug: "wid-get",
        href: "#/inputs/wid-get",
      }],
    }

    const markup = renderRouteTable(table)
    expect(
      markup.split("</script>").length - 1,
      "the element's own terminator is the only one in the markup",
    ).toBe(1)
    expect(markup, "the value is escaped, not dropped").toContain("\\u003c")
    expect(routeTableFromHtml(markup), "and it reads back unchanged").toEqual(table)
  })

  it("refuses a document that carries no echo, naming the id it looked for", () => {
    expect(() => routeTableFromHtml("<!DOCTYPE html><html><head></head></html>"))
      .toThrow(/ui-guide-routes/)
  })

  it("refuses a payload that is not JSON, naming the parse failure", () => {
    expect(() => routeTableFromHtml(documentWith("{ sections: [] }")))
      .toThrow(/not JSON/)
  })

  it("refuses a payload that is JSON but not a route table, naming the field", () => {
    expect(() => routeTableFromHtml(documentWith(`{"sections":[]}`)))
      .toThrow(/not a route table/)
    expect(() => routeTableFromHtml(documentWith(`{"sections":[],"demos":[{"name":"Badge"}]}`)))
      .toThrow(/not a route table/)
  })

  it("hands a tampered href to the drift check, which names it", () => {
    // The build's real failure mode, end to end and without a build: a document whose echo no longer
    // matches the resolver. The reader is not supposed to catch this — identity is the drift check's
    // job — so the assertion is that the tampering survives the read and is reported by name.
    const table = routeTable()
    const html = documentWith(JSON.stringify(table)).replace(
      `"${table.sections[0].href}"`,
      `"#/nonsense"`,
    )

    const read = routeTableFromHtml(html)
    const drift = routeTableDrift(read)
    expect(drift.length, `drift: ${drift.join(" | ")}`).toBeGreaterThan(0)
    expect(drift.join(" "), "the report names the href").toContain("#/nonsense")
    expect(drift.join(" "), "and the entry it came from").toContain(table.sections[0].sectionId)
  })
})
