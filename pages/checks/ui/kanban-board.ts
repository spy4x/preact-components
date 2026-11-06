import { centreInView, check, type Devtools, poll, pressKey } from "../harness.ts"

const KANBAN_CARD = "#demo-KanbanBoard"

/** What one read of the `KanbanBoard` demo sees. */
interface KanbanState {
  /** Each column's card ids, top to bottom, keyed by column id. */
  columns: Record<string, string[]>
  /** The card id whose handle has focus, or `null`. */
  focused: string | null
  /** The column that holds the focused card, or `null`. */
  focusedColumn: string | null
  /** The live region's text. */
  live: string
  /** The demo's readout of the last move `onMove` reported. */
  lastMove: string
  /** The demo's readout of the last card `onOpen` opened. */
  opened: string
  /** The column holding a drop indicator, or `null` when none is shown. */
  indicatorColumn: string | null
}

/** Reads {@link KanbanState} off the `KanbanBoard` card in one round trip. */
const KANBAN_STATE = `(() => {
  const card = document.querySelector("${KANBAN_CARD}")
  const columns = {}
  for (const column of card.querySelectorAll("[data-kanban-column]")) {
    columns[column.dataset.kanbanColumn] = [...column.querySelectorAll("[data-kanban-item]")]
      .map((item) => item.dataset.kanbanItem)
  }
  const active = document.activeElement
  const item = active?.closest?.("[data-kanban-item]")
  const handle = item !== null && item !== undefined && active.matches("[data-kanban-handle]")
  const indicator = card.querySelector("[data-kanban-indicator]")
  return {
    columns,
    focused: handle ? item.dataset.kanbanItem : null,
    focusedColumn: handle ? item.closest("[data-kanban-column]").dataset.kanbanColumn : null,
    live: card.querySelector("[data-kanban-live]").textContent.trim(),
    lastMove: card.querySelector('[data-e2e="kanban-last-move"]').textContent.trim(),
    opened: card.querySelector('[data-e2e="kanban-opened"]').textContent.trim(),
    indicatorColumn: indicator?.closest("[data-kanban-column]")?.dataset.kanbanColumn ?? null,
  }
})()`

/** A page expression for the handle of the card with this id. */
function kanbanHandle(id: string): string {
  return `document.querySelector('${KANBAN_CARD} [data-kanban-item="${id}"] [data-kanban-handle]')`
}

/** Put the demo back to its first items, and wait until it shows them. */
async function resetKanban(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(
    `(document.querySelector('${KANBAN_CARD} [data-e2e="kanban-reset"]').click(), null)`,
  )
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.lastMove.endsWith("none yet")`),
    2_000,
  )
}

/**
 * `KanbanBoard`, driven by real key presses and clicks on its catalogue demo. Its touch and mouse
 * drags are Playwright specs in `e2e/ui.spec.ts`.
 *
 * A string render shows the board's markup, but none of what the board does: a key press that
 * picks a card up, the arrow keys that move it, the drop that reports it through `onMove`, focus
 * following the card into its new column, Escape putting it back, and the live region
 * that says what happened. Each check here reads those off the page.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function kanbanBoardChecks(devtools: Devtools): Promise<void> {
  const present = await devtools.evaluate<boolean>(
    `document.querySelector("${KANBAN_CARD} [data-kanban-column]") !== null`,
  )
  check("the KanbanBoard card is on the page", present)
  if (!present) return

  await resetKanban(devtools)
  await centreInView(devtools, `document.querySelector("${KANBAN_CARD} [data-kanban-column]")`)
  try {
    await kanbanKeyboardMoveCheck(devtools)
    await kanbanEscapeCheck(devtools)
    await kanbanBlurCheck(devtools)
    await kanbanRefusedDropFocusCheck(devtools)
    await kanbanRefusedDropBlankClickCheck(devtools)
    await kanbanSameColumnKeyboardCheck(devtools)
    await kanbanOpenChecks(devtools)
    await kanbanPhoneWidthCheck(devtools)
  } finally {
    await resetKanban(devtools)
  }
}

/**
 * Space picks the first card up, ArrowRight carries it into the next column and Enter drops it:
 * `onMove` hears the new column and index, the card is there, focus is on it, and the live region
 * said the drop.
 */
async function kanbanKeyboardMoveCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(`(${kanbanHandle("notes")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.live.startsWith("Picked up")`),
    2_000,
  )
  const picked = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  await pressKey(devtools, "ArrowRight")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.columns.doing[0] === "notes"`),
    2_000,
  )
  const carried = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${KANBAN_STATE}.live.startsWith("Dropped")`), 2_000)
  const dropped = await devtools.evaluate<KanbanState>(KANBAN_STATE)

  check(
    "a KanbanBoard card picked up with Space shows in the next column on ArrowRight, before any onMove",
    picked.live === "Picked up Write the release notes. To do, position 1 of 3." &&
      carried.focused === "notes" && carried.focusedColumn === "doing" &&
      carried.lastMove.endsWith("none yet") &&
      carried.live === "Write the release notes: Doing, position 1 of 2.",
    `picked "${picked.live}", then "${carried.live}", focus ${carried.focused} in ` +
      `${carried.focusedColumn}, onMove "${carried.lastMove}"`,
  )
  check(
    "Enter drops a KanbanBoard card: onMove gets the new column and index, and focus stays on it",
    dropped.lastMove.endsWith("notes to doing at 0") &&
      dropped.columns.doing?.[0] === "notes" && !dropped.columns.todo?.includes("notes") &&
      dropped.focused === "notes" && dropped.focusedColumn === "doing",
    `onMove "${dropped.lastMove}", doing ${JSON.stringify(dropped.columns.doing)}, focus ` +
      `${dropped.focused} in ${dropped.focusedColumn}`,
  )
  check(
    "the KanbanBoard live region announces the drop",
    dropped.live === "Dropped Write the release notes in Doing, position 1 of 2.",
    dropped.live,
  )
}

/** Escape during a keyboard move puts the card back where it was, focused, and reports no move. */
async function kanbanEscapeCheck(devtools: Devtools): Promise<void> {
  const before = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  await devtools.evaluate<null>(`(${kanbanHandle("icons")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowRight")
  await pressKey(devtools, "ArrowDown")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.columns.doing.includes("icons")`),
    2_000,
  )
  const moving = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  await pressKey(devtools, "Escape")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.live.includes(" is back in ")`),
    2_000,
  )
  const after = await devtools.evaluate<KanbanState>(KANBAN_STATE)

  check(
    "Escape puts a KanbanBoard card back where it was, keeps focus on it and reports no move",
    moving.columns.doing?.includes("icons") === true &&
      JSON.stringify(after.columns) === JSON.stringify(before.columns) &&
      after.lastMove === before.lastMove && after.focused === "icons" &&
      after.focusedColumn === "todo",
    `while moving: doing ${JSON.stringify(moving.columns.doing)}; after Escape: ` +
      `${JSON.stringify(after.columns)}, onMove "${after.lastMove}", focus ${after.focused} in ` +
      `${after.focusedColumn}`,
  )
}

/**
 * A click outside a picked-up card puts it back, as Escape does: otherwise the card would stay
 * picked up with focus elsewhere, and the board would pull focus back to it on its next render.
 */
async function kanbanBlurCheck(devtools: Devtools): Promise<void> {
  const before = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  await devtools.evaluate<null>(`(${kanbanHandle("search")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowRight")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.columns.doing.includes("search")`),
    2_000,
  )
  const moving = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  const note = await kanbanPoint(
    devtools,
    `document.querySelector('${KANBAN_CARD} [data-e2e="kanban-last-move"]')`,
  )
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      ...note,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
    })
  }
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.live.includes(" is back in ")`),
    2_000,
  )
  const after = await devtools.evaluate<KanbanState>(KANBAN_STATE)

  check(
    "a click away from a picked-up KanbanBoard card puts it back and reports no move",
    moving.columns.doing?.includes("search") === true &&
      JSON.stringify(after.columns) === JSON.stringify(before.columns) &&
      after.lastMove === before.lastMove && after.focused === null &&
      after.live === "Rank search results is back in To do, position 2 of 2.",
    `while moving: doing ${JSON.stringify(moving.columns.doing)}; after the click: ` +
      `${JSON.stringify(after.columns)}, onMove "${after.lastMove}", focus ${after.focused}, ` +
      `live "${after.live}"`,
  )
}

/** What the board's layout looks like at one window width. */
interface KanbanFit {
  /** The board's visible width and its content's width, in CSS pixels. */
  clientWidth: number
  scrollWidth: number
  /** The narrowest column's width. */
  narrowest: number
  /** How far the page itself scrolls sideways; 0 when it does not. */
  pageOverflow: number
}

/**
 * On a phone-sized window the board scrolls sideways inside itself: its columns keep their width
 * instead of being squeezed, and the page does not scroll sideways.
 */
async function kanbanPhoneWidthCheck(devtools: Devtools): Promise<void> {
  try {
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    })
    // Two frames: one for the resize to lay out, one for anything it scheduled.
    const frame = `new Promise((done) => requestAnimationFrame(done))`
    await devtools.evaluate<null>(`${frame}.then(() => ${frame}).then(() => null)`)
    const fit = await devtools.evaluate<KanbanFit>(`(() => {
      const board = ${KANBAN_BOARD}
      const widths = [...board.querySelectorAll("[data-kanban-column]")]
        .map((column) => column.getBoundingClientRect().width)
      const root = document.documentElement
      return {
        clientWidth: board.clientWidth,
        scrollWidth: board.scrollWidth,
        narrowest: Math.round(Math.min(...widths)),
        pageOverflow: root.scrollWidth - root.clientWidth,
      }
    })()`)
    check(
      "at 375px the KanbanBoard scrolls sideways inside itself instead of squeezing its columns",
      fit.scrollWidth > fit.clientWidth && fit.narrowest >= 240 && fit.pageOverflow <= 0,
      `board ${fit.clientWidth}px showing ${fit.scrollWidth}px, narrowest column ` +
        `${fit.narrowest}px, page sideways overflow ${fit.pageOverflow}px`,
    )
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
}

/** The middle of an element in viewport coordinates, from a page expression. */
async function kanbanPoint(devtools: Devtools, element: string): Promise<{ x: number; y: number }> {
  return await devtools.evaluate<{ x: number; y: number }>(`(() => {
    const box = (${element}).getBoundingClientRect()
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
  })()`)
}

/** A page expression for the board's own scrolling list of columns. */
const KANBAN_BOARD = `document.querySelector('${KANBAN_CARD} ul[aria-label]')`

/** A real mouse click in the middle of an element. */
async function kanbanClick(devtools: Devtools, element: string): Promise<void> {
  const at = await kanbanPoint(devtools, element)
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      ...at,
      button: type === "mouseMoved" ? "none" : "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: type === "mouseMoved" ? 0 : 1,
    })
  }
}

/**
 * A keyboard drop the caller refuses leaves the card where it was, and once the reader clicks
 * another control, focus stays on that control: the board does not pull it back to the card on
 * its next render.
 */
async function kanbanRefusedDropFocusCheck(devtools: Devtools): Promise<void> {
  await resetKanban(devtools)
  const refuse = `document.querySelector('${KANBAN_CARD} [data-e2e="kanban-refuse"]')`
  await kanbanClick(devtools, refuse)
  await poll(() => devtools.evaluate<boolean>(`${refuse}.checked`), 2_000)
  await devtools.evaluate<null>(`(${kanbanHandle("notes")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowRight")
  await pressKey(devtools, "Enter")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.lastMove.endsWith("notes to doing at 0")`),
    2_000,
  )
  const refused = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  // The click turns refusal off, which re-renders the board: the render that used to steal focus.
  await kanbanClick(devtools, refuse)
  await poll(() => devtools.evaluate<boolean>(`!${refuse}.checked`), 2_000)
  const frame = `new Promise((done) => requestAnimationFrame(done))`
  await devtools.evaluate<null>(`${frame}.then(() => ${frame}).then(() => null)`)
  // A fixed wait, not a poll: it proves the render does not steal focus, and an absence has no
  // state to poll for.
  await new Promise((done) => setTimeout(done, 200))
  const after = await devtools.evaluate<{ onRefuse: boolean; focused: string }>(`({
    onRefuse: document.activeElement === ${refuse},
    focused: document.activeElement?.outerHTML.slice(0, 80) ?? "nothing",
  })`)

  check(
    "after a KanbanBoard drop the caller refuses, focus stays on the control the reader clicks next",
    refused.columns.todo?.[0] === "notes" && after.onRefuse,
    `after the refused drop: todo ${JSON.stringify(refused.columns.todo)}; after the click, ` +
      `focus on ${after.focused}`,
  )
}

/**
 * A keyboard drop the caller refuses, then a real click on blank space, which leaves focus on the
 * page itself: the board's next render must not pull focus back to the card either. This is the
 * case the card's own blur has to end, because focus on the page body is also what a remounted
 * card leaves behind, and there the board does put focus back.
 */
async function kanbanRefusedDropBlankClickCheck(devtools: Devtools): Promise<void> {
  await resetKanban(devtools)
  const refuse = `document.querySelector('${KANBAN_CARD} [data-e2e="kanban-refuse"]')`
  await devtools.evaluate<null>(`(${refuse}.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${refuse}.checked`), 2_000)
  await devtools.evaluate<null>(`(${kanbanHandle("notes")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowRight")
  await pressKey(devtools, "Enter")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.lastMove.endsWith("notes to doing at 0")`),
    2_000,
  )
  await kanbanClick(
    devtools,
    `document.querySelector('${KANBAN_CARD} [data-e2e="kanban-last-move"]')`,
  )
  // A deliberate pause, not a poll: the board decides what a blur means a task later, in a timer
  // (`onCardBlur`), and nothing on the page shows when that decision has run. A render before it
  // would still find the card waiting for focus; a poll on focus alone measured exactly that.
  await new Promise((done) => setTimeout(done, 100))
  const blank = await devtools.evaluate<boolean>(`document.activeElement === document.body`)
  // A render the reader did not cause: `.click()` moves no focus.
  await devtools.evaluate<null>(`(${refuse}.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`!${refuse}.checked`), 2_000)
  const frame = `new Promise((done) => requestAnimationFrame(done))`
  await devtools.evaluate<null>(`${frame}.then(() => ${frame}).then(() => null)`)
  // A fixed wait, not a poll: it proves the render does not steal focus, and an absence has no
  // state to poll for.
  await new Promise((done) => setTimeout(done, 200))
  const after = await devtools.evaluate<KanbanState>(KANBAN_STATE)

  check(
    "after a refused KanbanBoard drop and a click on blank space, a later render leaves focus alone",
    blank && after.focused === null,
    `focus on the page after the click: ${blank}; after the render, focus on card ${after.focused}`,
  )
}

/** ArrowDown then Enter moves a card one place down its own column, and reports index 1. */
async function kanbanSameColumnKeyboardCheck(devtools: Devtools): Promise<void> {
  await resetKanban(devtools)
  await devtools.evaluate<null>(`(${kanbanHandle("notes")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await pressKey(devtools, "ArrowDown")
  await pressKey(devtools, "Enter")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.lastMove.endsWith("notes to todo at 1")`),
    2_000,
  )
  const moved = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  check(
    "ArrowDown and Enter move a KanbanBoard card one place down its own column",
    moved.lastMove.endsWith("notes to todo at 1") &&
      JSON.stringify(moved.columns.todo) === `["icons","notes","search"]` &&
      moved.focused === "notes",
    `onMove "${moved.lastMove}", todo ${
      JSON.stringify(moved.columns.todo)
    }, focus ${moved.focused}`,
  )
}

/**
 * With `onOpen`, Enter on a card opens it rather than picking it up, Space still picks it up, and
 * a real click on a card opens it.
 */
async function kanbanOpenChecks(devtools: Devtools): Promise<void> {
  await resetKanban(devtools)
  await devtools.evaluate<null>(`(${kanbanHandle("icons")}.focus(), null)`)
  const before = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  await pressKey(devtools, "Enter")
  await poll(
    () =>
      devtools.evaluate<boolean>(`${KANBAN_STATE}.opened.endsWith("Draw the empty-state icon")`),
    2_000,
  )
  const entered = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  await pressKey(devtools, "Space")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.live.startsWith("Picked up")`),
    2_000,
  )
  const spaced = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  await pressKey(devtools, "Escape")
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.live.includes(" is back in ")`),
    2_000,
  )

  check(
    "Enter opens a KanbanBoard card through onOpen, and Space still picks it up",
    entered.opened.endsWith("Draw the empty-state icon") && entered.live === before.live &&
      entered.focused === "icons" &&
      spaced.live === "Picked up Draw the empty-state icon. To do, position 2 of 3.",
    `after Enter: opened "${entered.opened}", live "${entered.live}"; after Space: ` +
      `live "${spaced.live}"`,
  )

  await kanbanClick(devtools, kanbanHandle("search"))
  await poll(
    () => devtools.evaluate<boolean>(`${KANBAN_STATE}.opened.endsWith("Rank search results")`),
    2_000,
  )
  const clicked = await devtools.evaluate<KanbanState>(KANBAN_STATE)
  check(
    "a real click on a KanbanBoard card opens it through onOpen, without moving it",
    clicked.opened.endsWith("Rank search results") && clicked.lastMove.endsWith("none yet"),
    `opened "${clicked.opened}", onMove "${clicked.lastMove}"`,
  )
}
