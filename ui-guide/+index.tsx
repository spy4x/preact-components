/**
 * `@preact-components/ui-guide` — the live component catalogue, shipped as a component.
 *
 * Frameworks are the app's business, so this package exports a component and a plain route
 * descriptor instead of a file-based route: any app that imports the library can render the guide
 * and register it in its own navigation, which is what the source guide in `gb` never did.
 *
 * Everything below the title is generated from {@link demoRegistry}, so the page cannot show a
 * component the registry does not know about. A component a covered package exports and no section
 * demonstrates fails `deno task test` in `coverage.ts`; a registry a host trimmed by hand is named
 * in the red banner at the top of the page instead of quietly shrinking it.
 */

import { CopyButton, PageTitle } from "@preact-components/ui"
import type { ComponentChildren, JSX } from "preact"
import { cn } from "@preact-components/cn"
import { IconGallery } from "./icons.tsx"
import { CatalogInstructions } from "./instructions.tsx"
import {
  catalogueGroupsWithHeadings,
  catalogueNames,
  catalogueSections,
  classDemos,
  demoRegistry,
  missingDemos,
  packageIds,
  type PartialDemoRegistry,
} from "./registry.ts"

export interface UIGuideProps {
  /**
   * Registry to render. Defaults to {@link demoRegistry}, the complete one.
   *
   * Pass a partial registry to render a trimmed guide; the cards left out are named in a warning
   * banner, so a guide that renders less than the catalogue says so on the page.
   */
  registry?: PartialDemoRegistry
  /** Clipboard port, forwarded to every copy control in the catalogue. */
  copy?: (text: string) => void | Promise<void>
  class?: string
}

/** Props of one catalogue card: its identity, the port, and the live example as children. */
export interface DemoCardProps {
  /** Card id, and the name of the component for a component card. */
  name: string
  /** Heading: `<Name />` for a component card, the card's own title for a class card. */
  label: string
  /** One or two sentences on the contract, under the heading. */
  summary: string
  /** The JSX the usage block prints and the copy button puts on the clipboard. */
  snippet: string
  /** Classes the card applies; a class card renders them as chips. */
  classes?: string[]
  /** Clipboard port, forwarded to the copy button. */
  copy?: (text: string) => void | Promise<void>
  /** The live example. */
  children: ComponentChildren
}

/**
 * One demo: its heading, the live example, and the copyable JSX behind it.
 *
 * The copy button sits beside the `details` rather than inside its `summary`: a button inside a
 * summary toggles the disclosure as well as copying, and the snippet has to be copyable without
 * opening it. `copyLabel` is the accessible name and the tooltip, so the control is not one of forty
 * identical "Copy" buttons to a screen reader.
 *
 * @param props See {@link DemoCardProps}.
 */
export function DemoCard(
  { name, label, summary, snippet, classes, copy, children }: DemoCardProps,
): JSX.Element {
  return (
    <article
      id={`demo-${name}`}
      class="scroll-mt-8 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <h3 class="font-mono text-sm font-semibold text-purple-700 dark:text-purple-400">
        {label}
      </h3>
      {classes && classes.length > 0
        ? (
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            {classes.map((className) => (
              <code
                key={className}
                class="rounded-md border border-purple-600 px-1.5 py-0.5 font-mono text-xs text-purple-600 dark:text-purple-400"
              >
                .{className}
              </code>
            ))}
          </div>
        )
        : null}
      <p class="mt-1 mb-3 text-sm text-gray-600 dark:text-gray-300">{summary}</p>
      <div class="mb-3 overflow-visible rounded-md bg-gray-50 p-4 dark:bg-gray-900">{children}</div>
      <div class="flex items-start justify-between gap-3" data-e2e="usage">
        <details class="min-w-0 flex-1">
          <summary class="cursor-pointer text-xs text-gray-500 dark:text-gray-400">Usage</summary>
          <pre class="mt-2 overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
            <code>{snippet}</code>
          </pre>
        </details>
        <CopyButton
          textToCopy={snippet}
          copy={copy}
          copyLabel={`Copy the ${label} snippet`}
        />
      </div>
    </article>
  )
}

/**
 * Banner listing components the catalogue means to demonstrate and this registry does not carry.
 *
 * A complete registry renders nothing, so a healthy catalogue never shows it. When the guide is
 * handed a partial registry the gap is stated at the top of the page rather than being invisible.
 */
function MissingDemoBanner({ names }: { names: string[] }) {
  return (
    <div
      role="alert"
      data-e2e="ui-guide-missing-demos"
      class="rounded-lg border border-red-500 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
    >
      <p class="font-medium">
        {names.length} {names.length === 1 ? "card is" : "cards are"} missing from this registry
      </p>
      <p class="mt-1 text-sm">
        The catalogue lists {names.length === 1 ? "it" : "them"}{" "}
        and the registry this guide was rendered with does not carry{" "}
        {names.length === 1 ? "it" : "them"}:{" "}
        {names.map((name) => <code key={name} class="mr-1 font-mono">{name}</code>)}
      </p>
    </div>
  )
}

/**
 * The live catalogue: instructions, the sections grouped, and the icon gallery.
 *
 * The groups come from `registry.ts` and the sections are bucketed by `section.group`, so the page
 * draws the structure it was handed rather than its own idea of it — a section moved between groups
 * moves here with no edit in this file. Groups and sections render as host elements and only the
 * cards are components, which keeps the markup the same shape it always was: a section is still
 * `<section id={section.id}>` with its own heading, its own blurb and its own card grid, and the
 * group is a heading above a few of them. The ids are what the route resolver, the host's
 * scroll-into-view and the deep links all address, so the group's own id is `group-<id>`: a group
 * taking `inputs` would shadow the `inputs` section of the same name.
 *
 * **Heading levels are the outline, not styling.** `h1` is the page title, `h2` the groups, `h3` a
 * section and its cards, `h4` a class card — one level per nesting the document really has. Giving
 * the groups their own heading is what pushes the sections from `h2` to `h3`, and that is the
 * correct outline rather than a side effect: a section is no longer a top-level division of the
 * page. It is also the one change a *host* can notice, because a stylesheet may key on the level:
 * `pages/styles.css` measures section blurbs with `main section[id] > div > h2 + p`, which matched
 * every section before this and now matches only the groups and the instructions block. A host that
 * did that should widen the selector (`:is(h1, h2, h3, h4, h5, h6)`); shaping the published
 * package's markup around the demo's CSS would invert the dependency.
 *
 * @param props See {@link UIGuideProps}.
 */
export function UIGuide(
  { registry = demoRegistry, copy, class: className }: UIGuideProps,
): JSX.Element {
  const missing = missingDemos(registry)

  return (
    <section class={cn("mx-auto max-w-5xl space-y-10 p-4 sm:p-6", className)}>
      <div>
        <PageTitle>UI Guide</PageTitle>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Every component <code>{`@preact-components/{${packageIds.join(", ")}}`}</code> exports —
          {" "}
          {catalogueNames.length}{" "}
          live demos, with the JSX next to each — plus the icon gallery. Generated from the
          registry, so a component with no demo fails the build rather than quietly not being here.
        </p>
      </div>

      {missing.length > 0 ? <MissingDemoBanner names={missing} /> : null}

      <CatalogInstructions />

      {catalogueGroupsWithHeadings.map((group) => {
        const sections = catalogueSections.filter((section) => section.group === group.id)
        if (sections.length === 0) return null

        return (
          <section
            key={group.id}
            id={`group-${group.id}`}
            aria-labelledby={`group-${group.id}-heading`}
            class="scroll-mt-8 space-y-6"
          >
            <div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
              <h2
                id={`group-${group.id}-heading`}
                class="text-2xl font-bold text-gray-900 dark:text-gray-100"
              >
                {group.title}
              </h2>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{group.blurb}</p>
            </div>

            {sections.map((section) => {
              const demos = section.names.flatMap((name) => {
                const demo = registry[name]
                return demo ? [[name, demo] as const] : []
              })
              if (demos.length === 0) return null

              return (
                <section key={section.id} id={section.id} class="scroll-mt-8">
                  <div class="mb-4 border-b border-gray-200 pb-2 dark:border-gray-700">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {section.title}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{section.blurb}</p>
                  </div>
                  <div class="grid grid-cols-1 gap-4">
                    {demos.map(([name, demo]) => {
                      // A class card is headed by its own title and lists the classes it applies; a
                      // component card is headed by the component. `classDemos` is keyed by card id,
                      // so a component name can never collide with one.
                      const classDemo = section.kind === "class" ? classDemos[name] : undefined

                      return (
                        <DemoCard
                          key={name}
                          name={name}
                          label={classDemo?.title ?? `<${name} />`}
                          summary={demo.summary}
                          snippet={demo.snippet}
                          classes={classDemo?.classes}
                          copy={copy}
                        >
                          {demo.render()}
                        </DemoCard>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </section>
        )
      })}

      <IconGallery copy={copy} />
    </section>
  )
}

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
 * typing its URL — the reason the `gb` guide was effectively dead code. The app decides how to
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

export { IconGallery, type IconGalleryProps, iconNames } from "./icons.tsx"
export {
  demoHref,
  type DemoRouteEntry,
  type DemoRouteMatch,
  type IndexRouteMatch,
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
  missingDemos,
  type PackageId,
  packageIds,
  packageSpecifier,
  type PartialDemoRegistry,
  type SectionId,
  sectionIds,
  type SectionKind,
  type SectionPackage,
} from "./registry.ts"
