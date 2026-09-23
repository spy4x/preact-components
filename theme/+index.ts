/**
 * `@preact-components/theme` — TypeScript entry point.
 *
 * The design system itself is two plain CSS files, `tokens.css` and `preset.css` (see
 * `README.md`), and JSR refuses a CSS file as a package export: "Expected a JavaScript or
 * TypeScript module, but identified a Css module." The stylesheets therefore ship as ordinary
 * files inside the published package rather than as `deno.json` `exports` entries, and this
 * module is the one export the package has — the two constants below resolve to wherever the
 * package installer actually put those files, in the JSR cache or in `node_modules`, so a
 * consumer's own build step can find them without hard-coding a path into a dependency's
 * internals.
 *
 * `README.md` → "Install" says exactly how a Tailwind 4 build turns these into the two
 * `@import`s the design system needs.
 */

/** Resolved location of `tokens.css`, wherever this package is installed. */
export const TOKENS_CSS_URL: URL = new URL("./tokens.css", import.meta.url)

/** Resolved location of `preset.css`, wherever this package is installed. */
export const PRESET_CSS_URL: URL = new URL("./preset.css", import.meta.url)
