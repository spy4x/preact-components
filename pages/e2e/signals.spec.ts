/**
 * Playwright specs for `signals/`: `useUrlFilters`, driven through the search field of the host
 * page's demo (`pages/src/url-filters.tsx`), which sits at the end of the guide's UI page.
 */
import type { Page } from "playwright-core"
import type { Spec } from "./runner.ts"

/** The demo's search field, bound to the `q` parameter. */
const QUERY = `[data-e2e="url-filters-query"]`

/** The word typed, and how long after one key the next one follows. */
const WORD = "hello"
const KEY_DELAY_MS = 25
/** How many times the word is typed in all, and into one mounted field before a fresh page. */
const RUNS = 50
/**
 * Chromium ignores `pushState` and `replaceState` calls past 200 in 10 seconds on one page, and
 * the address then stops following the field. One run costs 12 of them on this page (a push and a
 * fragment-restoring replace for each of five letters and for the clear), so 50 runs on one page
 * were stopped by the browser at run 17, on any code. Ten runs stay well under the limit.
 */
const RUNS_PER_PAGE = 10

/** A longer word typed faster, so that a key lands in every part of a frame. */
const FAST_WORD = "abcdefghijklmnopqrstuvwxyz"
const FAST_KEY_DELAY_MS = 5

/** The attribute {@link watchOverwrites} leaves on the field when the page sets it back. */
const OVERWRITTEN = "data-overwritten"

/**
 * Note, on the field itself, the first time the page changes what the field holds.
 *
 * A key press changes the field's text without going through its `value` property; only the
 * page's own code assigns that property. While a reader types, the hook has nothing to assign but
 * the text already there, so an assignment that changes the text is the hook putting an older
 * value back. It lasts a few milliseconds and loses a letter only when a key lands inside it,
 * which at 25 ms per key is rare; this makes each one count.
 *
 * @param page The page, with the demo mounted.
 */
async function watchOverwrites(page: Page): Promise<void> {
  await page.locator(QUERY).evaluate((field: HTMLInputElement, attribute) => {
    const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
    if (!native?.get || !native.set) throw new Error("no native value property to watch")
    const { get, set } = native
    Object.defineProperty(field, "value", {
      configurable: true,
      get: () => get.call(field),
      set: (next: string) => {
        const held = get.call(field)
        if (next !== held && !field.hasAttribute(attribute)) {
          field.setAttribute(attribute, `"${held}" to "${next}"`)
        }
        set.call(field, next)
      },
    })
  }, OVERWRITTEN)
}

/**
 * What the search field holds once it and the address agree.
 *
 * The hook writes the address a frame after the key press, and reads it back a frame after the
 * render that follows.
 * The two agreeing is the state every run comes to rest in, whether or not a letter was lost on the
 * way, so waiting for it never waits on the outcome under test.
 *
 * @param page The page, with the demo mounted.
 * @returns The field's value, equal to the address's `q` parameter (nothing, when it has none).
 */
async function settledQuery(page: Page): Promise<string> {
  const handle = await page.waitForFunction((selector) => {
    const field = document.querySelector<HTMLInputElement>(selector)
    const inAddress = new URLSearchParams(location.search).get("q") ?? ""
    return field !== null && field.value === inAddress ? { value: field.value } : false
  }, QUERY)
  return (await handle.jsonValue() as { value: string }).value
}

/**
 * Wait until the search field holds `expected` and the address agrees.
 *
 * @param page The page, with the demo mounted.
 * @param expected The value both must hold; empty for no `q` parameter.
 */
async function queryBecomes(page: Page, expected: string): Promise<void> {
  await page.waitForFunction(({ selector, value }) => {
    const inAddress = new URLSearchParams(location.search).get("q") ?? ""
    return document.querySelector<HTMLInputElement>(selector)?.value === value &&
      inAddress === value
  }, { selector: QUERY, value: expected })
}

/**
 * The typing check for one page: the word typed `RUNS_PER_PAGE` times into the same mounted field,
 * every letter kept and the field never set back on the way.
 *
 * @param first The number of this page's first run, counted from 1 across all pages.
 * @returns The spec.
 */
function typingSpec(first: number): Spec {
  const last = first + RUNS_PER_PAGE - 1
  return {
    name: `useUrlFilters: "${WORD}" typed at ${KEY_DELAY_MS} ms per key into a mounted field ` +
      `keeps every letter and is never set back, runs ${first} to ${last} of ${RUNS}`,
    pageId: "ui",
    run: async (page) => {
      const field = page.locator(QUERY)
      await watchOverwrites(page)
      for (let run = first; run <= last; run++) {
        await field.pressSequentially(WORD, { delay: KEY_DELAY_MS })
        await queryBecomes(page, WORD)
        await field.fill("")
        await queryBecomes(page, "")
        const overwritten = await field.getAttribute(OVERWRITTEN)
        if (overwritten !== null) {
          throw new Error(`run ${run} of ${RUNS}: the page set the field back from ${overwritten}`)
        }
      }
    },
  }
}

export const specs: readonly Spec[] = [
  ...Array.from(
    { length: RUNS / RUNS_PER_PAGE },
    (_, index) => typingSpec(index * RUNS_PER_PAGE + 1),
  ),
  {
    name: `useUrlFilters: 26 letters typed at ${FAST_KEY_DELAY_MS} ms per key into a mounted ` +
      "field all arrive, twice",
    pageId: "ui",
    run: async (page) => {
      const field = page.locator(QUERY)
      for (let run = 1; run <= 2; run++) {
        await field.pressSequentially(FAST_WORD, { delay: FAST_KEY_DELAY_MS })
        const held = await settledQuery(page)
        if (held !== FAST_WORD) throw new Error(`run ${run} of 2: the field holds "${held}"`)
        await field.fill("")
        await queryBecomes(page, "")
      }
    },
  },
  {
    name: "useUrlFilters: a letter typed in the frame an address change is read in is kept, " +
      "and the other filters follow the address",
    pageId: "ui",
    run: async (page) => {
      // The hook reads an address change in a timer after the next frame. Typing from a frame
      // callback registered with the change puts the letter after the render and before that read.
      await page.locator(QUERY).evaluate((field: HTMLInputElement) => {
        history.pushState(null, "", `?status=open${location.hash}`)
        requestAnimationFrame(() => {
          field.value = "x"
          field.dispatchEvent(new Event("input", { bubbles: true }))
        })
      })
      await queryBecomes(page, "x")
      await page.locator(`[data-e2e="url-filters-status"]`).filter({ hasText: "open" }).waitFor()
      await page.waitForFunction(() => location.search === "?status=open&q=x")
    },
  },
  {
    name: "useUrlFilters: an address that changes again as the last change is read costs no " +
      "history entry of the hook's own",
    pageId: "ui",
    run: async (page) => {
      const entries = await page.evaluate(() => history.length)
      // The second change is made in the same task as the read of the first, which is when the
      // status shows it: after the hook's read, before the frame its write effect runs in.
      await page.locator(`[data-e2e="url-filters-status"]`).evaluate((status) => {
        new MutationObserver((_, observer) => {
          if (!status.textContent?.includes("open")) return
          observer.disconnect()
          history.pushState(null, "", `?status=open&tab=2${location.hash}`)
        }).observe(status, { childList: true, characterData: true, subtree: true })
        history.pushState(null, "", `?status=open${location.hash}`)
      })
      await page.waitForFunction(() => location.search === "?status=open&tab=2")
      // Two frames: the write effect woken by the first read has run by the end of the first.
      await page.evaluate(() =>
        new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      )
      const after = await page.evaluate(() => `${history.length} ${location.search}`)
      if (after !== `${entries + 2} ?status=open&tab=2`) {
        throw new Error(`${entries} entries, then two pushes left "${after}"`)
      }
    },
  },
  {
    name: "useUrlFilters: Back and Forward move a typed field with the address",
    pageId: "ui",
    run: async (page) => {
      const field = page.locator(QUERY)
      await field.pressSequentially(WORD, { delay: KEY_DELAY_MS })
      await queryBecomes(page, WORD)
      // One history entry per letter, so each press of Back takes one letter off.
      await page.goBack()
      await queryBecomes(page, WORD.slice(0, -1))
      await page.goBack()
      await queryBecomes(page, WORD.slice(0, -2))
      await page.goForward()
      await queryBecomes(page, WORD.slice(0, -1))
      await page.goForward()
      await queryBecomes(page, WORD)
    },
  },
]
