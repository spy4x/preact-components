/**
 * A page that renders `Map` on the server and hydrates it in the browser, outside the catalogue.
 *
 * `Map` is published as server-renderable: its box, credit line and list of places are in the
 * served markup, and Leaflet mounts into that box once the component hydrates. The catalogue cannot
 * show this any more, because it reaches `Map` through a lazy loader (`ui-guide/sections/
 * map-leaflet.tsx`) and so renders only a placeholder on the server. This page imports `Map`
 * directly: `pages/build.ts` prerenders {@link MapPage} into `map-demo/index.html` and bundles
 * `./+main.tsx`, which hydrates the same component, and `pages/checks/map.ts` proves Leaflet mounts
 * into the very box the server rendered.
 *
 * It lives in `map-demo/`, beside the local tile the catalogue's Map card already uses, so it loads
 * nothing from past the preview server either.
 */

import { Map } from "@spy4x/preact-map"
import type { MapMarker } from "@spy4x/preact-map"
import { useEffect } from "preact/hooks"
import type { JSX } from "preact"
import { renderToString } from "preact-render-to-string"

/** The places the page shows; `pages/checks/map.ts` counts its pins against this list. */
export const MAP_PAGE_MARKERS: MapMarker[] = [
  { id: "north", lat: 53.5, lng: 10, label: "Northern stop", status: "on" },
  { id: "centre", lat: 50, lng: 8.7, label: "Central stop", status: "off" },
  { id: "south", lat: 48.1, lng: 11.6, label: "Southern stop" },
]

/**
 * The global the page's inline script sets to the box the server rendered, before the island runs.
 * The check reads it back: if hydration had replaced the box with a new element, this one would be
 * detached, and Leaflet would not be inside it.
 */
export const SERVED_BOX_GLOBAL = "servedMapBox"

/** The hydrated part of the page: one `Map`, and the boot marker the check waits for. */
export function MapPage(): JSX.Element {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true"
  }, [])

  return (
    <Map
      center={{ lat: 51, lng: 10 }}
      zoom={5}
      markers={MAP_PAGE_MARKERS}
      onMarkerClick={() => {}}
      tileUrl="tile.png"
      attribution="© Example tile provider"
      label="Server-rendered map"
    />
  )
}

/** What {@link renderMapPage} needs from the build. */
export interface MapPageOptions {
  /** Href of the compiled stylesheet, already base-prefixed. */
  cssHref: string
  /** Src of this page's island, already base-prefixed. */
  islandSrc: string
}

/**
 * Render the whole `map-demo/index.html`.
 *
 * @param options See {@link MapPageOptions}.
 * @returns The document.
 */
export function renderMapPage({ cssHref, islandSrc }: MapPageOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Map, rendered on the server</title>
    <link rel="stylesheet" href="${cssHref}">
  </head>
  <body class="theme-base">
    <main class="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 class="text-lg font-semibold">Map, rendered on the server</h1>
      <p class="text-sm">
        The box and the list below are in the served HTML; Leaflet draws the map into the box once
        the page hydrates.
      </p>
      <div id="root">${renderToString(<MapPage />)}</div>
    </main>
    <script>
      globalThis.${SERVED_BOX_GLOBAL} = document.querySelector('[data-e2e="map-box"]')
    </script>
    <script type="module" src="${islandSrc}"></script>
  </body>
</html>
`
}
