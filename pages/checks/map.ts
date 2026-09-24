import { check, type Devtools, poll, pressKey } from "./harness.ts"

/** The card these checks drive, and the pieces of it they read. */
const CARD = "#demo-Map"
const LIST = CARD + ' [data-e2e="map-marker-list"]'
const LAST_CLICKED = CARD + ' [data-e2e="map-last-clicked"]'

/** `ui-guide/sections/map.tsx`'s `PLACES`, in the order the card renders them. */
const PLACE_LABELS = ["London depot", "Paris warehouse", "Berlin outpost"]

/** What one round trip reads off the page. */
interface MapState {
  /** `false` when the card itself was not found; every other field is then noise. */
  ok: boolean
  /** The box's own size, in CSS pixels, as rendered — read before Leaflet's tile pane is asked
   * about, so this is the size the server-sent markup gives it, not a size Leaflet computed. */
  box: { width: number; height: number }
  /** Whether the box carries the class this component always renders it with, server or client —
   * proof its size comes from static markup rather than a script that only runs after hydration. */
  boxCarriesSizeClass: boolean
  /** Whether a `.leaflet-container` exists inside the box yet. */
  leafletMounted: boolean
  /** `overflow` Leaflet's own stylesheet sets on `.leaflet-container` — `""` off a container that
   * does not exist, `"visible"` (the UA default) if `leaflet.css` never reached the page. */
  leafletContainerOverflow: string
  /** How many `.leaflet-tile-loaded` tiles are inside the box. */
  loadedTiles: number
  /** The `src` of one such tile, resolved to an absolute URL by the browser — `""` when there is
   * none yet. */
  oneTileSrc: string
  /** Whether every loaded tile's `src` shares the page's own origin. */
  allTilesLocal: boolean
  /** Whether every loaded tile's rectangle overlaps the box's — not full containment, since a tile
   * grid legitimately overhangs its container at the edges (see `readState`'s own `overlaps`). */
  tilesOverlapBox: boolean
  /** The attribution element's text, trimmed. */
  attributionText: string
  /** Whether the attribution element is actually visible: not `display: none`, a real size, and
   * inside the box's own rectangle. */
  attributionVisible: boolean
  /** Accessible names of the list's buttons, in DOM order. */
  listNames: string[]
  /** `tabIndex` of each list button — `0` (or unset, which reads `0` on a real `<button>`) is what
   * a real Tab stop needs; anything else would mean this package pulled a button out of the tab
   * order by accident. */
  listTabIndexes: number[]
  /** The echo element's text. */
  lastClicked: string
}

/** Read everything these checks assert on, in one round trip. */
function readState(devtools: Devtools): Promise<MapState> {
  return devtools.evaluate<MapState>(`(() => {
    const card = document.querySelector('${CARD}')
    if (!card) {
      return {
        ok: false, box: { width: 0, height: 0 }, boxCarriesSizeClass: false,
        leafletMounted: false, leafletContainerOverflow: "", loadedTiles: 0, oneTileSrc: "",
        allTilesLocal: false, tilesOverlapBox: false, attributionText: "", attributionVisible: false,
        listNames: [], listTabIndexes: [], lastClicked: "",
      }
    }

    const box = card.querySelector('[data-e2e="map-box"]')
    const boxRect = box ? box.getBoundingClientRect() : null
    const leafletContainer = box ? box.querySelector(".leaflet-container") : null
    const tiles = box ? [...box.querySelectorAll(".leaflet-tile-loaded")] : []
    const attribution = card.querySelector('[data-e2e="map-attribution"]')
    const attrRect = attribution ? attribution.getBoundingClientRect() : null
    const attrStyle = attribution ? getComputedStyle(attribution) : null
    const listButtons = [...card.querySelectorAll('[data-e2e="map-marker-list"] li button')]
    const lastClicked = card.querySelector('[data-e2e="map-last-clicked"]')

    const within = (inner, outer) =>
      Boolean(inner) && Boolean(outer) &&
      inner.left >= outer.left - 1 && inner.top >= outer.top - 1 &&
      inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1

    // Not "fully inside": a tile grid legitimately overhangs its container at the edges — Leaflet
    // clips the overhang with the container's own overflow:hidden rule (asserted separately above)
    // rather than sizing tiles to fit. What is true of every real tile is that it overlaps the
    // box; one that did not would mean the grid drew somewhere else entirely.
    const overlaps = (inner, outer) =>
      Boolean(inner) && Boolean(outer) &&
      inner.left < outer.right && inner.right > outer.left &&
      inner.top < outer.bottom && inner.bottom > outer.top

    return {
      ok: true,
      box: boxRect ? { width: boxRect.width, height: boxRect.height } : { width: 0, height: 0 },
      boxCarriesSizeClass: Boolean(box) && box.className.split(/\\s+/).includes("h-80"),
      leafletMounted: Boolean(leafletContainer),
      leafletContainerOverflow: leafletContainer ? getComputedStyle(leafletContainer).overflow : "",
      loadedTiles: tiles.length,
      oneTileSrc: tiles[0] ? tiles[0].src : "",
      allTilesLocal: tiles.length > 0 &&
        tiles.every((tile) => new URL(tile.src).origin === location.origin),
      tilesOverlapBox: tiles.length > 0 &&
        tiles.every((tile) => overlaps(tile.getBoundingClientRect(), boxRect)),
      attributionText: attribution ? attribution.textContent.trim() : "",
      attributionVisible: Boolean(attribution) && attrStyle.display !== "none" &&
        Boolean(attrRect) && attrRect.width > 0 && attrRect.height > 0 &&
        within(attrRect, boxRect),
      listNames: listButtons.map((button) => button.textContent.trim()),
      listTabIndexes: listButtons.map((button) => button.tabIndex),
      lastClicked: lastClicked ? lastClicked.textContent.trim() : "",
    }
  })()`)
}

/**
 * `map/`'s browser checks: everything `map/map.test.tsx` cannot prove because it needs an effect, a
 * real DOM Leaflet mounts into, or a key press — see `AGENTS.md` and `map/README.md` → "Why the
 * list, not the pins, is the keyboard path" for why the list, not the map's own pins, is what these
 * checks drive by keyboard.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function mapChecks(devtools: Devtools): Promise<void> {
  const initial = await readState(devtools)
  check("the Map demo card is on the page", initial.ok, initial.ok ? "found" : "not found")
  if (!initial.ok) return

  check(
    "the box carries its size class from render, not from a script that runs after hydration",
    initial.boxCarriesSizeClass && initial.box.height > 100,
    `class includes h-80: ${initial.boxCarriesSizeClass}, rendered height ${initial.box.height}px`,
  )

  const mounted = await poll(async () => (await readState(devtools)).leafletMounted, 5_000)
  const afterMount = await readState(devtools)
  check(
    "Leaflet mounts into the box after hydration",
    mounted,
    mounted ? "a .leaflet-container appeared inside the box" : "no .leaflet-container after 5s",
  )
  check(
    "the box is the same size once Leaflet has mounted into it",
    Math.round(afterMount.box.height) === Math.round(initial.box.height) &&
      Math.round(afterMount.box.width) === Math.round(initial.box.width),
    `${initial.box.width}x${initial.box.height} before mount, ` +
      `${afterMount.box.width}x${afterMount.box.height} after`,
  )
  check(
    "leaflet.css reached the page — .leaflet-container's own overflow:hidden rule applies",
    afterMount.leafletContainerOverflow === "hidden",
    `computed overflow: "${afterMount.leafletContainerOverflow}"`,
  )

  const tilesLoaded = await poll(async () => (await readState(devtools)).loadedTiles > 0, 5_000)
  const withTiles = await readState(devtools)
  check(
    "at least one tile loads",
    tilesLoaded && withTiles.loadedTiles > 0,
    `${withTiles.loadedTiles} .leaflet-tile-loaded element(s)`,
  )
  check(
    "every loaded tile comes from this page's own origin, never a public tile server",
    withTiles.allTilesLocal,
    withTiles.oneTileSrc ? `e.g. ${withTiles.oneTileSrc}` : "no tile to read a src from",
  )
  check(
    "loaded tiles are drawn where the box is, not somewhere else on the page",
    withTiles.tilesOverlapBox,
    withTiles.tilesOverlapBox
      ? "every tile's rect overlaps the box's"
      : "a tile's rect did not overlap the box at all",
  )

  check(
    "the credit line is visible: not display:none, a real size, inside the box",
    withTiles.attributionVisible && withTiles.attributionText.length > 0,
    `text "${withTiles.attributionText}", visible=${withTiles.attributionVisible}`,
  )

  check(
    "the plain list carries the same places the map plots, in order",
    withTiles.listNames.length === PLACE_LABELS.length &&
      withTiles.listNames.every((name, index) => name === PLACE_LABELS[index]),
    `list reads: ${withTiles.listNames.join(", ") || "(empty)"}`,
  )
  check(
    "every list row is a real Tab stop — none was pulled out of the tab order",
    withTiles.listTabIndexes.length === PLACE_LABELS.length &&
      withTiles.listTabIndexes.every((index) => index === 0),
    `tabIndex values: ${withTiles.listTabIndexes.join(", ") || "(none)"}`,
  )

  await keyboardActivationChecks(devtools)
}

/**
 * Tab into the list, in order, and activate one by keyboard — the proof for "every marker can be
 * reached with Tab and has a name; activating one with the keyboard calls onMarkerClick", read off
 * the list rather than the map's own pins (see this file's own doc).
 *
 * A real Space press, not Enter: measured in `AGENTS.md`, a real Enter press does not activate a
 * focused button in this browser, and every other keyboard check in this repository already reaches
 * for Space for exactly that reason.
 *
 * @param devtools The connected session.
 */
async function keyboardActivationChecks(devtools: Devtools): Promise<void> {
  const staged = await devtools.evaluate<{ staged: boolean; label: string }>(`(() => {
    const buttons = [...document.querySelectorAll('${LIST} li button')]
    const target = buttons[1]
    if (!target) return { staged: false, label: "" }
    target.focus()
    return { staged: document.activeElement === target, label: target.textContent.trim() }
  })()`)

  check(
    "Tab reaches a list row directly — it has a real, focusable, named element",
    staged.staged && staged.label === PLACE_LABELS[1],
    staged.staged ? `focused "${staged.label}"` : "the second list row never took focus",
  )

  const before = await devtools.evaluate<string>(
    `document.querySelector('${LAST_CLICKED}').textContent.trim()`,
  )
  await pressKey(devtools, "Space")
  const activated = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${LAST_CLICKED}').textContent.trim() !== ${
          JSON.stringify(before)
        }`,
      ),
    2_000,
  )
  const after = await devtools.evaluate<string>(
    `document.querySelector('${LAST_CLICKED}').textContent.trim()`,
  )

  check(
    "a real Space press on the focused list row calls onMarkerClick with that marker's id",
    staged.staged && activated && after === "warehouse",
    staged.staged
      ? `onMarkerClick echoed "${before}" → "${after}" after Space on "${staged.label}"`
      : "nothing was focused, so a key press proves nothing",
  )
}
