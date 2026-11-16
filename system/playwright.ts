/**
 * The Playwright options every app shares, re-exported from `@spy4x/preact-playwright`, so an app
 * that imports them from here keeps working. A new app imports that package instead: it has no
 * dependencies, while this one brings the whole `@spy4x/preact-system` tree with it.
 *
 * @module
 */

export {
  type PlaywrightBaseConfig,
  playwrightBaseConfig,
  type PlaywrightBaseOptions,
  type PlaywrightBaseUse,
  type PlaywrightReporter,
} from "@spy4x/preact-playwright"
