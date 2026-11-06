import { check, type Devtools, pointerToCorner, poll, pressKey } from "../harness.ts"
import {
  COMBOBOX_STATE,
  type ComboboxReading,
  comboboxSetup,
  scrollToParked,
} from "./combobox-shared.ts"
import { aimAt, clickAt, movePointer } from "./shared.ts"

/** Which row the browser has under the pointer, and what the two rows are painted. */
interface Painted {
  /** `true` when the row aimed at is the one in `:hover`. */
  hovered: boolean
  /** `true` when a row nobody pointed at is in `:hover`, which would make the reading meaningless. */
  plain: boolean
  hoveredBackground: string
  plainBackground: string
}

/**
 * The keyboard highlight stays on screen, and the pointer does not move it.
 *
 * Both rules need the same long list, so they share one opening of it: the popup shows about six
 * of its 27 rows, which is what lets a highlight fall off the bottom in the first place.
 *
 * The scroll half is measured, not eyeballed: the number of `ArrowDown` presses is derived from
 * the popup's own height and its row height, so the highlight is taken exactly one row past the
 * fold whatever the card's styling does, and the row's box is then compared with the popup's
 * visible band. A popup that does not follow its highlight stays at `scrollTop` 0 with the row
 * below the band.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function highlightChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-offset"))
  await scrollToParked(devtools)

  const aim = await aimAt(devtools, `globalThis.__verifyCombobox?.input ?? null`)
  const landing = await clickAt(devtools, aim, `globalThis.__verifyCombobox?.input ?? null`)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const opened = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  const rowHeight = await devtools.evaluate<number>(
    `Math.round(globalThis.__verifyCombobox?.list?.firstElementChild?.offsetHeight ?? 0)`,
  )

  // One row past the last one the popup can show, derived rather than picked: whatever the card's
  // row height and popup height are, this is the first press whose highlight the popup has to
  // scroll to keep.
  const fits = rowHeight > 0 ? Math.floor(opened.clientHeight / rowHeight) : 0
  const steps = fits + 1
  const overflows = opened.scrollHeight > opened.clientHeight && steps < opened.options

  // The quiet case first, and it has to be the **last** row the popup already shows: an earlier row
  // cannot be centred in a list that is at the top, so a popup that centred every highlight would
  // hold still there and prove nothing. `block: "nearest"` leaves this one where it is; `"center"`
  // pulls it to the middle of the box.
  //
  // Only the popup's own scroll is asserted. `scrollIntoView` moves every scrollable ancestor it
  // has, so the page may legitimately shift a few pixels when the row sits below the fold of the
  // window, and it does here — that is the row being brought into sight, which is the point. The
  // page's position is reported rather than pinned.
  const quietSteps = fits - 1
  for (let press = 0; press < quietSteps; press++) await pressKey(devtools, "ArrowDown")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${COMBOBOX_STATE}.active === "guide-combobox-offset-option-${quietSteps}"`,
      ),
    3_000,
  )
  const quiet = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  check(
    "a Combobox highlight that is already on screen leaves the popup where it is",
    opened.ok && overflows && fits >= 3 && opened.scrollTop === 0 &&
      quiet.active === `guide-combobox-offset-option-${quietSteps}` && quiet.scrollTop === 0 &&
      quiet.activeInView,
    !opened.ok || landing?.onTarget !== true
      ? "the field was never opened, so this proves nothing"
      : !overflows
      ? `the popup shows all ${opened.options} of its rows, so it has nowhere to scroll and ` +
        `holding still proves nothing`
      : fits < 3
      ? `only ${fits} row(s) fit the popup, so there is no already-visible row far enough down ` +
        `to be worth scrolling to — this proves nothing`
      : quiet.active !== `guide-combobox-offset-option-${quietSteps}`
      ? `${quietSteps} real ArrowDown presses left the highlight on ${quiet.active} rather than ` +
        `on option ${quietSteps}`
      : quiet.scrollTop !== 0
      ? `the popup scrolled to ${quiet.scrollTop}px to reach row ${quietSteps}, which was already ` +
        `on screen, so the list jerks under a reader who is only moving down it`
      : `${quietSteps} real ArrowDown presses onto the last of the ${fits} rows already showing: ` +
        `the popup stayed at scrollTop 0 (the window moved ` +
        `${quiet.pageScrollY - opened.pageScrollY}px, bringing that row into sight)`,
  )

  for (let press = quietSteps; press < steps; press++) await pressKey(devtools, "ArrowDown")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${COMBOBOX_STATE}.active === "guide-combobox-offset-option-${steps}"`,
      ),
    3_000,
  )
  const walked = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  check(
    "arrowing past the fold scrolls the Combobox's popup to keep the highlight on screen",
    opened.ok && overflows && landing?.onTarget === true && opened.scrollTop === 0 &&
      opened.active === "guide-combobox-offset-option-0" &&
      walked.active === `guide-combobox-offset-option-${steps}` && walked.scrollTop > 0 &&
      walked.activeInView,
    !opened.ok
      ? "the Combobox card has no field with id guide-combobox-offset"
      : landing?.onTarget !== true
      ? `the press never landed on the field, so it was never opened — this proves nothing`
      : !overflows
      ? `the popup shows all ${opened.options} of its rows (${opened.scrollHeight}px of list in ` +
        `${opened.clientHeight}px of box), so no highlight can fall off it and this proves nothing`
      : opened.active !== "guide-combobox-offset-option-0" || opened.scrollTop !== 0
      ? `the popup opened at scrollTop ${opened.scrollTop} with ${opened.active} highlighted, ` +
        `not at the top on the first row, so the walk below starts from nowhere known`
      : walked.active !== `guide-combobox-offset-option-${steps}`
      ? `${steps} real ArrowDown presses left the highlight on ${walked.active}, not on option ` +
        `${steps}`
      : !walked.activeInView
      ? `the highlight walked to option ${steps} and off the screen: the row sits outside the ` +
        `popup's ${opened.clientHeight}px band at scrollTop ${walked.scrollTop}`
      : `${steps} real ArrowDown presses (${fits} rows of ${rowHeight}px fit the ` +
        `${opened.clientHeight}px popup): the highlight went to option ${steps} and the popup ` +
        `scrolled 0 → ${walked.scrollTop}px to keep it in view`,
  )

  await pointerHighlightCheck(devtools, steps)
}

/**
 * A pointer over a row paints it, and leaves the announced highlight where the keyboard put it.
 *
 * `aria-activedescendant` is where a screen reader is reading. Writing it from a `mouseenter`
 * drags that reading around with a pointer whose user may not be holding it at all — the two input
 * methods are not the same person's.
 *
 * "Unchanged" is a weak thing to assert, so this pins both ends. The highlight is put on a known
 * row with a real `Home` press first, the pointer is landed on a *different* row, the page records
 * that it landed there, and the browser is asked which row it now has in `:hover` — so a check
 * whose pointer never arrived fails rather than reporting a highlight that did not move.
 *
 * The paint is asserted as well as the state, which it could not be until the browser was told it
 * has a mouse: Tailwind gates `hover:` styles behind `@media (hover: hover)`, so the row's
 * `hover:bg-hover` used to be compiled and never matched, and both rows read the same
 * transparent background. Now the row under the pointer has to be painted differently from the row
 * beside it, and both backgrounds still go into the message so the difference is visible rather
 * than implied.
 *
 * @param devtools The connected session, with the offsets popup open.
 * @param walkedTo The row the previous check left the highlight on, for the failure message.
 */
async function pointerHighlightCheck(devtools: Devtools, walkedTo: number): Promise<void> {
  await pressKey(devtools, "Home")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${COMBOBOX_STATE}.active === "guide-combobox-offset-option-0" && ` +
          `${COMBOBOX_STATE}.scrollTop === 0`,
      ),
    3_000,
  )
  const before = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  const row = `document.getElementById("guide-combobox-offset-option-2")`
  const aim = await aimAt(devtools, row)
  const landing = await movePointer(devtools, aim, row)
  const after = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  const painted = await devtools.evaluate<Painted>(`(() => {
    const read = (index) => document.getElementById("guide-combobox-offset-option-" + index)
    const hovered = read(2)
    const plain = read(3)
    return {
      hovered: hovered !== null && hovered.matches(":hover"),
      plain: plain !== null && plain.matches(":hover"),
      hoveredBackground: hovered === null ? "no row" : getComputedStyle(hovered).backgroundColor,
      plainBackground: plain === null ? "no row" : getComputedStyle(plain).backgroundColor,
    }
  })()`)

  const weights = await devtools.evaluate<{ active: string; plain: string }>(`(() => {
    const weight = (index) =>
      getComputedStyle(document.getElementById("guide-combobox-offset-option-" + index)).fontWeight
    return { active: weight(0), plain: weight(3) }
  })()`)
  check(
    "the highlighted Combobox row is heavier than a plain row, so a hover cannot pass for it",
    Number(weights.active) > Number(weights.plain),
    `the highlighted row has weight ${weights.active} and a plain row ${weights.plain}: both fill ` +
      `with the same hover colour, so weight is the only mark that tells them apart`,
  )

  check(
    "the pointer paints a Combobox row without moving the highlight a screen reader follows",
    before.active === "guide-combobox-offset-option-0" && aim.onTarget &&
      landing?.onTarget === true && after.active === before.active && painted.hovered &&
      !painted.plain && painted.hoveredBackground !== painted.plainBackground,
    before.active !== "guide-combobox-offset-option-0"
      ? `Home left the highlight on ${before.active} rather than the first row (the walk before ` +
        `this one had it on option ${walkedTo}), so there is no known place for the pointer not ` +
        `to move it from`
      : !aim.onTarget || landing?.onTarget !== true
      ? `the pointer never landed on the third row: ${
        landing === null
          ? `(${aim.x}, ${aim.y}) reads ${aim.tag} and the move never reached the page`
          : `it went to ${landing.tag} at (${landing.x}, ${landing.y})`
      } — a missed move, which proves nothing`
      : after.active !== before.active
      ? `pointing at the third row moved the announced highlight from ${before.active} to ` +
        `${after.active}, which is a screen reader's reading position following a mouse`
      : !painted.hovered || painted.plain
      ? `the browser did not take the row under the pointer into :hover (third row ` +
        `${painted.hovered}, fourth row ${painted.plain}), so there is nothing here about a ` +
        `pointer at all`
      : painted.hoveredBackground === painted.plainBackground
      ? `the row under the pointer is painted exactly like the row beside it ` +
        `(${painted.hoveredBackground}), so \`hover:bg-hover\` reached nothing — a browser ` +
        `answering (hover: none) gates every hover utility out, which is the first thing to check`
      : `the pointer landed on ${landing.tag} at (${landing.x}, ${landing.y}) and the browser put ` +
        `that row, and only that row, into :hover, while aria-activedescendant stayed on ` +
        `${after.active}. The paint is Tailwind's \`hover:bg-hover\`: the row under the pointer ` +
        `reads ${painted.hoveredBackground} against ${painted.plainBackground} on the row beside ` +
        `it`,
  )

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  await pointerToCorner(devtools)
}

/** How the chosen Combobox row is drawn, and how far the keyboard highlight is from it. */
interface ChosenRowLook {
  /** `false` when the popup has no row with `aria-selected="true"`; the rest is then noise. */
  found: boolean
  /** The chosen row's position in the list. */
  index: number
  /** How many rows the list has. */
  rows: number
  /** The highlighted row's position minus the chosen row's; `null` when nothing is highlighted. */
  distance: number | null
  fontWeight: string
  background: string
  /** `true` when any row is in `:hover`, which would paint it and make the reading meaningless. */
  hovered: boolean
}

/** Read the parked combobox's chosen row: its weight, its fill and where the highlight is. */
const CHOSEN_ROW_LOOK = `(() => {
  const { input, list } = globalThis.__verifyCombobox ?? {}
  const rows = [...(list?.querySelectorAll('[role="option"]') ?? [])]
  const index = rows.findIndex((row) => row.getAttribute("aria-selected") === "true")
  const row = rows[index]
  if (!row) {
    return {
      found: false, index: -1, rows: rows.length, distance: null, fontWeight: "", background: "",
      hovered: false,
    }
  }
  const active = rows.findIndex((option) => option.id === input.getAttribute("aria-activedescendant"))
  const style = getComputedStyle(row)
  return {
    found: true,
    index,
    rows: rows.length,
    distance: active === -1 ? null : active - index,
    fontWeight: style.fontWeight,
    background: style.backgroundColor,
    hovered: rows.some((option) => option.matches(":hover")),
  }
})()`

/**
 * The chosen Combobox row is heavier and filled differently only while the keyboard highlight is on
 * it (#435).
 *
 * The chosen row is always tinted, so without a style of its own for "chosen and highlighted" a
 * keyboard user cannot see the highlight arrive on it. The popup opens with the highlight on the
 * chosen row. Real arrow presses move it one row away, then two, and back. The chosen row must look
 * the same with the highlight one row away as two rows away, so the emphasis is not drawn for a
 * neighbour's highlight; and with the highlight back on it, it must be heavier than at rest and
 * filled differently. The pointer is parked away from the popup and every read asserts no row is
 * in `:hover`, so a hover fill cannot stand in for the highlight's.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function chosenHighlightCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-coin"))
  await scrollToParked(devtools)

  const field = `globalThis.__verifyCombobox?.input ?? null`
  const opened = await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  await pointerToCorner(devtools)
  const start = await devtools.evaluate<ChosenRowLook>(CHOSEN_ROW_LOOK)

  // Two rows away and back, towards whichever side has two rows to walk onto.
  const up = start.index >= 2
  const [away, back] = up
    ? (["ArrowUp", "ArrowDown"] as const)
    : (["ArrowDown", "ArrowUp"] as const)
  const step = up ? -1 : 1
  const press = async (key: "ArrowUp" | "ArrowDown", distance: number) => {
    await pressKey(devtools, key)
    await poll(
      async () => (await devtools.evaluate<ChosenRowLook>(CHOSEN_ROW_LOOK)).distance === distance,
      3_000,
    )
    return await devtools.evaluate<ChosenRowLook>(CHOSEN_ROW_LOOK)
  }
  const near = await press(away, step)
  const far = await press(away, 2 * step)
  await press(back, step)
  const highlighted = await press(back, 0)

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)

  const walked = start.distance === 0 && near.distance === step && far.distance === 2 * step &&
    highlighted.distance === 0
  const hovered = [start, near, far, highlighted].some((reading) => reading.hovered)
  const looks = (reading: ChosenRowLook) =>
    `weight ${reading.fontWeight}, fill ${reading.background}`
  check(
    "only a keyboard highlight on the chosen Combobox row makes it heavier and changes its fill",
    opened?.onTarget === true && start.found && walked && !hovered &&
      near.fontWeight === far.fontWeight && near.background === far.background &&
      Number(highlighted.fontWeight) > Number(near.fontWeight) &&
      highlighted.background !== near.background,
    opened?.onTarget !== true
      ? "the press never landed on the field, so the popup was never opened — this proves nothing"
      : !start.found
      ? "the open popup has no chosen row, so there is nothing to highlight"
      : start.rows < 3
      ? `the list has ${start.rows} rows, too few to move the highlight two rows away`
      : !walked
      ? `the highlight sat ${start.distance}, ${near.distance}, ${far.distance}, ` +
        `${highlighted.distance} rows from the chosen row, not 0, ${step}, ${2 * step}, 0`
      : hovered
      ? "a row was under the pointer, so its hover fill could stand in for the highlight's"
      : `chosen row with the highlight one row away: ${looks(near)}; two rows away: ` +
        `${looks(far)}; on it: ${looks(highlighted)}`,
  )
}
