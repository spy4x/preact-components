/** @jsxImportSource preact */
/** @jsxRuntime automatic */

import { useMemo } from "preact/hooks"
import { Signal } from "@preact/signals"
import { JSX } from "preact"

/**
 * `@preact-components/signals/+signals` — `<For>`, `<Show>` and `Signal.prototype.map`.
 *
 * Provenance: written in `spy4x/template/libs/client/preact/+signals.tsx`, copied into
 * `warthunder-stats` with a JSDoc note saying so. This is that copy, so the file is not forked a
 * third time, with two corrections:
 *
 * - `each` accepts a missing array, which is what the `fallback` in the body was always for.
 * - `Signal.prototype.map` is declared against the array's *element* type. Both earlier copies
 *   declared `fn: (value: T) => JSX.Element` against `Signal<T>`, so `signal([1, 2]).map(…)` typed
 *   the callback as receiving `number[]` while the runtime passed it a `number`.
 *
 * ⚠️ Importing this module patches `Signal.prototype`. The patch is a side effect of the import,
 * exactly as in both source repos.
 */

const Item = (
  { v, k, f }: { v: unknown; k: number; f: (v: unknown, k: number) => JSX.Element },
): JSX.Element => f(v, k)

/**
 * Render a signal's array, caching each rendered item by its element reference.
 *
 * Re-rendering the list keeps the DOM node of every element the signal still holds by reference, so
 * an append does not remount the rows above it. Change an element's identity and it re-renders;
 * mutate one in place and nothing happens — the same contract signals have everywhere else.
 *
 * `fallback` covers an *absent* array (`null`/`undefined`), not an empty one: an empty array renders
 * nothing at all, so an empty-state placeholder belongs beside a `length` check or in `<Show>`.
 */
export function For(
  { each, children: f, fallback }: {
    each: Signal<unknown[] | null | undefined>
    children: (v: unknown, k: number) => JSX.Element
    fallback?: JSX.Element
  },
) {
  const c = useMemo(() => new Map(), [])
  const value = each.value
  return value?.map((v, k) =>
    c.get(v) || (c.set(v, <Item key={k} v={v} k={k} f={f} />), c.get(v))
  ) ?? fallback
}

/**
 * Render `children` when the signal's value is truthy, `fallback` otherwise.
 *
 * `children` may be a function of the value, which is how a non-array signal gets narrowed inside
 * the JSX.
 */
export function Show(
  { when, fallback, children: f }: {
    when: Signal<unknown>
    fallback?: JSX.Element
    children: ((v: unknown) => JSX.Element) | JSX.Element
  },
) {
  const v = when.value
  return v ? typeof f === "function" ? <Item v={v} k={0} f={f} /> : f : fallback
}

// `Array.prototype.map`'s shape is the reason for the explicit `this`: the callback receives one
// element of the array the signal holds, not the array itself.
declare module "@preact/signals" {
  interface Signal<T> {
    map<U>(this: Signal<U[]>, fn: (value: U) => JSX.Element): JSX.Element
  }
  interface ReadonlySignal<T> {
    map<U>(this: ReadonlySignal<U[]>, fn: (value: U) => JSX.Element): JSX.Element
  }
}

Signal.prototype.map = function <T,>(this: Signal<T[]>, fn: (value: T) => JSX.Element) {
  return <For each={this}>{(v: unknown) => fn(v as T)}</For>
}
