/**
 * `renderDocument`'s head: it now comes from `@spy4x/preact-system`'s `SEOHead` rather than
 * hand-written strings (issue #179), so what is worth proving here is the same thing that
 * component's own tests prove of it — that the canonical address is parsed, not concatenated.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { RouteTable } from "@spy4x/preact-ui-guide/routes"
import { PAGE_DESCRIPTION, PAGE_TITLE } from "./site.ts"
import { renderDocument } from "./document.tsx"

/** No sections or demos: nothing under test here reads the route table's contents. */
const EMPTY_ROUTE_TABLE: RouteTable = { pages: [], sections: [], demos: [] }

const OPTIONS = {
  base: "/preact-components/",
  origin: "https://spy4x.github.io",
  cssHref: "/preact-components/assets/main.css",
  islandSrc: "/preact-components/assets/main.js",
  appHtml: "<p>catalogue</p>",
  routeTable: EMPTY_ROUTE_TABLE,
}

describe("renderDocument", () => {
  it("carries the version on the root as an escaped attribute", () => {
    expect(renderDocument({ ...OPTIONS, version: "0.1.2" })).toContain(
      `<div id="root" data-version="0.1.2">`,
    )
    expect(renderDocument({ ...OPTIONS, version: `1"><script>` })).toContain(
      `data-version="1&quot;>&lt;script>"`,
    )
  })

  it("renders the title, description and site name as plain tags", () => {
    const html = renderDocument(OPTIONS)

    expect(html).toContain(`<title>${PAGE_TITLE}</title>`)
    expect(html).toContain(`<meta name="description" content="${PAGE_DESCRIPTION}"`)
    expect(html).toContain(`<meta property="og:site_name" content="preact-components"`)
  })

  it("publishes the origin and base joined as the canonical address, and reuses it for og:url", () => {
    const html = renderDocument(OPTIONS)

    expect(html).toContain(
      `<link rel="canonical" href="https://spy4x.github.io/preact-components/"`,
    )
    expect(html).toContain(
      `<meta property="og:url" content="https://spy4x.github.io/preact-components/"`,
    )
  })

  it("drops a fragment carried on the base path, and keeps a query string that comes with it", () => {
    // `renderDocument` still builds the candidate address by joining `origin` and `base` — see the
    // comment on that line — but the join is no longer what ships: `SEOHead` parses the joined
    // string before it is published. A query string and a fragment together, the same combination
    // `system/head.test.ts` uses to prove the same rule one package over, show that this is real
    // parsing and not a pass-through: the raw join still carries `#section`, and the published
    // address does not.
    const html = renderDocument({ ...OPTIONS, base: "/preact-components/?ref=readme#section" })
    const rawJoin = `${OPTIONS.origin}/preact-components/?ref=readme#section`

    expect(html).not.toContain(rawJoin)
    expect(html).toContain(
      `<link rel="canonical" href="https://spy4x.github.io/preact-components/?ref=readme"`,
    )
    expect(html).not.toContain("#section")
  })

  it("drops credentials carried on the configured origin", () => {
    const html = renderDocument({ ...OPTIONS, origin: "https://user:pw@spy4x.github.io" })

    expect(html).toContain(
      `<link rel="canonical" href="https://spy4x.github.io/preact-components/"`,
    )
    expect(html).not.toContain("user:pw@")
  })

  it("emits no JSON-LD: the demo is one page and shows no breadcrumb trail to describe", () => {
    const html = renderDocument(OPTIONS)

    expect(html).not.toContain('<script type="application/ld+json">')
  })
})
