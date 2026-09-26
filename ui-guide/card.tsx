/**
 * One catalogue card, and the banner a partial registry shows.
 *
 * The shell (`shell.tsx`) lays these out a page at a time; a card is the same wherever it lands, and
 * its `id="demo-<Name>"` is what every deep link and every browser check addresses.
 */

import { cn } from "@spy4x/preact-cn"
import { IconChevronRight } from "@spy4x/preact-icons"
import { CopyButton } from "@spy4x/preact-ui"
import type { ComponentChildren, JSX } from "preact"
import { InlineMarkdown } from "./markdown.tsx"
import type { DemoProp } from "./registry.ts"

/** Every word a card prints of its own. Each has an English default ({@link DEFAULT_CARD_LABELS}). */
export interface DemoCardLabels {
  /** The code row's disclosure. Defaults to `"Code"`. */
  code: string
  /** The props summary's caption. Defaults to `"Props"`. */
  props: string
  /** The accessible name of a class card's list of classes. Defaults to `"Classes"`. */
  classes: string
  /** The props summary's first column, for a screen reader. Defaults to `"Prop"`. */
  propName: string
  /** The props summary's second column. Defaults to `"Type and default"`. */
  propType: string
  /** The props summary's third column. Defaults to `"What it does"`. */
  propDescription: string
  /** The copy control's name. Defaults to `"Copy the <label> snippet"`. */
  copySnippet: (label: string) => string
}

/** The card's English words. */
export const DEFAULT_CARD_LABELS: DemoCardLabels = {
  code: "Code",
  props: "Props",
  classes: "Classes",
  propName: "Prop",
  propType: "Type and default",
  propDescription: "What it does",
  copySnippet: (label) => `Copy the ${label} snippet`,
}

/** Props of one catalogue card: its identity, the port, and the live example as children. */
export interface DemoCardProps {
  /** Card id, and the name of the component for a component card. */
  name: string
  /**
   * The card's name as the copy control reads it: `<Name />` for a component card, the card's own
   * title for a class or an example card.
   */
  label: string
  /** The copy control's name. Defaults to `labels.copySnippet(label)`. */
  copyLabel?: string
  /** Overrides for the card's own words. */
  labels?: Partial<DemoCardLabels>
  /** The visible heading. Defaults to {@link DemoCardProps.label}; a component card passes its name. */
  title?: string
  /** One plain sentence on what it is for, in inline Markdown (`markdown.tsx`). */
  summary: string
  /** The description as JSX, shown instead of {@link DemoCardProps.summary}. */
  description?: ComponentChildren
  /** The JSX the code block prints and the copy button puts on the clipboard. */
  snippet: string
  /** Classes the card applies; a class card renders them as chips. */
  classes?: string[]
  /** Show the code open: an example card's code is its content, not a detail. */
  usageOpen?: boolean
  /**
   * `true` for a card that takes the content column's full width, `false` for one that shares a
   * row, left out for a card whose section has not said (the grid then widens it when its demo
   * holds a table or a menu). Written to `data-card-size` as `wide`, `normal` or `auto`.
   */
  wide?: boolean
  /** The props summary under the demo. */
  props?: readonly DemoProp[]
  /**
   * The element id, `demo-<name>` by default. Only a card that is not a catalogue entry — the
   * overview's example — passes another, so it is not counted or addressed as one.
   */
  anchorId?: string
  /** Clipboard port, forwarded to the copy button. */
  copy?: (text: string) => void | Promise<void>
  /** Extra classes on the card: the shell's column span. */
  class?: string
  /** The live example. */
  children: ComponentChildren
}

/**
 * One demo: its name and one sentence, the live example on a quiet canvas, an optional props
 * summary, and the code behind it.
 *
 * The card is one surface. The demo's canvas is a band across it, the page's own colour showing
 * through, so there is never a bordered box inside a bordered box. The copy button is pinned to the
 * code row rather than put inside its `summary`: a button inside a summary toggles the disclosure as
 * well as copying, and the snippet has to be copyable without opening it. `copyLabel` is the
 * accessible name and the tooltip, so the control is not one of forty identical "Copy" buttons to a
 * screen reader.
 *
 * No hook runs here, so a test can call it as a function and read the tree it returns.
 *
 * @param props See {@link DemoCardProps}.
 */
export function DemoCard(
  {
    name,
    label,
    copyLabel,
    labels: labelOverrides,
    title,
    summary,
    description,
    snippet,
    classes,
    usageOpen,
    wide,
    props,
    anchorId,
    copy,
    class: className,
    children,
  }: DemoCardProps,
): JSX.Element {
  const labels = { ...DEFAULT_CARD_LABELS, ...labelOverrides }
  return (
    <article
      id={anchorId ?? `demo-${name}`}
      data-card-size={wide ? "wide" : wide === false ? "normal" : "auto"}
      class={cn(
        "flex min-w-0 scroll-mt-16 flex-col rounded-xl border border-gray-200 bg-white shadow-xs",
        "dark:border-gray-700/80 dark:bg-gray-800/60",
        // The deep-link mark the shell sets on the card a demo route names. The muted accent, not
        // the primary: in the dark palette the primary is near-black chrome no one can see.
        "data-[deep-link]:outline-2 data-[deep-link]:outline-offset-2",
        "data-[deep-link]:outline-(--color-primary-muted) data-[deep-link]:outline-solid",
        className,
      )}
    >
      <header class="flex flex-col gap-1 p-4 sm:p-6" data-card-part="header">
        <h3 class="text-base font-semibold [overflow-wrap:anywhere] text-gray-950 dark:text-gray-50">
          {title ?? label}
        </h3>
        {
          /* `anywhere`: a long identifier in a sentence wraps inside the card on a phone rather
          than pushing the card, and the page, wider than the screen. */
        }
        {
          /* A `div`, not a `p`: a JSX description may hold a list, and a list inside a paragraph
          is invalid HTML the browser repairs into a different tree than the one hydration meets. */
        }
        <div class="text-sm [overflow-wrap:anywhere] text-gray-600 dark:text-gray-300">
          {description ?? <InlineMarkdown text={summary} />}
        </div>
        {classes && classes.length > 0
          ? (
            <ul class="flex flex-wrap gap-1 pt-1" aria-label={labels.classes}>
              {classes.map((className) => (
                <li key={className}>
                  <code class="rounded-md bg-purple-50 px-1 font-mono text-xs text-purple-800 dark:bg-purple-950/60 dark:text-purple-200">
                    .{className}
                  </code>
                </li>
              ))}
            </ul>
          )
          : null}
      </header>
      <div
        data-card-part="demo"
        class={cn(
          "min-w-0 flex-1 border-y border-gray-200 bg-gray-50 p-4 sm:p-6",
          "dark:border-gray-700/80 dark:bg-gray-900/60",
          // A dot grid, the quiet canvas a demo sits on. A background, not a border: the demo is
          // never boxed twice.
          "bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-size-[16px_16px]",
        )}
      >
        {children}
      </div>
      {props && props.length > 0 ? <PropsSummary props={props} labels={labels} /> : null}
      <div class="relative" data-e2e="usage">
        <details class="group/code min-w-0" open={usageOpen}>
          <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-600 select-none hover:text-gray-950 sm:px-6 dark:text-gray-400 dark:hover:text-gray-50 [&::-webkit-details-marker]:hidden">
            <IconChevronRight class="size-4 shrink-0 transition-transform group-open/code:rotate-90" />
            {labels.code}
          </summary>
          <pre class="mx-4 mb-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-relaxed text-gray-100 sm:mx-6 sm:mb-6 dark:bg-black/40">
            <code>{snippet}</code>
          </pre>
        </details>
        <CopyButton
          textToCopy={snippet}
          copy={copy}
          copyLabel={copyLabel ?? labels.copySnippet(label)}
          class="absolute top-1 right-2 sm:right-4"
        />
      </div>
    </article>
  )
}

/** The props summary: one row per prop, its type, its default and one sentence. */
function PropsSummary(
  { props, labels }: { props: readonly DemoProp[]; labels: DemoCardLabels },
): JSX.Element {
  return (
    <div class="@container overflow-x-auto border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700/80">
      {
        /* Below 28rem of card width (a phone, or a half-width card at 1024 px) a row turns into a
        two-column grid: name and type on the first line, the sentence under them at full width, so
        the sentence never shrinks to a word per line. The name takes at most half the row, so a long
        one wraps rather than leaving its type no room; names and types wrap anywhere.
        `bg-transparent`: the preset paints a table in the dark palette with the surface colour
        (`theme/preset.css`, "Chrome the popup is painted by"), which would box the summary. */
      }
      <table class="w-full bg-transparent text-left text-sm">
        <caption class="pb-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {labels.props}
        </caption>
        <thead class="sr-only">
          <tr>
            <th scope="col">{labels.propName}</th>
            <th scope="col">{labels.propType}</th>
            <th scope="col">{labels.propDescription}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700/80">
          {props.map((prop) => (
            <tr
              key={prop.name}
              class="align-top @max-md:grid @max-md:grid-cols-[fit-content(50%)_minmax(0,1fr)]"
            >
              <th
                scope="row"
                class="py-2 pr-4 font-mono text-xs font-semibold [overflow-wrap:anywhere] text-gray-950 dark:text-gray-50"
              >
                {prop.name}
              </th>
              <td class="py-2 pr-4 font-mono text-xs [overflow-wrap:anywhere] text-purple-800 @max-md:pr-0 dark:text-purple-200">
                {prop.type}
                {prop.default === undefined
                  ? null
                  : <span class="block text-gray-500 dark:text-gray-400">= {prop.default}</span>}
              </td>
              <td class="py-2 text-gray-600 @max-md:col-span-2 @max-md:pt-0 dark:text-gray-300">
                <InlineMarkdown text={prop.description} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Banner listing components the catalogue means to demonstrate and this registry does not carry.
 *
 * A complete registry renders nothing, so a healthy catalogue never shows it. When the guide is
 * handed a partial registry the gap is stated at the top of the page rather than being invisible.
 */
export function MissingDemoBanner({ names }: { names: string[] }) {
  return (
    <div
      role="alert"
      data-e2e="ui-guide-missing-demos"
      class="rounded-lg border border-red-500 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
    >
      <p class="font-medium">
        {names.length} {names.length === 1 ? "card is" : "cards are"} missing from this registry
      </p>
      <p class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        The catalogue lists {names.length === 1 ? "it" : "them"}{" "}
        and the registry this guide was rendered with does not carry{" "}
        {names.length === 1 ? "it" : "them"}:{" "}
        {names.map((name) => <code key={name} class="font-mono">{name}</code>)}
      </p>
    </div>
  )
}
