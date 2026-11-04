import { check, type Devtools, pointerToCorner, poll, pressKey } from "../harness.ts"
import { liveRegionChecks } from "./combobox-live-region.ts"
import { chosenHighlightCheck, highlightChecks } from "./combobox-highlight.ts"
import {
  COMBOBOX_STATE,
  type ComboboxReading,
  comboboxSetup,
  scrollToParked,
} from "./combobox-shared.ts"
import { aimAt, clickAt } from "./shared.ts"
import {
  composeThenCommit,
  compositionDetail,
  heldThenFiltered,
  narrowedEachTime,
  pressImeKey,
  pressTagKey,
  RECORD_IME_KEYS,
  TAKE_IME_KEYS,
  typeEachCharacter,
  typeInto,
  typingDetail,
} from "./shared-typing.ts"

/**
 * Combobox's three browser-only rules, each driven on the card built for it.
 *
 * What a rendered string cannot reach: whether a field nobody has touched stays silent *and* still
 * answers once it is opened, where a popup is scrolled to, and which element a pointer move leaves
 * `aria-activedescendant` pointing at. The card carries a list of 27 offsets and a list of none
 * precisely so these three have the shapes they need — a long list for a highlight to fall off, and
 * an empty one for a field to say nothing about.
 *
 * Every point is derived from an element's own box and read back with `elementFromPoint` before it
 * is used, and every press records where the browser delivered it, so a missed press reports itself
 * as a missed press rather than as a broken component. Nothing here throws: a card that lost a
 * combobox is a failed check naming the id it could not find.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function comboboxChecks(devtools: Devtools): Promise<void> {
  await liveRegionChecks(devtools)
  await untouchedComboboxCheck(devtools)
  await arrivingOptionsCheck(devtools)
  await highlightChecks(devtools)
  await reopenCheck(devtools)
  await fetchingComboboxCheck(devtools)
  await chosenHighlightCheck(devtools)
  await imeComboboxCheck(devtools)
  await compositionComboboxCheck(devtools)
  await comboboxRowHeightCheck(devtools)
}

/**
 * Every Combobox option row is a 44 px touch target, measured off the open popup's real boxes.
 *
 * The rows come from the listbox pieces `Combobox` shares with `TagInput`, so this holds the shared
 * class as well as the component. The list is closed again with Escape, so the next check starts
 * from a closed field.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function comboboxRowHeightCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-coin"))
  await scrollToParked(devtools)
  const field = `globalThis.__verifyCombobox?.input ?? null`
  const landing = await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const rows = await devtools.evaluate<number[]>(
    `[...(globalThis.__verifyCombobox?.list?.querySelectorAll('[role="option"]') ?? [])]
      .map((row) => row.getBoundingClientRect().height)`,
  )
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  const shortest = rows.length === 0 ? 0 : Math.min(...rows)
  check(
    "every Combobox option row is at least 44 px tall",
    landing?.onTarget === true && rows.length > 0 && shortest >= 44,
    landing?.onTarget !== true
      ? "the click never landed on the field, so no popup was measured"
      : `shortest row ${shortest} px over ${rows.length} options`,
  )
}

/**
 * An open Combobox ignores the Enter and Escape that end an input method's composition, and still
 * answers a plain Enter and Escape.
 *
 * Safari sends the Enter that confirms a word with `isComposing` false and keyCode 229, so the
 * presses here are real ones with keyCode 229. The highlight is first moved off the selection with
 * ArrowDown, so a press that selected would change the field's value as well as close the list.
 * Then a plain Enter has to select the highlighted row, and a plain Escape on the reopened list has
 * to close it: the guard is not allowed to swallow every Enter and Escape.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function imeComboboxCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-coin"))
  await scrollToParked(devtools)
  const field = `globalThis.__verifyCombobox?.input ?? null`
  const read = () => devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  const landing = await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const opened = await read()
  await pressKey(devtools, "ArrowDown")
  await poll(
    () =>
      devtools.evaluate<boolean>(`${COMBOBOX_STATE}.active !== ${JSON.stringify(opened.active)}`),
    3_000,
  )
  const before = await read()

  await devtools.evaluate<null>(RECORD_IME_KEYS)
  await pressImeKey(devtools, "Enter")
  await pressImeKey(devtools, "Escape")
  // A fixed wait, not a poll: it proves the presses change nothing, and an absence has no state to
  // poll for. A press that selected or closed re-renders at once; give a wrong one time to show up.
  await new Promise((done) => setTimeout(done, 200))
  const keys = await devtools.evaluate<string>(TAKE_IME_KEYS)
  const ime = await read()
  check(
    "Enter and Escape with keyCode 229 neither select an option nor close an open Combobox",
    landing?.onTarget === true && before.expanded === "true" && before.activeText !== "" &&
      keys === "Enter 229 false, Escape 229 false" && ime.expanded === "true" &&
      ime.active === before.active && ime.inputValue === before.inputValue,
    `the click ${landing?.onTarget === true ? "landed" : "missed"}; open ${before.expanded}, ` +
      `highlight "${before.activeText}"; the page saw [${keys}]; then open ${ime.expanded}, ` +
      `highlight ${before.active} → ${ime.active}, field "${before.inputValue}" → ` +
      `"${ime.inputValue}"`,
  )

  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  const entered = await read()
  await pressKey(devtools, "ArrowDown")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const reopened = await read()
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  const escaped = await read()
  check(
    "a plain Enter still selects the highlighted Combobox option and a plain Escape still closes",
    entered.expanded === "false" && entered.inputValue === before.activeText &&
      reopened.expanded === "true" && escaped.expanded === "false",
    `Enter: open ${entered.expanded}, field "${entered.inputValue}" (highlight was ` +
      `"${before.activeText}"); ArrowDown: open ${reopened.expanded}; Escape: open ${escaped.expanded}`,
  )
}

/**
 * A list that changes under an open popup, both ways: options arriving, and options taken away.
 *
 * A field opened before its options have arrived shows the empty message, because opening it asked
 * a question. When the list lands underneath it three things have to happen at once: the message
 * goes, the input stops describing itself by it, and a row is highlighted — a list that arrives
 * with nothing highlighted leaves `Enter` doing nothing and tells a screen reader nothing came.
 *
 * The return leg is the half that was missing, and the defect it caught is worse than the one the
 * arrival fixed: with the highlight taken and the options then withdrawn,
 * `aria-activedescendant` went on naming a row the page no longer held. That is not a degraded
 * announcement but an invalid one — a reading position inside a list with no such row, on a field
 * that is saying at that same moment that there is nothing to match. So the reading below carries
 * `activeDangles`, which asks the page whether the pointer resolves to anything at all, rather
 * than only whether an attribute is present.
 *
 * The card's button arms the arrival rather than performing it, and that shape is forced: pressing
 * anything outside a combobox closes it, so the only way to have options land under an open popup
 * is to ask for them first and open the field while they are on their way. The check reads the
 * delay off the button rather than keeping its own copy, and asserts it really did get the field
 * open first — if the options beat it, the run proves nothing and says so.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function arrivingOptionsCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-empty"))
  await scrollToParked(devtools)

  // A scripted press of the card's own control, the way the Toastr checks press theirs: nothing
  // here is a claim about that button. What is under test starts at the field below it.
  const armed = await devtools.evaluate<{ ok: boolean; delay: number }>(`(() => {
    const button = document.querySelector('#demo-Combobox [data-e2e="combobox-load"]')
    if (button === null) return { ok: false, delay: 0 }
    button.click()
    return { ok: true, delay: Number(button.dataset.delay) }
  })()`)

  const field = `globalThis.__verifyCombobox?.input ?? null`
  const landing = await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const waiting = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  const landed = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.options > 0`),
    armed.delay * 4,
  )
  // The highlight follows the options in a later commit than the one that drew them, so on a slow
  // page it can still be on its way when the options already read as there (#269). Waited for,
  // not read once; a combobox that never highlights still fails, on the reading below.
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.active !== null`), 3_000)
  const arrived = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // The same control again. It empties the list on the press and refills it after the delay, so
  // this is the caller taking its options away with the popup open — the return leg of the same
  // walk. The press is scripted on purpose: a real press outside the popup would close it, and
  // what has to be driven here is a list changing under an open popup, which in an application is
  // a response landing rather than a click.
  await devtools.evaluate<null>(
    `(document.querySelector('#demo-Combobox [data-e2e="combobox-load"]')?.click(), null)`,
  )
  const emptied = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.options === 0`),
    3_000,
  )
  // The same for the highlight's departure.
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.active === null`), 3_000)
  const departed = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  check(
    "a Combobox follows its list under an open popup, in both directions",
    armed.ok && landing?.onTarget === true && waiting.expanded === "true" &&
      waiting.options === 0 && waiting.statusRole === "status" && waiting.active === null &&
      landed && arrived.expanded === "true" && arrived.options > 0 &&
      arrived.statusText === "" && arrived.describedBy === null &&
      arrived.active === "guide-combobox-empty-option-0" && arrived.activeText.length > 0 &&
      !arrived.activeDangles && emptied && departed.expanded === "true" &&
      departed.active === null && !departed.activeDangles,
    !armed.ok
      ? `the Combobox card has no [data-e2e="combobox-load"] control to arm`
      : landing?.onTarget !== true
      ? "the press never landed on the field, so it was never open when the options arrived"
      : waiting.options !== 0
      ? `the options were already there ${waiting.options} rows deep when the field opened, so ` +
        `they never arrived underneath it — this proves nothing`
      : waiting.statusRole !== "status"
      ? `the open, empty field renders no status to clear (role ${waiting.statusRole})`
      : waiting.active !== null
      ? `the open, empty field already points at ${waiting.active}, with no options to point at`
      : !landed
      ? `no options arrived within ${armed.delay * 4}ms of arming a ${armed.delay}ms wait`
      : arrived.expanded !== "true"
      ? "the popup closed while the options were arriving, so nothing landed underneath it"
      : arrived.statusText !== "" || arrived.describedBy !== null
      ? `${arrived.options} options arrived and the field's live region still reads ` +
        `"${arrived.statusText}"${
          arrived.describedBy === null ? "" : `, with the input still describing itself by it`
        }`
      : arrived.active !== "guide-combobox-empty-option-0"
      ? `${arrived.options} options arrived under the open popup and the highlight is ` +
        `${arrived.active ?? "nowhere"}: a screen reader is told nothing came, and Enter does ` +
        `nothing until an arrow key is pressed`
      : arrived.activeDangles
      ? `the highlight points at ${arrived.active}, which is not an element the page holds`
      : !emptied
      ? `the options never went away again, so the return leg proves nothing`
      : departed.expanded !== "true"
      ? "the popup closed when the options went away, so nothing was left open to check"
      : departed.active !== null
      ? `the options went away and the field still points at ${departed.active}` +
        `${
          departed.activeDangles
            ? ", which is not an element the page holds: a screen reader is left reading a row " +
              "that does not exist, on a field that says there are no matches"
            : ""
        }`
      : `open and empty: a polite live region reading "${waiting.statusText}" and no ` +
        `aria-activedescendant → ${arrived.options} options landed ${armed.delay}ms later: that ` +
        `same region is empty again, the input describes nothing, and the highlight is on ` +
        `"${arrived.activeText}" → the caller took them away again: no rows, no ` +
        `aria-activedescendant, and the popup still open`,
  )

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  await pointerToCorner(devtools)
}

/**
 * A combobox with no options says nothing until it is asked, and then answers.
 *
 * The defect: a page whose options arrive over the network renders this field with an empty list,
 * and the closed field showed "No matches" and announced it through a live region — to everybody,
 * about a control nobody had touched.
 *
 * Three readings rather than two, because each end of the rule can fail on its own. A component
 * that always shows the message fails the first; one that never shows it fails the second; and one
 * that shows it from the first touch onwards, forever, fails the third.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function untouchedComboboxCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-empty"))
  await scrollToParked(devtools)
  const untouched = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  const aim = await aimAt(devtools, `globalThis.__verifyCombobox?.input ?? null`)
  const landing = await clickAt(devtools, aim, `globalThis.__verifyCombobox?.input ?? null`)
  await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`),
    3_000,
  )
  const opened = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  const closed = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // "Silent" is now about what the region holds, not about whether there is one: the region is
  // always in the page, and the rule is that it carries no word until the field has been used.
  const silent = (reading: ComboboxReading) =>
    reading.statusRole === "status" && reading.statusText === "" && reading.statusChildren === 0
  check(
    "a Combobox with no options says nothing until it is opened, and answers only then",
    untouched.ok && untouched.expanded === "false" && untouched.options === 0 &&
      silent(untouched) && aim.onTarget && landing?.onTarget === true &&
      opened.expanded === "true" && opened.statusRole === "status" &&
      opened.statusLive === "polite" && opened.statusText.length > 0 && silent(closed),
    !untouched.ok
      ? "the Combobox card has no field with id guide-combobox-empty"
      : untouched.options !== 0
      ? `the field under test renders ${untouched.options} options, so it is not the empty one ` +
        `this check is about`
      : untouched.statusRole !== "status"
      ? `an untouched field renders no live region at all (role ${untouched.statusRole}), so a ` +
        `message would have to create one to arrive`
      : !silent(untouched)
      ? `an untouched, closed field's live region already reads "${untouched.statusText}" ` +
        `(${untouched.statusChildren} element children) — nobody has asked it anything`
      : !aim.onTarget || landing?.onTarget !== true
      ? `the press never landed on the field: ${
        landing === null
          ? `(${aim.x}, ${aim.y}) reads ${aim.tag} and the press never reached the page`
          : `it went to ${landing.tag} at (${landing.x}, ${landing.y})`
      } — a missed press, which proves nothing`
      : opened.expanded !== "true"
      ? "the field never opened on a real click, so the rest proves nothing"
      : opened.statusRole !== "status" || opened.statusLive !== "polite"
      ? `opened, the field renders no polite status region to answer with (role ` +
        `${opened.statusRole}, aria-live ${opened.statusLive})`
      : opened.statusText.length === 0
      ? `opened, the live region is still empty, so the field answered nothing`
      : !silent(closed)
      ? `closing the field left the region reading "${closed.statusText}", so once touched it ` +
        `never goes quiet again`
      : `untouched: an empty polite region and no aria-describedby → opened by a real click at ` +
        `(${landing.x}, ${landing.y}): that region now reads "${opened.statusText}" → closed ` +
        `with Escape: empty again`,
  )
}

/**
 * Reopening a Combobox highlights its selection, not a row the abandoned query chose.
 *
 * Opening drops the draft query, which widens the list back to every item — and the highlight used
 * to be placed against the *narrow* list the query had left. The row at that index in the wide list
 * is a different row, so abandoning a search and coming back highlighted whatever now happened to
 * sit where the search's first match used to be.
 *
 * The walk is deliberately the one a person takes: pick something far down the list, search for
 * something else, leave without choosing, and come back. Each step is asserted before the next is
 * read — a selection that never happened or a query that never arrived would otherwise make the
 * final reading meaningless.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function reopenCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-coin"))
  await scrollToParked(devtools)

  const field = `globalThis.__verifyCombobox?.input ?? null`
  const opened = await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)

  // The last row of the list, found by its text rather than by an index written down here: what
  // makes the check work is that the selection is far from the first row, not which row it is.
  const lastRow =
    `[...(globalThis.__verifyCombobox?.list?.querySelectorAll('[role="option"]') ?? [])]
    .at(-1) ?? null`
  const rowAim = await aimAt(devtools, lastRow)
  const picked = await clickAt(devtools, rowAim, lastRow)
  const chosen = await devtools.evaluate<string>(
    `(globalThis.__verifyCombobox?.list?.querySelectorAll('[role="option"]').length ?? 0) > 0
      ? [...globalThis.__verifyCombobox.list.querySelectorAll('[role="option"]')].at(-1).textContent.trim()
      : ""`,
  )
  await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.inputValue === ${JSON.stringify(chosen)}`),
    3_000,
  )
  const selected = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // Reopen before typing: opening empties the input of its selection, so the query is the one
  // character and not the selection with a character stuck to it.
  await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  await typeInto(devtools, "E")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.inputValue === "E"`), 3_000)
  const narrowed = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // Tab leaves the input for the clear button, which is a leave: the list closes and keeps the
  // query, which is the state the defect needs — a closed field with an abandoned search in it.
  await pressKey(devtools, "Tab")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  const abandoned = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // Focus rather than a click, and the difference is the whole defect. A click fires `focus` and
  // then `click`, and the component opens the list on both: the first call is the one that drops
  // the query and highlights against the stale list, and the second, running one render later,
  // quietly puts the highlight right again. Coming back to the field with the keyboard fires focus
  // alone, and nothing corrects it. `.focus()` is how that arrives here because tabbing backwards
  // needs Shift+Tab, which the shared key helper does not describe — what the page receives is the
  // single `focus` event a Tab into the field would deliver.
  await devtools.evaluate<null>(`(globalThis.__verifyCombobox?.input?.focus(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const reopened = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  check(
    "reopening a Combobox highlights its selection, not a row the abandoned query chose",
    opened?.onTarget === true && picked?.onTarget === true && chosen.length > 0 &&
      selected.inputValue === chosen && narrowed.options > 0 &&
      narrowed.options < selected.options &&
      narrowed.active === "guide-combobox-coin-option-0" &&
      reopened.options === selected.options && reopened.activeText === chosen,
    opened?.onTarget !== true || picked?.onTarget !== true
      ? `the press never landed on the field or on its last row, so nothing was selected — this ` +
        `proves nothing`
      : selected.inputValue !== chosen
      ? `clicking the last row left the field reading "${selected.inputValue}" rather than ` +
        `"${chosen}", so nothing was selected`
      : narrowed.inputValue !== "E"
      ? `the query never arrived: the field reads "${narrowed.inputValue}", so the list was ` +
        `never narrowed and this proves nothing`
      : narrowed.options >= selected.options
      ? `the query left all ${narrowed.options} rows in the list, so there is no narrow list for ` +
        `the reopening to be measured against`
      : narrowed.active !== "guide-combobox-coin-option-0"
      ? `the query "${narrowed.inputValue}" filtered the selection "${chosen}" out of the list and ` +
        `left the highlight on ${narrowed.active ?? "nothing"} rather than on the first row that ` +
        `survived it, so Enter right after typing would pick nothing`
      : abandoned.expanded !== "false"
      ? "Tab never closed the list, so the query was never abandoned"
      : reopened.options !== selected.options
      ? `reopening left ${reopened.options} rows rather than the full ${selected.options}, so the ` +
        `query was not dropped and the highlight has nothing to be wrong about`
      : reopened.activeText !== chosen
      ? `reopening highlighted "${reopened.activeText}" (${reopened.active}) rather than the ` +
        `selected "${chosen}": the highlight was placed against the ${narrowed.options} rows the ` +
        `abandoned query "${narrowed.inputValue}" had left, and that index is a different row in ` +
        `the full list of ${reopened.options}`
      : `selected "${chosen}" → the query "${narrowed.inputValue}" narrowed the list to ` +
        `${narrowed.options} of ${selected.options} rows, dropping the selection, and the ` +
        `highlight moved to the first row that survived → Tab abandoned it → focusing the field ` +
        `again restored all ${reopened.options} rows and highlighted "${reopened.activeText}" ` +
        `(${reopened.active}), the selection`,
  )

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  await pointerToCorner(devtools)
}

/** What the fetching field's live region said while one query was fetched, in order. */
interface FetchWalk {
  /** `false` when the card has no region under the fetching field's id. */
  ok: boolean
  /** Every distinct text the region passed through, `""` included, in the order it held them. */
  texts: string[]
  /** `true` when the region holding the last text is the element parked before typing. */
  same: boolean
  /** `aria-describedby` of the input as each text arrived, `null` when it carried none. */
  describedBy: (string | null)[]
}

/**
 * Park the fetching field's region and record every text it holds from here on.
 *
 * Every change is recorded, not sampled: a region that says "No matches" for one frame between two
 * polls has still told a screen reader so, and a poll could step over it. The input's description
 * is recorded with each text, because the empty message is what the input is described by and the
 * loading message must not be.
 */
const FETCH_PARK = `(() => {
  const region = document.getElementById("guide-combobox-fetch-status")
  const input = document.getElementById("guide-combobox-fetch")
  if (region === null || input === null) return false
  const walk = { region, texts: [""], describedBy: [input.getAttribute("aria-describedby")] }
  const record = () => {
    const text = (region.textContent ?? "").trim()
    if (text === walk.texts.at(-1)) return
    walk.texts.push(text)
    walk.describedBy.push(input.getAttribute("aria-describedby"))
  }
  walk.observer = new MutationObserver(record)
  walk.observer.observe(region, { childList: true, subtree: true, characterData: true })
  globalThis.__verifyFetch = walk
  return true
})()`

/** The walk so far; see {@link FetchWalk}. */
const FETCH_STATE = `(() => {
  const walk = globalThis.__verifyFetch ?? null
  const region = document.getElementById("guide-combobox-fetch-status")
  if (walk === null || region === null) return { ok: false, texts: [], same: false, describedBy: [] }
  return {
    ok: true,
    texts: [...walk.texts],
    same: region === walk.region,
    describedBy: [...walk.describedBy],
  }
})()`

/**
 * A field whose options are fetched per keystroke says it is loading, never "No matches", until
 * the fetch answers — and then says "No matches" when the answer is nothing (#205).
 *
 * The card's fetching field empties its list and sets `loading` on every keystroke, and answers
 * after a delay with the tickers that start with the query. `Z` starts none of them, so the one
 * query here walks the whole path: nothing, the caller's loading message, then the English default
 * empty message, all in the region that was there before the field was used. Every text the region
 * passes through is recorded by an observer attached beforehand, so a "No matches" that flashes
 * for one frame during the fetch is caught rather than stepped over by a poll.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function fetchingComboboxCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-fetch"))
  await scrollToParked(devtools)
  const parked = await devtools.evaluate<boolean>(FETCH_PARK)
  let walk: FetchWalk = { ok: false, texts: [], same: false, describedBy: [] }
  let landed = false
  let opened = false
  let typed = false
  let settled = false
  try {
    const field = `globalThis.__verifyCombobox?.input ?? null`
    landed = (await clickAt(devtools, await aimAt(devtools, field), field))?.onTarget === true
    opened = await poll(
      () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`),
      3_000,
    )
    await typeInto(devtools, "Z")
    typed = await poll(
      () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.inputValue === "Z"`),
      3_000,
    )
    // Waits for the end of the walk rather than for a number of milliseconds: the card's delay is
    // under a second, and the budget is five so a loaded machine is not mistaken for a broken field.
    settled = await poll(
      () => devtools.evaluate<boolean>(`${FETCH_STATE}.texts.at(-1) === "No matches"`),
      5_000,
    )
    walk = await devtools.evaluate<FetchWalk>(FETCH_STATE)
  } finally {
    await devtools.evaluate<null>(`(() => {
      globalThis.__verifyFetch?.observer?.disconnect()
      delete globalThis.__verifyFetch
      return null
    })()`).catch(() => null)
    await pressKey(devtools, "Escape")
    await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
    await pointerToCorner(devtools)
  }

  const loadingAt = walk.texts.indexOf("Searching tickers…")
  const lastLoading = walk.texts.lastIndexOf("Searching tickers…")
  const falseEmpty = walk.texts.findIndex((text, index) =>
    text.includes("No matches") && index < lastLoading
  )
  const mixed = walk.texts.find((text) =>
    text.includes("Searching tickers…") && text !== "Searching tickers…"
  )
  const final = walk.texts.at(-1) ?? ""
  const shown = walk.texts.map((text) => JSON.stringify(text)).join(" → ")
  check(
    'a Combobox that is loading says so, not "No matches", and says "No matches" once the fetch finds nothing',
    parked && walk.ok && landed && opened && typed && settled && loadingAt > 0 &&
      falseEmpty === -1 && mixed === undefined && final === "No matches" && walk.same &&
      walk.describedBy[loadingAt] === null &&
      walk.describedBy.at(-1) === "guide-combobox-fetch-status",
    !parked || !walk.ok
      ? "the Combobox card has no field with id guide-combobox-fetch and a live region beside it"
      : !landed || !opened
      ? "the press never opened the fetching field, so nothing was typed into it"
      : !typed
      ? "the query Z never reached the fetching field"
      : falseEmpty !== -1 || mixed !== undefined
      ? `the region said the list was empty while the options were still being fetched: ${shown}`
      : loadingAt <= 0
      ? `the region never carried the caller's loading message while the fetch ran: ${shown}`
      : walk.describedBy[loadingAt] !== null
      ? `the input was described by the region while it said the loading message ` +
        `(aria-describedby="${walk.describedBy[loadingAt]}"), which is a passing state, not a fact`
      : !settled || final !== "No matches"
      ? `the fetch for a query nothing starts with never ended in "No matches": ${shown}`
      : !walk.same
      ? `"No matches" arrived in a different element from the region parked before typing, which ` +
        `is the shape a screen reader does not announce`
      : walk.describedBy.at(-1) !== "guide-combobox-fetch-status"
      ? `once "No matches" arrived the input was described by ` +
        `"${walk.describedBy.at(-1)}", not by the region holding it`
      : `${shown}, every change recorded on the region parked before typing`,
  )
}

/** The parked combobox's option texts, in list order; `[]` while its list is hidden. */
const COMBOBOX_OPTIONS = `(() => {
  const list = globalThis.__verifyCombobox?.list
  return !list || list.hidden
    ? []
    : [...list.querySelectorAll('[role="option"]')].map((row) => row.textContent.trim())
})()`

/**
 * An input method's steps leave the Combobox list as it was, the finished word filters it once,
 * and plain typing still filters on every keystroke (#643).
 *
 * The coin card's list is opened with a click, so it shows all five coins under an empty query.
 * The composition builds "U" then "US": filtered, "U" alone would leave USD and EUR. The plain
 * typing then deletes the word and types "U" and "S" as two keystrokes, each of which must narrow
 * the list. Escape closes the field again for the next check.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function compositionComboboxCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-coin"))
  await scrollToParked(devtools)
  const field = `(globalThis.__verifyCombobox?.input ?? null)`
  const landing = await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const steps = ["U", "US"]
  const composed = await composeThenCommit(
    devtools,
    field,
    `globalThis.__verifyCombobox?.list ?? null`,
    COMBOBOX_OPTIONS,
    steps,
  )
  check(
    "an input method's steps leave the Combobox list unchanged, and the finished word filters it",
    landing?.onTarget === true && heldThenFiltered(composed, steps, ["USD"]),
    `the click ${landing?.onTarget === true ? "landed" : "missed"}; ${compositionDetail(composed)}`,
  )

  await pressTagKey(devtools, "Backspace")
  await pressTagKey(devtools, "Backspace")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.inputValue === ""`), 2_000)
  const cleared = await devtools.evaluate<string[]>(COMBOBOX_OPTIONS)
  const typed = await typeEachCharacter(devtools, COMBOBOX_OPTIONS, "US")
  check(
    "plain typing still filters the Combobox list on every keystroke",
    narrowedEachTime(cleared, typed),
    typingDetail("US", cleared, typed),
  )
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
}
