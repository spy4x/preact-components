/**
 * The address's fragment as the guide's `hash` prop wants it, for a host that routes by the hash.
 */

import { useEffect, useState } from "preact/hooks"

/**
 * `location.hash`, re-read on every `hashchange`.
 *
 * `undefined` until the first effect runs, which is what keeps a server render and the first client
 * render the same tree: the server has no `location`, so both render the guide's `all` page, and
 * the effect then hands the guide the route the address actually names.
 *
 * ```tsx
 * <UIGuide hash={useLocationHash()} />
 * ```
 *
 * @param initialHash What to answer before the first read. Only a server render that wants one
 * page's markup passes it; a browser leaves it out.
 * @returns The current hash, or `undefined` before the first read.
 */
export function useLocationHash(initialHash?: string): string | undefined {
  const [hash, setHash] = useState<string | undefined>(initialHash)

  useEffect(() => {
    const read = () => setHash(location.hash)
    read()
    globalThis.addEventListener("hashchange", read)
    return () => globalThis.removeEventListener("hashchange", read)
  }, [])

  return hash
}
