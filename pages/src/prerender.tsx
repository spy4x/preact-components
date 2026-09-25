/**
 * The server half of the island.
 *
 * `deno bundle` compiles the browser half from the same {@link App}; this renders that component to
 * markup inside Deno, where there is no DOM. That works because nothing in `ui/` or `ui-guide/`
 * touches `document` during render — the package rule, exercised here on every build.
 */

import { renderToString } from "preact-render-to-string"
import { App } from "./app.tsx"

/**
 * Prerender the page.
 *
 * @param hash Render as if the address carried this hash. Left out, the markup is the guide's `all`
 * page, every package at once — what `index.html` ships inside `#root` and the browser half
 * hydrates; given, it is one page's
 * markup, which the build and `verify` read to prove every page renders its cards.
 * @returns The markup.
 */
export function renderApp(hash?: string): string {
  return renderToString(<App initialHash={hash} />)
}
