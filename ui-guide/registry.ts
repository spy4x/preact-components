/**
 * The catalogue's demo registry — one entry per component the covered packages export.
 *
 * The guide covers five packages: `ui`, `charts`, `system`, `crud` and `signals`. Each package's
 * component names are derived from that package's own module namespace rather than kept in a list,
 * so the catalogue cannot document an export that no longer exists and cannot lose one in silence.
 * Five guards, all checked rather than commented:
 *
 * 1. **Compile-time drift, per package.** {@link ComponentNamesOf} is `Exclude<keyof typeof ns, …>`
 *    over one package's helpers. {@link PENDING_DEMOS} and every section's `demos` are written over
 *    those unions, and {@link DriftReport} reports `{ missingDemo: "Name" }` — naming the component
 *    and the package it belongs to — when an export is neither demoed, nor pending, nor a declared
 *    helper, and `{ unexpectedDemo: "Name" }` when a demo is keyed to a name its package does not
 *    export. A rename, a deletion and an invention are all `deno check` failures, at the package
 *    that is wrong.
 * 2. **Declared gaps.** A component whose demo is honestly not written yet goes in
 *    {@link PENDING_DEMOS}, not in a helper list. That list is typed over the same union, so a stale
 *    entry (a rename, a removal, a component demoed since) fails the build as
 *    `{ stalePending: "Name" }`, and the guide prints it — see `pendingDemos` — instead of quietly
 *    shrinking.
 * 3. **Runtime drift.** {@link missingDemos} is what the catalogue actually renders: any component
 *    the sections mean to demonstrate but the registry handed in does not carry is named in the
 *    warning banner. `registry.test.ts` drives it with a deliberately partial registry, so the
 *    banner path is exercised rather than assumed.
 * 4. **New packages.** `registry.test.ts` walks the top-level directories and fails when one carries
 *    a `deno.json` that is neither a {@link PACKAGES} source nor an {@link EXCLUDED_PACKAGES} entry
 *    with a reason, so a package added later has to make a deliberate decision instead of simply not
 *    appearing in the guide.
 * 5. **New exports.** Component names are the namespace minus the declared helpers, so the sixth
 *    guard is arithmetic: an export that is in neither set is a component, and a component with no
 *    demo and no pending entry fails guard 1. A helper list is the one hand-written classification
 *    left; {@link PASCAL_CASE_HELPERS} makes demoting a component into one a deliberate line.
 *
 * Prop vocabulary is guarded one level down, per component: a demo iterates a `Record<Union, …>`
 * keyed by a prop's own union type (`ButtonVariant`, `BadgeColor`, `SpinnerSize`, …) through
 * `record.ts`'s `entries()`, so adding a variant to a component fails `deno check` until the
 * catalogue shows it.
 *
 * `icons/` needs neither an entry nor a helper list: the gallery reads `Object.entries(import * as
 * icons)`, so a new glyph appears in the catalogue by itself.
 */

import * as charts from "@preact-components/charts"
import * as crud from "@preact-components/crud"
import * as signals from "@preact-components/signals"
import * as system from "@preact-components/system"
import * as ui from "@preact-components/ui"
import type { ComponentChildren } from "preact"
import { badgeDemos } from "./sections/badges.tsx"
import { buttonDemos } from "./sections/buttons.tsx"
import { chartsDemos } from "./sections/charts.tsx"
import { crudDemos } from "./sections/crud.tsx"
import { displayDemos } from "./sections/display.tsx"
import { feedbackDemos } from "./sections/feedback.tsx"
import { inputDemos } from "./sections/inputs.tsx"
import { signalsDemos } from "./sections/signals.tsx"
import { systemDemos } from "./sections/system.tsx"

/**
 * Value exports of `@preact-components/ui` that are helpers, not components.
 *
 * `registry.test.ts` asserts every name here is really exported and that no helper of any package
 * is PascalCase unless {@link PASCAL_CASE_HELPERS} says so: calling a component a helper is the one
 * way a name could leave the drift guard without anybody noticing.
 */
export const UI_HELPERS = ["buttonClasses", "clampConfidence"] as const

/** Value exports of `@preact-components/charts` that are helpers, not components. */
export const CHARTS_HELPERS = [
  "DEFAULT_AXIS_COLOR",
  "DEFAULT_CHART_PALETTE",
  "DEFAULT_D3_LINE_CHART_COLORS",
  "DEFAULT_GRID_COLOR",
  "DEFAULT_SURFACE_COLOR",
  "DEFAULT_TEXT_COLOR",
  "DEFAULT_TRACK_COLOR",
  "TIME_FRAMES",
  "barPercent",
  "chartPayloadSchema",
  "createInViewObserver",
  "defaultTooltipFormat",
  "donutGeometry",
  "extent",
  "formatTimeTick",
  "linearScale",
  "loadChartPayload",
  "loadMetricSeries",
  "niceScale",
  "niceStep",
  "paddedDomain",
  "previousPeriod",
  "seriesColor",
  "ticks",
  "timeSeriesPointSchema",
  "useInView",
  "useMetricSeries",
  "xLabelStride",
  "yDomainFor",
] as const

/** Value exports of `@preact-components/system` that are helpers, not components. */
export const SYSTEM_HELPERS = [
  "addDaysIso",
  "breadcrumbFromCanonical",
  "breadcrumbListJsonLd",
  "breadcrumbsFromCanonical",
  "canonicalUrl",
  "createHeadStore",
  "describeCalendarDay",
  "emailProblem",
  "fieldProblem",
  "flattenRoutes",
  "gateSubmit",
  "groupSlotsByPeriod",
  "hrefSegments",
  "humanizeSlug",
  "isValidTimeZone",
  "isoDateInTz",
  "isoToday",
  "jsonLdText",
  "monthFirstWeekday",
  "monthLabel",
  "nextThemeMode",
  "orderedRoutes",
  "pathSegments",
  "periodFor",
  "reloadOnControllerChange",
  "resolveImage",
  "resolveTimeZone",
  "routeSpecificity",
  "seoHeadJsonLd",
  "seoHeadTags",
  "serviceWorkerContainer",
  "shiftMonth",
  "skipWaiting",
  "sortRoutes",
  "startOfMonth",
  "themeToggleLabel",
  "timeSlotPeriodLabels",
  "watchForUpdate",
  "weekdayLabels",
] as const

/** Value exports of `@preact-components/crud` that are helpers, not components. */
export const CRUD_HELPERS = [
  "CONFLICT",
  "ValidationType",
  "associationActions",
  "commitNumber",
  "conflictIssue",
  "editorState",
  "fieldText",
  "filterRows",
  "formatTimestamp",
  "isRestorable",
  "isValid",
  "listRows",
  "rowsForStatus",
  "sameValidation",
  "schemaIssues",
  "search",
  "searchWords",
  "setField",
  "setFieldIssue",
  "submitEditor",
  "timeAgo",
  "toggleArchiveState",
  "validateSchema",
] as const

/**
 * Value exports of `@preact-components/signals` that are helpers, not components.
 *
 * The state layer is factories and pure functions by design; `For` and `Show` are the only things
 * in it that render, which is why the package is a section of the guide rather than a separate
 * concepts page.
 */
export const SIGNALS_HELPERS = [
  "CLIPBOARD_UNAVAILABLE",
  "ErrType",
  "RemoteEvent",
  "ThemeValue",
  "buildModelStore",
  "cn",
  "connectionError",
  "createClipboard",
  "createInitialListState",
  "createListState",
  "createThemeStore",
  "createToastStore",
  "deleteMapEntry",
  "firstIssueMessage",
  "isSilentError",
  "parseSort",
  "removeSortRule",
  "resolveFilterValue",
  "responseError",
  "serializeSort",
  "setMapEntry",
  "shouldPersistFilter",
  "sortRows",
  "toValidationError",
  "toggleSort",
  "useUrlFilters",
  "validate",
] as const

/**
 * Helper exports whose name is PascalCase — the naming convention components follow.
 *
 * A component demoted into a helper list would leave the drift guard without a type error, so the
 * demotion has to be typed in here as well. Every current entry is an `enum`, which is an object
 * rather than a component; `registry.test.ts` keeps this list exactly as long as reality.
 */
export const PASCAL_CASE_HELPERS = [
  "ErrType",
  "RemoteEvent",
  "ThemeValue",
  "ValidationType",
] as const

/**
 * Packages that carry a `deno.json` and are deliberately not demo sources.
 *
 * The catalogue's coverage test fails when a top-level directory with a package config is in
 * neither this record nor {@link PACKAGES}, so a package added later cannot quietly stay out of the
 * guide: covering it and excluding it are both one line, and both are visible in review.
 */
export const EXCLUDED_PACKAGES = {
  icons: {
    reason:
      "Covered by the icon gallery: it reads the barrel itself, so a new glyph is in the catalogue with no registry entry.",
  },
  theme: {
    reason: "Design tokens and a Tailwind preset — CSS, no components and nothing to render.",
  },
  "ui-guide": {
    reason:
      "The catalogue itself. It exports the guide and the icon gallery, and a card demonstrating the guide inside the guide would say nothing a reader does not already have on screen.",
  },
  pages: {
    reason:
      "The GitHub Pages demo, this guide's host app. A workspace member for its build-only pins, not a package: it publishes nothing.",
  },
} as const satisfies Record<string, { reason: string }>

/**
 * Every package the catalogue derives component names from.
 *
 * The barrel is the runtime half of the derivation (guard 5 in the module doc) and the helper list
 * is the only hand-written part of it. Adding a package here is what makes its every export a
 * component somebody has to account for.
 */
export const PACKAGES = {
  ui: { namespace: ui, helpers: UI_HELPERS },
  charts: { namespace: charts, helpers: CHARTS_HELPERS },
  system: { namespace: system, helpers: SYSTEM_HELPERS },
  crud: { namespace: crud, helpers: CRUD_HELPERS },
  signals: { namespace: signals, helpers: SIGNALS_HELPERS },
} as const satisfies Record<string, { namespace: object; helpers: readonly string[] }>

/** Identifier of a covered package: its directory, and the last segment of its specifier. */
export type PackageId = keyof typeof PACKAGES

/** Every covered package, in declaration order. */
export const packageIds: PackageId[] = Object.keys(PACKAGES) as PackageId[]

/** `@preact-components/<id>` — the specifier a reader copies out of the guide. */
export function packageSpecifier(id: PackageId): string {
  return `@preact-components/${id}`
}

/**
 * Every component one package exports, derived from its module namespace.
 *
 * A rename or a removal in the package changes this union, and every type below is written over it.
 */
export type ComponentNamesOf<P extends PackageId> = Exclude<
  keyof (typeof PACKAGES)[P]["namespace"],
  (typeof PACKAGES)[P]["helpers"][number]
>

/** Every component name the catalogue covers, from every package it covers. */
export type ComponentName = { [P in PackageId]: ComponentNamesOf<P> }[PackageId]

/** One entry of the catalogue: what the component is, the JSX to copy, and the live example. */
export interface Demo {
  /** One or two sentences on the component's contract and its defaults. */
  summary: string
  /** The JSX a consumer copies out of the guide. */
  snippet: string
  /**
   * The live example.
   *
   * Must be a pure function returning an element: stateful demos live in their own component so
   * the hook order of the catalogue never depends on the registry's contents.
   */
  render: () => ComponentChildren
}

/**
 * The compile-time tie between a section's demos and the components that exist.
 *
 * `Names` is constrained to {@link ComponentName}, so a name that is no longer exported does not
 * satisfy it, and `Record<Names, Demo>` means a name in the union with no demo does not satisfy
 * the fragment either. Both directions are errors at the section that is wrong.
 */
export type DemoFragment<Names extends ComponentName> = Record<Names, Demo>

/**
 * Components a covered package exports that the catalogue does not demonstrate yet.
 *
 * The list is the guide's worklist, and it is deliberately not a second helper list: a name here is
 * a component the reader is being told about, while a component nobody wants to demonstrate belongs
 * in that package's helpers. `satisfies` over the mapped type means a stale entry — a component
 * that has been renamed, removed or demoed since — cannot be written, and `registryDrift` reports a
 * demotion back to `true` as `{ stalePending: "Name" }`.
 */
export const PENDING_DEMOS = {
  /**
   * Empty on purpose, and it should stay that way.
   *
   * `ui` is the package under construction: every component PR adds an export here and its demo in
   * its own change. Spelling those names out would mean a `ui/` PR cannot pass `deno task check`
   * until somebody edits the guide in a second branch, which is the coupling this whole mechanism
   * exists to remove. {@link AUTO_PENDING_PACKAGES} is what keeps `ui` covered instead.
   */
  ui: [],
  charts: [
    "CompareChart",
    "D3LineChart",
    "DonutChart",
    "Kpi",
    "KpiGrid",
    "LineChart",
    "MetricPanel",
  ],
  system: [
    "BlogImageEnhancer",
    "BookingSubmit",
    "Calendar",
    "SEOHead",
    "SWUpdater",
    "ThemeToggle",
    "TimeSlots",
  ],
  crud: [
    "AssociationEditor",
    "CheckboxField",
    "CrudEditor",
    "DeletionValidation",
    "FieldIssues",
    "NumberField",
    "RowAction",
    "RowActions",
    "SelectField",
    "TextareaField",
    "TextField",
  ],
  signals: [],
} as const satisfies { [P in PackageId]: readonly ComponentNamesOf<P>[] }

/** Components declared as not-yet-demonstrated, for one package. */
export type PendingNames<P extends PackageId> = (typeof PENDING_DEMOS)[P][number]

/** Heading, blurb and demos of one catalogue section, before it is resolved for rendering. */
interface SectionSpec {
  /** Package whose component names this section's demos are keyed by. */
  package: PackageId
  /** Heading shown above the section. */
  title: string
  /** One or two sentences on what the section covers. */
  blurb: string
  /** The section's demos, keyed by component name. */
  demos: Record<string, Demo>
}

/**
 * The sections of the catalogue, in render order.
 *
 * Declaration order is reading order: the `ui` primitives first, then the packages a reader reaches
 * for next — charts, application chrome, CRUD scaffolding — and the state layer last, because it is
 * the one that reads as a concept rather than as a picture. Each fragment is keyed by the components
 * it documents, and the drift guard reads the package from the same entry.
 */
const catalogue = {
  badges: {
    package: "ui",
    title: "Badges",
    blurb: "Every palette entry, filled and outlined.",
    demos: badgeDemos,
  },
  buttons: {
    package: "ui",
    title: "Buttons",
    blurb:
      "Variants × sizes, plus the two components that wrap a button around a side effect (clipboard, geolocation).",
    demos: buttonDemos,
  },
  display: {
    package: "ui",
    title: "Display",
    blurb: "Headings, meters and the table shell.",
    demos: displayDemos,
  },
  feedback: {
    package: "ui",
    title: "Feedback",
    blurb:
      "Loading, error and toast surfaces. The overlay-style ones are pinned inside a box here.",
    demos: feedbackDemos,
  },
  inputs: {
    package: "ui",
    title: "Inputs",
    blurb: "Controlled switches and the dropdown trigger-panel pair.",
    demos: inputDemos,
  },
  charts: {
    package: "charts",
    title: "Charts",
    blurb:
      "Server-rendered charts and the d3 islands. `Bars` is live below and needs nothing but its data; the rest of the package is on the worklist at the top of the page.",
    demos: chartsDemos,
  },
  system: {
    package: "system",
    title: "System",
    blurb:
      "Application chrome and platform integration: navigation, heads, the service-worker prompt, the dual-mode calendar. `Breadcrumb` is live below; the rest is on the worklist.",
    demos: systemDemos,
  },
  crud: {
    package: "crud",
    title: "CRUD",
    blurb:
      "The list and editor scaffolding a resource page is rebuilt from — props and slots, no entity and no store assumed. `CrudList` is live below; the rest is on the worklist.",
    demos: crudDemos,
  },
  signals: {
    package: "signals",
    title: "Signals",
    blurb:
      "The state layer. `For` and `Show` are the package's only components; everything else is a factory an app calls itself (`buildModelStore`, `createListState`, `createToastStore`, `useUrlFilters`), so the section is short by design.",
    demos: signalsDemos,
  },
} as const satisfies Record<string, SectionSpec>

/** Identifier of a catalogue section. */
export type SectionId = keyof typeof catalogue

/** The demos one section registers, keyed by component name. */
type DemosOf<S extends SectionId> = (typeof catalogue)[S]["demos"]

/** Every component name a section registers a demo for, in no particular order. */
export type DemoedName = { [S in SectionId]: keyof DemosOf<S> }[SectionId]

/** One rendered section: its identity, its copy, the package it documents and its cards. */
export interface CatalogueSection {
  id: SectionId
  /** Heading shown above the section. */
  title: string
  /** One or two sentences on what the section covers. */
  blurb: string
  /** Package the section's demo keys belong to. */
  package: PackageId
  /** Package specifier, e.g. `@preact-components/ui`. */
  packageName: string
  /** Names with a demo in this section, in render order. */
  names: DemoedName[]
}

/** The sections in render order, resolved against {@link catalogue}. */
export const catalogueSections: CatalogueSection[] = (Object.keys(catalogue) as SectionId[]).map(
  (id) => {
    const section = catalogue[id]
    return {
      id,
      title: section.title,
      blurb: section.blurb,
      package: section.package,
      packageName: packageSpecifier(section.package),
      // A section's own fragment is a `Record` over the subset of its package's component names it
      // documents, so its keys are component names by construction; `Object.keys` is what widens
      // them to `string`.
      names: Object.keys(section.demos) as DemoedName[],
    }
  },
)

/**
 * Names with a demo, in render order — every card the catalogue renders, `ui`'s first.
 *
 * The sections are what the catalogue renders, so this is derived from them rather than from the
 * packages: a package's undemoed components are in {@link pendingDemos}, not here.
 */
export const catalogueNames: DemoedName[] = catalogueSections.flatMap((section) => section.names)

/** Components the sections demo, per package: the names a package's demos must account for. */
type DemoedNames<P extends PackageId> = {
  [S in SectionId]: (typeof catalogue)[S]["package"] extends P ? keyof DemosOf<S> : never
}[SectionId]

/**
 * Packages whose undemoed components are pending by default.
 *
 * A component a `ui/` PR adds is, by construction, a component whose demo lands in that same PR or
 * the next one. Requiring a hand-kept {@link PENDING_DEMOS} entry for it would mean the component PR
 * cannot pass `deno task check` on its own — the guard would block the very change it is meant to
 * describe, and the fix would live in a second branch. That coupling is the reason the guard was
 * generalised; leaving it in place for `ui` alone would defeat the generalisation.
 *
 * The property that matters survives: a component that is neither demoed nor declared pending is
 * still a hard `missingDemo` failure. What changes is only where "declared pending" comes from —
 * an explicit list for the packages that were ported whole, and the export set itself for the
 * package under construction.
 *
 * `ui` is the only entry. When a second package is built component-by-component it joins this list,
 * and {@link PENDING_DEMOS} keeps serving the packages ported in one go.
 */
export const AUTO_PENDING_PACKAGES = ["ui"] as const satisfies readonly PackageId[]

/** A package whose undemoed exports are pending without needing a {@link PENDING_DEMOS} entry. */
export type AutoPendingPackage = (typeof AUTO_PENDING_PACKAGES)[number]

/**
 * Components of `P` with no demo that no list has to declare.
 *
 * Empty for every package outside {@link AUTO_PENDING_PACKAGES}, so the explicit list stays the
 * only source of truth where there is one.
 */
type AutoPendingNames<P extends PackageId> = P extends AutoPendingPackage
  ? Exclude<ComponentNamesOf<P>, DemoedNames<P>>
  : never

/** Component exports a package has neither demoed nor declared pending. */
type MissingDemos<P extends PackageId> = Exclude<
  ComponentNamesOf<P>,
  DemoedNames<P> | PendingNames<P> | AutoPendingNames<P>
>

/** Demo keys that are not components of the package the section declares. */
type UnexpectedDemos<P extends PackageId> = Exclude<DemoedNames<P>, ComponentNamesOf<P>>

/** Components left in {@link PENDING_DEMOS} that have a demo after all. */
type DemoedPending<P extends PackageId> = Extract<PendingNames<P>, DemoedNames<P>>

/**
 * The drift report for one package.
 *
 * `true` when that package's demos, pending list and helpers account for its exports exactly.
 * Written as a conditional type rather than a `Record` annotation so the failure names the
 * offending component instead of reporting a missing property on an anonymous object.
 */
export type PackageDriftReport<P extends PackageId> = [MissingDemos<P>] extends [never]
  ? [UnexpectedDemos<P>] extends [never]
    ? [DemoedPending<P>] extends [never] ? true : { stalePending: DemoedPending<P> }
  : { unexpectedDemo: UnexpectedDemos<P> }
  : { missingDemo: MissingDemos<P> }

/** The drift report of every covered package: `true` per package, in a healthy tree. */
export type DriftReport = { [P in PackageId]: PackageDriftReport<P> }

/**
 * `true` in a healthy tree; `registry.test.ts` asserts every entry, and the type is the real guard.
 *
 * Annotated over every package, so the report cannot be completed by leaving a package out, and a
 * package demoted into a helper list shows up here rather than nowhere.
 */
export const registryDrift: DriftReport = {
  ui: true,
  charts: true,
  system: true,
  crud: true,
  signals: true,
}

/** Component names and declared helpers of one package, read from its barrel. */
export interface PackageExports<P extends PackageId = PackageId> {
  /** Component names, in module order. */
  components: Array<ComponentNamesOf<P>>
  /** Declared helpers the barrel really exports, in module order. */
  helpers: string[]
}

/**
 * Split a package's value exports into components and helpers.
 *
 * The runtime counterpart of {@link ComponentNamesOf}: `Object.keys` is what erases the name union
 * down to `string`, so the cast back is the price of deriving the lists instead of maintaining
 * them — and `registry.test.ts` compares both halves against the barrel they came from.
 *
 * @param id Package to read.
 * @returns The package's component names and the declared helpers it actually exports.
 */
export function exportsOf<P extends PackageId>(id: P): PackageExports<P> {
  const source: { namespace: object; helpers: readonly string[] } = PACKAGES[id]
  const declared = new Set(source.helpers)
  const exported = Object.keys(source.namespace)

  return {
    components: exported.filter((name) => !declared.has(name)) as Array<ComponentNamesOf<P>>,
    helpers: exported.filter((name) => declared.has(name)),
  }
}

/** Component names `@preact-components/ui` exports, in module order. */
export const componentNames: Array<ComponentNamesOf<"ui">> = exportsOf("ui").components

/** Helper exports of `ui` actually present on the barrel; a stale entry in the list shows up here. */
export const helperExportNames: string[] = exportsOf("ui").helpers

/** One package's declared gaps, for the worklist the guide prints. */
export interface PendingDemosByPackage {
  package: PackageId
  /** Package specifier, e.g. `@preact-components/crud`. */
  packageName: string
  /** Components of that package with no demo yet, in module order. */
  names: string[]
}

/** Packages with components still to be demonstrated, in {@link PACKAGES} order. */
export const pendingDemos: PendingDemosByPackage[] = (Object.keys(PACKAGES) as PackageId[])
  .map((id) => ({
    package: id,
    packageName: packageSpecifier(id),
    names: pendingNamesOf(id),
  }))
  .filter((entry) => entry.names.length > 0)

/**
 * Components of one package that are exported, undemoed and declared — the worklist, in module order.
 *
 * The declared {@link PENDING_DEMOS} entries come first because they are in the author's chosen
 * order; {@link AUTO_PENDING_PACKAGES} contributes whatever the exports have grown since, in module
 * order, so a component nobody has written up is named rather than silently absent.
 *
 * @param id Package to read.
 * @returns The package's pending component names.
 */
export function pendingNamesOf(id: PackageId): string[] {
  const declared: readonly string[] = PENDING_DEMOS[id]
  if (!(AUTO_PENDING_PACKAGES as readonly string[]).includes(id)) return [...declared]

  const demoed = new Set<string>(demoedNamesFor(id))
  const known = new Set(declared)
  const undeclared = exportsOf(id).components.filter((name) =>
    !demoed.has(name) && !known.has(name)
  )
  return [...declared, ...undeclared]
}

/**
 * Components one package's sections register a demo for, in render order.
 *
 * The runtime mirror of the {@link DemoedNames} type, which is private to the type level.
 *
 * @param id Package to read.
 * @returns The package's demoed component names.
 */
export function demoedNamesFor(id: PackageId): string[] {
  return catalogueSections.filter((section) => section.package === id).flatMap((s) => s.names)
}

/** The complete registry: one demo per component every section documents. */
export type DemoRegistry = Record<DemoedName, Demo>

/** A registry that may still be short an entry, which is what {@link missingDemos} reports on. */
export type PartialDemoRegistry = Partial<DemoRegistry>

/**
 * The flat registry the catalogue renders from: one entry per component, all sections merged.
 *
 * Annotated over {@link DemoedName}, so a section left out of the merge is a missing property.
 */
export const demoRegistry: DemoRegistry = {
  ...badgeDemos,
  ...buttonDemos,
  ...displayDemos,
  ...feedbackDemos,
  ...inputDemos,
  ...chartsDemos,
  ...systemDemos,
  ...crudDemos,
  ...signalsDemos,
}

/**
 * Components the sections mean to demonstrate but this registry does not carry.
 *
 * An exhaustive registry returns an empty list and the catalogue renders no warning; a partial one
 * is named loudly in the guide instead of quietly shrinking it. Takes the registry as an argument
 * so the missing path can be tested with a registry that is missing something. Components declared
 * pending are not this function's business — they are named by {@link pendingDemos} instead, which
 * is the difference between a gap somebody declared and one nobody did.
 *
 * @param registry Registry to check, complete or not.
 * @returns The names it does not cover, in render order.
 */
export function missingDemos(registry: PartialDemoRegistry): DemoedName[] {
  return catalogueNames.filter((name) => !(name in registry))
}

/**
 * The registry's entries in render order, with the demo of every name it actually covers.
 *
 * @param registry Registry to read, complete or not.
 * @returns `[name, demo]` pairs; names with no entry are left out.
 */
export function demoEntries(registry: PartialDemoRegistry): Array<[DemoedName, Demo]> {
  return catalogueNames.flatMap((name) => {
    const demo = registry[name]
    return demo ? [[name, demo] as [DemoedName, Demo]] : []
  })
}
