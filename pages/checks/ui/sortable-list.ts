import { centreInView, check, type Devtools, poll, pressKey, settledScroll } from "../harness.ts"

const SORTABLE_CARD = "#demo-SortableList"

/** What one read of the `SortableList` demo sees. */
interface SortableState {
  /** The rows' ids, in DOM order. */
  order: string[]
  /** The rows' ids, top to bottom as drawn, transforms included. */
  drawn: string[]
  /** The id of the row whose handle has focus, or `null`. */
  focused: string | null
  /** The live region's text. */
  live: string
  /** The demo's readout of the moves `onMove` reported. */
  lastMove: string
  /** The page's vertical scroll position. */
  scrollY: number
}

/** Reads {@link SortableState} off the `SortableList` card in one round trip. */
const SORTABLE_STATE = `(() => {
  const card = document.querySelector("${SORTABLE_CARD}")
  const rows = [...card.querySelectorAll("[data-sortable-item]")]
  const active = document.activeElement
  const row = active?.matches?.("[data-sortable-handle]") ? active.closest("[data-sortable-item]") : null
  return {
    order: rows.map((row) => row.dataset.sortableItem),
    drawn: [...rows]
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((row) => row.dataset.sortableItem),
    focused: row?.dataset.sortableItem ?? null,
    live: card.querySelector("[data-sortable-live]").textContent.trim(),
    lastMove: card.querySelector('[data-e2e="sortable-last-move"]').textContent.trim(),
    scrollY: Math.round(globalThis.scrollY),
  }
})()`

/** The demo's first order. */
const SORTABLE_FIRST = ["milk", "call", "bins", "plants", "post"]

/** A page expression for the element `part` names inside the row with this id. */
function sortablePart(id: string, part: "handle" | "body"): string {
  const inner = part === "handle" ? "[data-sortable-handle]" : "[data-sortable-handle] + div"
  return `document.querySelector('${SORTABLE_CARD} [data-sortable-item="${id}"] ${inner}')`
}

/** Put the demo back to its first items, and wait until it shows them. */
async function resetSortable(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(
    `(document.querySelector('${SORTABLE_CARD} [data-e2e="sortable-reset"]').click(), null)`,
  )
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.lastMove.endsWith("0, the last none yet")`),
    2_000,
  )
}

/**
 * `SortableList`, driven by real key presses, a real mouse drag and real touches on its catalogue
 * demo.
 *
 * A string render shows the handles and the empty live region, but none of what the list does:
 * picking an item up, the rows sliding out of its way, the one `onMove` at the drop, Escape putting
 * it back, a finger that scrolls the page outside a handle, and the edge scroll. Each check here
 * reads those off the page.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function sortableListChecks(devtools: Devtools): Promise<void> {
  const present = await devtools.evaluate<boolean>(
    `document.querySelector("${SORTABLE_CARD} [data-sortable-item]") !== null`,
  )
  check("the SortableList card is on the page", present)
  if (!present) return

  await resetSortable(devtools)
  await centreInView(devtools, `document.querySelector("${SORTABLE_CARD} ul")`)
  try {
    await sortableKeyboardCheck(devtools)
    await sortableEscapeCheck(devtools)
    await sortableTabAwayCheck(devtools)
    await sortableEnterCheck(devtools)
    await sortableReaderClickCheck(devtools)
    await sortableItemsChangeCheck(devtools)
    await sortableContextMenuCheck(devtools)
    await sortableMouseDragCheck(devtools)
    await sortableTouchDragCheck(devtools)
    await sortableTouchCancelCheck(devtools)
    await sortableTouchScrollCheck(devtools)
    await sortableEdgeScrollCheck(devtools)
  } finally {
    await devtools.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
      .catch(() => {})
    await resetSortable(devtools)
  }
}

/**
 * Space picks the first item up, two ArrowDown presses carry it down and Space drops it: the item
 * is drawn at its new place before any `onMove`, `onMove` hears `0 to 2` once, focus stays on its
 * handle, and the live region said each step.
 */
async function sortableKeyboardCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await devtools.evaluate<null>(`(${sortablePart("milk", "handle")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Picked up")`),
    2_000,
  )
  const picked = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  await pressKey(devtools, "ArrowDown")
  await pressKey(devtools, "ArrowDown")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.includes("position 3")`),
    2_000,
  )
  // Rows slide with a short transition; wait it out before reading where they are drawn.
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.drawn[2] === "milk"`),
    2_000,
  )
  const carried = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  await pressKey(devtools, "Space")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Dropped")`),
    2_000,
  )
  await poll(() => devtools.evaluate<boolean>(`${SORTABLE_STATE}.order[2] === "milk"`), 2_000)
  const dropped = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "the SortableList live region announces a keyboard pick-up and each move",
    picked.live === "Picked up Buy milk, position 1 of 5." &&
      carried.live === "Moved Buy milk to position 3 of 5.",
    `"${picked.live}", then "${carried.live}"`,
  )
  check(
    "a SortableList item picked up with Space is drawn lower on ArrowDown, before any onMove",
    JSON.stringify(carried.drawn) === `["call","bins","milk","plants","post"]` &&
      JSON.stringify(carried.order) === JSON.stringify(SORTABLE_FIRST) &&
      carried.lastMove.endsWith("0, the last none yet") && carried.focused === "milk",
    `drawn ${JSON.stringify(carried.drawn)}, DOM ${JSON.stringify(carried.order)}, onMove ` +
      `"${carried.lastMove}", focus ${carried.focused}`,
  )
  check(
    "Space drops a SortableList item: onMove hears 0 to 2 once, and focus stays on its handle",
    dropped.lastMove.endsWith("1, the last 0 to 2") &&
      JSON.stringify(dropped.order) === `["call","bins","milk","plants","post"]` &&
      dropped.focused === "milk" && dropped.live === "Dropped Buy milk at position 3 of 5.",
    `onMove "${dropped.lastMove}", order ${JSON.stringify(dropped.order)}, focus ` +
      `${dropped.focused}, live "${dropped.live}"`,
  )
}

/** Escape during a keyboard move puts the item back, keeps focus on it and reports no move. */
async function sortableEscapeCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await devtools.evaluate<null>(`(${sortablePart("plants", "handle")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowUp")
  await pressKey(devtools, "ArrowUp")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.drawn[1] === "plants"`),
    2_000,
  )
  const moving = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  await pressKey(devtools, "Escape")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Cancelled")`),
    2_000,
  )
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.drawn[3] === "plants"`),
    2_000,
  )
  const after = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "Escape puts a SortableList item back, keeps focus on it, calls nothing and announces it",
    moving.drawn[1] === "plants" &&
      JSON.stringify(after.drawn) === JSON.stringify(SORTABLE_FIRST) &&
      JSON.stringify(after.order) === JSON.stringify(SORTABLE_FIRST) &&
      after.lastMove.endsWith("0, the last none yet") && after.focused === "plants" &&
      after.live === "Cancelled. Water the plants is back at position 4 of 5.",
    `while moving drawn ${
      JSON.stringify(moving.drawn)
    }, live "${moving.live}"; after Escape drawn ` +
      `${JSON.stringify(after.drawn)}, onMove "${after.lastMove}", focus ${after.focused}, live ` +
      `"${after.live}"`,
  )
}

/** Tab away from a keyboard-held item puts it back and reports no move. */
async function sortableTabAwayCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await devtools.evaluate<null>(`(${sortablePart("call", "handle")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowDown")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Moved Call")`),
    2_000,
  )
  await pressKey(devtools, "Tab")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Cancelled")`),
    2_000,
  )
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `JSON.stringify(${SORTABLE_STATE}.drawn) === '${JSON.stringify(SORTABLE_FIRST)}'`,
      ),
    2_000,
  )
  const after = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "Tab away from a keyboard-held SortableList item puts it back and reports no move",
    JSON.stringify(after.drawn) === JSON.stringify(SORTABLE_FIRST) &&
      after.lastMove.endsWith("0, the last none yet") && after.focused !== "call" &&
      after.live === "Cancelled. Call the plumber is back at position 2 of 5.",
    `drawn ${JSON.stringify(after.drawn)}, onMove "${after.lastMove}", focus ${after.focused}, ` +
      `live "${after.live}"`,
  )
}

/** Whether the handle of the row with this id says it is pressed. */
function sortablePressed(devtools: Devtools, id: string): Promise<string | null> {
  return devtools.evaluate<string | null>(
    `${sortablePart(id, "handle")}.getAttribute("aria-pressed")`,
  )
}

/** Enter picks the second item up, ArrowDown moves it and Enter drops it: `onMove` hears `1 to 2`. */
async function sortableEnterCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await devtools.evaluate<null>(`(${sortablePart("call", "handle")}.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Picked up Call")`),
    2_000,
  )
  const pressed = await sortablePressed(devtools, "call")
  await pressKey(devtools, "ArrowDown")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Moved Call")`),
    2_000,
  )
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${SORTABLE_STATE}.order[2] === "call"`), 2_000)
  const after = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  const released = await sortablePressed(devtools, "call")

  check(
    "Enter picks a SortableList item up and drops it: onMove hears 1 to 2 once, focus stays on its handle",
    after.lastMove.endsWith("1, the last 1 to 2") && after.focused === "call" &&
      after.live === "Dropped Call the plumber at position 3 of 5." && pressed === "true" &&
      released === "false",
    `onMove "${after.lastMove}", focus ${after.focused}, live "${after.live}", aria-pressed ` +
      `${pressed} → ${released}`,
  )
}

/**
 * A click with no pointer behind it, as a screen reader sends in its reading mode, picks the first
 * item up and a second one drops it; a real mouse click with no drag does nothing.
 */
async function sortableReaderClickCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await centreInView(devtools, `document.querySelector("${SORTABLE_CARD} ul")`)
  const at = await sortablePoint(devtools, sortablePart("bins", "handle"))
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: at.x,
      y: at.y,
      button: type === "mouseMoved" ? "none" : "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: type === "mouseMoved" ? 0 : 1,
    })
  }
  await sortableFrames(devtools)
  const clicked = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  const clickedPressed = await sortablePressed(devtools, "bins")

  const milk = sortablePart("milk", "handle")
  await devtools.evaluate<null>(`(${milk}.focus(), ${milk}.click(), null)`)
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Picked up Buy milk")`),
    2_000,
  )
  const pressed = await sortablePressed(devtools, "milk")
  await pressKey(devtools, "ArrowDown")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Moved Buy milk")`),
    2_000,
  )
  await devtools.evaluate<null>(`(${milk}.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${SORTABLE_STATE}.order[1] === "milk"`), 2_000)
  const after = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "a mouse click on a SortableList handle, with no drag, picks nothing up",
    !clicked.live.startsWith("Picked up") && clickedPressed === "false" &&
      clicked.lastMove.endsWith("0, the last none yet"),
    `live "${clicked.live}", aria-pressed ${clickedPressed}, onMove "${clicked.lastMove}"`,
  )
  check(
    "a screen reader's click on a SortableList handle picks the item up, and a second drops it",
    pressed === "true" && after.lastMove.endsWith("1, the last 0 to 1") &&
      after.live === "Dropped Buy milk at position 2 of 5." && after.focused === "milk",
    `aria-pressed ${pressed}, onMove "${after.lastMove}", live "${after.live}", focus ` +
      `${after.focused}`,
  )
}

/**
 * The caller swaps the list's order while an item is held from the keyboard: the hold ends as a
 * cancel and nothing reaches `onMove`.
 */
async function sortableItemsChangeCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await devtools.evaluate<null>(`(${sortablePart("milk", "handle")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowDown")
  await pressKey(devtools, "Space")
  await poll(() => devtools.evaluate<boolean>(`${SORTABLE_STATE}.order[1] === "milk"`), 2_000)
  await devtools.evaluate<null>(`(${sortablePart("plants", "handle")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowUp")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Moved Water")`),
    2_000,
  )
  // The demo's Reset puts the first order back; clicked from script, so focus stays on the handle.
  await devtools.evaluate<null>(
    `(document.querySelector('${SORTABLE_CARD} [data-e2e="sortable-reset"]').click(), null)`,
  )
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Cancelled")`),
    2_000,
  )
  await sortableFrames(devtools)
  const after = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  const pressed = await sortablePressed(devtools, "plants")

  check(
    "changing a SortableList's items while one is held cancels the hold and calls nothing",
    after.live.startsWith("Cancelled. Water the plants") &&
      after.lastMove.endsWith("0, the last none yet") &&
      JSON.stringify(after.order) === JSON.stringify(SORTABLE_FIRST) && pressed === "false",
    `live "${after.live}", onMove "${after.lastMove}", order ${JSON.stringify(after.order)}, ` +
      `aria-pressed ${pressed}`,
  )
}

/** A long press's context menu is blocked on a handle, and only there. */
async function sortableContextMenuCheck(devtools: Devtools): Promise<void> {
  const blocked = (target: string) =>
    devtools.evaluate<boolean>(
      `!${target}.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))`,
    )
  const onHandle = await blocked(sortablePart("milk", "handle"))
  const onBody = await blocked(sortablePart("milk", "body"))

  check(
    "a SortableList handle blocks the context menu a long press would open, and its row body does not",
    onHandle && !onBody,
    `handle blocked ${onHandle}, body blocked ${onBody}`,
  )
}

/** A finger dragging a handle that the browser then cancels puts the item back and reports nothing. */
async function sortableTouchCancelCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await centreInView(devtools, `document.querySelector("${SORTABLE_CARD} ul")`)
  const from = await sortablePoint(devtools, sortablePart("milk", "handle"))
  const id = 13
  await devtools.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...from, id }],
  })
  for (let step = 1; step <= 8; step++) {
    await devtools.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x, y: from.y + step * 12, id }],
    })
    await sortableFrames(devtools)
  }
  const held = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  await devtools.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Cancelled")`),
    2_000,
  )
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `JSON.stringify(${SORTABLE_STATE}.drawn) === '${JSON.stringify(SORTABLE_FIRST)}'`,
      ),
    2_000,
  )
  const after = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "a cancelled touch drag of a SortableList handle puts the item back and calls nothing",
    held.live.startsWith("Moved Buy milk") &&
      after.live === "Cancelled. Buy milk is back at position 1 of 5." &&
      after.lastMove.endsWith("0, the last none yet") &&
      JSON.stringify(after.order) === JSON.stringify(SORTABLE_FIRST),
    `while held "${held.live}", after "${after.live}", onMove "${after.lastMove}", order ` +
      `${JSON.stringify(after.order)}`,
  )
}

/** The middle of an element in viewport coordinates, from a page expression. */
async function sortablePoint(
  devtools: Devtools,
  element: string,
): Promise<{ x: number; y: number }> {
  return await devtools.evaluate<{ x: number; y: number }>(`(() => {
    const box = (${element}).getBoundingClientRect()
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
  })()`)
}

/** Wait two animation frames, so the page has handled the input sent before. */
async function sortableFrames(devtools: Devtools): Promise<void> {
  const frame = `new Promise((done) => requestAnimationFrame(done))`
  await devtools.evaluate<null>(`${frame}.then(() => ${frame}).then(() => null)`)
}

/**
 * A real mouse press on the first handle, moved in steps to below the fourth row's middle and
 * released: the rows were drawn in the new order during the drag, and `onMove` hears `0 to 3` once.
 */
async function sortableMouseDragCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await centreInView(devtools, `document.querySelector("${SORTABLE_CARD} ul")`)
  const from = await sortablePoint(devtools, sortablePart("milk", "handle"))
  const past = await devtools.evaluate<number>(`(() => {
    const box = ${sortablePart("plants", "handle")}.closest("li").getBoundingClientRect()
    return Math.round(box.top + box.height * 0.75)
  })()`)
  const mouse = (type: string, x: number, y: number, buttons: number) =>
    devtools.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: type === "mouseMoved" && buttons === 0 ? "none" : "left",
      buttons,
      clickCount: type === "mouseMoved" ? 0 : 1,
    })
  await mouse("mouseMoved", from.x, from.y, 0)
  await mouse("mousePressed", from.x, from.y, 1)
  const steps = 8
  for (let step = 1; step <= steps; step++) {
    await mouse("mouseMoved", from.x, Math.round(from.y + ((past - from.y) * step) / steps), 1)
    await sortableFrames(devtools)
  }
  const during = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  await mouse("mouseReleased", from.x, past, 0)
  await poll(() => devtools.evaluate<boolean>(`${SORTABLE_STATE}.order[3] === "milk"`), 2_000)
  await sortableFrames(devtools)
  const dropped = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "dragging a SortableList handle with a mouse draws the rows in the new order before the drop",
    JSON.stringify(during.drawn) === `["call","bins","plants","milk","post"]` &&
      during.lastMove.endsWith("0, the last none yet"),
    `drawn ${JSON.stringify(during.drawn)}, onMove "${during.lastMove}", live "${during.live}"`,
  )
  check(
    "releasing a mouse drag of a SortableList handle calls onMove once with 0 to 3 and keeps focus on its handle",
    dropped.lastMove.endsWith("1, the last 0 to 3") &&
      JSON.stringify(dropped.order) === `["call","bins","plants","milk","post"]` &&
      dropped.live === "Dropped Buy milk at position 4 of 5." && dropped.focused === "milk",
    `onMove "${dropped.lastMove}", order ${
      JSON.stringify(dropped.order)
    }, live "${dropped.live}", ` +
      `focus ${dropped.focused}`,
  )
}

/**
 * One finger, through the browser's own touch input: down at `from`, moved in steps by `dy`, and
 * lifted. Each step waits two frames so the page sees every move.
 */
async function sortableTouch(
  devtools: Devtools,
  from: { x: number; y: number },
  dy: number,
  id: number,
): Promise<void> {
  await devtools.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...from, id }],
  })
  const steps = 8
  for (let step = 1; step <= steps; step++) {
    await devtools.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x, y: Math.round(from.y + (dy * step) / steps), id }],
    })
    await sortableFrames(devtools)
  }
  await devtools.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await sortableFrames(devtools)
}

/** A finger on the last handle, dragged up past the second row's middle: `onMove` hears `4 to 1`. */
async function sortableTouchDragCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await centreInView(devtools, `document.querySelector("${SORTABLE_CARD} ul")`)
  const from = await sortablePoint(devtools, sortablePart("post", "handle"))
  const past = await devtools.evaluate<number>(`(() => {
    const box = ${sortablePart("call", "handle")}.closest("li").getBoundingClientRect()
    return Math.round(box.top + box.height * 0.25)
  })()`)
  const scrolled = (await devtools.evaluate<SortableState>(SORTABLE_STATE)).scrollY
  await sortableTouch(devtools, from, past - from.y, 11)
  await poll(() => devtools.evaluate<boolean>(`${SORTABLE_STATE}.order[1] === "post"`), 2_000)
  const dropped = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "dragging a SortableList handle by touch calls onMove once with 4 to 1, leaves the page put and focuses its handle",
    dropped.lastMove.endsWith("1, the last 4 to 1") &&
      JSON.stringify(dropped.order) === `["milk","post","call","bins","plants"]` &&
      dropped.scrollY === scrolled && dropped.focused === "post",
    `onMove "${dropped.lastMove}", order ${JSON.stringify(dropped.order)}, scrollY ` +
      `${scrolled} → ${dropped.scrollY}, live "${dropped.live}", focus ${dropped.focused}`,
  )
}

/** A finger dragged up over an item's body, not its handle, scrolls the page and moves nothing. */
async function sortableTouchScrollCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await centreInView(devtools, `document.querySelector("${SORTABLE_CARD} ul")`)
  await settledScroll(devtools)
  const before = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  const from = await sortablePoint(devtools, sortablePart("bins", "body"))
  await sortableTouch(devtools, from, -150, 12)
  await settledScroll(devtools, { from: before.scrollY })
  const after = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "touch-scrolling a SortableList outside a handle scrolls the page and starts no drag",
    after.scrollY > before.scrollY + 50 &&
      JSON.stringify(after.order) === JSON.stringify(SORTABLE_FIRST) &&
      after.lastMove.endsWith("0, the last none yet") && after.live === before.live,
    `scrollY ${before.scrollY} → ${after.scrollY}, order ${JSON.stringify(after.order)}, onMove ` +
      `"${after.lastMove}", live "${before.live}" → "${after.live}"`,
  )
}

/**
 * A mouse drag held at the bottom edge of the window scrolls the page by itself; Escape then puts
 * the item back and reports nothing.
 */
async function sortableEdgeScrollCheck(devtools: Devtools): Promise<void> {
  await resetSortable(devtools)
  await centreInView(devtools, `document.querySelector("${SORTABLE_CARD} ul")`)
  await settledScroll(devtools)
  const from = await sortablePoint(devtools, sortablePart("milk", "handle"))
  const bottom = await devtools.evaluate<number>(`globalThis.innerHeight - 4`)
  const mouse = (type: string, y: number, buttons: number) =>
    devtools.send("Input.dispatchMouseEvent", {
      type,
      x: from.x,
      y,
      button: type === "mouseMoved" && buttons === 0 ? "none" : "left",
      buttons,
      clickCount: type === "mouseMoved" ? 0 : 1,
    })
  await mouse("mouseMoved", from.y, 0)
  await mouse("mousePressed", from.y, 1)
  await mouse("mouseMoved", from.y + 10, 1)
  await sortableFrames(devtools)
  const before = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  await mouse("mouseMoved", bottom, 1)
  const scrolled = await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.scrollY > ${before.scrollY + 100}`),
    3_000,
  )
  const held = await devtools.evaluate<SortableState>(SORTABLE_STATE)
  await pressKey(devtools, "Escape")
  await poll(
    () => devtools.evaluate<boolean>(`${SORTABLE_STATE}.live.startsWith("Cancelled")`),
    2_000,
  )
  await mouse("mouseReleased", bottom, 0)
  // The rows slide back with a short transition; wait it out before reading where they are drawn.
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `JSON.stringify(${SORTABLE_STATE}.drawn) === '${JSON.stringify(SORTABLE_FIRST)}'`,
      ),
    2_000,
  )
  const after = await devtools.evaluate<SortableState>(SORTABLE_STATE)

  check(
    "holding a SortableList drag at the window's bottom edge scrolls the page",
    scrolled && held.live.startsWith("Moved Buy milk"),
    `scrollY ${before.scrollY} → ${held.scrollY}, live "${held.live}"`,
  )
  check(
    "Escape during a SortableList mouse drag puts the item back, keeps focus on its handle and reports no move",
    JSON.stringify(after.order) === JSON.stringify(SORTABLE_FIRST) &&
      JSON.stringify(after.drawn) === JSON.stringify(SORTABLE_FIRST) &&
      after.lastMove.endsWith("0, the last none yet") &&
      after.live === "Cancelled. Buy milk is back at position 1 of 5." && after.focused === "milk",
    `order ${JSON.stringify(after.order)}, drawn ${JSON.stringify(after.drawn)}, onMove ` +
      `"${after.lastMove}", live "${after.live}", focus ${after.focused}`,
  )
}
