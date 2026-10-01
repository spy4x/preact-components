import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { App } from "fresh"
import { Head } from "fresh/runtime"
import type { JSX } from "preact"
import { SEOHead } from "./seo-head.tsx"

const PAGE = {
  title: "Widgets — Acme",
  description: "Widgets for teams.",
  canonical: "https://acme.example/products/widgets",
}

/**
 * Serve one route through a real Fresh app and return its HTML. The document shell lives in the
 * app wrapper, as in a Fresh project's `_app.tsx`: Fresh renders the route first, collects its
 * `<Head>` blocks, then renders the wrapper and places them in its `<head>`.
 */
async function serve(route: JSX.Element): Promise<string> {
  const app = new App()
    .appWrapper(({ Component }) => (
      <html>
        <head />
        <body>
          <Component />
        </body>
      </html>
    ))
    .get("/", (ctx) => ctx.render(route))
  const response = await app.handler()(new Request("http://localhost/"))
  return await response.text()
}

describe("SEOHead inside Fresh's <Head>", () => {
  it("prints no data-key on any head tag", async () => {
    const html = await serve(
      <Head>
        <SEOHead {...PAGE} />
      </Head>,
    )

    expect(html).toContain(`<title>${PAGE.title}</title>`)
    expect(html).not.toContain("data-key")
  })

  it("keeps every tag of a second <Head> block that keys its own list by index", async () => {
    const stylesheets = ["/a.css", "/b.css"]
    const html = await serve(
      <>
        <Head>
          <SEOHead {...PAGE} />
        </Head>
        <Head>
          {stylesheets.map((href, i) => <link key={i} rel="stylesheet" href={href} />)}
        </Head>
      </>,
    )

    expect(html).toContain(`<title>${PAGE.title}</title>`)
    expect(html).toContain(`name="description" content="${PAGE.description}"`)
    expect(html).toContain(`href="/a.css"`)
    expect(html).toContain(`href="/b.css"`)
  })
})
