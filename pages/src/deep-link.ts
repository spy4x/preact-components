/**
 * Deep links into the catalogue.
 *
 * The catalogue renders one card per component as `id="demo-<Name>"`; the deployed page owns the
 * URL shape on top of that. It uses a **fragment** rather than a path because GitHub Pages serves
 * files only — `/preact-components/badge` would be a 404, there is no rewrite rule that could
 * point it at `index.html`. A fragment also survives a move to a custom domain.
 *
 * `uiGuideRoute.path` (`/ui-guide`) is deliberately not used: it is a descriptor an app registers
 * in its own router, and this page is the app. The public URL is `/preact-components/`.
 *
 * Pure functions, no DOM: the host page owns the scrolling, these own the mapping.
 */

/** The catalogue's card id for a component: what {@link demoElementId} produces. */
export function demoElementId(name: string): string {
  return `demo-${name}`
}

/**
 * URL slug of a component: `ToggleSwitch` becomes `toggle-switch`.
 *
 * Every component `ui/` exports is camel-cased from words, so splitting on a lower-to-upper
 * boundary is enough; an acronym would need its own rule and there is none.
 *
 * @param name Component export name.
 * @returns The slug the navigation links to.
 */
export function demoSlug(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Resolve a URL fragment to the component it points at.
 *
 * Accepts what people paste and what the page itself writes: the slug (`#toggle-switch`), the
 * export name (`#ToggleSwitch`), and the card's own id (`#demo-ToggleSwitch`), in any case.
 *
 * @param fragment Raw fragment, with or without the leading `#`.
 * @param names Component names to resolve against, normally the `ui` barrel's.
 * @returns The canonical name, or `undefined` when the fragment points somewhere else.
 */
export function componentFromFragment<Name extends string>(
  fragment: string,
  names: readonly Name[],
): Name | undefined {
  const trimmed = decodeFragment(fragment).replace(/^demo-/, "").toLowerCase()
  if (!trimmed) return undefined

  return names.find((name) => name.toLowerCase() === trimmed || demoSlug(name) === trimmed)
}

/** Strip the `#`, undo percent-encoding, and drop surrounding whitespace. */
function decodeFragment(fragment: string): string {
  const trimmed = fragment.trim()
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed
  try {
    return decodeURIComponent(raw).trim()
  } catch {
    // A malformed escape is not a component name either way.
    return raw.trim()
  }
}

/**
 * Absolute URL of one demo, for a link that can be pasted into an issue.
 *
 * @param origin Absolute origin the page is served from, e.g. `https://spy4x.github.io`.
 * @param base Path the site is mounted at, with a leading and trailing slash.
 * @param name Component export name.
 * @returns The shareable deep link.
 */
export function demoUrl(origin: string, base: string, name: string): string {
  return `${origin}${base}#${demoSlug(name)}`
}
