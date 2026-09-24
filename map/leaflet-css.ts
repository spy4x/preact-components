/**
 * Leaflet's own stylesheet (`leaflet/dist/leaflet.css`), read from the exact npm package this
 * workspace member pins. Not re-exported from `@preact-components/map`'s main barrel (`+index.ts`):
 * `Deno.readTextFile` is Deno-only, and the main barrel has to stay usable wherever the `Map`
 * component itself can run. A published entry point that only a Deno build ever imports is what this
 * subpath is for — see `map/README.md` → "Leaflet's stylesheet" for the two routes a consumer
 * chooses between, and why this one exists at all next to the simpler "add `leaflet` yourself" route
 * `charts/README.md` already documents for `d3`.
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
