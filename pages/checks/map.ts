import { pageHref } from "@spy4x/preact-ui-guide/routes"
import { MAP_PAGE_MARKERS, SERVED_BOX_GLOBAL } from "../src/map-page/page.tsx"
import {
  centreInView,
  check,
  type Devtools,
  frameOverviewHydrates,
  inFreshFrame,
  poll,
  pressKey,
  readFrameScripts,
} from "./harness.ts"

/**
 * Strings only Leaflet's code carries; a script that holds either counts as carrying Leaflet. The
 * first is the title of the "Leaflet" link Leaflet's attribution control builds; the second is the
 * class its zoom animation puts on every pane it animates. Neither appears in `map/` or the guide.
 * `pages/build.ts` minifies the bundle, which renames identifiers but leaves string literals alone.
 */
const LEAFLET_MARKERS = ["A JavaScript library for interactive maps", "leaflet-zoom-animated"]

/** The id the frame gets, so every expression below finds the same one. */
const FRAME_ID = "map-lazy-leaflet-frame"

/** The id of the frame {@link serverRenderedMapChecks} loads the server-rendered map page into. */
const SSR_FRAME_ID = "map-server-rendered-frame"

/** The page `pages/build.ts` writes from `src/map-page/page.tsx`, relative to the site's root. */
const SSR_PAGE = "map-demo/"

/** What {@link serverRenderedMapChecks} reads off the hydrated server-rendered page. */
interface HydratedMapState {
  /** Whether the page's island set its boot marker. */
  hydrated: boolean
  /** How many `Map` boxes the page holds — one, unless hydration built a second. */
  boxes: number
  /** Whether the box the served markup carried is still in the document. */
  servedBoxConnected: boolean
  /** Whether Leaflet's container is inside that same box. */
  leafletInServedBox: boolean
  /** How many Leaflet pins are inside that same box. */
  pins: number
  /** Text of the plain list's rows. */
  listNames: string[]
}

/** The card these checks drive, and the pieces of it they read. */
const CARD = "#demo-Map"

/** `ui-guide/sections/map.tsx`'s `PLACES`, in the order the card renders them — both by `id` (what a
 * pin's `data-marker-id` carries) and by `label` (what its accessible name and the list's text read). */
const PLACE_IDS = ["depot", "warehouse", "outpost"]
const PLACE_LABELS = ["London depot", "Paris warehouse", "Berlin outpost"]

/** What one round trip reads off the page. */
interface MapState {
  /** `false` when the card itself was not found; every other field is then noise. */
  ok: boolean
  /** The box's own size, in CSS pixels, as rendered — read before Leaflet's tile pane is asked
   * about, so this is the size `Map`'s own markup gives it, not a size Leaflet computed. */
  box: { width: number; height: number }
  /** Whether the box carries the class this component always renders it with, server or client —
   * proof its size comes from `Map`'s markup rather than from a script Leaflet runs. */
  boxCarriesSizeClass: boolean
  /** Whether a `.leaflet-container` exists inside the box yet. */
  leafletMounted: boolean
  /** `overflow` Leaflet's own stylesheet sets on `.leaflet-container` — `""` off a container that
   * does not exist, `"visible"` (the UA default) if `leaflet.css` never reached the page. */
  leafletContainerOverflow: string
  /** How many `.leaflet-marker-icon` pins are inside the box — proof the map actually has pins on
   * it, not only tiles. */
  pinCount: number
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
  /** Whether the attribution element is really visible: not `display: none`, not `opacity: 0`, not
   * `visibility: hidden`, a real size, inside the box, and — the strongest check — the element (or a
   * descendant of it) is genuinely what `document.elementFromPoint` finds at its own centre, which a
   * transparent or covered element would fail even with every other property reading "visible". */
  attributionVisible: boolean
  /** Text of every plain-list row, in DOM order. */
  listNames: string[]
  /** `""` when nothing hides the list from assistive tech. Otherwise, which element carries the
   * `aria-hidden="true"` that does: `"the list's own wrapper"`, `"an ancestor of the list"`,
   * `"the <ul>"`, or the hidden row's own text — named rather than a bare boolean so a failing
   * check says what to go and look at, instead of just that something, somewhere, was hidden. */
  listHiddenBy: string
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
        leafletMounted: false, leafletContainerOverflow: "", pinCount: 0, loadedTiles: 0,
        oneTileSrc: "", allTilesLocal: false, tilesOverlapBox: false, attributionText: "",
        attributionVisible: false, listNames: [], listHiddenBy: "", lastClicked: "",
      }
    }

    const box = card.querySelector('[data-e2e="map-box"]')
    const boxRect = box ? box.getBoundingClientRect() : null
    const leafletContainer = box ? box.querySelector(".leaflet-container") : null
    const pins = box ? [...box.querySelectorAll(".leaflet-marker-icon")] : []
    const tiles = box ? [...box.querySelectorAll(".leaflet-tile-loaded")] : []
    const attribution = card.querySelector('[data-e2e="map-attribution"]')
    const attrRect = attribution ? attribution.getBoundingClientRect() : null
    const attrStyle = attribution ? getComputedStyle(attribution) : null
    const list = card.querySelector('[data-e2e="map-marker-list"]')
    const listRows = list ? [...list.querySelectorAll("li")] : []
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

    let attributionVisible = false
    if (attribution && attrRect && attrRect.width > 0 && attrRect.height > 0) {
      const cx = attrRect.left + attrRect.width / 2
      const cy = attrRect.top + attrRect.height / 2
      const atPoint = document.elementFromPoint(cx, cy)
      attributionVisible = attrStyle.display !== "none" &&
        attrStyle.opacity !== "0" && attrStyle.visibility !== "hidden" &&
        within(attrRect, boxRect) &&
        (atPoint === attribution || attribution.contains(atPoint))
    }

    // Both directions: an ancestor of the wrapper (walking up) hides the whole list from assistive
    // tech; aria-hidden on the ul itself, or on one row, hides only what is inside it — neither is
    // "an ancestor of the wrapper", so a check that only walked up never saw either. Named, not just
    // detected, so a failing check says which element it was rather than merely that one was.
    const ariaHiddenTrue = (el) => Boolean(el && el.getAttribute && el.getAttribute("aria-hidden") === "true")
    let listHiddenBy = ""
    for (let el = list; el; el = el.parentElement) {
      if (ariaHiddenTrue(el)) {
        listHiddenBy = el === list ? "the list's own wrapper" : "an ancestor of the list"
        break
      }
    }
    const ul = list ? list.querySelector("ul") : null
    if (!listHiddenBy && ariaHiddenTrue(ul)) {
      listHiddenBy = "the <ul>"
    }
    if (!listHiddenBy) {
      const hiddenRow = listRows.find((row) => ariaHiddenTrue(row))
      if (hiddenRow) listHiddenBy = 'row "' + hiddenRow.textContent.trim() + '"'
    }

    return {
      ok: true,
      box: boxRect ? { width: boxRect.width, height: boxRect.height } : { width: 0, height: 0 },
      boxCarriesSizeClass: Boolean(box) && box.className.split(/\\s+/).includes("h-80"),
      leafletMounted: Boolean(leafletContainer),
      leafletContainerOverflow: leafletContainer ? getComputedStyle(leafletContainer).overflow : "",
      pinCount: pins.length,
      loadedTiles: tiles.length,
      oneTileSrc: tiles[0] ? tiles[0].src : "",
      allTilesLocal: tiles.length > 0 &&
        tiles.every((tile) => new URL(tile.src).origin === location.origin),
      tilesOverlapBox: tiles.length > 0 &&
        tiles.every((tile) => overlaps(tile.getBoundingClientRect(), boxRect)),
      attributionText: attribution ? attribution.textContent.trim() : "",
      attributionVisible,
      listNames: listRows.map((row) => row.textContent.trim()),
      listHiddenBy,
      lastClicked: lastClicked ? lastClicked.textContent.trim() : "",
    }
  })()`)
}

/**
 * `map/`'s browser checks. First, that the guide loads Leaflet only when its map page opens
 * ({@link lazyLeafletChecks}); then everything `map/map.test.tsx` cannot prove because it needs an
 * effect, a real DOM Leaflet mounts into, or a key press. See `map/README.md` → "Keyboard and screen
 * readers": the map's own pins, not the plain list, are what these checks drive by keyboard.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function mapChecks(devtools: Devtools): Promise<void> {
  await inFreshFrame(
    devtools,
    { id: FRAME_ID, src: pageHref("overview"), label: "Leaflet" },
    (frame) => lazyLeafletChecks(devtools, frame),
  )

  await inFreshFrame(
    devtools,
    { id: SSR_FRAME_ID, src: SSR_PAGE, label: "server-rendered Map" },
    (frame) => serverRenderedMapChecks(devtools, frame),
  )

  await mapCardChecks(devtools)
}

/**
 * A `Map` rendered on the server hydrates, and Leaflet mounts into the box the server rendered.
 *
 * The catalogue reaches `Map` through a lazy loader, so it renders only a placeholder on the server,
 * and no check there hydrates `Map`'s own server markup. `map-demo/index.html` does
 * (`src/map-page/page.tsx`): the served HTML carries the box and the list of places, an inline
 * script keeps a reference to that box before the island runs, and the island hydrates the same
 * component. If hydration replaced the box instead of taking it over, the kept box would be detached
 * and would hold no map.
 *
 * @param devtools The connected session.
 * @param frame A page expression for the frame, loaded at the server-rendered page.
 */
async function serverRenderedMapChecks(devtools: Devtools, frame: string): Promise<void> {
  const labels = MAP_PAGE_MARKERS.map((marker) => marker.label)
  const served = await devtools.evaluate<string>(
    `fetch(new URL(${JSON.stringify(SSR_PAGE)}, location.origin + location.pathname))
      .then((response) => response.text())`,
  )
  // An element, not the attribute alone: the page's inline script names the same selector.
  const servedBox = /<div [^>]*data-e2e="map-box"/
  check(
    "the server-rendered Map page serves Map's box and its list of places, with no Leaflet map yet",
    servedBox.test(served) && !served.includes("leaflet-container") &&
      labels.every((label) => served.includes(`>${label}<`)),
    `served ${served.length} characters; box ${servedBox.test(served)}; ` +
      `places ${labels.filter((label) => served.includes(`>${label}<`)).join(", ") || "none"}`,
  )

  let state: HydratedMapState | undefined
  const mounted = await poll(async () => {
    state = await devtools.evaluate<HydratedMapState>(`(() => {
      const doc = ${frame}?.contentDocument
      const box = ${frame}?.contentWindow?.${SERVED_BOX_GLOBAL}
      const list = doc?.querySelector('[data-e2e="map-marker-list"]')
      return {
        hydrated: doc?.documentElement.dataset.hydrated === "true",
        boxes: doc ? doc.querySelectorAll('[data-e2e="map-box"]').length : 0,
        servedBoxConnected: Boolean(box?.isConnected),
        leafletInServedBox: Boolean(box?.querySelector(".leaflet-container")),
        pins: box ? box.querySelectorAll(".leaflet-marker-icon").length : 0,
        listNames: list ? [...list.querySelectorAll("li")].map((row) => row.textContent.trim()) : [],
      }
    })()`)
    return state.hydrated && state.leafletInServedBox && state.pins === labels.length
  }, 15_000)
  check(
    "a server-rendered Map hydrates: Leaflet mounts into the box the server rendered, one pin per place",
    mounted && state !== undefined && state.servedBoxConnected && state.boxes === 1,
    state
      ? `hydrated ${state.hydrated}; ${state.boxes} box(es); served box connected ` +
        `${state.servedBoxConnected}; Leaflet in it ${state.leafletInServedBox}; ` +
        `${state.pins} of ${labels.length} pins`
      : "the frame was never read",
  )
  check(
    "the hydrated server-rendered Map lists the same places the server rendered",
    state !== undefined && JSON.stringify(state.listNames) === JSON.stringify(labels),
    state ? state.listNames.join(", ") || "no rows" : "",
  )
}

/**
 * The guide loads Leaflet only when its map page opens (#315).
 *
 * The shared page cannot show that: earlier blocks have opened the map page already, and this block
 * runs on it. So, like `charts.ts`'s no-d3 check, this loads the site again in a fresh frame
 * (`inFreshFrame` in `harness.ts`): it opens at the overview, lists every script the frame fetched
 * and reads each one for Leaflet's code, then opens the frame's map page, waits for the map to draw
 * its pins, and reads again. The frame is removed before the card checks run.
 *
 * @param devtools The connected session.
 * @param frame A page expression for the frame, loaded at the overview.
 */
async function lazyLeafletChecks(devtools: Devtools, frame: string): Promise<void> {
  if (!await frameOverviewHydrates(devtools, frame)) return

  const overview = await readFrameScripts(devtools, frame, LEAFLET_MARKERS)
  check(
    "the guide's overview loads no Leaflet: no script the page fetched carries Leaflet's code",
    overview.scripts.length > 0 && overview.matching.length === 0,
    `${overview.scripts.length} scripts: ${overview.scripts.join(", ")}` +
      (overview.matching.length > 0 ? ` — Leaflet in ${overview.matching.join(", ")}` : ""),
  )

  await devtools.evaluate(
    `(${frame}.contentWindow.location.replace(${JSON.stringify(pageHref("map"))}), null)`,
  )
  let pins = 0
  const drawn = await poll(async () => {
    pins = await devtools.evaluate<number>(`(() => {
      const card = ${frame}?.contentDocument?.querySelector('[data-guide-page="map"] ${CARD}')
      if (!card || !card.querySelector(".leaflet-container")) return 0
      return card.querySelectorAll(".leaflet-marker-icon").length
    })()`)
    return pins === PLACE_IDS.length
  }, 15_000)

  const opened = await readFrameScripts(devtools, frame, LEAFLET_MARKERS)
  const newScripts = opened.scripts.filter((path) => !overview.scripts.includes(path))
  check(
    "opening the map page loads Leaflet, in a script the overview never fetched",
    opened.matching.length > 0 && opened.matching.every((path) => newScripts.includes(path)),
    `new scripts: ${newScripts.join(", ") || "none"} — Leaflet in ${
      opened.matching.join(", ") || "none"
    }`,
  )
  check(
    "the map page, opened fresh, draws the map with one pin per marker once Leaflet has loaded",
    drawn,
    `${pins} .leaflet-marker-icon element(s) in a .leaflet-container, expected ${PLACE_IDS.length}`,
  )
}

/**
 * The Map card on the shared page: everything `map/map.test.tsx` cannot prove because it needs an
 * effect, a real DOM Leaflet mounts into, or a key press.
 *
 * @param devtools The connected session, on the map page.
 */
async function mapCardChecks(devtools: Devtools): Promise<void> {
  // The card reaches `Map` through the guide's lazy loader (`ui-guide/sections/map-leaflet.tsx`),
  // so on a page that has not loaded it yet the card first shows a placeholder, with no box.
  await poll(
    () =>
      devtools.evaluate<boolean>(`document.querySelector('${CARD} [data-e2e="map-box"]') !== null`),
    15_000,
  )

  // Scrolled into view before anything else reads a position: `attributionVisible`'s
  // `document.elementFromPoint` check is viewport-relative, and earlier package blocks leave the
  // page scrolled wherever their own last check aimed it.
  await centreInView(devtools, `document.querySelector('${CARD}')`)

  const initial = await readState(devtools)
  check("the Map demo card is on the page", initial.ok, initial.ok ? "found" : "not found")
  if (!initial.ok) return

  check(
    "the box carries its size class from Map's markup, not from a script Leaflet runs",
    initial.boxCarriesSizeClass && initial.box.height > 100,
    `class includes h-80: ${initial.boxCarriesSizeClass}, rendered height ${initial.box.height}px`,
  )

  const mounted = await poll(async () => (await readState(devtools)).leafletMounted, 5_000)
  const afterMount = await readState(devtools)
  check(
    "Leaflet mounts into the box once the map page loads the package",
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

  const pinsAppeared = await poll(async () => (await readState(devtools)).pinCount > 0, 5_000)
  const withPins = await readState(devtools)
  check(
    "the map actually has pins on it — one per marker, not only tiles",
    pinsAppeared && withPins.pinCount === PLACE_IDS.length,
    `${withPins.pinCount} .leaflet-marker-icon element(s), expected ${PLACE_IDS.length}`,
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
    "the credit line is visible: not display:none, opacity:0 or visibility:hidden, and is really " +
      "what a click at its own centre would hit",
    withTiles.attributionVisible && withTiles.attributionText.length > 0,
    `text "${withTiles.attributionText}", visible=${withTiles.attributionVisible}`,
  )

  check(
    "the plain list names the same places, in order, and is not hidden from assistive tech",
    !withTiles.listHiddenBy &&
      withTiles.listNames.length === PLACE_LABELS.length &&
      withTiles.listNames.every((name, index) => name === PLACE_LABELS[index]),
    `list reads: ${withTiles.listNames.join(", ") || "(empty)"}` +
      (withTiles.listHiddenBy ? `, hidden by: ${withTiles.listHiddenBy}` : ", not hidden"),
  )

  await pinKeyboardChecks(devtools)
}

/** What `document.activeElement` carries, as far as these checks need it. */
interface ActiveElementInfo {
  markerId: string | null
}

/** Read `document.activeElement`'s `data-marker-id`, or `null` off anything else (including no
 * active element at all). */
function activeMarkerId(devtools: Devtools): Promise<string | null> {
  return devtools.evaluate<ActiveElementInfo>(`(() => {
    const el = document.activeElement
    return { markerId: el && el.getAttribute ? el.getAttribute("data-marker-id") : null }
  })()`).then((info) => info.markerId)
}

/**
 * Focus the map, then press Tab until the pins stop appearing, recording each pin's
 * `data-marker-id` as it is reached. Bounded at 10 presses — the map's own keyboard-pan focus, the
 * zoom control's two buttons and up to a handful of pins all fit comfortably inside that budget, and
 * a run that never reaches a pin, or never leaves them, is exactly the failure this check reports
 * rather than a loop that would hang.
 *
 * @param devtools The connected session.
 * @returns Every pin's `data-marker-id`, in the order Tab reached them, plus whether the map
 * container itself was successfully focused first — a Tab sequence measured from nowhere real.
 */
async function collectPinTabOrder(
  devtools: Devtools,
): Promise<{ focused: boolean; ids: string[] }> {
  const focused = await devtools.evaluate<boolean>(`(() => {
    const box = document.querySelector('${CARD} [data-e2e="map-box"]')
    const container = box && box.querySelector(".leaflet-container")
    if (!container) return false
    container.focus()
    return document.activeElement === container
  })()`)

  const ids: string[] = []
  for (let presses = 0; presses < 10; presses++) {
    await pressKey(devtools, "Tab")
    const id = await activeMarkerId(devtools)
    if (id) {
      ids.push(id)
      continue
    }
    // Once at least one pin has been seen, the first non-pin tab stop is what comes *after* the
    // pins — the loop's job is done. Before that, it is the map's own keyboard-pan focus or the
    // zoom control, and the loop keeps going.
    if (ids.length > 0) break
  }

  return { focused, ids }
}

/**
 * The whole document's root node id, fetched once — `DOM.getDocument` is what {@link accessibleName}
 * needs to resolve a selector into a node id, but calling it again invalidates every node id it (or
 * `DOM.querySelector`) handed out before, including one still in flight on another connection. Two
 * concurrent `accessibleName` calls that each fetched their own root raced exactly that: measured as
 * `Could not find node with given id` from `Accessibility.getPartialAXTree`, on the second call to
 * finish, in `verify`'s full run (never in isolation, where nothing else touched the DOM domain
 * between them). The fix is one root, and the callers below fetch it once and then read every pin's
 * name in sequence, never concurrently.
 *
 * @param devtools The connected session.
 */
async function domRootNodeId(devtools: Devtools): Promise<number> {
  const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
    depth: -1,
    pierce: true,
  })
  return root.nodeId
}

/**
 * One source `Accessibility.getPartialAXTree` considered while computing an element's name — see
 * {@link accessibleName}.
 *
 * Every source type the browser knows how to read a name from appears once per element, whether or
 * not that attribute exists — a considered-but-absent `aria-label` reports
 * `{ type: "attribute", attribute: "aria-label" }` with **no** `value` and **no** `superseded` key,
 * the exact same absence of a `superseded` key a *winning* source has. Measured, not assumed: an
 * earlier version of this check treated "not superseded" alone as proof `aria-label` won, and it
 * stayed green after the line that sets `aria-label` was deleted, because the considered-but-absent
 * entry is `!superseded` too. Requiring `value` to be present as well is what tells a source that
 * genuinely won apart from one that was never there to begin with.
 */
interface AXNameSource {
  /** The attribute this source reads, e.g. `"aria-label"` or `"title"` — absent for a source that
   * is not attribute-based (an element's own text content, a related `aria-labelledby` element). */
  attribute?: string
  /** Present when this source actually had a value to offer, whether or not it went on to win —
   * absent only when the attribute this source reads does not exist on the element at all. */
  value?: unknown
  /** `true` when a higher-priority source won instead — present only on a source that had a `value`
   * and still lost; never present at all on one that was merely considered and found nothing. */
  superseded?: boolean
}

/** What {@link accessibleName} reports about one element. */
interface AXName {
  /** The computed accessible name, or `undefined` if the selector matched nothing. */
  value: string | undefined
  /** Whether `aria-label` is present among the sources and is not superseded — the proof that the
   * name in `value` actually came from `aria-label`, not merely that it reads the same as `title`
   * or the element's text would have produced. */
  fromAriaLabel: boolean
}

/**
 * Read one element's accessible name the way a screen reader would compute it, through the DevTools
 * `Accessibility` domain — not the DOM. This is what actually distinguishes `aria-label` from
 * `title` and from an element's own text content the way real assistive technology does; a check
 * that read `textContent` or a `title` attribute directly could pass for the wrong reason — and, per
 * review, a check that only compares the *value* still passes when `aria-label` is deleted, because
 * Leaflet's own `title` (set from the same `label`) computes to the identical string. `fromAriaLabel`
 * is what closes that gap: it reads `sources`, the ranked list of every name source the browser
 * considered, and is true only when `aria-label` is among them and was not superseded by a
 * higher-priority source winning instead.
 *
 * @param devtools The connected session.
 * @param rootNodeId The document's root node id — see {@link domRootNodeId}; share one across every
 * call in the same batch rather than fetching a fresh root per call.
 * @param selector CSS selector for the element, matched against the whole document.
 */
async function accessibleName(
  devtools: Devtools,
  rootNodeId: number,
  selector: string,
): Promise<AXName> {
  const { nodeId } = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
    nodeId: rootNodeId,
    selector,
  })
  if (!nodeId) return { value: undefined, fromAriaLabel: false }

  const { nodes } = await devtools.send<
    { nodes: Array<{ name?: { value?: string; sources?: AXNameSource[] } }> }
  >("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false })

  const name = nodes[0]?.name
  const fromAriaLabel = (name?.sources ?? []).some(
    (source) =>
      source.attribute === "aria-label" && source.value !== undefined && !source.superseded,
  )
  return { value: name?.value, fromAriaLabel }
}

/** Read the echo element's current text. */
function lastClickedText(devtools: Devtools): Promise<string> {
  return devtools.evaluate<string>(
    `document.querySelector('${CARD} [data-e2e="map-last-clicked"]').textContent.trim()`,
  )
}

/**
 * The pins' keyboard path, proven directly rather than read off the plain list — see
 * `map/README.md` → "Keyboard and screen readers". Three things: Tab from the focused map reaches
 * every pin, in marker order; each pin's real, screen-reader-computed accessible name equals its
 * `label`; and a real Space press, and a real Enter press, each call `onMarkerClick` with the
 * focused pin's `id`.
 *
 * @param devtools The connected session.
 */
async function pinKeyboardChecks(devtools: Devtools): Promise<void> {
  const { focused, ids } = await collectPinTabOrder(devtools)
  check(
    "focusing the map and pressing Tab reaches every pin, in marker order",
    focused && ids.length === PLACE_IDS.length &&
      ids.every((id, index) => id === PLACE_IDS[index]),
    focused
      ? `Tab order: ${ids.join(", ") || "(no pin reached)"}, expected ${PLACE_IDS.join(", ")}`
      : "the map's own container never took focus, so nothing was Tabbed from",
  )

  await devtools.send("Accessibility.enable", {})
  const rootNodeId = await domRootNodeId(devtools)
  const names: AXName[] = []
  for (const id of PLACE_IDS) {
    names.push(await accessibleName(devtools, rootNodeId, `[data-marker-id="${id}"]`))
  }
  check(
    "every pin's real, screen-reader-computed accessible name equals its label",
    names.every((name, index) => name.value === PLACE_LABELS[index]),
    PLACE_IDS.map((id, index) => `${id}: "${names[index].value ?? "(none)"}"`).join(", "),
  )
  check(
    "that name comes from aria-label specifically, not merely from title reading the same text",
    names.every((name) => name.fromAriaLabel),
    PLACE_IDS.map((id, index) => `${id}: fromAriaLabel=${names[index].fromAriaLabel}`).join(", "),
  )

  const beforeSpace = await lastClickedText(devtools)
  await devtools.evaluate(`document.querySelector('[data-marker-id="${PLACE_IDS[0]}"]').focus()`)
  await pressKey(devtools, "Space")
  const spaceActivated = await poll(
    async () => (await lastClickedText(devtools)) !== beforeSpace,
    2_000,
  )
  const afterSpace = await lastClickedText(devtools)
  check(
    "a real Space press on a focused pin calls onMarkerClick with that pin's id",
    spaceActivated && afterSpace === PLACE_IDS[0],
    `onMarkerClick echoed "${beforeSpace}" → "${afterSpace}" after Space on the ${
      PLACE_IDS[0]
    } pin`,
  )

  await devtools.evaluate(`document.querySelector('[data-marker-id="${PLACE_IDS[1]}"]').focus()`)
  await pressKey(devtools, "Enter")
  const enterActivated = await poll(
    async () => (await lastClickedText(devtools)) !== afterSpace,
    2_000,
  )
  const afterEnter = await lastClickedText(devtools)
  check(
    "a real Enter press on a focused pin calls onMarkerClick with that pin's id",
    enterActivated && afterEnter === PLACE_IDS[1],
    `onMarkerClick echoed "${afterSpace}" → "${afterEnter}" after Enter on the ${PLACE_IDS[1]} pin`,
  )
}
