import {
  centreInView,
  check,
  type Devtools,
  openGuidePage,
  pointerToCorner,
  poll,
  pressKey,
} from "../harness.ts"
import { aimAt, blurActive, clickAt } from "./shared.ts"

/** Row keys, aria-sort of two headers, the demo's own readout text, and where focus sits. */
interface DataTableState {
  /** `false` when the card or one of the headers this file drives is missing. */
  ok: boolean
  /** `data-row-key` of every row on screen, in document order — see `rowKeyAttribute` in `ui/`. */
  rowKeys: string[]
  /** `aria-sort` of the Merchant column's `<th>`, or `null` when it carries none. */
  merchantAriaSort: string | null
  /** How many `<th>` in the card carry `aria-sort` at all. */
  ariaSortCount: number
  /** The demo's own `data-e2e="data-table-sort"` paragraph, e.g. `"merchant:asc"` or `"none"`. */
  readout: string
  /** `true` when the Merchant header's button holds focus. */
  onMerchant: boolean
}

/** Park references to the DataTable card, its Merchant header button and its pager. */
const DATA_TABLE_SETUP = `(() => {
  const card = document.querySelector('#demo-DataTable [data-e2e="data-table-client"]')
  const headerButtons = card ? [...card.querySelectorAll('th button')] : []
  const byLabel = (label) =>
    headerButtons.find((button) => button.textContent.includes(label)) ?? null
  const nav = card ? card.querySelector('nav[aria-label="Invoice pages"]') : null
  const controls = nav === null ? [] : [...nav.children].filter((node) => node.tagName === "BUTTON")
  globalThis.__verifyDataTable = {
    card,
    merchant: byLabel("Merchant"),
    readout: card ? card.querySelector('[data-e2e="data-table-sort"]') : null,
    next: controls[1] ?? null,
  }
  return {
    found: card !== null,
    merchantFound: globalThis.__verifyDataTable.merchant !== null,
    readoutFound: globalThis.__verifyDataTable.readout !== null,
    nextFound: globalThis.__verifyDataTable.next !== null,
  }
})()`

/** Row order, the Merchant column's `aria-sort`, the readout text, and whether Merchant is focused. */
const DATA_TABLE_STATE = `(() => {
  const store = globalThis.__verifyDataTable
  if (!store || !store.card) {
    return {
      ok: false, rowKeys: [], merchantAriaSort: null, ariaSortCount: -1, readout: "",
      onMerchant: false,
    }
  }
  const rowKeys = [...store.card.querySelectorAll("[data-row-key]")]
    .map((el) => el.getAttribute("data-row-key"))
  return {
    ok: true,
    rowKeys,
    merchantAriaSort: store.merchant ? store.merchant.closest("th").getAttribute("aria-sort") : null,
    ariaSortCount: store.card.querySelectorAll("[aria-sort]").length,
    readout: (store.readout?.textContent ?? "").trim(),
    onMerchant: document.activeElement === store.merchant,
  }
})()`

/**
 * `DataTable`'s sort-by-header, paging and URL contract: a real `<button>` per sortable header,
 * `aria-sort` on exactly the sorted column, a real mouse click or a Space press both sorting and
 * reversing, a page turn that does not cost the reader their place, and — on the separate,
 * URL-bound instance `pages/src/data-table-sort.tsx` mounts — a header press that round-trips
 * through `?sort=`.
 *
 * The click half and the Space half each drive the same column, Merchant, through the same two
 * transitions — sorted, then reversed — because that is the pair the issue's "Done when" asks for
 * on each input method rather than once for the component. The click half uses a real
 * `Input.dispatchMouseEvent` at the button's own rectangle (`clickMerchantHeader`), and asserts
 * the press landed on the button before trusting anything that followed it — a scripted `.click()`
 * fires with no hit-testing, so it would "click" a button a stray `pointer-events-none` had made
 * unreachable to an actual pointer. The Space half's own third press is a real Enter press instead:
 * {@link modalChecks} and {@link dropdownChecks} already prove `pressKey(devtools, "Enter")`
 * activates a focused native button in general, but only a press on this header's own listener can
 * catch a handler that called `preventDefault()` on Enter specifically (#261).
 *
 * Three presses on Merchant — ascending, descending, off — return the table to the unsorted
 * baseline before the Space half starts, so the two proofs begin from the same state instead of
 * one inheriting whatever the other left behind; the round trip back to the baseline is itself
 * checked, which is what confirms `toggleSort`'s third step (a rule cycles off, not just between
 * the two directions) actually reaches the header, not only the sort state. The Space half's own
 * three presses repeat that round trip with its last press swapped for a real Enter, which is what
 * lets it double as the Enter proof without a fourth press.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function dataTableChecks(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const found = await devtools.evaluate<
    { found: boolean; merchantFound: boolean; readoutFound: boolean; nextFound: boolean }
  >(DATA_TABLE_SETUP)

  const baseline = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  check(
    "the DataTable card renders its sortable Merchant header, sort readout and pager",
    found.found && found.merchantFound && found.readoutFound && found.nextFound && baseline.ok,
    !found.found
      ? 'there is no [data-e2e="data-table-client"] table in #demo-DataTable to drive'
      : !found.merchantFound
      ? 'no header button whose text includes "Merchant" was found'
      : !found.readoutFound
      ? 'no [data-e2e="data-table-sort"] readout was found'
      : !found.nextFound
      ? "the pager's Next control was not found"
      : !baseline.ok
      ? "the state reader could not read the card it just found"
      : "card, Merchant header, readout and pager all found",
  )
  check(
    "unsorted, the table shows its rows in input order and no header carries aria-sort",
    baseline.rowKeys.join(",") === "inv-1,inv-2,inv-3" && baseline.merchantAriaSort === null &&
      baseline.ariaSortCount === 0 && baseline.readout === "sort: none",
    `rows ${baseline.rowKeys.join(",")}, merchant aria-sort ${
      String(baseline.merchantAriaSort)
    }, ${baseline.ariaSortCount} header(s) sorted, readout "${baseline.readout}"`,
  )

  // Click half: the same column, twice, sorted then reversed — then a third click to confirm the
  // rule cycles off (asc → desc → off) rather than only ever toggling between the two directions.
  // Each click is a real `Input.dispatchMouseEvent` at the button's own rectangle, not a scripted
  // `.click()`, and each check asserts the press actually landed on the button before trusting
  // anything that followed it.
  const clickedOnce = await clickMerchantHeader(devtools)
  check(
    "a real mouse click on a sortable header lands on the button, sorts by it, and changes the row order",
    clickedOnce.onTarget && baseline.rowKeys.join(",") !== clickedOnce.state.rowKeys.join(",") &&
      clickedOnce.state.merchantAriaSort === "ascending" && clickedOnce.state.ariaSortCount === 1,
    !clickedOnce.onTarget
      ? `the press landed on ${clickedOnce.landingTag}, not the Merchant header button`
      : `rows ${baseline.rowKeys.join(",")} → ${clickedOnce.state.rowKeys.join(",")}, aria-sort ` +
        `${String(baseline.merchantAriaSort)} → ${String(clickedOnce.state.merchantAriaSort)}`,
  )

  const clickedTwice = await clickMerchantHeader(devtools)
  check(
    "clicking that header again reverses the sort, and the row order changes again",
    clickedTwice.onTarget &&
      clickedOnce.state.rowKeys.join(",") !== clickedTwice.state.rowKeys.join(",") &&
      clickedTwice.state.merchantAriaSort === "descending" &&
      clickedTwice.state.ariaSortCount === 1,
    !clickedTwice.onTarget
      ? `the press landed on ${clickedTwice.landingTag}, not the Merchant header button`
      : `rows ${clickedOnce.state.rowKeys.join(",")} → ${clickedTwice.state.rowKeys.join(",")}, ` +
        `aria-sort ${String(clickedOnce.state.merchantAriaSort)} → ` +
        `${String(clickedTwice.state.merchantAriaSort)}`,
  )

  const clickedThrice = await clickMerchantHeader(devtools)
  check(
    "a third click on the same header clears its sort, back to the unsorted baseline",
    clickedThrice.onTarget &&
      clickedThrice.state.rowKeys.join(",") === baseline.rowKeys.join(",") &&
      clickedThrice.state.merchantAriaSort === null && clickedThrice.state.ariaSortCount === 0,
    !clickedThrice.onTarget
      ? `the press landed on ${clickedThrice.landingTag}, not the Merchant header button`
      : `rows ${clickedTwice.state.rowKeys.join(",")} → ${
        clickedThrice.state.rowKeys.join(",")
      }, ` +
        `aria-sort ${String(clickedTwice.state.merchantAriaSort)} → ` +
        `${String(clickedThrice.state.merchantAriaSort)}`,
  )

  // Space half: the same two transitions, driven by a real key press on the focused header
  // button rather than a click, starting from the baseline the click half just returned to.
  // Parked first: the click half left the pointer resting on the Merchant button, and a hover
  // style is not part of what this half is proving.
  await pointerToCorner(devtools)
  await devtools.evaluate<null>(`(globalThis.__verifyDataTable?.merchant?.focus(), null)`)
  const pressedOnce = await pressMerchantHeader(devtools)
  check(
    "a real Space press on the focused header sorts by it, and keeps focus on the header",
    baseline.rowKeys.join(",") !== pressedOnce.rowKeys.join(",") &&
      pressedOnce.merchantAriaSort === "ascending" && pressedOnce.onMerchant,
    !pressedOnce.onMerchant
      ? `the press moved focus off the Merchant header`
      : `rows ${baseline.rowKeys.join(",")} → ${pressedOnce.rowKeys.join(",")}, aria-sort ` +
        `${String(baseline.merchantAriaSort)} → ${String(pressedOnce.merchantAriaSort)}`,
  )

  const pressedTwice = await pressMerchantHeader(devtools)
  check(
    "a second Space press reverses the sort again, still without losing focus",
    pressedOnce.rowKeys.join(",") !== pressedTwice.rowKeys.join(",") &&
      pressedTwice.merchantAriaSort === "descending" && pressedTwice.onMerchant,
    !pressedTwice.onMerchant
      ? "the second press moved focus off the Merchant header"
      : `rows ${pressedOnce.rowKeys.join(",")} → ${pressedTwice.rowKeys.join(",")}, aria-sort ` +
        `${String(pressedOnce.merchantAriaSort)} → ${String(pressedTwice.merchantAriaSort)}`,
  )

  // A real Enter press, on its own: the two presses above only prove Space reaches the header's
  // handler — a handler that called `preventDefault()` on Enter specifically would still pass both
  // of them (#261). Reverses the sort a third time, which conveniently is also the "back to
  // unsorted" step the paging check below needs.
  const pressedThrice = await pressMerchantHeader(devtools, "Enter")
  check(
    "a real Enter press on the focused header cycles the sort off again, still keeping focus",
    pressedTwice.rowKeys.join(",") !== pressedThrice.rowKeys.join(",") &&
      pressedThrice.merchantAriaSort === null && pressedThrice.onMerchant,
    !pressedThrice.onMerchant
      ? "the Enter press moved focus off the Merchant header"
      : `rows ${pressedTwice.rowKeys.join(",")} → ${pressedThrice.rowKeys.join(",")}, aria-sort ` +
        `${String(pressedTwice.merchantAriaSort)} → ${String(pressedThrice.merchantAriaSort)}`,
  )
  await blurActive(devtools)

  await dataTablePagingCheck(devtools)
  // The URL-bound demo is the host's own, at the end of the guide's UI page; opening the page again
  // starts it at its top.
  await openGuidePage(devtools, "ui")
  await dataTableUrlSortCheck(devtools)
  await openGuidePage(devtools, "ui")
  await dataTableRowIdentityCheck(devtools)
  await dataTableServerChecks(devtools)
}

/** A real mouse click on the Merchant header button, and where it landed. */
interface MerchantClick {
  /** The state once the click has settled. */
  state: DataTableState
  /** `true` when the press landed on the Merchant header button, or something inside it. */
  onTarget: boolean
  /** What the press actually landed on, for the failure message. */
  landingTag: string
}

/** Expression `aimAt`/`clickAt` read the Merchant header button through. */
const MERCHANT_TARGET = "globalThis.__verifyDataTable?.merchant ?? null"

/**
 * Click the Merchant header button with a real `Input.dispatchMouseEvent` at its own rectangle —
 * not a scripted `.click()`, which fires with no hit-testing and would still "click" a button
 * `pointer-events-none` had made unreachable by an actual pointer.
 *
 * Scrolled into view first: the coordinate `aimAt` derives is a viewport point, and the DataTable
 * card sits well down the page, below every check that ran before this file's own — a real click
 * dispatched at a point nothing has scrolled to lands on whatever is visible there instead, not on
 * a button that is currently off-screen.
 */
async function clickMerchantHeader(devtools: Devtools): Promise<MerchantClick> {
  const before = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  await centreInView(devtools, `globalThis.__verifyDataTable?.merchant ?? null`)
  const aim = await aimAt(devtools, MERCHANT_TARGET)
  const landing = await clickAt(devtools, aim, MERCHANT_TARGET)
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${DATA_TABLE_STATE}.readout !== ${JSON.stringify(before.readout)}`,
      ),
    2_000,
  )
  const state = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  return { state, onTarget: landing?.onTarget === true, landingTag: landing?.tag ?? "nothing" }
}

/**
 * Press a key on whatever holds focus (the Merchant header, throughout this file's Space and Enter
 * halves). Defaults to Space, which every existing call site still asks for by name.
 */
async function pressMerchantHeader(
  devtools: Devtools,
  key: "Space" | "Enter" = "Space",
): Promise<DataTableState> {
  const before = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  await pressKey(devtools, key)
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${DATA_TABLE_STATE}.readout !== ${JSON.stringify(before.readout)}`,
      ),
    2_000,
  )
  return await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
}

/**
 * Paging: pressing the pager's Next control moves to the last page and the rows change, and focus
 * stays on Next the same way it does in `paginationChecks` above — `DataTable` renders a real
 * `Pagination`, so this is that same contract, read off the DataTable card instead.
 *
 * @param devtools The connected session, unsorted (the block above leaves it that way) and on the
 *   pager's first page.
 */
async function dataTablePagingCheck(devtools: Devtools): Promise<void> {
  const before = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  await devtools.evaluate<null>(`(globalThis.__verifyDataTable?.next?.focus(), null)`)
  const onNext = await devtools.evaluate<boolean>(
    `document.activeElement === globalThis.__verifyDataTable?.next`,
  )

  await pressKey(devtools, "Space")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${DATA_TABLE_STATE}.rowKeys.join(",") !== ${JSON.stringify(before.rowKeys.join(","))}`,
      ),
    2_000,
  )
  const after = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  const afterOnNext = await devtools.evaluate<boolean>(
    `document.activeElement === globalThis.__verifyDataTable?.next`,
  )
  const nextDisabled = await devtools.evaluate<string | null>(
    `globalThis.__verifyDataTable?.next?.getAttribute("aria-disabled") ?? null`,
  )

  check(
    "a real Space press on the pager's focused Next control turns the page and its rows change",
    before.rowKeys.join(",") === "inv-1,inv-2,inv-3" && onNext &&
      after.rowKeys.join(",") === "inv-4,inv-5",
    !onNext
      ? "Next never took focus, so nothing was pressed"
      : before.rowKeys.join(",") !== "inv-1,inv-2,inv-3"
      ? `the page did not start on its first, unsorted page: ${before.rowKeys.join(",")}`
      : `rows ${before.rowKeys.join(",")} → ${after.rowKeys.join(",")}`,
  )
  check(
    "turning the page does not lose the reader's place: focus stays on Next",
    afterOnNext,
    afterOnNext ? "focus is still on Next" : "focus moved off Next when the page turned",
  )
  check(
    "Next reports it cannot act once the pager is on its last page",
    nextDisabled === "true",
    `Next's aria-disabled is ${String(nextDisabled)} on a 2-page pager's last page`,
  )
}

/** One read of `pages/src/data-table-sort.tsx`'s own card: its rows and its Customer column. */
interface DataTableUrlState {
  /** `false` when the section this file drives is missing. */
  ok: boolean
  /** `data-row-key` of every row on screen, in document order. */
  rowKeys: string[]
  /** `aria-sort` of the Customer column's `<th>`, or `null` when it carries none. */
  ariaSort: string | null
  /** `location.search`, `?` included. */
  search: string
  /** `history.length`, so one press costs exactly one entry. */
  entries: number
}

/** Park references to the URL-bound demo's section and its Customer header button. */
const DATA_TABLE_URL_SETUP = `(() => {
  const section = document.querySelector('[data-e2e="data-table-sort-url"]')
  const button = section
    ? ([...section.querySelectorAll("th button")].find((b) => b.textContent.includes("Customer")) ?? null)
    : null
  globalThis.__verifyDataTableUrl = { section, button }
  return { found: section !== null, buttonFound: button !== null }
})()`

/** Rows, the Customer column's `aria-sort`, and the address, read in one round trip. */
const DATA_TABLE_URL_STATE = `(() => {
  const store = globalThis.__verifyDataTableUrl
  if (!store || !store.section) {
    return { ok: false, rowKeys: [], ariaSort: null, search: "", entries: -1 }
  }
  const rowKeys = [...store.section.querySelectorAll("[data-row-key]")]
    .map((el) => el.getAttribute("data-row-key"))
  return {
    ok: true,
    rowKeys,
    ariaSort: store.button ? store.button.closest("th").getAttribute("aria-sort") : null,
    search: location.search,
    entries: history.length,
  }
})()`

/**
 * Read the URL-bound demo once it has stopped moving: two identical readings in a row.
 *
 * `useUrlFilters` writes the address from a `useSignalEffect`, a render cycle behind the signal
 * write that also drives `DataTable`'s own re-render — polling on one field alone caught that gap
 * both ways: `search` moved once while `aria-sort` still read the pre-press value, and `aria-sort`
 * moved once while `search` still read the pre-press address. Waiting for the whole reading to
 * repeat itself is what `pages/checks/signals.ts`'s own `settled` does for the same reason, over
 * the same two effects.
 */
async function settledDataTableUrlState(devtools: Devtools): Promise<DataTableUrlState> {
  let previous: DataTableUrlState | null = null
  let steady: DataTableUrlState | null = null
  await poll(async () => {
    const current = await devtools.evaluate<DataTableUrlState>(DATA_TABLE_URL_STATE)
    const same = previous !== null && previous.ok === current.ok &&
      previous.search === current.search && previous.entries === current.entries &&
      previous.ariaSort === current.ariaSort &&
      previous.rowKeys.join(",") === current.rowKeys.join(",")
    previous = current
    if (same) steady = current
    return same
  }, 2_000)
  return steady ?? previous ?? await devtools.evaluate<DataTableUrlState>(DATA_TABLE_URL_STATE)
}

/**
 * The URL half of `DataTable`'s sort contract: `pages/src/data-table-sort.tsx` binds `sort` to
 * `?sort=` through `useUrlFilters`, and this is what proves the binding rather than only the
 * conversion `parseSort`/`serializeSort` do — see that file's own doc comment for why the binding
 * lives there and not on a catalogue card.
 *
 * Run after `dataTableChecks`' own block, on an entirely separate `DataTable` instance mounted
 * lower on the same page; nothing above this function touches `location`, so a stray write here
 * would be this check's own doing. Every assertion is a transition off the address this function
 * itself just read, never an assumption about what the address held before it ran — `signals/`'s
 * own checks, in the package block that runs before this one, restore the address they started
 * from, but this function does not depend on knowing what that was.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function dataTableUrlSortCheck(devtools: Devtools): Promise<void> {
  const found = await devtools.evaluate<{ found: boolean; buttonFound: boolean }>(
    DATA_TABLE_URL_SETUP,
  )
  const before = await settledDataTableUrlState(devtools)
  check(
    "the URL-bound DataTable demo renders its section and a Customer header button",
    found.found && found.buttonFound && before.ok,
    !found.found
      ? 'there is no [data-e2e="data-table-sort-url"] section to drive'
      : !found.buttonFound
      ? 'no header button whose text includes "Customer" was found'
      : !before.ok
      ? "the state reader could not read the section it just found"
      : "section and Customer header button both found",
  )

  await devtools.evaluate<null>(`(globalThis.__verifyDataTableUrl?.button?.click(), null)`)
  const pressed = await settledDataTableUrlState(devtools)

  check(
    "pressing a header on the URL-bound demo writes its sort to the address as ?sort=",
    pressed.search !== before.search &&
      (pressed.search.includes("sort=customer%3Aasc") ||
        pressed.search.includes("sort=customer:asc")),
    `search ${before.search || "(empty)"} → ${pressed.search}`,
  )
  check(
    "that write costs exactly one history entry",
    pressed.entries - before.entries === 1,
    `history.length ${before.entries} → ${pressed.entries}`,
  )
  check(
    "the same press sorts the demo's own rows and marks the column aria-sort=ascending",
    before.rowKeys.join(",") !== pressed.rowKeys.join(",") && pressed.ariaSort === "ascending",
    `rows ${before.rowKeys.join(",")} → ${pressed.rowKeys.join(",")}, aria-sort ` +
      `${String(before.ariaSort)} → ${String(pressed.ariaSort)}`,
  )

  await devtools.evaluate<null>(`(history.back(), null)`)
  const backed = await settledDataTableUrlState(devtools)

  check(
    "one press of Back restores the address, the row order, and drops aria-sort",
    backed.search === before.search && backed.rowKeys.join(",") === before.rowKeys.join(",") &&
      backed.ariaSort === null,
    `search ${pressed.search} → ${backed.search}, rows ${pressed.rowKeys.join(",")} → ` +
      `${backed.rowKeys.join(",")}, aria-sort ${String(pressed.ariaSort)} → ${
        String(backed.ariaSort)
      }`,
  )

  await blurActive(devtools)
}

// ---------------------------------------------------------------------------------------------
// Table / DataTable: row identity (#234) and server mode (#235).
// ---------------------------------------------------------------------------------------------

/** One body row of the DataTable card, as the row-identity check reads it. */
interface DataTableIdentityRow {
  /** The row's `data-row-key`. */
  key: string
  /** The key this `<tr>` element was tagged with before the reorder, or `null` for an untagged one. */
  tag: string | null
  /** Whether the row's own Flag checkbox is ticked. */
  flagged: boolean
}

/** Every body row of the client DataTable, with its tag and its Flag checkbox's state. */
const DATA_TABLE_IDENTITY_ROWS = `(() => {
  const card = globalThis.__verifyDataTable?.card ?? null
  if (!card) return []
  return [...card.querySelectorAll("tbody tr")]
    .filter((tr) => tr.querySelector("[data-row-key]") !== null)
    .map((tr) => ({
      key: tr.querySelector("[data-row-key]").getAttribute("data-row-key"),
      tag: tr.__verifyRowTag ?? null,
      flagged: tr.querySelector('input[type="checkbox"]')?.checked === true,
    }))
})()`

/**
 * `Table` keys a body row by the identity the caller gives it (`bodyKeys`, which `DataTable` fills
 * from `rowKey`), not by its position (#234).
 *
 * On the DataTable card, unsorted, this tags every `<tr>` element with the key it shows, ticks the
 * Flag checkbox of `inv-1` — an uncontrolled checkbox, so its tick is DOM state no signal holds —
 * and then sorts by Merchant with a real click, which moves `inv-1` from the first row to the
 * second and brings `inv-3` to the top. Keyed by identity, each surviving `<tr>` still carries its
 * own key's tag and the tick is still on `inv-1`. Keyed by position — the bug — the first `<tr>` is
 * repainted in place: it now shows `inv-3` while still carrying `inv-1`'s tag and tick.
 *
 * Starts by turning the card back to its first page, and ends by unticking the box and cycling
 * the sort back off, so the card is left unsorted and unticked.
 *
 * @param devtools The connected session, on a freshly opened guide page.
 */
async function dataTableRowIdentityCheck(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  await devtools.evaluate(DATA_TABLE_SETUP)
  // Reopening the guide page does not remount the card, so its page and sort are whatever the
  // checks above left: the paging check leaves it on page 2. Back to page 1 first — a scripted
  // click, because turning the page is setup here, not what this check proves.
  await devtools.evaluate<null>(`(globalThis.__verifyDataTable?.card
    ?.querySelector('nav[aria-label="Invoice pages"] [aria-label="Page 1"]')?.click(), null)`)
  await poll(
    () =>
      devtools.evaluate<boolean>(`${DATA_TABLE_STATE}.rowKeys.join(",") === "inv-1,inv-2,inv-3"`),
    2_000,
  )
  const prepared = await devtools.evaluate<DataTableIdentityRow[]>(`(() => {
    const card = globalThis.__verifyDataTable?.card ?? null
    if (!card) return []
    for (const tr of card.querySelectorAll("tbody tr")) {
      const cell = tr.querySelector("[data-row-key]")
      if (cell) tr.__verifyRowTag = cell.getAttribute("data-row-key")
    }
    card.querySelector('[data-row-key="inv-1"]')?.closest("tr")
      ?.querySelector('input[type="checkbox"]')?.click()
    return ${DATA_TABLE_IDENTITY_ROWS}
  })()`)
  const preparedRows = prepared.map((row) => `${row.key}${row.flagged ? "*" : ""}`).join(",")
  check(
    "the DataTable card starts unsorted with a Flag checkbox per row, and inv-1 ticks",
    preparedRows === "inv-1*,inv-2,inv-3",
    `rows (ticked marked *): ${preparedRows || "(none)"}`,
  )

  const sorted = await clickMerchantHeader(devtools)
  const after = await devtools.evaluate<DataTableIdentityRow[]>(DATA_TABLE_IDENTITY_ROWS)
  const afterRows = after.map((row) =>
    `${row.key}${row.flagged ? "*" : ""}${row.tag === null ? "" : `(was ${row.tag})`}`
  ).join(",")
  const order = after.map((row) => row.key).join(",")
  const tagsFollow = after.every((row) => row.tag === null || row.tag === row.key)
  const survivors = after.filter((row) => row.tag !== null).map((row) => row.key).sort().join(",")
  const ticked = after.filter((row) => row.flagged).map((row) => row.key).join(",")
  check(
    "sorting moves each row's own <tr>, and its ticked checkbox, to the row's new position",
    sorted.onTarget && order === "inv-3,inv-1,inv-5" && tagsFollow && survivors === "inv-1,inv-3" &&
      ticked === "inv-1",
    !sorted.onTarget
      ? `the press landed on ${sorted.landingTag}, not the Merchant header button`
      : `rows after sorting (ticked *, element's earlier key in brackets): ${afterRows}`,
  )

  // Leave the card as found: unticked, and the sort cycled on through descending back off.
  await devtools.evaluate<null>(`(() => {
    const card = globalThis.__verifyDataTable?.card
    card?.querySelector('[data-row-key="inv-1"]')?.closest("tr")
      ?.querySelector('input[type="checkbox"]')?.click()
    return null
  })()`)
  for (let press = 0; press < 2; press++) {
    const before = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
    await devtools.evaluate<null>(`(globalThis.__verifyDataTable?.merchant?.click(), null)`)
    await poll(
      () =>
        devtools.evaluate<boolean>(
          `${DATA_TABLE_STATE}.readout !== ${JSON.stringify(before.readout)}`,
        ),
      2_000,
    )
  }
}

/** One read of the DataTable card's server-mode table. */
interface DataTableServerState {
  /** `false` when the server-mode table this file drives is missing. */
  ok: boolean
  /** `data-row-key` of every row on screen, in document order. */
  rowKeys: string[]
  /** `aria-sort` of the Merchant column's `<th>`, or `null` when it carries none. */
  merchantAriaSort: string | null
  /** The demo's readout: the sort, the page and how many rows the "server" answered with. */
  readout: string
  /** Text of the page button marked `aria-current="page"`, or `""` for none. */
  currentPage: string
  /** How many numbered page buttons the pager shows. */
  pageButtons: number
  /** `aria-disabled` of the pager's Next control. */
  nextDisabled: string | null
  /** `"merchant"`, `"next"` or `"other"`: which of the driven controls holds focus. */
  focus: string
}

/** Park references to the server-mode table, its Merchant header button and its Next control. */
const DATA_TABLE_SERVER_SETUP = `(() => {
  const section = document.querySelector('#demo-DataTable [data-e2e="data-table-server"]')
  const merchant = section
    ? ([...section.querySelectorAll("th button")].find((b) => b.textContent.includes("Merchant")) ?? null)
    : null
  const nav = section ? section.querySelector('nav[aria-label="Server invoice pages"]') : null
  const next = nav
    ? ([...nav.querySelectorAll("button")].find((b) => b.textContent.trim() === "Next") ?? null)
    : null
  globalThis.__verifyDataTableServer = { section, merchant, nav, next }
  return { found: section !== null, merchantFound: merchant !== null, nextFound: next !== null }
})()`

/** Rows, `aria-sort`, readout, pager and focus of the server-mode table, in one round trip. */
const DATA_TABLE_SERVER_STATE = `(() => {
  const store = globalThis.__verifyDataTableServer
  if (!store || !store.section) {
    return {
      ok: false, rowKeys: [], merchantAriaSort: null, readout: "", currentPage: "",
      pageButtons: -1, nextDisabled: null, focus: "other",
    }
  }
  const active = document.activeElement
  return {
    ok: true,
    rowKeys: [...store.section.querySelectorAll("[data-row-key]")]
      .map((el) => el.getAttribute("data-row-key")),
    merchantAriaSort: store.merchant ? store.merchant.closest("th").getAttribute("aria-sort") : null,
    readout: (store.section.querySelector('[data-e2e="data-table-server-readout"]')?.textContent ?? "")
      .replace(/\\s+/g, " ").trim(),
    currentPage: (store.nav?.querySelector('[aria-current="page"]')?.textContent ?? "").trim(),
    pageButtons: store.nav ? store.nav.querySelectorAll("li button").length : -1,
    nextDisabled: store.next ? store.next.getAttribute("aria-disabled") : null,
    focus: active === store.merchant ? "merchant" : active === store.next ? "next" : "other",
  }
})()`

/** Press a key on whatever holds focus, then wait for the server table's readout to change. */
async function pressOnServerTable(
  devtools: Devtools,
  key: "Space" | "Enter",
): Promise<DataTableServerState> {
  const before = await devtools.evaluate<DataTableServerState>(DATA_TABLE_SERVER_STATE)
  await pressKey(devtools, key)
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${DATA_TABLE_SERVER_STATE}.readout !== ${JSON.stringify(before.readout)}`,
      ),
    2_000,
  )
  return await devtools.evaluate<DataTableServerState>(DATA_TABLE_SERVER_STATE)
}

/** One line of a server-table state, for a failure message. */
function describeServerState(state: DataTableServerState): string {
  return `rows ${state.rowKeys.join(",")}, aria-sort ${String(state.merchantAriaSort)}, page ` +
    `${state.currentPage || "(none)"} of ${state.pageButtons}, focus on ${state.focus}, readout ` +
    `"${state.readout}"`
}

/**
 * `DataTable`'s server mode (#235), on the second table of the DataTable card: the card's own
 * `fetchInvoicePage` sorts and pages eight invoices and hands `DataTable` one page of three plus the
 * total. Driven by real key presses only: Enter and then Space on the focused Merchant header,
 * Space and then Enter on the pager's focused Next control.
 *
 * What it proves: a header press still reaches `onSortChange` and `aria-sort` in this mode, the
 * rows on screen are exactly the page the "server" answered with, the pager is sized from `total`
 * (three pages from three rows in hand), and focus stays on the control that was pressed. The
 * "server" orders text by code unit, so descending it puts "eBay refund" (`inv-8`) first; a
 * client-side re-sort of that page with `sortRows`' locale-aware collation would put it last
 * (`inv-4,inv-2,inv-8`), and a client-side slice of a page the server already cut would show page
 * 1's rows, or none, on pages 2 and 3. Ends with a scripted click that cycles
 * the sort off, which also returns the table to page 1.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function dataTableServerChecks(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const found = await devtools.evaluate<
    { found: boolean; merchantFound: boolean; nextFound: boolean }
  >(DATA_TABLE_SERVER_SETUP)
  const baseline = await devtools.evaluate<DataTableServerState>(DATA_TABLE_SERVER_STATE)
  check(
    "server mode: the DataTable card's server table shows the server's first page, pager sized from its total",
    found.found && found.merchantFound && found.nextFound &&
      baseline.rowKeys.join(",") === "inv-1,inv-2,inv-3" && baseline.merchantAriaSort === null &&
      baseline.currentPage === "1" && baseline.pageButtons === 3 &&
      baseline.readout.includes("3 of 8 rows"),
    !found.found
      ? 'there is no [data-e2e="data-table-server"] table in #demo-DataTable'
      : !found.merchantFound
      ? "no Merchant header button was found in the server table"
      : !found.nextFound
      ? "the server table's pager has no Next control"
      : describeServerState(baseline),
  )

  await centreInView(devtools, "globalThis.__verifyDataTableServer?.merchant ?? null")
  await devtools.evaluate<null>(`(globalThis.__verifyDataTableServer?.merchant?.focus(), null)`)
  const ascending = await pressOnServerTable(devtools, "Enter")
  check(
    "server mode: a real Enter press on the focused header asks for the sorted page and shows it as given",
    ascending.rowKeys.join(",") === "inv-3,inv-6,inv-1" &&
      ascending.merchantAriaSort === "ascending" && ascending.focus === "merchant" &&
      ascending.currentPage === "1",
    describeServerState(ascending),
  )

  const descending = await pressOnServerTable(devtools, "Space")
  check(
    "server mode: a real Space press on the same header reverses the sort in the server's collation, not the client's",
    descending.rowKeys.join(",") === "inv-8,inv-4,inv-2" &&
      descending.merchantAriaSort === "descending" && descending.focus === "merchant",
    describeServerState(descending),
  )

  await devtools.evaluate<null>(`(globalThis.__verifyDataTableServer?.next?.focus(), null)`)
  const second = await pressOnServerTable(devtools, "Space")
  check(
    "server mode: a real Space press on the focused Next control shows the server's page 2, keeping focus",
    second.rowKeys.join(",") === "inv-5,inv-7,inv-1" && second.currentPage === "2" &&
      second.merchantAriaSort === "descending" && second.focus === "next",
    describeServerState(second),
  )

  const last = await pressOnServerTable(devtools, "Enter")
  check(
    "server mode: a real Enter press on Next shows the short last page, and Next reports it cannot act",
    last.rowKeys.join(",") === "inv-6,inv-3" && last.currentPage === "3" &&
      last.nextDisabled === "true" && last.focus === "next",
    `${describeServerState(last)}, Next aria-disabled ${String(last.nextDisabled)}`,
  )

  await blurActive(devtools)
  await devtools.evaluate<null>(`(globalThis.__verifyDataTableServer?.merchant?.click(), null)`)
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${DATA_TABLE_SERVER_STATE}.rowKeys.join(",") === "inv-1,inv-2,inv-3"`,
      ),
    2_000,
  )
}
