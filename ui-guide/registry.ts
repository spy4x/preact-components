/**
 * The catalogue's data: the packages it covers, the sections a reader scrolls, and one demo per card.
 *
 * The sections live in `sections/*.tsx` and hand their cards over here. A section states the package
 * its keys belong to and the group it is read in, and everything the page and the route model need —
 * {@link catalogueSections}, {@link catalogueNames}, {@link catalogueGroups} — is derived from that
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
import { badgeDemos } from "./sections/badges.tsx"
import { buttonDemos } from "./sections/buttons.tsx"
import { chartsDemos } from "./sections/charts.tsx"
import { crudDemos } from "./sections/crud.tsx"
import { displayDemos } from "./sections/display.tsx"
import { enhancedFormDemos } from "./sections/enhanced-forms.tsx"
import { feedbackDemos } from "./sections/feedback.tsx"
import { fieldDemos } from "./sections/fields.tsx"
import { formDemos } from "./sections/forms.tsx"
import { inputDemos } from "./sections/inputs.tsx"
import { mapDemos } from "./sections/map.tsx"
import { surfaceDemos } from "./sections/surfaces.tsx"
import { systemDemos } from "./sections/system.tsx"

/**
 * Every package the catalogue demonstrates, in reading order.
 *
 * Adding one here is what makes its every exported component somebody's to account for;
 * `coverage.ts` reads this list and fails when a package directory is neither catalogued nor
 * excluded with a reason.
 */
export const packageIds = ["ui", "charts", "system", "crud", "map"] as const

/** Identifier of a catalogued package: its directory, and the last segment of its specifier. */
export type PackageId = (typeof packageIds)[number]

/** `@preact-components/<id>` — the specifier a reader copies out of the guide. */
export function packageSpecifier(id: SectionPackage): string {
  return `@preact-components/${id}`
}

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
 * `theme/` exports no components, so it is not a {@link packageIds} entry and its exports are never
 * enumerated; a class section names it to say which package's vocabulary its cards belong to, and
 * that is what keeps its card ids out of the coverage rule.
 */
export const CLASS_PACKAGE = "theme" as const

/** A section's package: one of the catalogued component packages, or the theme's classes. */
export type SectionPackage = PackageId | typeof CLASS_PACKAGE

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

/** What a section's cards are keyed by: a catalogued package's components, or the theme's classes. */
export type SectionKind = "component" | "class"

/**
 * The group a section belongs to, as the reader's reason for looking rather than as a package
 * boundary.
 *
 * The five ids are the one hand-kept list in the grouping: reading order for the groups themselves,
 * because a group is a heading and headings do not fall out of a record the way an array order does.
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

/**
 * One group as a reader sees it: an id with the heading and the sentence above its sections.
 *
 * The headings are hand-written for the same reason the ids are: a heading is prose, and prose
 * cannot be derived from a key without reading worse than the key. What *is* derived is the
 * membership, in {@link catalogueGroups} — so the expensive half (which sections are in it) cannot
 * go stale, and the cheap half is a line of copy.
 */
export interface CatalogueGroup {
  /** The group, e.g. `"inputs"`. */
  id: GroupId
  /** Heading shown above the group, e.g. `"Inputs"`. */
  title: string
  /** One sentence on what the group collects, and why those sections are read together. */
  blurb: string
}

/**
 * The five groups' headings, in {@link catalogueGroupIds} order.
 *
 * Annotated over `Record<GroupId, …>`, so a group added to {@link catalogueGroupIds} without a
 * heading is a missing property and a heading for a group that does not exist is excess — the same
 * two-way tie the module doc's guard 7 describes, one level up. Nothing here names a section: the
 * members come from the specs, so this record cannot lose one.
 */
const groupHeadings: Record<GroupId, { title: string; blurb: string }> = {
  foundations: {
    title: "Foundations",
    blurb:
      "The two cards that are a surface before they are anything else: the palette, and the button.",
  },
  surfaces: {
    title: "Surfaces and page furniture",
    blurb:
      "What a page shows and the feedback it shows instead: headings, meters and tables; the loading, error and toast states; and the two sections that document `preset.css`'s own controls and utilities, which is what an app applies to markup the library does not own.",
  },
  inputs: {
    title: "Inputs",
    blurb:
      "One story in two halves: `ui/`'s controlled primitives, and the same controls written as the preset's class on a native element.",
  },
  data: {
    title: "Data and resources",
    blurb:
      "The packages that only matter once there is a resource behind the page: the server-rendered charts, the CRUD scaffolding a resource page is rebuilt from, and the map that plots one on a tile layer.",
  },
  application: {
    title: "App shell",
    blurb:
      "The chrome an adopter wires first: the heads a page needs, the service-worker prompt, the dual-mode calendar and the blog image enhancer. The state layer these are assembled through is `signals/`, which has nothing to render and so has no section here — read its own README instead.",
  },
}

/** The groups with their headings, in render order: what the page and its navigation iterate. */
export const catalogueGroupsWithHeadings: CatalogueGroup[] = catalogueGroupIds.map((id) => ({
  id,
  title: groupHeadings[id].title,
  blurb: groupHeadings[id].blurb,
}))

/** Heading, blurb, group and demos of one catalogue section, before it is resolved for rendering. */
interface SectionSpec {
  /**
   * Package the section's demo keys belong to.
   *
   * `theme` marks a class section: its keys are card ids and its cards are {@link ClassDemo}s, so
   * the coverage rule never looks for them among a package's exports.
   */
  package: SectionPackage
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
      "Server-rendered charts and the d3 islands. The zero-JS SVGs are live and need nothing but their data; the two islands draw in an effect, so their cards are their real server render and a browser is where the drawing happens.",
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
export const catalogueGroups: Record<GroupId, readonly SectionId[]> = (() => {
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
 * The groups' sections as one array, in group order then declaration order.
 *
 * The flattening {@link catalogueSections} is built from, and the reason the page can draw group
 * headings without a second order to keep in step: it is the groups read back, so the flat render
 * order and the grouped view are the same list.
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
  /** Package specifier, e.g. `@preact-components/ui` or `@preact-components/theme`. */
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
    kind: section.package === CLASS_PACKAGE ? "class" : "component",
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
