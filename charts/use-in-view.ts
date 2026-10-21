/** Options of {@link createInViewObserver}. */
export interface InViewOptions {
  /** How far ahead of the viewport the element counts as visible. Defaults to `"200px"`. */
  rootMargin?: string
  /** Visible ratio required to count. Defaults to `0`. */
  threshold?: number
}

/** Handle returned by {@link createInViewObserver}. */
export interface InViewHandle {
  disconnect: () => void
}

/**
 * Observe one element and report intersection changes.
 *
 * The default `rootMargin` of 200px starts the work before the element is actually visible, so a
 * lazy chart or fetch is ready when the reader arrives. Returns `null` when
 * `IntersectionObserver` is unavailable, which is what keeps a server render from touching the DOM;
 * call it in an effect and `disconnect()` the handle in that effect's cleanup.
 */
export function createInViewObserver(
  element: Element,
  onChange: (isIntersecting: boolean) => void,
  options: InViewOptions = {},
): InViewHandle | null {
  if (typeof IntersectionObserver === "undefined") return null

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) onChange(entry.isIntersecting)
    },
    { rootMargin: options.rootMargin ?? "200px", threshold: options.threshold ?? 0 },
  )

  observer.observe(element)
  return { disconnect: () => observer.disconnect() }
}
