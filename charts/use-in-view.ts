import type { RefObject } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"

export interface InViewOptions {
  /** How far ahead of the viewport the element counts as visible. Defaults to `"200px"`. */
  rootMargin?: string
  /** Visible ratio required to count. Defaults to `0`. */
  threshold?: number
  /** Stop observing after the first intersection. Defaults to `true`. */
  once?: boolean
}

/** Handle returned by {@link createInViewObserver}. */
export interface InViewHandle {
  disconnect: () => void
}

/**
 * Observe one element and report intersection changes.
 *
 * Split out of {@link useInView} so the observer wiring — the preload margin, the threshold and the
 * cleanup — is testable with a fake `IntersectionObserver` rather than a real browser. Returns
 * `null` when `IntersectionObserver` is unavailable, which is what keeps a server render from
 * touching the DOM.
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

/**
 * Report whether the element behind `ref` has scrolled into view.
 *
 * The pagination and chart-deferral hook from a source application: the default `rootMargin` of 200px starts the
 * work before the element is actually visible, and with `once` (the default) the observer stops
 * after the first hit so a lazy fetch happens exactly once. Server-safe — with no
 * `IntersectionObserver` the effect is a no-op and `inView` stays `false` until hydration.
 *
 * Name the element type so the ref fits the tag it is attached to:
 *
 * ```tsx
 * const { ref, inView } = useInView<HTMLDivElement>()
 * return <div ref={ref}>{inView ? <Chart /> : null}</div>
 * ```
 */
export function useInView<T extends Element = Element>(
  options: InViewOptions = {},
): { ref: RefObject<T>; inView: boolean } {
  const { rootMargin = "200px", threshold = 0, once = true } = options
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let handle: InViewHandle | null = null
    handle = createInViewObserver(element, (isIntersecting) => {
      if (isIntersecting) setInView(true)
      else if (!once) setInView(false)
      if (isIntersecting && once) handle?.disconnect()
    }, { rootMargin, threshold })

    return () => handle?.disconnect()
  }, [rootMargin, threshold, once])

  return { ref, inView }
}
