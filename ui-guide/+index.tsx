/**
 * `@spy4x/preact-ui-guide` — the live component catalogue, shipped as a component.
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

import type { ComponentChildren, JSX } from "preact"
import { useLocationHash } from "./location-hash.ts"
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
 * import { uiGuideRoute } from "@spy4x/preact-ui-guide"
 *
 * const navLinks = [...appLinks, { href: uiGuideRoute.path, label: uiGuideRoute.label }]
 * // and at the route, one line — the component reads the address's hash itself:
 * <uiGuideRoute.component />
 * ```
 *
 * A host that renders `UIGuide` directly passes the hash the same way:
 * `<UIGuide hash={useLocationHash()} />`. Without a `hash`, the guide shows every page at once and
 * its links change the address and nothing else.
 */
export const uiGuideRoute: UiGuideRoute = {
  path: "/ui-guide",
  label: "UI Guide",
  component: HashRoutedGuide,
}

/**
 * The guide, routed by the address's hash: what {@link uiGuideRoute} mounts. A `hash` the caller
 * passes wins over the address.
 *
 * @param props See {@link UIGuideProps}.
 */
function HashRoutedGuide(props: UIGuideProps): JSX.Element {
  const hash = useLocationHash()
  return <UIGuide {...props} hash={props.hash ?? hash} />
}

export { DemoCard, type DemoCardLabels, type DemoCardProps } from "./card.tsx"
export { useLocationHash } from "./location-hash.ts"
export { type MapTiles, OPENSTREETMAP_TILES } from "./map-tiles.ts"
export {
  type ColorSchemePort,
  type GuideRouteChange,
  UIGuide,
  type UIGuideLabels,
  type UIGuideProps,
} from "./shell.tsx"
export { IconGallery, type IconGalleryLabels, type IconGalleryProps, iconNames } from "./icons.tsx"
export type { SearchKindWords } from "./search.tsx"
export {
  demoHref,
  type DemoRouteEntry,
  type DemoRouteMatch,
  type IndexRouteMatch,
  pageHref,
  pageOfFragment,
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
  cardLabel,
  catalogueGroupIds,
  catalogueNames,
  type CatalogueSection,
  catalogueSections,
  CLASS_PACKAGE,
  type ClassDemo,
  type ClassDemoFragment,
  classDemoNames,
  classDemos,
  coveredPackageIds,
  type Demo,
  type DemoFragment,
  type DemoRegistry,
  demoRegistry,
  type GroupId,
  type GuidePage,
  type GuidePageId,
  guidePageIds,
  guidePages,
  helperPackageIds,
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
