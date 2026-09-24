import { check, type Devtools, poll, pressKey, settledScroll } from "./harness.ts"

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
  /** Whether the list — or any ancestor of it — carries `aria-hidden="true"`, which would take it out
   * of the accessibility tree regardless of what its text reads. */
  listAriaHidden: boolean
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
        attributionVisible: false, listNames: [], listAriaHidden: false, lastClicked: "",
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

    let listAriaHidden = false
    for (let el = list; el; el = el.parentElement) {
      if (el.getAttribute && el.getAttribute("aria-hidden") === "true") {
        listAriaHidden = true
        break
      }
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
      listAriaHidden,
      lastClicked: lastClicked ? lastClicked.textContent.trim() : "",
    }
  })()`)
}

/**
 * `map/`'s browser checks: everything `map/map.test.tsx` cannot prove because it needs an effect, a
 * real DOM Leaflet mounts into, or a key press. See `map/README.md` → "Keyboard and screen readers":
 * the map's own pins, not the plain list, are what these checks drive by keyboard.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function mapChecks(devtools: Devtools): Promise<void> {
  // Scrolled into view before anything else reads a position: `attributionVisible`'s
  // `document.elementFromPoint` check is viewport-relative, and earlier package blocks leave the
  // page scrolled wherever their own last check aimed it.
  await devtools.evaluate(`(() => {
    document.querySelector('${CARD}')?.scrollIntoView({ block: "center", behavior: "instant" })
  })()`)
  await settledScroll(devtools)

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
    !withTiles.listAriaHidden &&
      withTiles.listNames.length === PLACE_LABELS.length &&
      withTiles.listNames.every((name, index) => name === PLACE_LABELS[index]),
    `list reads: ${withTiles.listNames.join(", ") || "(empty)"}, aria-hidden ancestor: ` +
      `${withTiles.listAriaHidden}`,
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
 * Read one element's accessible name the way a screen reader would compute it, through the DevTools
 * `Accessibility` domain — not the DOM. This is what actually distinguishes `aria-label` from
 * `title` and from an element's own text content the way real assistive technology does; a check
 * that read `textContent` or a `title` attribute directly could pass for the wrong reason.
 *
 * @param devtools The connected session.
 * @param rootNodeId The document's root node id — see {@link domRootNodeId}; share one across every
 * call in the same batch rather than fetching a fresh root per call.
 * @param selector CSS selector for the element, matched against the whole document.
 * @returns The computed accessible name, or `undefined` if the selector matched nothing.
 */
async function accessibleName(
  devtools: Devtools,
  rootNodeId: number,
  selector: string,
): Promise<string | undefined> {
  const { nodeId } = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
    nodeId: rootNodeId,
    selector,
  })
  if (!nodeId) return undefined

  const { nodes } = await devtools.send<{ nodes: Array<{ name?: { value?: string } }> }>(
    "Accessibility.getPartialAXTree",
    { nodeId, fetchRelatives: false },
  )
  return nodes[0]?.name?.value
}

/**
 * Send a real Enter press with the `text` field the shared `pressKey` helper omits (`#261`) — a
 * bare `Input.dispatchKeyEvent` with no `text` on the key-down is not the same event a physical
 * Enter press produces, and this check exists specifically to prove Enter, not only Space, reaches
 * this package's own `keydown` listener. Written here rather than added to `harness.ts`'s `pressKey`
 * table, which `#261` tracks fixing on its own.
 *
 * @param devtools The connected session; the key goes to whatever the page has focused.
 */
async function pressEnterWithText(devtools: Devtools): Promise<void> {
  await devtools.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    text: "\r",
  })
  await devtools.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  })
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
  const names: Array<string | undefined> = []
  for (const id of PLACE_IDS) {
    names.push(await accessibleName(devtools, rootNodeId, `[data-marker-id="${id}"]`))
  }
  check(
    "every pin's real, screen-reader-computed accessible name equals its label",
    names.every((name, index) => name === PLACE_LABELS[index]),
    PLACE_IDS.map((id, index) => `${id}: "${names[index] ?? "(none)"}"`).join(", "),
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
  await pressEnterWithText(devtools)
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
