/**
 * `StateInit` — a generic SSR→client hydration bridge: the server writes one JSON value into the
 * page, and the browser reads it back with {@link readStateInit}. Which keys the value holds is the
 * app's business; this file knows nothing about them.
 *
 * The source applications' own versions of this each hard-coded that app's env keys directly into
 * the component (see `system/README.md`'s "Not in this package" table), which is exactly what made
 * neither portable. This one carries an opaque value instead.
 */

import type { JSX } from "preact"
import { jsonLdText } from "./seo-head.tsx"

/** `id` {@link StateInit} and {@link readStateInit} agree on when neither is given one. */
const DEFAULT_ID = "state-init"

export interface StateInitProps {
  /** The value to hand to the browser. Anything `JSON.stringify` can serialise. */
  data: unknown
  /**
   * `id` of the `<script>` element carrying it, and what {@link readStateInit} must be given to
   * find it again. Defaults to `"state-init"`; only worth changing when a page renders more than
   * one `StateInit`.
   */
  id?: string
}

/**
 * Serialise `data` for embedding inside {@link StateInit}'s `<script type="application/json">`.
 *
 * Reuses `seo-head.tsx`'s own `jsonLdText` rather than a second implementation of the same escape:
 * `<` becomes the six characters `\u003c`, which is what keeps a value containing the literal text `</script>` from
 * closing the element it is embedded in — the HTML parser looks for that sequence case-insensitively
 * to end *any* `<script>`, whatever its `type`, before either JSON or JavaScript ever gets a look at
 * the content. `<!--` is a `<` too, so the same escape covers it.
 *
 * U+2028 and U+2029 need no escaping here the way they would if this value were embedded as
 * executable JavaScript (`window.x = {…}`) rather than JSON: `StateInit` renders a
 * `type="application/json"` element, which the browser never executes, and {@link readStateInit}
 * reads it back with `JSON.parse`, which has always accepted both characters inside a JSON string —
 * they only became a hazard for the *"raw JS expression"* shape of this pattern, which is not the
 * shape used here. `state-init.test.tsx` proves a value containing all three — `</script>`, `<!--`
 * and both separators — survives a round trip through this function and back through `JSON.parse`
 * unchanged, rather than assuming it from the reasoning above.
 *
 * **Throws when `data` is not JSON-serialisable, by name, rather than crashing inside `.replace`.**
 * `JSON.stringify` answers `undefined` — not a string, and not a thrown error — for `undefined`
 * itself, a function, or a `Symbol`, at the position this is called from (the top level, since
 * `StateInit` passes `data` straight through); calling `.replace` on that `undefined` inside
 * `jsonLdText` used to fail with a bare `TypeError` pointing at `seo-head.tsx`, naming neither
 * `StateInit` nor which of the three the caller passed. A `BigInt` anywhere in `data`, nested or
 * not, makes `JSON.stringify` throw its own `TypeError` directly, with the same problem: nothing in
 * the message says `StateInit` sent it there. Both are caught here and re-thrown naming this
 * component, before `jsonLdText` ever runs.
 */
export function stateInitText(data: unknown): string {
  let json: string | undefined
  try {
    json = JSON.stringify(data)
  } catch (cause) {
    throw new Error(
      "StateInit: data could not be serialised to JSON — it may contain a BigInt",
      { cause },
    )
  }
  if (json === undefined) {
    throw new TypeError(
      "StateInit: data must be JSON-serialisable — undefined, a function and a Symbol all " +
        "serialise to nothing",
    )
  }
  return jsonLdText(data)
}

/**
 * Write `data` into the page as JSON, for {@link readStateInit} to read back on the client.
 *
 * A `type="application/json"` script is never executed by the browser — unlike the classic
 * `<script>window.__STATE__ = {…}</script>` shape, there is no way for this element's content to
 * run as code, whatever it contains. Rendering it is the whole component: no state of its own, and
 * nothing touched outside this one render.
 */
export function StateInit({ data, id = DEFAULT_ID }: StateInitProps): JSX.Element {
  return (
    <script
      type="application/json"
      id={id}
      // The body is JSON `stateInitText` produced, with `<` escaped; see that function's own doc.
      dangerouslySetInnerHTML={{ __html: stateInitText(data) }}
    />
  )
}

/** One element, as {@link readStateInit} needs to see it — a seam a test can fake without a DOM. */
export interface StateInitElementLike {
  tagName: string
  getAttribute(name: string): string | null
  textContent: string | null
}

/** The one thing {@link readStateInit} needs from `document` — a seam a test can fake without a DOM. */
export interface StateInitSourceLike {
  getElementById(id: string): StateInitElementLike | null
}

/**
 * Read back the value a {@link StateInit} with the same `id` wrote into this page.
 *
 * **Only a `<script type="application/json">` with the given `id` is trusted.** `getElementById`
 * finds any element with a matching `id`, and this page's own `id` is not a namespace this component
 * controls — a route that renders a sanitised value from elsewhere into a `<div id="state-init">`
 * earlier in the page, entirely unrelated to this component, would otherwise have its `textContent`
 * parsed as this page's server state. Checking `tagName` and the `type` attribute rules out any
 * element a sanitiser lets through. It cannot rule out an injected `<script type="application/json">`
 * with the same `id` placed earlier in the page, since whoever can place one already has HTML
 * injection; a page that renders untrusted markup should render `StateInit` before it — in `<head>`
 * is simplest.
 *
 * `undefined` covers every way there is nothing to read: no element with this `id`, an element with
 * this `id` that is not `StateInit`'s own script, no text content, or text that is not valid JSON —
 * a page that was never given a `StateInit` at all reads the same as one whose script tag id was
 * misspelled, rather than throwing either way.
 *
 * `source` defaults to the real `document`, read only inside the call — never at module load, which
 * is what lets this file be imported, and this function called with a fake `source`, in a test that
 * has no DOM at all.
 *
 * @param id Must match the `id` the page's `StateInit` was rendered with. Defaults to `"state-init"`.
 */
export function readStateInit<T>(
  id = DEFAULT_ID,
  source: StateInitSourceLike = document,
): T | undefined {
  const element = source.getElementById(id)
  if (!element) return undefined
  if (element.tagName !== "SCRIPT" || element.getAttribute("type") !== "application/json") {
    return undefined
  }
  const text = element.textContent
  if (!text) return undefined
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}
