import { check, type Devtools } from "./harness.ts"

/**
 * `signals/`'s browser checks: `useUrlFilters`, bound to the host page's own address bar.
 *
 * The hook is two effects and nothing else, so no test in this repository can reach it — every unit
 * test renders to an HTML string and runs no effect. What this file drives is the section
 * `pages/src/url-filters.tsx` puts below the catalogue: two filters, `status` and `page`, bound to
 * the query string in both directions.
 *
 * Every assertion below is a **transition** — the filters read one way, the address changes, they
 * read another — rather than a single end state, because a hook that read the address only at mount
 * satisfies an end-state assertion on a freshly loaded page perfectly well. That hook is exactly the
 * bug these checks exist for: the URL-to-signals effect was a `useSignalEffect` whose body reads no
 * signal, so it ran once and the filters then ignored every route pushed afterwards.
 *
 * The one exception is {@link mountChecks}, which has no "before" to compare against and is a guard
 * rather than a detection: it fails if the fix broke the mount path, and it passes with the bug in
 * place. It is labelled that way where it is raised.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function signalsChecks(devtools: Devtools): Promise<void> {
  await urlFilterChecks(devtools)
  check(
    "every URL-filter reading came back without a page exception",
    pageErrors.length === 0,
    pageErrors.length === 0
      ? "each expression this file evaluated returned a value"
      : pageErrors.join(" | "),
  )
}

/** How long the page is given to answer an address change before it is read. */
const SETTLE_MS = 300

/** How many times {@link goBack} may step back before it gives up looking for a different address. */
const BACK_LIMIT = 6

/**
 * What a reading of the demo is: the two filters as the page prints them, and the address they are
 * supposed to have come from.
 */
interface FilterState {
  /** The `status` filter, or `(any)` when it holds its default. */
  status: string
  /** The `page` filter. */
  page: string
  /** `location.search` at the same instant, so a failure names the address the values disagree with. */
  search: string
}

/** A reading that never happened, shaped so every check over it reads as a failure. */
const UNREAD: FilterState = { status: "(unread)", page: "(unread)", search: "(unread)" }

/**
 * Both filters and the address, read in one round trip.
 *
 * `(missing)` rather than a thrown `TypeError` when the demo is not on the page: a check must never
 * throw, and a missing element is a failure this file should report by name rather than one that
 * ends the browser phase for every package after it.
 */
const STATE = `(() => {
  const text = (name) => {
    const node = document.querySelector('[data-e2e="' + name + '"]')
    return node ? node.textContent.trim() : "(missing)"
  }
  return {
    status: text("url-filters-status"),
    page: text("url-filters-page"),
    search: location.search,
  }
})()`

/**
 * Page exceptions this file swallowed, raised as a check of its own by {@link signalsChecks}.
 *
 * A throw out of `Runtime.evaluate` raises no protocol event, so `verify.ts`'s console-error check
 * would never see one: a swallowed exception with no check of its own is a silent pass.
 */
const pageErrors: string[] = []

/**
 * Evaluate an expression in the page, turning a page exception into a value.
 *
 * @param devtools The connected session.
 * @param expression JavaScript to run.
 * @param fallback What to return when the expression threw.
 */
async function read<T>(devtools: Devtools, expression: string, fallback: T): Promise<T> {
  try {
    return await devtools.evaluate<T>(expression)
  } catch (error) {
    pageErrors.push(error instanceof Error ? error.message : String(error))
    return fallback
  }
}

/**
 * Do one thing to the address, let the page answer, and read the filters back.
 *
 * @param devtools The connected session.
 * @param action A statement run in the page: a push, or a click on one of the demo's own controls.
 * @returns What the demo shows once it has settled.
 */
async function drive(devtools: Devtools, action: string): Promise<FilterState> {
  return await read<FilterState>(
    devtools,
    `(async () => {
      ${action}
      await new Promise((done) => setTimeout(done, ${SETTLE_MS}))
      return ${STATE}
    })()`,
    UNREAD,
  )
}

/**
 * Step back until the address differs from the one the page is on, or until the budget runs out.
 *
 * A loop rather than one `history.back()`, because the hook writes the filters back through the
 * router after every read it does: each address this file pushes is followed by a second entry
 * carrying the same query string, so a single step back lands on an address that reads identically
 * and would prove nothing. The step that does change the address is the one worth asserting on.
 *
 * @param devtools The connected session.
 * @returns What the demo shows at the first different address, and how many steps it took.
 */
async function goBack(devtools: Devtools): Promise<FilterState & { steps: number }> {
  return await read(
    devtools,
    `(async () => {
      const settle = () => new Promise((done) => setTimeout(done, ${SETTLE_MS + 50}))
      const start = location.search
      let steps = 0
      while (steps < ${BACK_LIMIT} && location.search === start) {
        history.back()
        steps++
        await settle()
      }
      const state = ${STATE}
      return { ...state, steps }
    })()`,
    { ...UNREAD, steps: 0 },
  )
}

/**
 * The whole run, in the order the addresses happen.
 *
 * The page's own fragment route is put back at the end. The demo writes its filters through the
 * router, and the router's `navigate` pushes `pathname?search` — an address with no fragment — so
 * starting the demo drops whatever `#/…` route `pages/checks/pages.ts` left behind. Restoring it
 * leaves the page as this file found it for the checks that run after.
 *
 * @param devtools The connected session.
 */
async function urlFilterChecks(devtools: Devtools): Promise<void> {
  const route = await read(devtools, "location.hash", "")

  await mountChecks(devtools)
  await pushChecks(devtools)
  await linkChecks(devtools)
  await backChecks(devtools)
  await writeBackChecks(devtools)

  await read(devtools, `(location.hash = ${JSON.stringify(route)}, true)`, false)
}

/**
 * Arriving at a filtered address: the demo is started on `?status=open&page=3` and has to open on
 * those values rather than on its defaults.
 *
 * This is a guard, not a detection — a hook that reads the address once, at mount, passes it too.
 * It is here because the fix rewires exactly this path: the first read is now the first run of an
 * effect keyed on the search string, and a mistake in that key would show up here as a card opening
 * on `(any)` and `1`.
 *
 * The control is activated with a click rather than a key press: in headless Chromium a real Enter
 * press does not activate a focused button.
 *
 * @param devtools The connected session.
 */
async function mountChecks(devtools: Devtools): Promise<void> {
  const mounted = await drive(
    devtools,
    `history.pushState(null, "", "?status=open&page=3" + location.hash)
     document.querySelector('[data-e2e="url-filters-run"]').click()`,
  )
  check(
    "a filter card started on a filtered address opens on that address, not on its defaults",
    mounted.status === "open" && mounted.page === "3",
    `${mounted.search} → status ${mounted.status}, page ${mounted.page} ` +
      `(its defaults are (any) and 1)`,
  )
}

/**
 * The bug itself, three times over, each push varying a different thing: the parameter that changes,
 * the parameter that does not, and a parameter leaving the address altogether.
 *
 * `history.pushState` is what the router's own `navigate` calls, and the router dispatches its
 * `pushState` event from that same patched method, so a push made here arrives at the hook exactly
 * as a router push does.
 *
 * @param devtools The connected session.
 */
async function pushChecks(devtools: Devtools): Promise<void> {
  const before = await drive(devtools, `void 0`)

  const changed = await drive(devtools, `history.pushState(null, "", "?status=closed&page=3")`)
  check(
    "a route pushed after mount re-reads the parameter that changed",
    before.status === "open" && changed.status === "closed" && changed.page === "3",
    `?status=open&page=3 → ?status=closed&page=3: status ${before.status} → ${changed.status}, ` +
      `page ${before.page} → ${changed.page}`,
  )

  const paged = await drive(devtools, `history.pushState(null, "", "?status=closed&page=7")`)
  check(
    "a push that moves one parameter leaves the other where it was",
    changed.page === "3" && paged.page === "7" && paged.status === "closed",
    `page ${changed.page} → ${paged.page} while status stayed ${paged.status}`,
  )

  const dropped = await drive(devtools, `history.pushState(null, "", "?page=7")`)
  check(
    "a parameter dropped from the address takes its filter back to the default",
    paged.status === "closed" && dropped.status === "(any)" && dropped.page === "7",
    `?status=closed&page=7 → ?page=7: status ${paged.status} → ${dropped.status}, ` +
      `page held at ${dropped.page}`,
  )
}

/**
 * The same thing through the demo's own affordance: a link whose href is a query string, clicked.
 *
 * A link is how the issue describes meeting the bug in an application — follow one that changes the
 * query string and the filters stay as they were — so one check drives a real click on one rather
 * than a push written here.
 *
 * @param devtools The connected session.
 */
async function linkChecks(devtools: Devtools): Promise<void> {
  const before = await drive(devtools, `void 0`)
  const linked = await drive(
    devtools,
    `document.querySelector('[data-e2e="url-filters-link-open"]').click()`,
  )
  check(
    "following a link that changes the query string moves the filters with it",
    before.status === "(any)" && linked.status === "open" && before.page === "7" &&
      linked.page === "1",
    `clicked ?status=open: status ${before.status} → ${linked.status}, ` +
      `page ${before.page} → ${linked.page} (the link names no page, so that filter falls back)`,
  )
}

/**
 * Arriving backwards: the browser's own back button, which reaches the hook as a `popstate` rather
 * than as a push.
 *
 * This is the case the hook used to answer with a `popstate` listener of its own. That listener is
 * gone — the router already re-renders on `popstate` — so this check is what says the behaviour
 * survived its removal.
 *
 * @param devtools The connected session.
 */
async function backChecks(devtools: Devtools): Promise<void> {
  const before = await drive(devtools, `void 0`)
  const backed = await goBack(devtools)
  check(
    "going back re-reads the filters out of the address the browser returns to",
    backed.steps > 0 && backed.steps < BACK_LIMIT && backed.search !== before.search &&
      before.status === "open" && backed.status === "(any)" && backed.page === "7",
    `${before.search} → ${backed.search} in ${backed.steps} step(s): status ${before.status} → ` +
      `${backed.status}, page ${before.page} → ${backed.page}`,
  )
}

/**
 * The other direction, and the regression the fix could have caused: a filter changed in the page
 * writes to the address, and the re-read that now follows every address change must not undo it.
 *
 * Before the fix the URL-to-signals effect never ran twice, so nothing could overwrite a value the
 * page had just set. It runs on every address change now, including the one the hook itself makes.
 *
 * @param devtools The connected session.
 */
async function writeBackChecks(devtools: Devtools): Promise<void> {
  const before = await drive(devtools, `void 0`)
  const written = await drive(
    devtools,
    `document.querySelector('[data-e2e="url-filters-set-closed"]').click()`,
  )
  check(
    "a filter changed in the page reaches the address and survives the re-read that follows",
    before.status === "(any)" && written.status === "closed" &&
      written.search.includes("status=closed") && written.page === before.page,
    `clicked status = closed: status ${before.status} → ${written.status}, ` +
      `address ${before.search} → ${written.search}, page held at ${written.page}`,
  )
}
