/**
 * One catalogue card, and the banner a partial registry shows.
 *
 * The shell (`shell.tsx`) lays these out a page at a time; a card is the same wherever it lands, and
 * its `id="demo-<Name>"` is what every deep link and every browser check addresses.
 */

import { CopyButton } from "@preact-components/ui"
import type { ComponentChildren, JSX } from "preact"
import { cn } from "@preact-components/cn"

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
      class={cn(
        "min-w-0 scroll-mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-xs",
        "dark:border-gray-700 dark:bg-gray-800",
        // The deep-link mark the shell sets on the card a demo route names. The muted accent, not
        // the primary: in the dark palette the primary is near-black chrome no one can see.
        "data-[deep-link]:outline-2 data-[deep-link]:outline-offset-2",
        "data-[deep-link]:outline-(--color-primary-muted) data-[deep-link]:outline-solid",
      )}
    >
      <h3 class="font-mono text-sm font-semibold [overflow-wrap:anywhere] text-purple-700 dark:text-purple-400">
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
      {
        /* `anywhere`: a long identifier in a summary wraps inside the card on a phone rather than
      pushing the card, and the page, wider than the screen. */
      }
      <p class="mt-1 mb-3 text-sm [overflow-wrap:anywhere] text-gray-600 dark:text-gray-300">
        {summary}
      </p>
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
        {names.map((name) => <code key={name} class="mr-1 font-mono">{name}</code>)}
      </p>
    </div>
  )
}
