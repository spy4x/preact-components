/**
 * The catalogue's demo registry — exactly one entry per component `@preact-components/ui`
 * exports.
 *
 * Two guards keep the catalogue honest, and both are checked rather than commented:
 *
 * 1. **Compile-time drift.** {@link ComponentName} is `keyof typeof ui`, so renaming or removing a
 *    component in `ui/` immediately shifts that union. Every section registers its demos through
 *    {@link DemoFragment}, which is `Record<Name, Demo>` over the union, and {@link DriftReport}
 *    compares what the sections cover against what the package exports. A component with no demo,
 *    a demo for a component that is not exported, and a rename that only reached one side are all
 *    `deno check` failures naming the offending component. This is what stops the catalogue from
 *    documenting dead API the way the source guides documented dead CSS (`.btn-sm`, `.h6`).
 * 2. **Runtime drift.** {@link missingDemos} is what the catalogue actually renders: any exported
 *    component with no entry is listed in a warning banner instead of being silently absent.
 *    `registry.test.ts` drives it with a deliberately partial registry, so the banner path is
 *    exercised rather than assumed.
 *
 * Prop vocabulary is guarded the same way, one level down: a demo iterates a `Record<Union, …>`
 * keyed by a prop's own union type (`ButtonVariant`, `BadgeColor`, `SpinnerSize`, …) through
 * `record.ts`'s `entries()`, so adding a variant to a component fails `deno check` until the
 * catalogue shows it.
 *
 * The registry covers the `ui` barrel only. The icon gallery needs no entry — it reads
 * `Object.entries(import * as icons)`, so a new glyph appears in the catalogue by itself.
 */

import * as ui from "@preact-components/ui"
import { badgeDemos } from "./sections/badges.tsx"
import { buttonDemos } from "./sections/buttons.tsx"
import { displayDemos } from "./sections/display.tsx"
import { feedbackDemos } from "./sections/feedback.tsx"
import { inputDemos } from "./sections/inputs.tsx"
import type { ComponentChildren } from "preact"

/**
 * Value exports of `@preact-components/ui` that are helpers, not components.
 *
 * Spelled out so `ComponentName` can be derived from the module instead of maintained by hand.
 * `registry.test.ts` fails if this list and the module ever disagree.
 */
export const HELPER_EXPORTS = ["buttonClasses", "clampConfidence"] as const

/** A helper export: callable, but nothing to demonstrate on its own. */
export type HelperExport = (typeof HELPER_EXPORTS)[number]

/**
 * Every component `@preact-components/ui` exports, derived from the module itself.
 *
 * A rename or a removal in `ui/` changes this union, and every type below is written over it.
 */
export type ComponentName = Exclude<keyof typeof ui, HelperExport>

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

/** The complete registry: one demo per exported component. */
export type DemoRegistry = Record<ComponentName, Demo>

/** A registry that may still be short an entry, which is what {@link missingDemos} reports on. */
export type PartialDemoRegistry = Partial<DemoRegistry>

/**
 * Every value export of the `ui` barrel, split into components and helpers.
 *
 * Read from the module namespace at load time, so this is the runtime counterpart of
 * {@link ComponentName} and cannot fall behind it.
 */
function readExportNames(): { components: ComponentName[]; helpers: HelperExport[] } {
  const helpers = new Set<string>(HELPER_EXPORTS)
  const exported = Object.keys(ui)
  return {
    components: exported.filter((name) => !helpers.has(name)) as ComponentName[],
    helpers: exported.filter((name) => helpers.has(name)) as HelperExport[],
  }
}

const exportNames = readExportNames()

/** Component names in module order — what the catalogue counts itself against. */
export const componentNames: ComponentName[] = exportNames.components

/** Helper exports actually present on the barrel; a stale entry in the list shows up here. */
export const helperExportNames: HelperExport[] = exportNames.helpers

/**
 * The sections of the catalogue, in render order.
 *
 * Declaration order is reading order. Each fragment is keyed by the components it documents.
 */
const catalogue = {
  badges: badgeDemos,
  buttons: buttonDemos,
  display: displayDemos,
  feedback: feedbackDemos,
  inputs: inputDemos,
} as const

/** Identifier of a catalogue section. */
export type SectionId = keyof typeof catalogue

/** Heading and blurb shown above a section's demos. */
export interface SectionInfo {
  title: string
  blurb: string
}

/** Section copy. Annotated with `Record<SectionId, …>`, so a new section cannot ship headless. */
export const sectionInfo: Record<SectionId, SectionInfo> = {
  badges: {
    title: "Badges",
    blurb: "Every palette entry, filled and outlined.",
  },
  buttons: {
    title: "Buttons",
    blurb:
      "Variants × sizes, plus the two components that wrap a button around a side effect (clipboard, geolocation).",
  },
  display: {
    title: "Display",
    blurb: "Headings, meters and the table shell.",
  },
  feedback: {
    title: "Feedback",
    blurb:
      "Loading, error and toast surfaces. The overlay-style ones are pinned inside a box here.",
  },
  inputs: {
    title: "Inputs",
    blurb: "Controlled switches and the dropdown trigger-panel pair.",
  },
}

/** One rendered section: its identity, its copy, and the components it documents. */
export interface CatalogueSection extends SectionInfo {
  id: SectionId
  /** Components this section documents, in render order. */
  names: ComponentName[]
}

/** The sections in render order, resolved against {@link sectionInfo}. */
export const catalogueSections: CatalogueSection[] = (Object.keys(sectionInfo) as SectionId[]).map(
  (id) => ({
    id,
    ...sectionInfo[id],
    // A section's own fragment is a `Record` over the subset of `ComponentName` it documents, so
    // its keys are component names by construction; `Object.keys` is what widens them to `string`.
    names: Object.keys(catalogue[id]) as ComponentName[],
  }),
)

/** Every component name the sections register a demo for. */
type CoveredName = {
  [Section in SectionId]: keyof (typeof catalogue)[Section]
}[SectionId]

/** Components the `ui` package exports with no demo anywhere. */
type Uncovered = Exclude<ComponentName, CoveredName>

/** Demo keys that are not exports of the `ui` package. */
type Unexpected = Exclude<CoveredName, ComponentName>

/**
 * The drift report.
 *
 * `true` when the registry matches the package exactly. Written as a conditional type rather than
 * a `Record` annotation so the failure names the offending component instead of reporting a
 * missing property on an anonymous object.
 */
export type DriftReport = [Uncovered] extends [never]
  ? ([Unexpected] extends [never] ? true : { unexpectedDemo: Unexpected })
  : { missingDemo: Uncovered }

/** `true` in a healthy tree; `registry.test.ts` asserts it, and the type is the real guard. */
export const registryDrift: DriftReport = true

/**
 * The flat registry the catalogue renders from: one entry per component, all sections merged.
 *
 * Annotated over {@link ComponentName}, so a component the sections forgot is a missing property.
 */
export const demoRegistry: DemoRegistry = {
  ...badgeDemos,
  ...buttonDemos,
  ...displayDemos,
  ...feedbackDemos,
  ...inputDemos,
}

/**
 * Exported components with no demo entry.
 *
 * An exhaustive registry returns an empty list and the catalogue renders no warning; a partial one
 * is named loudly in the guide instead of quietly shrinking it. Takes the registry as an argument
 * so the missing path can be tested with a registry that is missing something.
 *
 * @param registry Registry to check, complete or not.
 * @returns The names of the exported components it does not cover, in module order.
 */
export function missingDemos(registry: PartialDemoRegistry): ComponentName[] {
  return componentNames.filter((name) => !(name in registry))
}

/**
 * The registry's entries in module order, with the demo of every name it actually covers.
 *
 * @param registry Registry to read, complete or not.
 * @returns `[name, demo]` pairs; names with no entry are left out.
 */
export function demoEntries(registry: PartialDemoRegistry): Array<[ComponentName, Demo]> {
  return componentNames.flatMap((name) => {
    const demo = registry[name]
    return demo ? [[name, demo] as [ComponentName, Demo]] : []
  })
}
