/**
 * What the `website()` Vite plugin writes into `server-entry.ts` in place of `__WEBSITE_BUILD__`.
 *
 * @module
 */
import type { Preload } from "./render.tsx"
import type { StaticFile } from "./static.ts"

/** What the client build produced: the server entry hands it to `setAssets` and `setStaticFiles`. */
export interface WebsiteBuild {
  /** The build id, which `asset()` adds to an address on this site. */
  buildId: string
  /** The stylesheets every page links. */
  css: string[]
  /** The client script. */
  script: string
  /** The chunks a page with islands preloads. */
  preload: Preload
  /** The client build's files, keyed by their address. */
  files: Record<string, StaticFile>
}
