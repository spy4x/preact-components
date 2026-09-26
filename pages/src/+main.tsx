/**
 * The island.
 *
 * `hydrate`, not `render`: `index.html` already carries the whole catalogue, because the build ran
 * the same {@link App} through `preact-render-to-string`. This bundle is what makes the page
 * interactive — dropdowns, switches, the icon filter, toasts and the deep links all live here. With
 * JavaScript off the markup is still readable, which is what the document's `<noscript>` says.
 */

import { hydrate } from "preact"
import { App } from "./app.tsx"

const root = document.getElementById("root")
if (!root) {
  throw new Error("#root is missing — this bundle is meant to load the built index.html")
}

// The version rides on `#root` (`document.tsx`), so the island's first render matches the server's.
hydrate(<App version={root.dataset.version} />, root)
