import { check, type Devtools, pointerToCorner, poll, pressKey } from "../harness.ts"
import {
  COMBOBOX_STATE,
  type ComboboxReading,
  comboboxSetup,
  scrollToParked,
} from "./combobox-shared.ts"
import { aimAt, clickAt } from "./shared.ts"
import { typeInto } from "./shared-typing.ts"

/** One reading of the parked live region: what it is, what it holds, and what it has recorded. */
interface RegionReading {
  /** `false` when the page holds no such region at all; every other field is then noise. */
  ok: boolean
  /**
   * `false` when there was no region to park while the field was empty.
   *
   * That is the defect itself rather than a broken check, so it is reported apart from `ok`: the
   * page can hold a perfectly good region carrying the right words and still have built it around
   * the message a moment ago.
   */
  parkedOk: boolean
  role: string | null
  live: string | null
  atomic: string | null
  /** Everything a reader would be told, trimmed. `""` is the empty region the field starts with. */
  text: string
  children: number
  /** `true` when the region the page holds now is the very element parked before the field was used. */
  same: boolean
  /** `true` when the parked element is still in the document. */
  connected: boolean
  /** Mutation records the observer saw **on that node itself**. */
  mutations: number
  added: number
  removed: number
  /** The region's own height in pixels; `0` is what an empty one must cost. */
  height: number
  /** Border, padding, margin and `min-height`, so "no box" is reported rather than implied. */
  box: string
}

/** What a parent of a whole combobox is charged for the region inside it, one layout mode a row. */
interface RegionCost {
  name: string
  withRegion: number
  without: number
  cost: number
}

/** The id of the catalogue field these checks own, and the base of its derived ids. */
const ANNOUNCE_ID = "guide-combobox-announce"

/**
 * Park that field's live region and start watching it, while it is still empty.
 *
 * The observer is attached to the **region itself** with `childList`, and the callback throws away
 * any record whose target is not that node. This is what makes the check unable to pass against the
 * old code: a region that is created along with its message is a child arriving in the region's
 * *parent*, and an observer given the parent with `subtree` would count that as a change. Given the
 * node itself, an observer records nothing at all when the page replaces it — which is exactly the
 * difference being asserted.
 */
const REGION_PARK = `(() => {
  const region = document.getElementById(${JSON.stringify(`${ANNOUNCE_ID}-status`)})
  if (region === null) return false
  const parked = { region, mutations: 0, added: 0, removed: 0 }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target !== region) continue
      parked.mutations += 1
      parked.added += record.addedNodes.length
      parked.removed += record.removedNodes.length
    }
  })
  observer.observe(region, { childList: true })
  parked.observer = observer
  globalThis.__verifyRegion = parked
  return true
})()`

/** What {@link REGION_RELEASE} reports about the observer it took down. */
interface RegionRelease {
  /** `true` when nothing was ever parked, so there is nothing to report and nothing to clean up. */
  idle: boolean
  /** Records a deliberate poke produced **before** the disconnect: positive means it was watching. */
  watching: number
  /** Records the same poke produced **after** it: anything but zero means it is watching still. */
  watchingStill: number
  /** `true` when the global is off the page. */
  gone: boolean
}

/**
 * Stop watching the region, prove it stopped, and take the global off the page.
 *
 * A live observer is a cost every later check pays — `pages/checks/system.ts` disconnects its own
 * for the same reason — and this file's longest block, Modal's, runs after these.
 *
 * The proof is two pokes around the disconnect, each read with `takeRecords()` rather than through
 * the callback: a `MutationObserver` delivers its callback in a microtask, so a tally read in the
 * same turn would be unchanged whether it is connected or not, while `takeRecords()` answers
 * synchronously. A stray comment node is the poke, appended and removed again, so the page is left
 * exactly as it was found.
 *
 * Safe to run when nothing was ever parked: the path out of a failed precondition runs it too.
 */
const REGION_RELEASE = `(() => {
  const parked = globalThis.__verifyRegion ?? null
  const region = parked?.region ?? null
  if (parked === null || region === null) {
    delete globalThis.__verifyRegion
    return { idle: true, watching: -1, watchingStill: -1, gone: true }
  }
  const poke = () => {
    const comment = document.createComment("release probe")
    region.appendChild(comment)
    comment.remove()
    return parked.observer.takeRecords().length
  }
  const watching = poke()
  parked.observer.disconnect()
  const watchingStill = poke()
  delete globalThis.__verifyRegion
  return { idle: false, watching, watchingStill, gone: globalThis.__verifyRegion === undefined }
})()`

/** The parked region as it stands now, identity and observer tally included. */
const REGION_STATE = `(() => {
  const parked = globalThis.__verifyRegion ?? null
  const region = document.getElementById(${JSON.stringify(`${ANNOUNCE_ID}-status`)})
  if (region === null) {
    return {
      ok: false, parkedOk: parked !== null, role: null, live: null, atomic: null, text: "",
      children: -1, same: false, connected: false, mutations: -1, added: -1, removed: -1,
      height: -1, box: "",
    }
  }
  const style = getComputedStyle(region)
  return {
    ok: true,
    parkedOk: parked !== null,
    role: region.getAttribute("role"),
    live: region.getAttribute("aria-live"),
    atomic: region.getAttribute("aria-atomic"),
    text: (region.textContent ?? "").trim().slice(0, 60),
    children: region.childElementCount,
    same: parked !== null && region === parked.region,
    connected: parked !== null && parked.region.isConnected,
    mutations: parked?.mutations ?? -1,
    added: parked?.added ?? -1,
    removed: parked?.removed ?? -1,
    height: Math.round(region.getBoundingClientRect().height),
    box: [
      style.borderTopWidth, style.borderBottomWidth, style.paddingTop, style.paddingBottom,
      style.marginTop, style.marginBottom, style.minHeight,
    ].join(" "),
  }
})()`

/**
 * What a host's container is charged for the always-present region, in six layout modes.
 *
 * The question a host actually faces is not what the region measures but what its *parent* spaces,
 * and the answer turns on where the region lives. `SWUpdater`'s region is the component's whole
 * output, so a host's `flex` or `grid` gap is charged for it; this one is a child of the combobox's
 * own root, so what the host lays out is one combobox-shaped box either way.
 *
 * Measured rather than argued: the real field is cloned into each parent, the parent is measured,
 * the clone's region is taken out, and the parent is measured again. The clone is mounted off
 * screen and removed before the expression returns.
 */
const REGION_COST = `(() => {
  const region = document.getElementById(${JSON.stringify(`${ANNOUNCE_ID}-status`)})
  const root = region?.parentElement ?? null
  if (root === null) return { ok: false, rows: [] }
  const host = document.createElement("div")
  host.style.cssText = "position:absolute;left:-10000px;top:0;width:320px"
  document.body.appendChild(host)
  const modes = [
    ["block flow, no spacing", ""],
    ["block flow with space-y-4", "space-y-4"],
    ["flex column with gap-4", "flex flex-col gap-4"],
    ["flex column with space-y-4", "flex flex-col space-y-4"],
    ["grid with gap-4", "grid gap-4"],
    ["grid with space-y-4", "grid space-y-4"],
  ]
  const rows = modes.map(([name, cls]) => {
    const parent = document.createElement("div")
    parent.className = cls
    const first = document.createElement("p")
    first.style.cssText = "height:24px;margin:0"
    const last = first.cloneNode(true)
    const field = root.cloneNode(true)
    parent.append(first, field, last)
    host.appendChild(parent)
    const withRegion = Math.round(parent.getBoundingClientRect().height)
    field.querySelector('[role="status"]')?.remove()
    const without = Math.round(parent.getBoundingClientRect().height)
    return { name, withRegion, without, cost: withRegion - without }
  })
  host.remove()
  return { ok: true, rows }
})()`

/**
 * The accessible **description** the browser computes for one element, as the tree reports it.
 *
 * Read over the DevTools Protocol rather than from the markup, because "described by an element
 * that happens to be empty" and "not described at all" are the same attribute and different trees,
 * and it is the tree a screen reader reads.
 *
 * @param devtools The connected session.
 * @param selector A CSS selector for the element.
 * @returns The description, `""` when the tree reports none, or `null` when it could not be read.
 */
async function accessibleDescription(
  devtools: Devtools,
  selector: string,
): Promise<string | null> {
  try {
    await devtools.send("Accessibility.enable")
    const document_ = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
      depth: 0,
    })
    const found = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
      nodeId: document_.root.nodeId,
      selector,
    })
    if (!found.nodeId) return null
    // `description` is a computed string — `{ type, value }` — and it is absent altogether when the
    // browser computes none. An earlier revision read `description.value.value`, which is undefined
    // for every node, so the check passed against an input that really was described: the break
    // that would not go red is what found it.
    const tree = await devtools.send<{ nodes: Array<{ description?: { value?: string } }> }>(
      "Accessibility.getPartialAXTree",
      { nodeId: found.nodeId, fetchRelatives: false },
    )
    const node = tree.nodes.at(0)
    if (node === undefined) return null
    return node.description?.value ?? ""
  } catch {
    return null
  }
}

/**
 * The live region the combobox keeps: there before it is needed, and changed rather than replaced.
 *
 * Three things a rendered string cannot show, and one of them is the whole issue. That the region
 * is in the page before anybody has touched the field, a unit test can pin. That a message *arrives
 * as a change to that same element* cannot be pinned anywhere but here, and it is the difference
 * between a screen reader announcing the count and saying nothing at all: assistive technology
 * announces a change to a region it is already watching, and commonly ignores a region that turns
 * up with its message already inside it.
 *
 * So the element is parked while it is genuinely empty and compared by identity afterwards, and a
 * `MutationObserver` is attached to that same node beforehand. A check that merely found "a status
 * region with the right text in it" after typing would pass against the old code just as well; both
 * of these go red on it, which the pull request shows by doing it.
 *
 * The field is the card's own, driven by nothing else, and both its strings come from props the
 * card passes — so no English default hard-coded anywhere could satisfy what is read back.
 *
 * The observer and the global it is parked on are taken down on every way out of here, a failed
 * precondition and a throw included, which is what the `finally` is for: the checks that follow —
 * Modal's among them, and they are the longest in this file — should not pay for one still
 * watching the combobox card.
 *
 * @param devtools The connected session, on a hydrated page, before the card has been touched.
 */
export async function liveRegionChecks(devtools: Devtools): Promise<void> {
  let release: RegionRelease = { idle: true, watching: -1, watchingStill: -1, gone: false }
  try {
    await runLiveRegionChecks(devtools)
  } finally {
    release = await devtools.evaluate<RegionRelease>(REGION_RELEASE).catch(() => release)
  }

  check(
    "the Combobox live-region checks leave nothing watching the page behind them",
    !release.idle && release.watching > 0 && release.watchingStill === 0 && release.gone,
    release.idle
      ? `no region was ever parked, so the checks above proved nothing and there was nothing to ` +
        `take down`
      : release.watching <= 0
      ? `the observer recorded nothing for a deliberate change to the region it was given, so it ` +
        `was not watching during the checks above and their evidence is worth nothing`
      : release.watchingStill !== 0
      ? `the observer still records changes to the region (${release.watchingStill} for one ` +
        `deliberate poke) after these checks finished: every package block below this one, ` +
        `Modal's included, would pay for it`
      : !release.gone
      ? `the observer is disconnected but globalThis.__verifyRegion is still on the page`
      : `one deliberate change to the region produced ${release.watching} record(s) while the ` +
        `checks ran and ${release.watchingStill} after the disconnect, and the global is off the ` +
        `page`,
  )
}

/**
 * The checks themselves — see {@link liveRegionChecks}, which owns parking and releasing the page.
 *
 * @param devtools The connected session, on a hydrated page, before the card has been touched.
 */
async function runLiveRegionChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup(ANNOUNCE_ID))
  await scrollToParked(devtools)
  const parked = await devtools.evaluate<boolean>(REGION_PARK)
  const pristine = await devtools.evaluate<RegionReading>(REGION_STATE)
  const field = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  const cost = await devtools.evaluate<{ ok: boolean; rows: RegionCost[] }>(REGION_COST)
  const describedBefore = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)

  const noBox = pristine.box === "0px 0px 0px 0px 0px 0px 0px"
  const charged = cost.rows.filter((row) => row.cost !== 0)
  const costTable = cost.rows.map((row) => `${row.name} ${row.cost}px`).join(", ")

  check(
    "a Combobox's live region is in the page, empty and costing nothing, before the field is used",
    parked && pristine.ok && pristine.role === "status" && pristine.live === "polite" &&
      pristine.atomic === "true" && pristine.text === "" && pristine.children === 0 &&
      pristine.height === 0 && noBox && field.ok && field.expanded === "false" &&
      cost.ok && charged.length === 0,
    !parked || !pristine.ok
      ? `the Combobox card has no live region with id ${ANNOUNCE_ID}-status, so there is nothing ` +
        `for a message to arrive in`
      : field.expanded !== "false"
      ? `the field was already open (aria-expanded ${field.expanded}) when this ran, so it is not ` +
        `the untouched state this check is about`
      : pristine.role !== "status" || pristine.live !== "polite" || pristine.atomic !== "true"
      ? `the region is marked role="${pristine.role}" aria-live="${pristine.live}" ` +
        `aria-atomic="${pristine.atomic}", and a reader announces a polite, atomic status`
      : pristine.text !== "" || pristine.children !== 0
      ? `an untouched field's region already reads "${pristine.text}" in ${pristine.children} ` +
        `element(s) — nobody has asked it anything`
      : pristine.height !== 0 || !noBox
      ? `the empty region is ${pristine.height}px tall with border/padding/margin/min-height of ` +
        `${pristine.box}, so it takes space on a field that is saying nothing`
      : !cost.ok
      ? "the region's own root could not be cloned, so what a parent is charged was not measured"
      : charged.length > 0
      ? `a parent holding the whole field is charged ${
        charged.map((row) => `${row.cost}px in a ${row.name}`).join(", ")
      } for the empty region`
      : `role="status" aria-live="polite" aria-atomic="true", 0 element children, text "", 0px ` +
        `tall with border/padding/margin/min-height ${pristine.box} — and a parent holding the ` +
        `whole field is charged nothing for it in any layout mode: ${costTable}`,
  )

  await countArrivesCheck(devtools, pristine)
  const describedCounting = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)
  await emptyMessageCheck(devtools)
  await describedByCheck(devtools, describedBefore, describedCounting)

  // Putting the page back for the checks below, not an assertion: every reading this block makes
  // has been taken and asserted by now, and nothing after this line is read.
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  await pointerToCorner(devtools)
}

/**
 * What the browser computes as the input's accessible description, in each state the region has.
 *
 * Read out of the accessibility tree over the protocol rather than off the markup, because
 * "described by an element that happens to be empty" and "not described at all" are the same
 * attribute and different trees, and it is the tree a reader reads.
 *
 * The rule being pinned is that the description follows the empty message and only the empty
 * message. It is a transition, so all of it is asserted: nothing on an untouched field, nothing
 * while a count is in the region, the message once the query matches nothing, and nothing again
 * once Tab closes the field, which drops the query with the list (#853).
 *
 * @param devtools The connected session, with the field open and the empty message in its region.
 * @param untouched The description read before the field was touched.
 * @param counting The description read while the region held the count.
 */
async function describedByCheck(
  devtools: Devtools,
  untouched: string | null,
  counting: string | null,
): Promise<void> {
  const message = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)

  // Tab leaves the input for the clear button, which the component treats as a leave: the list
  // closes and the query goes with it. The poll's answer is asserted, not dropped: a field that
  // never closed would otherwise pass on a region that emptied for some other reason.
  await pressKey(devtools, "Tab")
  const listClosed = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`),
    3_000,
  )
  const regionEmptied = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text === ""`),
    3_000,
  )
  const closed = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)

  const readings = [untouched, counting, message, closed]
  const named = `untouched "${untouched}", counting "${counting}", nothing matching ` +
    `"${message}", closed by Tab "${closed}"`

  check(
    "a Combobox's input is described by its live region for the empty message alone",
    !readings.includes(null) && untouched === "" && counting === "" &&
      message === "No coin left" && listClosed && regionEmptied && closed === "",
    readings.includes(null)
      ? `the accessibility tree could not be read for #${ANNOUNCE_ID}, so this proves nothing`
      : !listClosed
      ? `the Tab never closed the list, so the last reading is not the closed state`
      : !regionEmptied
      ? `the region still answers the query after Tab closed the field: ${named}`
      : untouched !== "" || counting !== ""
      ? `the field carries a description before anybody has asked it anything (untouched ` +
        `"${untouched}", with a count in the region "${counting}"): a count is about the last ` +
        `keystroke, and a description is re-read as part of the field every time it is announced`
      : message !== "No coin left" || closed !== ""
      ? `a field showing the empty message computes its description as "${message}", and the ` +
        `field Tab closed as "${closed}"`
      : `"" → "" → "No coin left" → "": ${named}`,
  )
}

/**
 * Typing narrows the list, and the count of what is left arrives in the region that was there.
 *
 * The assertion is a transition and an identity, not an end state: empty before, the caller's own
 * count afterwards, in an element compared with `===` against the one parked while it was empty,
 * with the observer attached to that node reporting the change it saw.
 *
 * Text is inserted the way every other combobox check here types — through the browser's own input
 * pipeline — so the component's `onInput` runs on a trusted event.
 *
 * @param devtools The connected session, with the region parked and watched.
 * @param pristine The reading taken before the field was touched, for the failure message.
 */
async function countArrivesCheck(devtools: Devtools, pristine: RegionReading): Promise<void> {
  const target = `globalThis.__verifyCombobox?.input ?? null`
  const landing = await clickAt(devtools, await aimAt(devtools, target), target)
  // Every poll's answer is kept and asserted below. One waited on and dropped would let the
  // reading after it stand for a state the page never reached.
  const fieldOpened = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`),
    3_000,
  )
  const opened = await devtools.evaluate<RegionReading>(REGION_STATE)

  // "e" leaves ETH and EUR, so the region speaks the plural count.
  await typeInto(devtools, "e")
  const queryArrived = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.inputValue === "e"`),
    3_000,
  )
  const regionSpoke = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text !== ""`),
    3_000,
  )
  const narrowed = await devtools.evaluate<RegionReading>(REGION_STATE)
  const list = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  check(
    "a Combobox's match count arrives as a change to the live region that was already there",
    pristine.ok && landing?.onTarget === true && fieldOpened && narrowed.parkedOk &&
      opened.text === "" && opened.mutations === 0 && queryArrived && regionSpoke &&
      list.options > 0 && narrowed.same && narrowed.connected &&
      narrowed.text === `${list.options} coins left` && narrowed.mutations >= 1 &&
      narrowed.added >= 1,
    landing?.onTarget !== true
      ? `the press never landed on the field, so nothing was typed into it — this proves nothing`
      : !fieldOpened
      ? `the field never opened on that press, so the reading taken next is not the open, empty ` +
        `state the count is measured against`
      : !queryArrived
      ? `the text never reached the field, so nothing narrowed the list`
      : !regionSpoke
      ? `the region was still empty ${3_000}ms after the query arrived, so typing announced nothing`
      : !narrowed.parkedOk
      ? `there was no region to park while the field was empty, so nothing was ever watched. The ` +
        `page now holds one reading "${narrowed.text}", which a check looking only for a status ` +
        `region with the right text in it would have accepted — that region was built around the ` +
        `message, which is the shape a screen reader does not announce`
      : opened.text !== "" || opened.mutations !== 0
      ? `opening the field alone put "${opened.text}" into the region (${opened.mutations} ` +
        `change(s)), so the count below is not what typing produced`
      : list.options === 0
      ? `the query left no options at all, so there was no count for the region to carry`
      : !narrowed.same || !narrowed.connected
      ? `the region holding the count is a different element from the one parked while it was ` +
        `empty (same: ${narrowed.same}, the parked one still in the document: ` +
        `${narrowed.connected}) — the page threw the watched region away and built a new one ` +
        `around the message, which is the shape a screen reader does not announce. It reads ` +
        `"${narrowed.text}", so a check that looked only for the right text would have passed`
      : narrowed.text !== `${list.options} coins left`
      ? `the region reads "${narrowed.text}" over ${list.options} matching options, rather than ` +
        `the count the card passes as a prop`
      : narrowed.mutations < 1 || narrowed.added < 1
      ? `an observer watching the parked region recorded ${narrowed.mutations} change(s) and ` +
        `${narrowed.added} added node(s) while the count appeared: the message did not arrive in ` +
        `the element that was being watched`
      : `the element parked while the region was empty is the same element that now reads ` +
        `"${narrowed.text}" over ${list.options} options, it is still in the document, and an ` +
        `observer attached to that node beforehand recorded ${narrowed.mutations} change(s) and ` +
        `${narrowed.added} added node(s) — a region created together with its message would have ` +
        `recorded none`,
  )
}

/**
 * The other two states of the same region: nothing matches, and the field is cleared.
 *
 * Three transitions in one walk, because each is only worth asserting against the one before it: a
 * query that matches nothing replaces the count with the empty message, the clear button empties
 * the region, and typing again brings the message back as a fresh change rather than as text that
 * was never taken away.
 *
 * @param devtools The connected session, with the field open and a count in its region.
 */
async function emptyMessageCheck(devtools: Devtools): Promise<void> {
  // As above, every poll's answer is kept: the reading taken after one that timed out would stand
  // for a state the page never reached, and the message it printed would not say so.
  await typeInto(devtools, "zz")
  const listEmptied = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.options === 0`),
    3_000,
  )
  const messageArrived = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text === "No coin left"`),
    3_000,
  )
  const nothing = await devtools.evaluate<RegionReading>(REGION_STATE)

  // The component's own clear button, pressed for real: the way a person empties the field.
  const clear = `globalThis.__verifyCombobox?.input?.parentElement?.querySelector("button") ?? null`
  const pressed = await clickAt(devtools, await aimAt(devtools, clear), clear)
  const regionEmptied = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text === ""`),
    3_000,
  )
  const cleared = await devtools.evaluate<RegionReading>(REGION_STATE)

  const target = `globalThis.__verifyCombobox?.input ?? null`
  const reopening = await clickAt(devtools, await aimAt(devtools, target), target)
  const reopened = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`),
    3_000,
  )
  await typeInto(devtools, "zz")
  const messageBack = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text === "No coin left"`),
    3_000,
  )
  const again = await devtools.evaluate<RegionReading>(REGION_STATE)

  check(
    "a Combobox's empty message replaces the count in that region, leaves it, and comes back",
    nothing.parkedOk && listEmptied && messageArrived && nothing.same &&
      nothing.text === "No coin left" && pressed?.onTarget === true && regionEmptied &&
      cleared.same && cleared.text === "" && cleared.children === 0 &&
      cleared.mutations > nothing.mutations && reopening?.onTarget === true && reopened &&
      messageBack && again.same && again.connected &&
      again.text === "No coin left" && again.mutations > cleared.mutations,
    !nothing.parkedOk
      ? `there was no region to park while the field was empty, so nothing was ever watched; the ` +
        `page now holds one reading "${nothing.text}"`
      : !listEmptied
      ? `the query still leaves options in the list, so this is not the nothing-matches state ` +
        `the empty message belongs to`
      : !messageArrived || nothing.text !== "No coin left"
      ? `a query matching nothing left the region reading "${nothing.text}" rather than the ` +
        `empty message the card passes`
      : pressed?.onTarget !== true
      ? `the press never landed on the clear button, so the field was never emptied`
      : !regionEmptied || cleared.text !== "" || cleared.children !== 0
      ? `clearing the field left "${cleared.text}" in the region (${cleared.children} element ` +
        `children), so it never went quiet`
      : cleared.mutations <= nothing.mutations
      ? `the observer recorded no change to the parked region when the message left it ` +
        `(${nothing.mutations} → ${cleared.mutations})`
      : reopening?.onTarget !== true || !reopened
      ? `the field never reopened on a real press, so the message did not arrive a second time ` +
        `into a field anybody had touched`
      : !messageBack || !again.same || !again.connected
      ? `typing again put the message in a different element (same: ${again.same}, the parked ` +
        `one still in the document: ${again.connected})`
      : again.text !== "No coin left" || again.mutations <= cleared.mutations
      ? `typing again left the region reading "${again.text}" after ` +
        `${again.mutations - cleared.mutations} further change(s), so the message did not arrive ` +
        `a second time`
      : `count → "${nothing.text}" → cleared by a real press on the clear button, empty with 0 ` +
        `children → typed again, "${again.text}" — one element throughout, with the observer ` +
        `recording ${again.mutations} changes to it in all`,
  )
}
