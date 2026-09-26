/**
 * Example cards: how the guide shows an export that renders nothing — a function, a constant, a
 * label map.
 *
 * A component card shows the component. An example card shows code and what that code returns,
 * computed by running the real export when the card renders, so the output on the page cannot
 * drift from what the library does. One example may cover several related exports; `covers` names
 * them, and `coverage.ts` counts those names as covered.
 */

import { untracked } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import type { Demo, DemoProp } from "./registry.ts"

/** One example, as a section writes it. */
export interface Example {
  /** Card heading, e.g. `"cn()"`. */
  title: string
  /** One plain sentence on what the export is for, in inline Markdown (`markdown.tsx`). */
  summary: string
  /** The description as JSX, shown instead of {@link Example.summary}: see `Demo.description`. */
  description?: ComponentChildren
  /**
   * `true` for a card that takes the content column's full width (a long output), `false` for one
   * that shares a row. Left out, an example card shares a row. See `Demo.wide`.
   */
  wide?: boolean
  /** A props or options summary under the output: see `Demo.props`. */
  props?: readonly DemoProp[]
  /** The code a reader copies: the same calls {@link Example.run} makes. */
  snippet: string
  /** Every export the example demonstrates, as its package exports it; at least one. */
  covers: readonly [string, ...string[]]
  /**
   * Calls the real export and returns what the card prints as its output. It runs once per render
   * of the card's output, so it may call hooks; its signal reads are untracked (see
   * {@link toExampleDemos}).
   */
  run: () => unknown
}

/** A section's examples, keyed by card id: the card renders as `id="demo-<key>"`. */
export type ExampleFragment = Record<string, Example>

/** An example resolved into the registry's card shape: its heading, its covered names and `run`. */
export interface ExampleDemo extends Demo {
  title: string
  covers: readonly [string, ...string[]]
  /** The example's own `run`, kept so a test can read which exports it calls. */
  run: () => unknown
}

/**
 * Prints a value the way a reader expects to see a result: JSON, with the values JSON drops spelled
 * out instead of lost.
 *
 * `undefined`, functions, `bigint`, `Map` and `Set` have no JSON form; each is printed as a short
 * tag so an example returning one still shows something true.
 *
 * @param value What an example's `run` returned.
 * @returns The text the card prints.
 */
export function formatOutput(value: unknown): string {
  const tagged = (_key: string, item: unknown): unknown => {
    if (item === undefined) return "<undefined>"
    if (typeof item === "function") return `<function ${item.name || "anonymous"}>`
    if (typeof item === "bigint") return `${item}n`
    if (item instanceof Map) return Object.fromEntries(item)
    if (item instanceof Set) return [...item]
    return item
  }
  return JSON.stringify(value, tagged, 2)
}

/**
 * Turns a section's examples into registry cards whose live part is the output of running them.
 *
 * `run` is called inside the card's render, so it runs on the server render and again in the
 * browser, never at import time. Being inside a render, it may call hooks. It is called inside
 * `untracked`, and so is the formatting of what it returns, which may itself be a signal:
 * otherwise the card would subscribe to every signal `run` reads, a write to one of them would
 * render the card again, `run` would build fresh signals and write them again, and in the browser
 * the page would never finish loading.
 *
 * @param examples The section's examples.
 * @returns One card per example, keyed as given.
 */
export function toExampleDemos(examples: ExampleFragment): Record<string, ExampleDemo> {
  return Object.fromEntries(
    Object.entries(examples).map(([key, example]) => [key, {
      title: example.title,
      summary: example.summary,
      description: example.description,
      wide: example.wide,
      props: example.props,
      snippet: example.snippet,
      covers: example.covers,
      run: example.run,
      render: () => <ExampleOutput run={example.run} />,
    }]),
  )
}

/** The output block of an example card: what `run` returned, formatted. */
function ExampleOutput({ run }: { run: () => unknown }): JSX.Element {
  return (
    <figure>
      <figcaption class="mb-1 text-xs text-gray-500 dark:text-gray-400">Output</figcaption>
      <pre
        data-e2e="example-output"
        class="overflow-x-auto font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere] text-gray-900 dark:text-gray-100"
      ><code>{untracked(() => formatOutput(run()))}</code></pre>
    </figure>
  )
}
