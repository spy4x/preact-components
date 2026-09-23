/**
 * `@preact-components/theme` — TypeScript entry point.
 *
 * The design system itself is two plain CSS files, `tokens.css` and `preset.css` (see
 * `README.md`), and JSR refuses a CSS file as a package export: "Expected a JavaScript or
 * TypeScript module, but identified a Css module." A JSR-installed copy of this package cannot be
 * read by a `file:` path either — `import.meta.url` inside a module served from the registry is
 * the registry's own `https:` address, not a location on disk, so there is no path a consumer
 * could resolve a sibling file against even if `exports` allowed pointing at one.
 *
 * The two stylesheets are exported as text instead. `TOKENS_CSS` and `PRESET_CSS` are generated
 * from `tokens.css`/`preset.css` by `generate.ts` (`deno task --cwd theme generate`), so the
 * shipped constant and the file it came from cannot drift apart by hand — `css-text.test.ts`
 * fails if they ever do. `README.md` → "Install" has the Tailwind 4 recipe that turns these two
 * strings into the compiled design system.
 */

export { PRESET_CSS } from "./preset-css.ts"
export { TOKENS_CSS } from "./tokens-css.ts"
