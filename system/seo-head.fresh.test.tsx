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
  ogImage: "https://acme.example/og/widgets.png",
  imageWidth: 1200,
  imageHeight: 630,
  twitterSite: "@acme",
  twitterCreator: "@jane",
}

/** How many times `needle` occurs in `html`. */
function count(html: string, needle: string): number {
  return html.split(needle).length - 1
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

  it("prints the image size and twitter:creator once each", async () => {
    const html = await serve(
      <Head>
        <SEOHead {...PAGE} />
      </Head>,
    )

    // Fresh dedupes unkeyed head tags by type and attributes, ignoring `content`. Each needle below
    // is one tag's identity, so a count of 1 means Fresh neither dropped nor merged it.
    for (
      const needle of [
        `property="og:image"`,
        `property="og:image:width" content="1200"`,
        `property="og:image:height" content="630"`,
        `name="twitter:site" content="@acme"`,
        `name="twitter:creator" content="@jane"`,
      ]
    ) {
      expect([needle, count(html, needle)]).toEqual([needle, 1])
    }
  })
})
