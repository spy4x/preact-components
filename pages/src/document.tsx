/**
 * The deployed document — one static HTML file, no server.
 *
 * A template rather than a Preact component: the island hydrates `#root` only, so a component for
 * the wrapper would never be diffed and would sit in the bundle for nothing. `appHtml` is the
 * markup `preact-render-to-string` produced from the same `App` the island hydrates, which is what
 * makes hydration match rather than repair.
 *
 * The `<head>` itself comes from `@spy4x/preact-system`'s `SEOHead`, rendered to a string the
 * same way `appHtml` is: this is the one real consumer of that component in the repository, and
 * its canonical address is now parsed rather than concatenated — see `renderDocument` below.
 */

import type { RouteTable } from "@spy4x/preact-ui-guide/routes"
import { renderToString } from "preact-render-to-string"
import { SEOHead } from "@spy4x/preact-system/seo-head"
import { renderRouteTable } from "./route-echo.ts"
import { FAVICON, PAGE_DESCRIPTION, PAGE_TITLE } from "./site.ts"

/** Feeds `og:site_name`. The demo has no other user-visible string of its own to name the site. */
const SITE_NAME = "preact-components"

export interface DocumentOptions {
  /** Path the site is mounted at, with a leading and trailing slash. */
  base: string
  /** Origin the site is published on, used for the canonical and Open Graph URLs. */
  origin: string
  /** Href of the compiled stylesheet, already base-prefixed. */
  cssHref: string
  /** Src of the hydration island, already base-prefixed. */
  islandSrc: string
  /** Prerendered catalogue markup for `#root`. Inserted verbatim — it is generated, not user input. */
  appHtml: string
  /**
   * Routes the navigation links to, echoed into the document.
   *
   * The single `index.html` is the whole site under hash routing, so this is the closest thing to a
   * per-route emission there is: `build.ts` renders the document, reads this table back out of it,
   * and fails when an entry is not one the resolver accepts. Nothing reads it at runtime — the cost
   * is a few kilobytes of JSON in a document that already ships the whole catalogue.
   */
  routeTable: RouteTable
}

/**
 * The colour-scheme bootstrap.
 *
 * Runs before first paint, so a returning reader with `dark` stored never sees the light palette
 * flash. `ThemeToggle` reads the class back during hydration, which is why the island's first
 * render and the prerendered markup agree. Wrapped in `try` because storage throws in some
 * privacy modes; the page works without it either way.
 */
const THEME_BOOTSTRAP = `<script>
      try {
        var stored = localStorage.getItem("pc-theme")
        if (stored === "dark" || (!stored && matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark")
        }
      } catch (error) {}
    </script>`

/**
 * Render the complete HTML document.
 *
 * @param options See {@link DocumentOptions}.
 * @returns The file written to `dist/index.html`.
 */
export function renderDocument(
  { base, origin, cssHref, islandSrc, appHtml, routeTable }: DocumentOptions,
): string {
  // `SEOHead` parses this before it publishes it — see `normalizeCanonical` in
  // `@spy4x/preact-system/head` — so a stray query string or fragment on either input is
  // resolved and cleaned rather than concatenated straight into the tag set.
  const canonical = `${origin}${base}`

  // No `crumbs`: the demo is one HTML document under hash routing, so it has no page hierarchy to
  // describe, and it shows no breadcrumb trail anywhere in its markup. `SEOHead` emits no
  // `BreadcrumbList` for fewer than two crumbs, which is the honest state for a page like this one
  // — a root entry pointing anywhere else (the GitHub repository, say) would tell a search engine
  // the page sits under a site it does not sit under, and structured data is supposed to describe
  // content the page actually shows.
  const seoHead = renderToString(
    <SEOHead
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      canonical={canonical}
      siteName={SITE_NAME}
    />,
  )

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    ${seoHead}
    <link rel="icon" href="${FAVICON}">
    <link rel="stylesheet" href="${cssHref}">
    ${THEME_BOOTSTRAP}
    ${renderRouteTable(routeTable)}
  </head>
  <body class="theme-base">
    <div id="root">${appHtml}</div>
    <noscript>
      <p class="mx-auto max-w-5xl p-4 text-sm">
        The catalogue below is prerendered and readable without JavaScript; the demos are not
        interactive without it.
      </p>
    </noscript>
    <script type="module" src="${islandSrc}"></script>
  </body>
</html>
`
}
