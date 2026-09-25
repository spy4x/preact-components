/**
 * What the deployed page is and where it is mounted.
 *
 * Shared by the browser bundle, the build and the verification script, so the base path and the
 * page's identity are written once. Dependency-free on purpose: this module ends up in the bundle.
 */

/** Where the library lives. Public URL, no token, no secret. */
export const REPOSITORY = "https://github.com/spy4x/preact-components"

/** The project-site subpath `actions/deploy-pages` serves this demo from. */
export const DEFAULT_BASE = "/preact-components/"

/** GitHub Pages' origin for the account that owns the repository. */
export const DEFAULT_ORIGIN = "https://spy4x.github.io"

/** Title of the deployed document; deep links rewrite it to `<Component> — <title>`. */
export const PAGE_TITLE = "preact-components — live UI guide"

/** Meta description, and the blurb the Open Graph card shows. */
export const PAGE_DESCRIPTION =
  "Live component demos from @spy4x/preact-* — ui, charts, system and crud — plus the " +
  "whole icon set: dropdowns open, toggles toggle, charts draw, icons are searchable and copyable."

/** Inline SVG favicon, so the page never requests a file that does not exist. */
export const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%233c1d95'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='system-ui,sans-serif' font-size='20' font-weight='700' fill='%23ffffff'%3Ep%3C/text%3E%3C/svg%3E"

/**
 * Normalise a base path to the shape every consumer here expects.
 *
 * @param value Base path, with or without leading and trailing slashes.
 * @returns The base with both, e.g. `/preact-components/`.
 */
export function normalizeBase(value: string): string {
  const withLeading = value.startsWith("/") ? value : `/${value}`
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`
}
