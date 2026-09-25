/**
 * `@preact-components/ui-guide` — the live component catalogue, shipped as a component.
 *
 * Frameworks are the app's business, so this package exports a component and a plain route
 * descriptor instead of a file-based route: any app that imports the library can render the guide
 * and register it in its own navigation, which is what one of the source guides never did.
 *
 * The guide is a shell (`shell.tsx`): a side navigation and one page at a time, the overview or one
 * package, chosen by the `hash` the host passes in. Every card is generated from the registry, so a
 * page cannot show a component the registry does not know about. A component a covered package
 * exports and no section demonstrates fails `deno task test` in `coverage.ts`; a registry a host
 * trimmed by hand is named in the red banner at the top of the page instead of quietly shrinking it.
 */

import type { ComponentChildren } from "preact"
import { UIGuide, type UIGuideProps } from "./shell.tsx"

/** A route a host app can register, in the shape most routers want. */
export interface UiGuideRoute {
  /** URL path the guide should be served at. */
  path: string
  /** Label for a navigation entry. */
  label: string
  /** The component to render at that path. */
  component: (props: UIGuideProps) => ComponentChildren
}

/**
 * Route descriptor for the catalogue.
 *
 * Exported so the guide can be registered in an app's navigation instead of being reachable only by
 * typing its URL — the reason that source guide was effectively dead code. The app decides how to
 * consume it; nothing here knows about a router.
 *
 * ```tsx
 * import { uiGuideRoute } from "@preact-components/ui-guide"
 *
 * const navLinks = [...appLinks, { href: uiGuideRoute.path, label: uiGuideRoute.label }]
 * // and at the route: <uiGuideRoute.component />
 * ```
 */
export const uiGuideRoute: UiGuideRoute = {
  path: "/ui-guide",
  label: "UI Guide",
  component: UIGuide,
}

export { DemoCard, type DemoCardProps } from "./card.tsx"
export { type GuideRouteChange, UIGuide, type UIGuideLabels, type UIGuideProps } from "./shell.tsx"
export { IconGallery, type IconGalleryProps, iconNames } from "./icons.tsx"
export {
  demoHref,
  type DemoRouteEntry,
  type DemoRouteMatch,
  type IndexRouteMatch,
  pageHref,
  pageOfRoute,
  type PageRouteEntry,
  type PageRouteMatch,
  parseRoute,
  routeHref,
  type RouteMatch,
  routeSlug,
  type RouteTable,
  routeTable,
  routeTableDrift,
  type SectionRouteEntry,
  type SectionRouteMatch,
} from "./routes.ts"
export {
  type CatalogueGroup,
  catalogueGroupIds,
  catalogueGroups,
  catalogueGroupsWithHeadings,
  catalogueNames,
  type CatalogueSection,
  catalogueSections,
  CLASS_PACKAGE,
  type ClassDemo,
  type ClassDemoFragment,
  classDemoNames,
  classDemos,
  type Demo,
  type DemoFragment,
  type DemoRegistry,
  demoRegistry,
  type GroupId,
  type GuidePage,
  type GuidePageId,
  guidePageIds,
  guidePages,
  missingDemos,
  type PackageId,
  packageIds,
  packageSpecifier,
  pageOfSection,
  type PartialDemoRegistry,
  type SectionId,
  sectionIds,
  type SectionKind,
  type SectionPackage,
} from "./registry.ts"
