/**
 * The tile provider the guide's Map card draws with.
 *
 * `Map` takes its tiles from the app, so the card has to name a provider. The guide uses
 * OpenStreetMap's standard tiles, with the credit line their policy requires. A host that mounts
 * the guide can hand it another provider through `UIGuide`'s `mapTiles` prop: its own tile server,
 * or, as the demo site's browser checks do, a local image that keeps the run off the network.
 */

import { createContext } from "preact"

/** A tile provider: its URL template and the credit line it requires. */
export interface MapTiles {
  /** URL template with `{z}`, `{x}` and `{y}`, or one image Leaflet requests for every tile. */
  url: string
  /** The credit line the provider requires, shown as plain text. */
  attribution: string
}

/** OpenStreetMap's standard tile layer, and its required credit line. */
export const OPENSTREETMAP_TILES: MapTiles = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
}

/** What the shell hands the Map card: the host's provider, or {@link OPENSTREETMAP_TILES}. */
export const MapTilesContext = createContext<MapTiles>(OPENSTREETMAP_TILES)
