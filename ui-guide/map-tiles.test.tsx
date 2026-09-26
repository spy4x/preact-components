import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { MapProps } from "@spy4x/preact-map"
import { options } from "preact"
import { render } from "preact-render-to-string"
import { UIGuide } from "./+index.tsx"
import { type MapTiles, OPENSTREETMAP_TILES } from "./map-tiles.ts"
import { LazyMap } from "./sections/map-leaflet.tsx"

/**
 * The tiles the Map card hands `Map`, read off the element tree: the card renders a placeholder on
 * the server, so its props are what a test can see.
 *
 * @param mapTiles The provider to hand the guide, or none.
 */
function mapCardTiles(mapTiles?: MapTiles): Array<Pick<MapProps, "tileUrl" | "attribution">> {
  const seen: Array<Pick<MapProps, "tileUrl" | "attribution">> = []
  const previous = options.vnode
  options.vnode = (vnode) => {
    if (vnode.type === LazyMap) {
      const { tileUrl, attribution } = vnode.props as unknown as MapProps
      seen.push({ tileUrl, attribution })
    }
    previous?.(vnode)
  }
  try {
    render(<UIGuide hash="#/map" mapTiles={mapTiles} />)
  } finally {
    options.vnode = previous
  }
  return seen
}

describe("the Map card's tiles", () => {
  it("draw OpenStreetMap's tiles with their credit line by default", () => {
    expect(mapCardTiles()).toEqual([
      {
        tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "© OpenStreetMap contributors",
      },
    ])
    expect(OPENSTREETMAP_TILES.url).toContain("{z}/{x}/{y}")
  })

  it("come from the host when it passes a provider", () => {
    const local = { url: "map-demo/tile.png", attribution: "© Local tile" }

    expect(mapCardTiles(local)).toEqual([{ tileUrl: local.url, attribution: local.attribution }])
  })
})
