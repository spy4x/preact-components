/** Playwright specs for `system/` components, on the guide's system page. */
import type { Spec } from "./runner.ts"
import { scrollRegionSpec } from "./scroll-region.ts"

export const specs: readonly Spec[] = [
  scrollRegionSpec({
    what: "the SEOHead card's list of tags",
    pageId: "system",
    selector: `#demo-SEOHead [data-e2e="seo-head-tags"]`,
    name: "The tags SEOHead renders",
    key: "ArrowDown",
  }),
]
