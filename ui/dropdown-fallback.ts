// Not exported from the package: a detail of how `Dropdown` takes over its server markup.

/**
 * Reads how a server-rendered `<details>` fallback stood when the component took it over: whether
 * it was open, and whether its summary had focus. `undefined` when `element` is not a `<details>`.
 * It checks the tag name rather than `instanceof HTMLDetailsElement`, so a test DOM that
 * installs only `document` as a global (happy-dom used that way) does not throw.
 */
export function readFallback(
  element: Element | null | undefined,
  active: Element | null,
): { open: boolean; summaryFocused: boolean } | undefined {
  if (element?.localName !== "details") return undefined
  return {
    open: (element as HTMLDetailsElement).open,
    summaryFocused: active !== null && active === element.firstElementChild,
  }
}
