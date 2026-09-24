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
 * `<` becomes `<`, which is what keeps a value containing the literal text `</script>` from
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
 */
export function stateInitText(data: unknown): string {
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

/** The one thing {@link readStateInit} needs from `document` — a seam a test can fake without a DOM. */
export interface StateInitSourceLike {
  getElementById(id: string): { textContent: string | null } | null
}

/**
 * Read back the value a {@link StateInit} with the same `id` wrote into this page.
 *
 * `undefined` covers every way there is nothing to read: no element with this `id`, an element with
 * no text content, or text that is not valid JSON — a page that was never given a `StateInit` at
 * all reads the same as one whose script tag id was misspelled, rather than throwing either way.
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
  const text = source.getElementById(id)?.textContent
  if (!text) return undefined
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}
