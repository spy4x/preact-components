/**
 * The island of `map-demo/index.html`: hydrates the server-rendered {@link MapPage}.
 *
 * `hydrate`, not `render`: the page already carries `Map`'s markup, and the point of the page is to
 * prove `Map` takes that markup over rather than building its own.
 */

import { hydrate } from "preact"
import { MapPage } from "./page.tsx"

const root = document.getElementById("root")
if (!root) {
  throw new Error("#root is missing — this bundle is meant to load the built map-demo/index.html")
}

hydrate(<MapPage />, root)
