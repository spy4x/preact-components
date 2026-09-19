/**
 * The deployed document — one static HTML file, no server.
 *
 * A template rather than a Preact component: the island hydrates `#root` only, so a component for
 * the wrapper would never be diffed and would sit in the bundle for nothing. `appHtml` is the
 * markup `preact-render-to-string` produced from the same `App` the island hydrates, which is what
 * makes hydration match rather than repair.
 */

import { FAVICON, PAGE_DESCRIPTION, PAGE_TITLE } from "./site.ts"

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
  { base, origin, cssHref, islandSrc, appHtml }: DocumentOptions,
): string {
  const canonical = `${origin}${base}`

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${PAGE_TITLE}</title>
    <meta name="description" content="${PAGE_DESCRIPTION}">
    <meta name="color-scheme" content="light dark">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${PAGE_TITLE}">
    <meta property="og:description" content="${PAGE_DESCRIPTION}">
    <meta property="og:url" content="${canonical}">
    <meta name="twitter:card" content="summary">
    <link rel="icon" href="${FAVICON}">
    <link rel="stylesheet" href="${cssHref}">
    ${THEME_BOOTSTRAP}
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
