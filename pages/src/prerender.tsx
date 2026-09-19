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
 * @returns The markup `index.html` ships inside `#root`, which the browser half hydrates.
 */
export function renderApp(): string {
  return renderToString(<App />)
}
