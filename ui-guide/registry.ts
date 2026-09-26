/**
 * The catalogue's data: the packages it covers, the sections a reader scrolls, and one demo per card.
 *
 * The sections live in `sections/*.tsx` and hand their cards over here. A section states the package
 * its keys belong to and the group it is read in, and everything the page and the route model need —
 * {@link catalogueSections}, {@link catalogueNames}, {@link sectionIds} — is derived from that
 * one record, so there is no second list to keep in step.
 *
 * Nothing in this file checks itself. `coverage.ts` is the check: it reads every covered package's
 * exports, and `deno task test` fails when a component has no card, when a card is keyed to a name
 * no package exports, or when its allow-list has gone stale.
 *
 * Prop vocabulary is guarded one level down, per component: a demo iterates a `Record<Union, …>`
 * keyed by a prop's own union type (`ButtonVariant`, `BadgeColor`, `SpinnerSize`, …) through
 * `record.ts`'s `entries()`, so adding a variant to a component fails `deno check` until the
 * catalogue shows it.
 *
 * **Classes are a second kind of section.** `forms` and `surfaces` document the style classes
 * `theme/preset.css` ships rather than components, and they declare `package: "theme"` so the
 * coverage rule leaves them alone: a class name is not an export, and pretending it were would be
 * the "document what does not exist" failure in the other direction. Their cards are keyed by a card
 * id and carry the classes they apply, and `classes.test.tsx` is their guard — it reads `preset.css`,
 * renders the catalogue, and fails when a class the preset defines is demonstrated nowhere and named
 * in no exclusion.
 *
 * `icons/` needs no entry either: the gallery reads `Object.entries(import * as icons)`, so a new
 * glyph appears in the catalogue by itself.
 */

import type { ComponentChildren } from "preact"
import type { ExampleDemo } from "./example.tsx"
import { badgeDemos } from "./sections/badges.tsx"
import { buttonDemos } from "./sections/buttons.tsx"
import { chartsDemos } from "./sections/charts.tsx"
import { crudDemos } from "./sections/crud.tsx"
import { displayDemos } from "./sections/display.tsx"
import { enhancedFormDemos } from "./sections/enhanced-forms.tsx"
import { uiExamples } from "./sections/ui-examples.tsx"
import { signalsExamples } from "./sections/signals-examples.tsx"
import { chartsExamples } from "./sections/charts-examples.tsx"
import { systemExamples } from "./sections/system-examples.tsx"
import { crudExamples } from "./sections/crud-examples.tsx"
import { themeExamples } from "./sections/theme-examples.tsx"
import { cnExamples } from "./sections/cn-examples.tsx"
import { feedbackDemos } from "./sections/feedback.tsx"
import { fieldDemos } from "./sections/fields.tsx"
import { formDemos } from "./sections/forms.tsx"
import { inputDemos } from "./sections/inputs.tsx"
import { layoutDemos } from "./sections/layout.tsx"
import { mapDemos } from "./sections/map.tsx"
import { surfaceDemos } from "./sections/surfaces.tsx"
import { systemDemos } from "./sections/system.tsx"

/**
 * Every package whose components the catalogue renders, in reading order.
 *
 * Their markup is on the page, so the host's stylesheet has to scan them (`pages/styles.css`).
 */
export const packageIds = ["ui", "charts", "system", "crud", "map"] as const

/**
 * Packages the catalogue covers with example cards alone: nothing they export renders markup of its
 * own, so no stylesheet needs to scan them.
 */
export const examplePackageIds = ["signals", "theme", "cn"] as const

/**
 * Every package the catalogue accounts for: {@link packageIds}, then {@link examplePackageIds}.
 *
 * Adding one here is what makes its every value export somebody's to account for; `coverage.ts`
 * reads this list and fails when a package directory is neither catalogued nor excluded with a
 * reason.
 */
export const coveredPackageIds = [...packageIds, ...examplePackageIds] as const

/** Identifier of a catalogued package: its directory, and the last segment of its specifier. */
export type PackageId = (typeof coveredPackageIds)[number]

/** `@spy4x/preact-<id>` — the specifier a reader copies out of the guide. */
export function packageSpecifier(id: SectionPackage): string {
  return `@spy4x/preact-${id}`
}

/** One row of a card's props summary: a prop, its type, its default and what it does. */
export interface DemoProp {
  /** The prop's name, e.g. `"title"`. */
  name: string
  /** Its type as a reader writes it, e.g. `"string"` or `"(value: number) => string"`. */
  type: string
  /** Its default, as code, when it has one. */
  default?: string
  /** One plain sentence on what it does, in inline Markdown (`markdown.tsx`). */
  description: string
}

/** One entry of the catalogue: what the component is, the JSX to copy, and the live example. */
export interface Demo {
  /**
   * One plain sentence on what the component is for, as text. Inline Markdown code spans
   * (`` `name` ``) render as code, so no literal backtick reaches the page. It is also what the
   * search reads when {@link Demo.description} is JSX.
   */
  summary: string
  /**
   * The card's description as JSX, shown instead of {@link Demo.summary} when given — for a
   * sentence that needs a link or markup the Markdown subset does not cover.
   */
  description?: ComponentChildren
  /**
   * Give the card the content column's full width: for a demo that needs room (a table, a chart, a
   * form). Left out, the card shares a row with its neighbour at the widths that fit two.
   */
  wide?: boolean
  /** The props summary under the demo: the props a reader reaches for first. Optional. */
  props?: readonly DemoProp[]
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
 * The shape a section's demos have: one {@link Demo} per card, keyed by component name.
 *
 * Which names belong in it is `coverage.ts`'s business, at test time and against the packages
 * themselves. A section states the shape so a card missing a summary, a snippet or a render
 * function is an error where it is written.
 */
export type DemoFragment = Record<string, Demo>

/**
 * The package the class sections document.
 *
 * A class section names it to say which package's vocabulary its cards belong to. Its card ids are
 * not exports, and `coverage.ts` reads only component and example sections, so they stay out of
 * the coverage rule.
 */
export const CLASS_PACKAGE = "theme" as const

/** A section's package: any catalogued package. */
export type SectionPackage = PackageId

/**
 * One card of a class section: the same shape as {@link Demo}, plus what only a class card has.
 *
 * The key a class card is registered under is a card id (`"class-card"`), not a class name, so the
 * card carries its own heading; `classes` is the list it is about, rendered as chips and checked
 * against its own rendered markup by `classes.test.tsx`.
 */
export interface ClassDemo extends Demo {
  /** Card heading, e.g. `"Colour atoms"`. */
  title: string
  /** Classes this card applies, in display order. */
  classes: string[]
}

/**
 * The shape a class section's cards have: one {@link ClassDemo} per card id.
 *
 * The counterpart of {@link DemoFragment} for the sections that document classes, and it carries
 * what only a class card has: a card with no heading and no class list is an error where it is
 * written. `classes.test.tsx` is what holds the cards to `preset.css`.
 */
export type ClassDemoFragment = Record<string, ClassDemo>

/**
 * What a section's cards are: a package's components, the theme's classes, or examples of exports
 * that render nothing (`example.tsx`).
 */
export type SectionKind = "component" | "class" | "example"

/**
 * The group a section belongs to, as the reader's reason for looking rather than as a package
 * boundary.
 *
 * The five ids are the one hand-kept list in the grouping: reading order for the groups themselves.
 * The guide no longer draws a group as a heading — a package's page is what a reader navigates by —
 * so a group now only decides where its sections fall in that page's order.
 * Everything else derives. `foundations` carries the two cards whose whole content is a mark — the
 * palette and the button surface. `surfaces` is what a page is made of: the things it shows, the
 * feedback it shows when there is nothing to show, and the two sections that document
 * `preset.css`'s own class families. `inputs` is one story in two halves, `ui/`'s controlled
 * primitives and the native controls the same classes style. `data` is the two packages that only
 * matter once there is a resource. `application` is the app shell an adopter wires first, and it is
 * a group of one: `signals/` was read beside it until that package stopped exporting components,
 * and the group is kept because the shell is a reader's own reason for looking rather than a
 * leftover of the package it once shared a heading with.
 */
export const catalogueGroupIds = [
  "foundations",
  "surfaces",
  "inputs",
  "data",
  "application",
] as const

/** Identifier of a top-level group, e.g. `"inputs"`. */
export type GroupId = (typeof catalogueGroupIds)[number]

/** Heading, blurb, group and demos of one catalogue section, before it is resolved for rendering. */
interface SectionSpec {
  /**
   * Package the section's demo keys belong to.
   *
   * `theme` marks a class section: its keys are card ids and its cards are {@link ClassDemo}s, so
   * the coverage rule never looks for them among a package's exports.
   */
  package: SectionPackage
  /** `"example"` for a section of {@link ExampleDemo}s; left out, the package decides the kind. */
  kind?: "example"
  /**
   * The group the section is read in.
   *
   * Typed over {@link GroupId}, which is what makes the grouping checked rather than declared: an
   * invented group, a renamed one and a typo are all `deno check` failures at the section whose
   * spec is wrong. It is also why "every section appears in exactly one group" needs no list — a
   * section's group is a property of the section, so a section cannot be in two groups, and a
   * section with no `group` does not type-check at all.
   */
  group: GroupId
  /** Heading shown above the section. */
  title: string
  /** One or two sentences on what the section covers. */
  blurb: string
  /** The section's demos, keyed by component name or, for a class section, by card id. */
  demos: Record<string, Demo>
}

/**
 * Identifier of a catalogue section.
 *
 * The one hand-kept list of sections, and it is what makes {@link catalogue} total: a section id
 * that names nothing fails `deno check` with a property the record does not have, and a section the
 * union does not name fails with a missing property naming the id. It is written out rather than
 * derived because the annotation that makes the record total is a reference to the union, and a
 * union derived from the record it constrains is a cycle TypeScript rejects.
 */
export type SectionId =
  | "badges"
  | "buttons"
  | "layout"
  | "display"
  | "enhanced-forms"
  | "feedback"
  | "inputs"
  | "fields"
  | "forms"
  | "surfaces"
  | "charts"
  | "system"
  | "crud"
  | "map"
  | "ui-examples"
  | "signals-examples"
  | "charts-examples"
  | "system-examples"
  | "crud-examples"
  | "theme-examples"
  | "cn-examples"

const catalogue = {
  badges: {
    group: "foundations",
    package: "ui",
    title: "Badges",
    blurb: "Every palette entry, filled and outlined.",
    demos: badgeDemos,
  },
  buttons: {
    group: "foundations",
    package: "ui",
    title: "Buttons",
    blurb:
      "Variants × sizes, plus the components that wrap a button around a side effect (clipboard, geolocation, a CSV download).",
    demos: buttonDemos,
  },
  layout: {
    group: "surfaces",
    package: "ui",
    title: "Layout",
    blurb:
      "How a page puts space between its parts: `Page`, `Section`, `Stack`, `Cluster` and `Grid`, each with a named gap from the theme's spacing scale. No component carries an outer margin, so these are the only source of space between siblings.",
    demos: layoutDemos,
  },
  display: {
    group: "surfaces",
    package: "ui",
    title: "Display",
    blurb:
      "Everything that presents rather than collects: the page title, headings, the table shell, the meters, the card parts, tabs, pagination and the avatar family.",
    demos: displayDemos,
  },
  feedback: {
    group: "surfaces",
    package: "ui",
    title: "Feedback",
    blurb:
      "What a page shows while it is busy, empty or broken: spinners and skeletons, the error and empty states, the toast, and the two dialogs. The overlay-style ones are pinned inside a box here.",
    demos: feedbackDemos,
  },
  inputs: {
    group: "inputs",
    package: "ui",
    title: "Inputs",
    blurb:
      "The controlled controls `ui/` owns: switches, the dropdown's trigger-panel pair, and the composite pickers built from them. The `Fields` section below is the text-and-form half of the same story.",
    demos: inputDemos,
  },
  fields: {
    group: "inputs",
    package: "ui",
    title: "Fields",
    blurb:
      "The controlled form primitives: `Field` owns the label wiring and the messages, and `Input`/`Textarea`/`Select`/`Checkbox`/`Radio` are the native elements with the preset's class on them.",
    demos: fieldDemos,
  },
  "enhanced-forms": {
    group: "inputs",
    package: "ui",
    title: "Enhanced forms",
    blurb:
      "Whole forms built on the `Fields` primitives above, that post on their own before a script has run and stay on the page once one has: `EnhancedForm` is the building block, `NewsletterForm` and `ContactForm` are the two shapes built on it.",
    demos: enhancedFormDemos,
  },
  forms: {
    group: "surfaces",
    package: CLASS_PACKAGE,
    title: "Forms",
    blurb:
      "The form classes `preset.css` ships, with no component wrapped around them: the controls, a label in either placement, and the input with a button inside it. The `Fields` section above shows the same classes through the `ui/` primitives.",
    demos: formDemos,
  },
  surfaces: {
    group: "surfaces",
    package: CLASS_PACKAGE,
    title: "Surfaces and utilities",
    blurb:
      "The half of the stylesheet an app applies to its own markup: card surfaces, the scroll container, the type scale, KPI tiles, and every colour atom.",
    demos: surfaceDemos,
  },
  charts: {
    group: "data",
    package: "charts",
    title: "Charts",
    blurb:
      "The server-rendered charts need nothing but their data; the two d3 charts draw in the browser, so until then their cards show a placeholder.",
    demos: chartsDemos,
  },
  system: {
    group: "application",
    package: "system",
    title: "System",
    blurb:
      "Application chrome and platform integration: heads, the service-worker prompt, the dual-mode calendar. Everything is live; the two platform-integration cards say on the card what they demonstrate and what they leave to a browser.",
    demos: systemDemos,
  },
  crud: {
    group: "data",
    package: "crud",
    title: "CRUD",
    blurb:
      "The list and editor scaffolding a resource page is rebuilt from — props and slots, no entity and no store assumed. Every card drives a small in-memory store built from the structural interfaces the package declares.",
    demos: crudDemos,
  },
  map: {
    group: "data",
    package: "map",
    title: "Map",
    blurb:
      "Markers on a Leaflet tile layer, plotted from plain data — each pin is the component's real keyboard and screen-reader interface — with a plain, non-interactive list of the same places beside it. The card is its own server render — a labelled empty box — until a browser mounts Leaflet into it.",
    demos: mapDemos,
  },
  "ui-examples": {
    group: "application",
    package: "ui",
    kind: "example",
    title: "Helpers",
    blurb:
      "The functions and constants `ui/` exports beside its components, each run on this page.",
    demos: uiExamples,
  },
  "signals-examples": {
    group: "application",
    package: "signals",
    kind: "example",
    title: "Signals",
    blurb: "Each helper run on this page, its output printed under the code.",
    demos: signalsExamples,
  },
  "charts-examples": {
    group: "application",
    package: "charts",
    kind: "example",
    title: "Helpers",
    blurb:
      "The scales, colours and loaders `charts/` exports beside its charts, each run on this page.",
    demos: chartsExamples,
  },
  "system-examples": {
    group: "application",
    package: "system",
    kind: "example",
    title: "Helpers",
    blurb:
      "The functions and constants `system/` exports beside its components, each run on this page.",
    demos: systemExamples,
  },
  "crud-examples": {
    group: "application",
    package: "crud",
    kind: "example",
    title: "Helpers",
    blurb:
      "The functions and constants `crud/` exports beside its components, each run on this page.",
    demos: crudExamples,
  },
  "theme-examples": {
    group: "application",
    package: "theme",
    kind: "example",
    title: "Stylesheets as text",
    blurb:
      "The stylesheets exported as strings, for a build that turns them into a compiled stylesheet.",
    demos: themeExamples,
  },
  "cn-examples": {
    group: "application",
    package: "cn",
    kind: "example",
    title: "cn",
    blurb: "`cn()` run on this page, its output printed under the code.",
    demos: cnExamples,
  },
} as const satisfies Record<SectionId, SectionSpec>

/**
 * The sections of every group, in reading order: the catalogue's flat order, bucketed.
 *
 * Derived rather than declared, in the direction that keeps one edit per section: a section says
 * which group it belongs to and this record is written from that, so the two cannot disagree and a
 * new section joins its group by declaring it. Order is kept — each section is appended in
 * {@link catalogue}'s declaration order, which is the reading order within a group (badges before
 * buttons, a class section after the `ui/` sections it mirrors).
 */
const catalogueGroups: Record<GroupId, readonly SectionId[]> = (() => {
  const grouped: Record<GroupId, SectionId[]> = {
    foundations: [],
    surfaces: [],
    inputs: [],
    data: [],
    application: [],
  }

  // `Object.keys` is what widens the ids to `string`; the cast back is the price of iterating a
  // record whose keys are already a union of literals.
  for (const id of Object.keys(catalogue) as SectionId[]) {
    grouped[catalogue[id].group].push(id)
  }

  return grouped
})()

/**
 * The groups' sections as one array, in group order then declaration order: the reading order
 * {@link catalogueSections} is built from, and so the order each page lists its sections in. The
 * groups are no longer drawn as headings; they only order the sections.
 */
export const sectionIds: SectionId[] = catalogueGroupIds.flatMap((groupId) => [
  ...catalogueGroups[groupId],
])

/** One rendered section: its identity, its copy, the package it documents and its cards. */
export interface CatalogueSection {
  id: SectionId
  /**
   * The group the section is read in.
   *
   * Resolved from the spec, so a host rendering its own navigation and the page drawing group
   * headings read the same value: the one the section itself decided.
   */
  group: GroupId
  /** Whether the section's cards are components or theme classes. */
  kind: SectionKind
  /** Heading shown above the section. */
  title: string
  /** One or two sentences on what the section covers. */
  blurb: string
  /** Package the section's keys belong to: a component package, or `theme`. */
  package: SectionPackage
  /** Package specifier, e.g. `@spy4x/preact-ui` or `@spy4x/preact-theme`. */
  packageName: string
  /** Names with a demo in this section, in render order. */
  names: string[]
}

/**
 * The sections in render order, resolved against {@link catalogue}.
 *
 * The order is {@link sectionIds}: groups first, declaration order within them, which is the one
 * order the catalogue keeps. The flat array stays the interface — `pages/`, `routes.ts` and
 * `verify.ts` all iterate sections — and none of them has to know that the page draws a heading
 * every few of them.
 */
export const catalogueSections: CatalogueSection[] = sectionIds.map((id) => {
  const section = catalogue[id]
  return {
    id,
    group: section.group,
    kind: "kind" in section
      ? section.kind
      : section.package === CLASS_PACKAGE
      ? "class"
      : "component",
    title: section.title,
    blurb: section.blurb,
    package: section.package,
    packageName: packageSpecifier(section.package),
    names: Object.keys(section.demos),
  }
})

/**
 * Names with a demo, in render order — every card the catalogue renders, `ui`'s first.
 *
 * The sections are what the catalogue renders, so this is derived from them rather than from the
 * packages: a component with no card is `coverage.ts`'s business, not this list's.
 */
export const catalogueNames: string[] = catalogueSections.flatMap((section) => section.names)

/** The complete registry: one demo per card every section documents. */
export type DemoRegistry = Record<string, Demo>

/** A registry that may still be short an entry, which is what {@link missingDemos} reports on. */
export type PartialDemoRegistry = Partial<DemoRegistry>

/** The flat registry the catalogue renders from: one entry per card, all sections merged. */
export const demoRegistry: DemoRegistry = {
  ...badgeDemos,
  ...buttonDemos,
  ...layoutDemos,
  ...displayDemos,
  ...enhancedFormDemos,
  ...feedbackDemos,
  ...inputDemos,
  ...fieldDemos,
  ...formDemos,
  ...surfaceDemos,
  ...chartsDemos,
  ...systemDemos,
  ...crudDemos,
  ...mapDemos,
  ...uiExamples,
  ...signalsExamples,
  ...chartsExamples,
  ...systemExamples,
  ...crudExamples,
  ...themeExamples,
  ...cnExamples,
}

/**
 * Every class demonstration the catalogue renders, keyed by card id.
 *
 * Derived from the class sections rather than written out again, so a section added later is in here
 * without a second list. The cast is the price of {@link Demo} being the base shape of a section's
 * `demos`: a section whose package is the theme's carries {@link ClassDemo}s, which the registry's
 * `Record<string, Demo>` widens away. `classes.test.tsx` asserts the shape survived.
 */
export const classDemos: Record<string, ClassDemo> = Object.fromEntries(
  catalogueSections
    .filter((section) => section.kind === "class")
    .flatMap((section) => section.names.map((name) => [name, demoRegistry[name]])),
) as Record<string, ClassDemo>

/** Every example card the catalogue renders, keyed by card id; derived like {@link classDemos}. */
export const exampleDemos: Record<string, ExampleDemo> = Object.fromEntries(
  catalogueSections
    .filter((section) => section.kind === "example")
    .flatMap((section) => section.names.map((name) => [name, demoRegistry[name]])),
) as Record<string, ExampleDemo>

/**
 * A card's heading: a class or example card's own title, and `<Name />` for a component.
 *
 * @param name Card key.
 */
export function cardLabel(name: string): string {
  return classDemos[name]?.title ?? exampleDemos[name]?.title ?? `<${name} />`
}

/** Card ids of the class sections, in render order: the demos that document classes, not components. */
export const classDemoNames: string[] = catalogueSections
  .filter((section) => section.kind === "class")
  .flatMap((section) => section.names)

/**
 * Cards the sections mean to render that this registry does not carry.
 *
 * An exhaustive registry returns an empty list and the catalogue renders no warning; a partial one
 * is named loudly in the guide instead of quietly shrinking it. Takes the registry as an argument so
 * the missing path can be tested with a registry that is missing something.
 *
 * @param registry Registry to check, complete or not.
 * @returns The names it does not cover, in render order.
 */
export function missingDemos(registry: PartialDemoRegistry): string[] {
  return catalogueNames.filter((name) => !(name in registry))
}

/**
 * The guide's pages, in navigation order: the overview, one page per package, then `all`, every
 * page at once.
 *
 * A page is what the guide renders at one time. The sections above are still the unit a card
 * belongs to and a route names; a page is the package they belong to, so `ui/`'s sections are
 * one page read top to bottom, and a package with one section (`map`, `signals`, `cn`) is a page of
 * one. `theme` holds the two class sections and its examples, and `icons` renders the gallery.
 *
 * `all` is every other page at once. It is what the guide renders before its host has read the
 * address — so it is the served document, the page a reader without JavaScript gets — and a route
 * of its own, for searching the whole library with the browser's find.
 */
export const guidePageIds = [
  "overview",
  "ui",
  "system",
  "crud",
  "charts",
  "map",
  "signals",
  "theme",
  "icons",
  "cn",
  "all",
] as const

/** Identifier of one page of the guide, e.g. `"ui"`. */
export type GuidePageId = (typeof guidePageIds)[number]

/** One page as the navigation and the page header show it. */
export interface GuidePage {
  id: GuidePageId
  /** Navigation label and page heading, e.g. `"Components"`. */
  title: string
  /** One or two sentences under the page heading. */
  blurb: string
  /** One plain sentence: what the overview's package card says. */
  summary: string
  /** The package the page documents, e.g. `@spy4x/preact-ui`; `undefined` for the overview. */
  packageName: string | undefined
  /** The sections the page renders, in reading order; empty for a page with no cards. */
  sections: CatalogueSection[]
}

/** Title and blurb of every page, hand-written because they are prose. */
const pageCopy: Record<GuidePageId, { title: string; blurb: string; summary?: string }> = {
  overview: {
    title: "Overview",
    blurb: "What the library holds, one page per package.",
  },
  ui: {
    title: "UI",
    blurb:
      "The controls and surfaces an app is assembled from: buttons and badges, tables and meters, fields and pickers, dialogs, toasts and the empty and error states.",
    summary:
      "Buttons, fields, tables, dialogs, toasts and the other controls an app is built from.",
  },
  system: {
    title: "System",
    blurb: catalogue.system.blurb,
    summary: "App chrome and platform pieces: shells, heads, the sign-in form and the calendar.",
  },
  crud: {
    title: "CRUD",
    blurb: catalogue.crud.blurb,
    summary: "List and editor scaffolding for a resource page, driven by props and your store.",
  },
  charts: {
    title: "Charts",
    blurb:
      "Charts that render on the server as plain SVG and HTML, two d3 charts that draw in the browser, and the scale and loading helpers behind them.",
    summary: "Server-rendered SVG charts, two d3 charts and the helpers behind them.",
  },
  map: {
    title: "Map",
    blurb: catalogue.map.blurb,
    summary: "Markers on a Leaflet map, plotted from plain data.",
  },
  signals: {
    title: "Signals",
    blurb:
      "State helpers built on `@preact/signals`: the model store, filters bound to the address bar, table state, toasts and the theme store. The package renders nothing of its own.",
    summary:
      "State helpers on `@preact/signals`: stores, address-bar filters, table state and toasts.",
  },
  theme: {
    title: "Theme",
    blurb:
      "The design tokens and the classes `preset.css` ships: the half of the stylesheet an app applies to markup the library does not own.",
    summary: "The design tokens, the preset stylesheet and the classes it ships.",
  },
  icons: {
    title: "Icons",
    blurb: "Every glyph the icon package exports. Search by name, click a glyph to copy its JSX.",
    summary: "Every glyph the icon package exports, searchable and copyable.",
  },
  all: {
    title: "Everything",
    blurb:
      "Every page of the guide on one page: the whole library in one scroll, for the browser's own find.",
  },
  cn: {
    title: "cn",
    blurb:
      "`cn()` joins class names and resolves conflicting Tailwind utilities, so a caller's class wins over a component's default.",
    summary: "Joins class names and lets a caller's Tailwind class win over a component's.",
  },
}

/**
 * The page a section is read on: its package's page, and `theme` for a class section.
 *
 * @param section Section to place.
 * @returns The page that renders it.
 */
export function pageOfSection(section: Pick<CatalogueSection, "package">): GuidePageId {
  return section.package
}

/** Every page of the guide, resolved, in {@link guidePageIds} order. */
export const guidePages: GuidePage[] = guidePageIds.map((id) => ({
  id,
  title: pageCopy[id].title,
  blurb: pageCopy[id].blurb,
  summary: pageCopy[id].summary ?? pageCopy[id].blurb,
  packageName: id === "overview" || id === "all" ? undefined : `@spy4x/preact-${id}`,
  sections: id === "all"
    ? catalogueSections
    : catalogueSections.filter((section) => pageOfSection(section) === id),
}))

/** The pages that document one package each: every page but the overview and `all`. */
export const packagePages: GuidePage[] = guidePages.filter((page) =>
  page.id !== "overview" && page.id !== "all"
)
