import { check, type Devtools, pointerToCorner, poll, pressKey } from "../harness.ts"
import { blurActive } from "./shared.ts"

/** One read of the pager being driven: which page it is on, and what its two end controls are. */
interface PagerState {
  /** `false` when the card is missing the nav or one of its controls. */
  ok: boolean
  /** The page marked `aria-current="page"`, or `0` when none is. */
  page: number
  previousDisabled: boolean
  nextDisabled: boolean
  /**
   * `true` when a control carries the **native** `disabled` attribute.
   *
   * Read so that a failure can name the mistake rather than its symptom. Chromium takes focus off a
   * focused button the moment that attribute appears, so a component that reached for it would fail
   * these checks with "focus is on the page", which is the reported defect's own message and says
   * nothing about the cause.
   */
  nativelyDisabled: boolean
  onPrevious: boolean
  onNext: boolean
  /**
   * `true` while the two parked controls are still the ones the nav renders, compared by identity.
   * A control Preact unmounted and put back is a different element that a selector would still
   * find, and losing the element is the whole defect.
   */
  sameControls: boolean
  /**
   * The last page the card's `onChange` was asked for, or `0` before it has been asked for any.
   *
   * Read from the card rather than from the pager, and it is the only way to see a request the
   * component then clamped away: asking for page 6 of 5 leaves the pager on page 5, which is
   * exactly where it already was. Removing the guard from the disabled control's handler and
   * rebuilding left every check in this file green until the card started reporting this.
   */
  requested: number
  /** The focused element's text, cut short, for the failure message. */
  label: string
}

/**
 * Park the five-page pager's nav and its two end controls.
 *
 * The controls are the `nav`'s own button children — the page numbers live inside the `ul` between
 * them — so nothing here depends on the card's copy, which is the caller's and may be translated.
 * The nav is picked by its accessible name because the card renders three of them.
 */
const PAGER_SETUP = `(() => {
  const nav = document.querySelector('#demo-Pagination nav[aria-label="Five pages"]')
  const controls = nav === null
    ? []
    : [...nav.children].filter((node) => node.tagName === "BUTTON")
  globalThis.__verifyPager = {
    nav,
    previous: controls[0] ?? null,
    next: controls[1] ?? null,
    readout: document.querySelector('#demo-Pagination [data-e2e="pagination-requested"]'),
  }
  return {
    found: nav !== null,
    controls: controls.length,
    readout: globalThis.__verifyPager.readout !== null,
  }
})()`

/** The pager's page, its two controls' state and where focus is, read in one round trip. */
const PAGER_STATE = `(() => {
  const { nav, previous, next, readout } = globalThis.__verifyPager ?? {}
  if (!nav || !previous || !next) {
    return {
      ok: false, page: 0, previousDisabled: false, nextDisabled: false,
      nativelyDisabled: false, onPrevious: false, onNext: false, sameControls: false,
      requested: -1, label: "",
    }
  }
  const active = document.activeElement
  const current = nav.querySelector('[aria-current="page"]')
  const buttons = [...nav.children].filter((node) => node.tagName === "BUTTON")
  const asked = (readout?.textContent ?? "").match(/onChange: (\\d+)/)
  return {
    ok: true,
    page: current === null ? 0 : Number((current.textContent ?? "").trim()),
    previousDisabled: previous.getAttribute("aria-disabled") === "true",
    nextDisabled: next.getAttribute("aria-disabled") === "true",
    nativelyDisabled: previous.disabled === true || next.disabled === true,
    onPrevious: active === previous,
    onNext: active === next,
    sameControls: buttons.length === 2 && buttons[0] === previous && buttons[1] === next,
    requested: readout === null ? -1 : (asked === null ? 0 : Number(asked[1])),
    label: active === document.body
      ? "the page"
      : (active?.textContent ?? "").trim().slice(0, 40),
  }
})()`

/**
 * Pagination's end controls survive being paged to the end, with the focus that was on them.
 *
 * The defect was that they did not exist there: a control that cannot act was left out of the
 * render, so the last Space press a keyboard user made destroyed the button under their finger and
 * dropped focus to the page. No string-rendering test can see any of this — it needs a focused
 * element, a real key press, and a component that re-renders in between.
 *
 * Two things every reading here insists on beyond the obvious. Focus is compared by **identity**
 * against the element parked before the paging started, because a selector would also match a
 * freshly mounted Next button that never had focus — which is exactly the state the defect leaves
 * behind, minus the focus. And the page number is read from `aria-current="page"` after each press,
 * so a control that kept its focus by never doing anything is a failure rather than a pass.
 *
 * Mostly Space: the walk below presses Space, which still activates a button carrying
 * `aria-disabled` — which is why the component guards its own handler, and why one of the checks
 * below presses a disabled control and asserts nothing happened. A real Enter press is proven
 * separately, once, on Next: Space alone would not catch a handler that called `preventDefault()`
 * on Enter specifically, which the Dropdown and Modal checks elsewhere in this file do not stand in
 * for here.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function paginationChecks(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const found = await devtools.evaluate<{ found: boolean; controls: number; readout: boolean }>(
    PAGER_SETUP,
  )

  const toEnd = await walkPager(devtools, "next", 4)
  check(
    "paging a Pagination to its last page leaves Next focused and disabled",
    found.found && found.controls === 2 && found.readout && toEnd.ok && toEnd.start.page === 1 &&
      !toEnd.beforeLast.nextDisabled && toEnd.beforeLast.onNext && toEnd.beforeLast.page === 4 &&
      toEnd.after.page === 5 && toEnd.after.nextDisabled && toEnd.after.onNext &&
      toEnd.after.sameControls,
    !found.found
      ? "there is no five-page Pagination on the card to drive"
      : found.controls !== 2
      ? `the nav renders ${found.controls} end controls, not the two this check drives`
      : !found.readout
      ? "the card reports no page it was asked for, so the check below it could not tell a " +
        "request the component clamped from no request at all"
      : toEnd.start.page !== 1
      ? `the pager started on page ${toEnd.start.page} rather than page 1, so this proves nothing`
      : !toEnd.ok
      ? toEnd.note
      : !toEnd.beforeLast.onNext
      ? `focus was on ${toEnd.beforeLast.label} before the last press, not on Next`
      : toEnd.beforeLast.nextDisabled
      ? "Next was already disabled on page 4, so the last press was never a real one"
      : toEnd.after.page !== 5
      ? `the last Space press left the pager on page ${toEnd.after.page}, so it never reached the end`
      : toEnd.after.nativelyDisabled
      ? `Next carries the native disabled attribute at the last page, so Chromium took focus off ` +
        `it — focus is on ${toEnd.after.label}. That is the reported defect by another route; ` +
        `aria-disabled says the same thing to a screen reader and leaves focus alone`
      : !toEnd.after.nextDisabled
      ? "the pager is on its last page and Next still says it can act"
      : !toEnd.after.onNext
      ? `Next lost focus on reaching the last page — it went to ${toEnd.after.label}, which is the ` +
        `defect this check exists for`
      : `Space from page 1: ${toEnd.pages.join(" → ")}, and on the last press Next went from ` +
        `enabled to disabled while staying the same element with focus`,
  )

  // The page number alone cannot answer this one. `Pagination` clamps what it is given, so a
  // disabled Next whose handler still ran would ask the card for page 6 of 5 and the card would
  // render page 5 — the page it was already on. The card reports the page it was *asked* for, and
  // that is the reading with a different answer for the two implementations.
  const dead = await devtools.evaluate<PagerState>(PAGER_STATE)
  // Pressed only once Next is the focused element, for the reason {@link walkPager} gives: a key
  // press with focus somewhere else drives whatever is there and leaves it for a later block.
  if (dead.onNext && dead.nextDisabled) {
    await pressKey(devtools, "Space")
    await poll(
      () => devtools.evaluate<boolean>(`${PAGER_STATE}.requested !== ${dead.requested}`),
      1_000,
    )
  }
  const afterDead = await devtools.evaluate<PagerState>(PAGER_STATE)
  check(
    "a Space press on Pagination's disabled Next asks for no page at all",
    dead.nextDisabled && dead.onNext && dead.requested === 5 &&
      afterDead.requested === dead.requested && afterDead.page === dead.page && afterDead.onNext,
    !dead.nextDisabled || !dead.onNext
      ? "Next was not both focused and disabled before the press, so this proves nothing"
      : dead.requested !== 5
      ? `the card reports ${dead.requested} as the last page it was asked for, not the 5 the walk ` +
        `above asked for, so a further request could not be told from it`
      : afterDead.requested !== dead.requested
      ? `the press asked the card for page ${afterDead.requested} — aria-disabled does not stop ` +
        `the click, and the handler did not either; the pager still reads page ${afterDead.page} ` +
        `only because it clamps what it is given`
      : afterDead.page !== dead.page
      ? `a press on the disabled Next moved the pager from page ${dead.page} to ${afterDead.page}`
      : !afterDead.onNext
      ? `the press took focus off Next, onto ${afterDead.label}`
      : `a real Space press on the disabled Next asked the card for nothing (still page ` +
        `${afterDead.requested}), left the pager on page ${afterDead.page}, and kept focus on it`,
  )

  const toStart = await walkPager(devtools, "previous", 4)
  check(
    "paging a Pagination back to its first page leaves Previous focused and disabled",
    toStart.ok && toStart.start.page === 5 && !toStart.beforeLast.previousDisabled &&
      toStart.beforeLast.onPrevious && toStart.beforeLast.page === 2 && toStart.after.page === 1 &&
      toStart.after.previousDisabled && toStart.after.onPrevious && toStart.after.sameControls,
    toStart.start.page !== 5
      ? `the pager started on page ${toStart.start.page} rather than page 5, so this proves nothing`
      : !toStart.ok
      ? toStart.note
      : !toStart.beforeLast.onPrevious
      ? `focus was on ${toStart.beforeLast.label} before the last press, not on Previous`
      : toStart.after.page !== 1
      ? `the last Space press left the pager on page ${toStart.after.page}, not back at the start`
      : toStart.after.nativelyDisabled
      ? `Previous carries the native disabled attribute at page 1, so Chromium took focus off it ` +
        `— focus is on ${toStart.after.label}; aria-disabled is what keeps it`
      : !toStart.after.previousDisabled
      ? "the pager is on page 1 and Previous still says it can act"
      : !toStart.after.onPrevious
      ? `Previous lost focus on reaching page 1 — it went to ${toStart.after.label}`
      : `Space from page 5: ${toStart.pages.join(" → ")}, and on the last press Previous went ` +
        `from enabled to disabled while staying the same element with focus`,
  )

  // A real Enter press, on its own: everything above walked the pager with Space, which does not
  // prove Enter reaches the same handler — a control that called `preventDefault()` on Enter
  // specifically would still pass every check above it (#261). The pager is on page 1 here, so Next
  // is the enabled control to press it on.
  await devtools.evaluate<null>(`(globalThis.__verifyPager?.next?.focus(), null)`)
  const beforeEnter = await devtools.evaluate<PagerState>(PAGER_STATE)
  await pressKey(devtools, "Enter")
  const movedByEnter = await poll(
    () => devtools.evaluate<boolean>(`${PAGER_STATE}.page !== ${beforeEnter.page}`),
    3_000,
  )
  const afterEnter = await devtools.evaluate<PagerState>(PAGER_STATE)
  check(
    "a real Enter press activates Pagination's Next control",
    beforeEnter.onNext && !beforeEnter.nextDisabled && movedByEnter &&
      afterEnter.page === beforeEnter.page + 1 && afterEnter.onNext,
    !beforeEnter.onNext
      ? `focus was on ${beforeEnter.label}, not Next, so this proves nothing`
      : beforeEnter.nextDisabled
      ? "Next was already disabled, so a press here proves nothing about activation"
      : !movedByEnter
      ? "the pager was still on the same page 3s after a real Enter press"
      : afterEnter.page !== beforeEnter.page + 1
      ? `a real Enter press moved the pager from page ${beforeEnter.page} to ${afterEnter.page}, ` +
        `not to ${beforeEnter.page + 1}`
      : `a real Enter press on Next: page ${beforeEnter.page} → ${afterEnter.page}, focus stayed ` +
        `on Next`,
  )

  // Leave nothing focused. The blocks after this one send their own key presses, and a control
  // still holding focus here would answer one of them.
  await blurActive(devtools)
}

/** What one walk of the pager from one end to the other saw. */
interface Walk {
  /** `false` when a press did not move the pager; `note` says which one. */
  ok: boolean
  note: string
  /** Where the pager was before the first press. */
  start: PagerState
  /** The state read immediately before the press that reaches the end. */
  beforeLast: PagerState
  /** The state read after that press. */
  after: PagerState
  /** Every page the walk visited, the starting one first. */
  pages: number[]
}

/**
 * Focus one end control and press Space until the pager reaches that end.
 *
 * Each press is followed by a wait for the page number to change rather than a fixed sleep, so a
 * slow render is a slow check instead of a false failure, and a press that genuinely did nothing is
 * reported as the press it was. The reading taken just before the final press is kept separately
 * because that is the half of the transition the checks are about: enabled and focused there,
 * disabled and still focused after.
 *
 * **Nothing is pressed until the control has the focus.** A key press goes wherever the page has
 * focus, so a walk whose control is missing would otherwise send four Space presses at whatever the
 * check before this one left focused — and a mutation run proved that is not theoretical: with the
 * end controls unmounted there was no Next to park, the presses landed on the date range picker's
 * trigger, and a Modal check two blocks later failed for a reason that named neither component.
 *
 * @param devtools The connected session.
 * @param control Which end control to drive.
 * @param presses How many presses reach the end from where the pager is now.
 * @returns The walk, whether or not every press landed.
 */
async function walkPager(
  devtools: Devtools,
  control: "next" | "previous",
  presses: number,
): Promise<Walk> {
  await devtools.evaluate<null>(`(globalThis.__verifyPager?.${control}?.focus(), null)`)
  const start = await devtools.evaluate<PagerState>(PAGER_STATE)

  const focused = control === "next" ? start.onNext : start.onPrevious
  if (!start.ok || !focused) {
    return {
      ok: false,
      note: start.ok
        ? `the ${control} control would not take focus — it stayed on ${start.label}, so nothing ` +
          `was pressed`
        : "the card is missing the nav or one of its end controls, so nothing was pressed",
      start,
      beforeLast: start,
      after: start,
      pages: [start.page],
    }
  }

  const pages = [start.page]
  let beforeLast = start
  let current = start
  let note = ""
  let ok = true

  for (let press = 1; press <= presses; press++) {
    beforeLast = current
    await pressKey(devtools, "Space")
    const moved = await poll(
      () => devtools.evaluate<boolean>(`${PAGER_STATE}.page !== ${current.page}`),
      3_000,
    )
    current = await devtools.evaluate<PagerState>(PAGER_STATE)
    pages.push(current.page)
    if (!moved && ok) {
      ok = false
      note = `press ${press} of ${presses} left the pager on page ${current.page}, with focus on ` +
        `${current.label}`
    }
  }

  return { ok, note, start, beforeLast, after: current, pages }
}
