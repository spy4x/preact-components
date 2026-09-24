/**
 * Leaflet's own stylesheet (`leaflet/dist/leaflet.css`), read from the exact npm package this
 * workspace member pins.
 *
 * **Not published.** `map/deno.json` excludes this file (`publish.exclude`) and does not list it in
 * `exports`. `import.meta.resolve("leaflet/dist/leaflet.css")` carries no dependency record a
 * published consumer's own module resolver can follow — `deno info --json` on this file shows
 * `"dependencies": null` for that call — so a consumer who imported this as a published subpath
 * would get a function that throws `TypeError: Import "leaflet/dist/leaflet.css" not a dependency`
 * the moment they called it, regardless of what their own `deno.json` declared. This file exists only
 * for `pages/build.ts`, in this same repository, to import by a relative path; every other consumer's
 * route is documented in `map/README.md` → "Leaflet's stylesheet", and it does not involve this file.
 */

/**
 * Read Leaflet's stylesheet.
 *
 * `import.meta.resolve` follows this package's own `leaflet/` import-map entry — the trailing-slash
 * pin in `map/deno.json` — to the exact file inside Deno's npm cache, so the bytes returned are
 * always the ones the pinned `leaflet` version ships, never a copy this package carries or could
 * drift from it. `import.meta.resolve` returns a `file:` URL as a **string**, and
 * `Deno.readTextFile` does not parse a string that merely looks like a URL — passed one, it reads a
 * literal (nonexistent) path named after it instead, and fails with `NotFound` rather than a
 * type error. Wrapping it in `new URL(...)` is what makes it a URL Deno actually resolves.
 *
 * @returns Leaflet's `dist/leaflet.css`, verbatim.
 */
export async function leafletStylesheet(): Promise<string> {
  return await Deno.readTextFile(new URL(import.meta.resolve("leaflet/dist/leaflet.css")))
}
