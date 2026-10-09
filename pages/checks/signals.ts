import { pageHref } from "@spy4x/preact-ui-guide/routes"
import { check, type Devtools, inFreshFrame, PAGE_UNTIL, poll } from "./harness.ts"

/**
 * `signals/`'s browser checks: the theme store and its bootstrap script setting `color-scheme`
 * (#446), then `useUrlFilters`, bound to the host page's own address bar, then `useNow` mounted and
 * unmounted on the host page (`pages/src/now-demo.tsx`).
 *
 * The demo page runs the real `themeBootstrapScript` in `<head>` and attaches a real
 * `createThemeStore` behind the header's theme switch (`pages/src/document.tsx`, `pages/src/app.tsx`).
 *
 * The hook is two effects and nothing else, so no test in this repository can reach it — every unit
 * test renders to an HTML string and runs no effect. What this file drives is the section
 * `pages/src/url-filters.tsx` puts below the catalogue: three filters — `status`, `page` and a
 * `size` with a custom parser — bound to the query string in both directions, with a link or a
 * button for every one of them.
 *
 * Most assertions below are **transitions**: the filters read one way, the address changes, they
 * read another. A single end state would be satisfied by a hook that read the address only at
 * mount, which is the bug this file exists for. Eleven are something else and say so where they
 * are raised — the card that arrives on a filtered address, and the filter nobody touched while a
 * letter was typed early, are guards on the mount path; two assert that an address does *not*
 * move, which is the whole of what "reading never writes" means; five are counts, because "one
 * change, one history entry" and "no `hashchange` fired" are numbers rather than transitions; one
 * asserts that a fragment stays absent; and the last collects what the page threw.
 *
 * The group about the fragment pairs every one of its assertions with a transition on the query
 * string, for the reason the shared rules give: "the fragment did not change" is also true of a
 * write that never happened, so each of those checks reads the query string moving in the same
 * breath.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function signalsChecks(devtools: Devtools): Promise<void> {
  await themeSwitchColorSchemeCheck(devtools)
  for (const stored of ["dark", "light"] as const) await bootstrapColorSchemeCheck(devtools, stored)
  await urlFilterChecks(devtools)
  await nowChecks(devtools)
  check(
    "every URL-filter and useNow reading came back without a page exception",
    pageErrors.length === 0,
    pageErrors.length === 0
      ? "each expression this file evaluated returned a value, and every action settled"
      : pageErrors.join(" | "),
  )
}

/** The demo's theme storage key, `THEME_KEY` in `pages/src/site.ts`. */
const THEME_KEY = "pc-theme"

/** What the root of a page reads for its theme at one instant. */
interface SchemeReading {
  /** Whether `<html>` carries the `dark` class. */
  dark: boolean
  /** `getComputedStyle(<html>).colorScheme`. `"normal"` when nothing set it. */
  computed: string
}

/**
 * Pressing the header's theme switch, which calls the attached store's `toggle`, moves the root's
 * computed `color-scheme` with the `dark` class, both ways. The palette and the stored preference
 * are put back afterwards.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function themeSwitchColorSchemeCheck(devtools: Devtools): Promise<void> {
  const readings = await devtools.evaluate<SchemeReading[] | string>(`(async () => {
    const root = document.documentElement
    const button = document.querySelector('[data-e2e="theme-toggle"]')
    if (!button) return "no theme switch on the page"
    let stored = null
    try { stored = localStorage.getItem(${JSON.stringify(THEME_KEY)}) } catch {}
    const wasDark = root.classList.contains("dark")
    const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)))
    const read = () => ({ dark: root.classList.contains("dark"), computed: getComputedStyle(root).colorScheme })
    const readings = []
    for (let press = 0; press < 2; press++) {
      button.click()
      await frame()
      readings.push(read())
    }
    if (root.classList.contains("dark") !== wasDark) { button.click(); await frame() }
    try {
      if (stored === null) localStorage.removeItem(${JSON.stringify(THEME_KEY)})
      else localStorage.setItem(${JSON.stringify(THEME_KEY)}, stored)
    } catch {}
    return readings
  })()`).catch((error) => String(error))
  const ok = Array.isArray(readings) && readings.length === 2 &&
    readings[0].dark !== readings[1].dark &&
    readings.every((reading) => reading.computed === (reading.dark ? "dark" : "light"))
  check(
    "a press on the theme switch moves the root's color-scheme with the dark class, both ways",
    ok,
    Array.isArray(readings)
      ? readings.map((reading, index) =>
        `press ${index + 1}: dark class ${reading.dark}, color-scheme "${reading.computed}"`
      ).join("; ")
      : readings,
  )
}

/**
 * A fresh load of the page with `stored` saved paints `color-scheme: <stored>` on the root from the
 * bootstrap script alone: read while the app's stylesheet request is held back, so no rule of the
 * stylesheet's has applied, and the island, which waits for the stylesheet, has not hydrated.
 *
 * The load happens in a frame ({@link inFreshFrame}), so the shared page stays where it was. The
 * stylesheet is paused with `Fetch.enable` rather than blocked, because a blocked request is a
 * failed request the run's last check reports; the cache is disabled meanwhile, so the frame's
 * request reaches the network and the pause, instead of being served from what the shared page
 * already loaded.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param stored The preference saved before the load.
 */
async function bootstrapColorSchemeCheck(
  devtools: Devtools,
  stored: "dark" | "light",
): Promise<void> {
  const key = JSON.stringify(THEME_KEY)
  const previous = await devtools.evaluate<string | null>(
    `(() => { try { return localStorage.getItem(${key}) } catch { return null } })()`,
  ).catch(() => null)
  let detail = "(not read)"
  let ok = false
  try {
    await devtools.evaluate(`(localStorage.setItem(${key}, ${JSON.stringify(stored)}), null)`)
    await devtools.send("Network.setCacheDisabled", { cacheDisabled: true })
    await devtools.send("Fetch.enable", {
      patterns: [{
        urlPattern: "*/assets/*.css",
        resourceType: "Stylesheet",
        requestStage: "Request",
      }],
    })
    const paused = devtools.once<{ requestId: string }>("Fetch.requestPaused", 20_000)
    // Handled here too, so a frame that never loads cannot leave this rejection unobserved.
    paused.catch(() => {})
    await inFreshFrame(
      devtools,
      {
        id: "color-scheme-bootstrap-frame",
        src: pageHref("overview"),
        label: `color-scheme (${stored} stored)`,
      },
      async (frame) => {
        const { requestId } = await paused
        try {
          // The stylesheet link comes after the script in <head>, so once the parser has reached it
          // the script has run.
          const parsed = await poll(
            () =>
              devtools.evaluate<boolean>(
                `${frame}?.contentDocument?.querySelector('link[rel="stylesheet"]') != null`,
              ).catch(() => false),
            10_000,
          )
          const reading = await devtools.evaluate<
            { inline: string; computed: string; dark: boolean; sheet: boolean; hydrated: boolean }
          >(`(() => {
            const doc = ${frame}.contentDocument
            const root = doc.documentElement
            return {
              inline: root.style.colorScheme,
              computed: ${frame}.contentWindow.getComputedStyle(root).colorScheme,
              dark: root.classList.contains("dark"),
              sheet: doc.querySelector('link[rel="stylesheet"]').sheet !== null,
              hydrated: root.dataset.hydrated === "true",
            }
          })()`)
          ok = parsed && !reading.sheet && !reading.hydrated && reading.computed === stored &&
            reading.inline === stored && reading.dark === (stored === "dark")
          detail = `head parsed ${parsed}; stylesheet applied ${reading.sheet}; hydrated ` +
            `${reading.hydrated}; dark class ${reading.dark}; color-scheme inline ` +
            `"${reading.inline}", computed "${reading.computed}"`
        } finally {
          await devtools.send("Fetch.continueRequest", { requestId }).catch(() => {})
        }
      },
    )
  } catch (error) {
    detail = `threw: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    await devtools.send("Fetch.disable", {}).catch(() => {})
    await devtools.send("Network.setCacheDisabled", { cacheDisabled: false }).catch(() => {})
    await devtools.evaluate(`(() => {
      try {
        if (${JSON.stringify(previous)} === null) localStorage.removeItem(${key})
        else localStorage.setItem(${key}, ${JSON.stringify(previous)})
      } catch {}
      return null
    })()`).catch(() => {})
  }
  check(
    `with ${stored} stored, the bootstrap script sets color-scheme: ${stored} before the stylesheet ` +
      "applies",
    ok,
    detail,
  )
}

/** How long one action is given to stop changing the page before its reading is taken anyway. */
const SETTLE_BUDGET_MS = 5_000

/**
 * What a reading of the demo is: the three filters as the page prints them, and the address they
 * are supposed to have come from.
 */
interface FilterState {
  /** The `status` filter, or `(any)` when it holds its default. */
  status: string
  /** The `page` filter. */
  page: string
  /** The `size` filter, as that field's own parser produced it. */
  size: string
  /** The search field's own value: the `q` filter as the reader sees it in the field. */
  query: string
  /** `location.search` at the same instant, so a failure names the address the values disagree with. */
  search: string
  /** `location.hash` — the host page's own route, which no filter write is allowed to disturb. */
  hash: string
  /**
   * `location.href`. Only the whole address distinguishes "no fragment" from a bare `#`:
   * `location.hash` reads as the empty string for both, so a write that appended a stray `#` would
   * be invisible to {@link FilterState.hash} alone.
   */
  href: string
  /** `history.length`: what an address change costs the reader in Back presses. */
  entries: number
}

/** A reading that never happened, shaped so every check over it reads as a failure. */
const UNREAD: FilterState = {
  status: "(unread)",
  page: "(unread)",
  size: "(unread)",
  query: "(unread)",
  search: "(unread)",
  hash: "(unread)",
  href: "(unread)",
  entries: -1,
}

/**
 * Every filter, the whole address and the history depth, read in one round trip.
 *
 * `(missing)` rather than a thrown `TypeError` when the demo is not on the page: a check must never
 * throw, and a missing element is a failure this file should report by name rather than one that
 * costs every check left in this file and reports `signals` instead.
 */
const STATE = `(() => {
  const text = (name) => {
    const node = document.querySelector('[data-e2e="' + name + '"]')
    return node ? node.textContent.trim() : "(missing)"
  }
  return {
    status: text("url-filters-status"),
    page: text("url-filters-page"),
    size: text("url-filters-size"),
    query: (() => {
      const node = document.querySelector('[data-e2e="url-filters-query"]')
      return node ? node.value : "(missing)"
    })(),
    search: location.search,
    hash: location.hash,
    href: location.href,
    entries: history.length,
  }
})()`

/**
 * Page exceptions this file swallowed, and actions that never settled, raised as a check of its own
 * by {@link signalsChecks}.
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
 * Read the demo once it has stopped moving: two identical readings in a row.
 *
 * `poll` rather than a fixed sleep, because a sleep long enough for a loaded machine is wasted on
 * every run that did not need it, and one short enough to be cheap goes red under load for no
 * reason. Waiting for the page to repeat itself also says something a sleep cannot: an address
 * change that made the hook write again would keep the reading moving, so a run that settles is one
 * where the address, the filters and the history depth have all come to rest.
 *
 * @param devtools The connected session.
 * @param what The action being waited on, for the failure message.
 * @returns The settled reading, or the last one taken when the budget ran out.
 */
async function settled(devtools: Devtools, what: string): Promise<FilterState> {
  let previous = UNREAD
  let steady = UNREAD

  const stopped = await poll(async () => {
    const now = await read(devtools, STATE, UNREAD)
    const same = now.status !== "(unread)" && now.status === previous.status &&
      now.page === previous.page && now.size === previous.size && now.query === previous.query &&
      now.search === previous.search && now.hash === previous.hash &&
      now.href === previous.href && now.entries === previous.entries
    previous = now
    if (same) steady = now
    return same
  }, SETTLE_BUDGET_MS)

  if (!stopped) {
    pageErrors.push(`the page never stopped changing after ${what}`)
    return previous
  }

  return steady
}

/**
 * Do one thing to the address, and read the filters back once the page has stopped moving.
 *
 * @param devtools The connected session.
 * @param action A statement run in the page: a push, or a click on one of the demo's own controls.
 * @param what What that action is, for the failure message.
 * @returns What the demo shows once it has settled.
 */
async function act(devtools: Devtools, action: string, what: string): Promise<FilterState> {
  await read(devtools, `(() => { ${action}; return true })()`, false)
  return await settled(devtools, what)
}

/** The fragment this file puts on the address itself, rather than borrowing one from the page. */
const OWN_FRAGMENT = "#url-filters-check"

/**
 * A fragment shaped like the route a statically hosted site keeps there, `?` and all.
 *
 * `#/…?tab=2` is what hash routing looks like, and it is the spelling a write is most likely to
 * mangle: everything after the `#` belongs to the fragment, including a `?` that reads like the
 * start of a query string to anything joining the address back together by hand.
 */
const ROUTE_FRAGMENT = "#/url-filters-check?tab=2"

/** Where the page moves its own route to, while the card stays mounted. */
const MOVED_FRAGMENT = "#/url-filters-check/moved"

/** How many of each address event one action fired. */
interface AddressEvents {
  /** `hashchange` — none may be fired by a write that leaves the fragment where it was. */
  hashchange: number
  /** `pushState` — wouter's own, dispatched from the method it patches. */
  pushState: number
  /** `replaceState` — the same, from the other patched method. */
  replaceState: number
}

/** A count that never happened, shaped so every check over it reads as a failure. */
const UNCOUNTED: AddressEvents = { hashchange: -1, pushState: -1, replaceState: -1 }

/**
 * Start counting the address events the page fires, from now until {@link STOP_WATCHING}.
 *
 * All three are counted rather than only `hashchange`, and that is the point: "no `hashchange`
 * fired" is also what a run with no listener attached reports, so the `pushState` count — which a
 * filter write must raise — is what says the same `addEventListener` call took effect for the same
 * action. Without it this check would pass on a page where the listener had never been installed.
 */
const START_WATCHING = `(() => {
  const counts = { hashchange: 0, pushState: 0, replaceState: 0 }
  const handlers = {}
  for (const type of Object.keys(counts)) {
    handlers[type] = () => { counts[type]++ }
    addEventListener(type, handlers[type])
  }
  globalThis.__urlFilterWatch = { counts, handlers }
  return true
})()`

/** Stop counting and hand the counts over, leaving no listener behind on any path. */
const STOP_WATCHING = `(() => {
  const watch = globalThis.__urlFilterWatch
  if (!watch) return { hashchange: -1, pushState: -1, replaceState: -1 }
  for (const type of Object.keys(watch.handlers)) {
    removeEventListener(type, watch.handlers[type])
  }
  delete globalThis.__urlFilterWatch
  return watch.counts
})()`

/**
 * Push an address.
 *
 * `history.pushState` is what the router's own `navigate` calls, and the router dispatches its
 * `pushState` event from that same patched method, so a push made here reaches the hook exactly as
 * a router push does. It also fires no `hashchange`, which is why a fragment can be put on the
 * address here without the host page's own routing noticing.
 *
 * @param search The query string to push, `?` included.
 * @param hash A fragment to push with it; by default whatever the page is already carrying, so a
 *             fragment this run loses is one the hook lost and never one this file dropped.
 */
function push(search: string, hash?: string): string {
  const fragment = hash === undefined ? "location.hash" : JSON.stringify(hash)
  return `history.pushState(null, "", ${JSON.stringify(search)} + ${fragment})`
}

/**
 * Do one thing to the address while counting the address events it fires.
 *
 * The listeners are removed on every path: {@link read} turns a page exception into a value rather
 * than a throw, so the statement that removes them always runs, and it removes them by the handler
 * references it installed rather than by rebuilding them.
 *
 * @param devtools The connected session.
 * @param action A statement run in the page.
 * @param what What that action is, for the failure message.
 * @returns The settled reading, and what the page fired while it was happening.
 */
async function actWatched(
  devtools: Devtools,
  action: string,
  what: string,
): Promise<{ state: FilterState; events: AddressEvents }> {
  await read(devtools, START_WATCHING, false)
  const state = await act(devtools, action, what)
  const events = await read<AddressEvents>(devtools, STOP_WATCHING, UNCOUNTED)
  return { state, events }
}

/**
 * Click one of the demo's controls, by the name it carries in `data-e2e`.
 *
 * A click and not a key press: the hook has no keyboard contract of its own, every control is a
 * plain `<button>` or wouter's `<Link>`, and nothing here needs to prove that a keyboard press also
 * reaches it.
 *
 * @param name The control's `data-e2e` value.
 */
function click(name: string): string {
  return `const node = document.querySelector('[data-e2e="${name}"]')
    if (!node) throw new Error('no element with data-e2e="${name}"')
    node.click()`
}

/**
 * The whole run, in the order the addresses happen.
 *
 * The three history-entry counts are each taken across an action that follows a push, never one
 * that follows a press of Back: a push made while the reader is one entry back from the end
 * replaces that entry instead of adding one, and a count taken there would be measuring the
 * browser rather than the hook.
 *
 * The address is put back at the end, query string and fragment both, with a push rather than by
 * assigning `location.hash`: assigning it would fire a `hashchange` the host page answers by
 * re-marking and re-scrolling, and nothing in this run has given it reason to. What is *not* put
 * back is the demo itself, which stays mounted and live for every package that runs after this one.
 * That costs nothing today — the card writes only when the query string would change, and no later
 * check touches the query string — but a check added after this one that does touch it would meet a
 * live card reading it.
 *
 * @param devtools The connected session.
 */
async function urlFilterChecks(devtools: Devtools): Promise<void> {
  const opening = await settled(devtools, "reading the page this file found")

  const arrived = await arrivalChecks(devtools)
  const pushed = await pushChecks(devtools, arrived)
  const linked = await linkChecks(devtools, pushed)
  const written = await writeChecks(devtools, linked)
  const backed = await backChecks(devtools, written)
  await fragmentChecks(devtools, backed)
  await earlyInputChecks(devtools)

  await read(
    devtools,
    `history.pushState(null, "", location.pathname + ${JSON.stringify(opening.search)} + ` +
      `${JSON.stringify(opening.hash)})`,
    false,
  )
}

/**
 * Arriving: what a card does with the address it is mounted on, and what it does *to* that address.
 *
 * The first check is a guard, not a detection — a hook that reads the address once, at mount,
 * passes it too. It is here because the fix rewires exactly that path, and because a card arriving
 * on a filtered address is what a deep link into a filtered list is.
 *
 * The three after it are about the other direction, and they are the defect this round is about:
 * **reading an address must not write to it**, whether or not the hook would have spelt that
 * address the same way. A hook that writes leaves a history entry nobody asked for and, because the
 * router's `navigate` pushes `pathname?search`, replaces the address with one carrying no fragment
 * — so a fragment-routed page loses its route at mount. `?page=1&size=huge&status=` is the address
 * that makes the difference: a filter written out at its default, a value the parser rejects and an
 * empty value, none of which the hook would have written itself. Rewriting it on arrival also
 * traps Back, which the last of these checks is what proves: one press has to return the reader to
 * where they came from, not to the address the hook has just rewritten again.
 *
 * The fragment is this file's own rather than the `#/…` route `pages/checks/pages.ts` leaves
 * behind, so these checks prove the hook rather than the order the packages run in.
 *
 * @param devtools The connected session.
 * @returns The reading this group ends on.
 */
async function arrivalChecks(devtools: Devtools): Promise<FilterState> {
  const filtered = await act(
    devtools,
    push("?status=open&page=3", OWN_FRAGMENT),
    "a push to ?status=open&page=3 with a fragment",
  )
  const remounted = await act(devtools, click("url-filters-remount"), "a click on remount")

  check(
    "a filter card that arrives on a filtered address starts from that address",
    remounted.status === "open" && remounted.page === "3" && remounted.size === "md",
    `remounted on ${remounted.search} → status ${remounted.status}, page ${remounted.page}, ` +
      `size ${remounted.size} (its defaults are (any), 1 and md)`,
  )
  check(
    "arriving on an address the filters agree with leaves it alone, fragment and all",
    filtered.search === "?status=open&page=3" && remounted.search === "?status=open&page=3" &&
      filtered.hash === OWN_FRAGMENT && remounted.hash === OWN_FRAGMENT,
    `pushed ?status=open&page=3${OWN_FRAGMENT} → read as ${filtered.search}${filtered.hash} → ` +
      `remounted as ${remounted.search}${remounted.hash}`,
  )

  const spelt = await act(
    devtools,
    push("?page=1&size=huge&status=", OWN_FRAGMENT),
    "a push to ?page=1&size=huge&status= with a fragment",
  )
  check(
    "an address the hook would spell differently is left exactly as it was sent",
    remounted.status === "open" && remounted.page === "3" && spelt.status === "(any)" &&
      spelt.page === "1" && spelt.size === "md" &&
      spelt.search === "?page=1&size=huge&status=" && spelt.hash === OWN_FRAGMENT,
    `pushed ?page=1&size=huge&status=${OWN_FRAGMENT}: status ${remounted.status} → ` +
      `${spelt.status}, page ${remounted.page} → ${spelt.page}, size ${spelt.size}, and the ` +
      `address is still ${spelt.search}${spelt.hash}`,
  )

  const back = await act(devtools, "history.back()", "one press of Back out of that address")
  check(
    "one press of Back out of such an address returns the reader where they came from",
    spelt.status === "(any)" && back.status === "open" && back.page === "3" &&
      back.search === "?status=open&page=3" && back.hash === OWN_FRAGMENT,
    `${spelt.search} → ${back.search}${back.hash} in one press: status ${spelt.status} → ` +
      `${back.status}, page ${spelt.page} → ${back.page}`,
  )

  return back
}

/**
 * The bug the issue was opened about, three pushes over, each varying a different thing: the
 * parameter that changes, the parameter that does not, and a parameter leaving the address
 * altogether. The first push is also where the cost of an address change is counted.
 *
 * @param devtools The connected session.
 * @param before The reading this group starts from.
 * @returns The reading it ends on.
 */
async function pushChecks(devtools: Devtools, before: FilterState): Promise<FilterState> {
  const changed = await act(
    devtools,
    push("?status=closed&page=3"),
    "a push to ?status=closed&page=3",
  )
  check(
    "a route pushed after mount re-reads the parameter that changed",
    before.status === "open" && changed.status === "closed" && changed.page === "3",
    `?status=open&page=3 → ?status=closed&page=3: status ${before.status} → ${changed.status}, ` +
      `page ${before.page} → ${changed.page}`,
  )
  const paged = await act(
    devtools,
    push("?status=closed&page=7"),
    "a push to ?status=closed&page=7",
  )
  check(
    "a push that moves one parameter leaves the other where it was",
    changed.page === "3" && paged.page === "7" && paged.status === "closed",
    `page ${changed.page} → ${paged.page} while status stayed ${paged.status}`,
  )
  // Counted across this push rather than the one before it: the group above ends on a press of
  // Back, and a push made one entry back from the end replaces that entry instead of appending one.
  // This push follows a push, so anything but +1 here is the hook's doing.
  check(
    "one address change costs the reader one history entry",
    paged.entries - changed.entries === 1,
    `history.length ${changed.entries} → ${paged.entries} across one push — a second entry here ` +
      `is a press of Back that appears to do nothing`,
  )

  const dropped = await act(devtools, push("?page=7"), "a push to ?page=7")
  check(
    "a parameter dropped from the address takes its filter back to the default",
    paged.status === "closed" && dropped.status === "(any)" && dropped.page === "7",
    `?status=closed&page=7 → ?page=7: status ${paged.status} → ${dropped.status}, ` +
      `page held at ${dropped.page}`,
  )

  return dropped
}

/**
 * The demo's own affordances: five links, each one a query string, each one clicked.
 *
 * A link is how the issue describes meeting the bug in an application — follow one that changes the
 * query string and the filters stay as they were. Clicked in an order that carries two axes no push
 * in this file varies: `? (no filters)` takes the address to an empty query string and the link
 * after it starts from there rather than from another filtered address, and the last two are the
 * `size` field's custom `parser`, given a value it accepts and then one it refuses.
 *
 * A rejected value is where reading and writing are easiest to confuse. `?size=huge` is an address
 * a reader can type; the parser answers with the default so the page is never handed a size it
 * cannot render, and the address keeps the word the reader wrote, because reading is not a change.
 *
 * @param devtools The connected session.
 * @param before The reading this group starts from.
 * @returns The reading it ends on.
 */
async function linkChecks(devtools: Devtools, before: FilterState): Promise<FilterState> {
  const linked = await act(
    devtools,
    click("url-filters-link-page"),
    "a click on the ?status=open&page=2 link",
  )
  check(
    "following a link that changes the query string moves the filters with it",
    before.status === "(any)" && linked.status === "open" && before.page === "7" &&
      linked.page === "2",
    `clicked ?status=open&page=2: status ${before.status} → ${linked.status}, ` +
      `page ${before.page} → ${linked.page}`,
  )

  const emptied = await act(
    devtools,
    click("url-filters-link-none"),
    "a click on the ? (no filters) link",
  )
  check(
    "a link back to an empty query string returns every filter to its default",
    emptied.search === "" && emptied.status === "(any)" && emptied.page === "1" &&
      emptied.size === "md",
    `clicked ? (no filters): ${linked.search} → "${emptied.search}", status ${linked.status} → ` +
      `${emptied.status}, page ${linked.page} → ${emptied.page}`,
  )

  const refilled = await act(
    devtools,
    click("url-filters-link-open"),
    "a click on the ?status=open link",
  )
  check(
    "a link followed from an empty address fills the filters again",
    emptied.status === "(any)" && refilled.status === "open" && refilled.search === "?status=open",
    `clicked ?status=open from "${emptied.search}": status ${emptied.status} → ` +
      `${refilled.status}, address "${emptied.search}" → ${refilled.search}`,
  )

  const sized = await act(devtools, click("url-filters-link-size"), "a click on the ?size=lg link")
  check(
    "a value the field's parser accepts reaches the filter",
    refilled.size === "md" && sized.size === "lg" && sized.search === "?size=lg",
    `clicked ?size=lg: size ${refilled.size} → ${sized.size}, address ${sized.search}`,
  )

  const rejected = await act(
    devtools,
    click("url-filters-link-bad-size"),
    "a click on the ?size=huge link",
  )
  check(
    "a value the field's parser rejects falls back to the default, and the address keeps it",
    sized.size === "lg" && rejected.size === "md" && rejected.search === "?size=huge",
    `clicked ?size=huge: size ${sized.size} → ${rejected.size}, and the address is still ` +
      `${rejected.search} — reading it is not a filter change, so nothing was written`,
  )

  return rejected
}

/**
 * The other direction: a filter changed in the page, and what that costs the address.
 *
 * Five things are at stake here and each has its own check. The value has to reach the address and
 * survive the re-read that now follows every address change — before the fix the URL-to-signals
 * effect never ran twice, so nothing could overwrite a value the page had just set, and it runs on
 * every change now, including the ones the hook itself makes. The write is also where an address
 * the filters never agreed with is finally tidied up, which is the other half of leaving it alone
 * on arrival: `?size=huge` survives every read and goes the moment a filter moves. A change has to
 * cost exactly one history entry — a clear included, however many filters it moves — so Back undoes
 * a filter in one press. And a parameter belonging to anything else on the page has to come through
 * untouched, both when a filter is written next to it and when every filter is cleared: an
 * application's address holds more than this hook's three parameters, and the write rebuilds the
 * whole query string.
 *
 * @param devtools The connected session.
 * @param before The reading this group starts from.
 * @returns The reading it ends on.
 */
async function writeChecks(devtools: Devtools, before: FilterState): Promise<FilterState> {
  const written = await act(
    devtools,
    click("url-filters-set-closed"),
    "a click on the status = closed button",
  )
  check(
    "a filter changed in the page reaches the address and survives the re-read that follows",
    before.status !== "closed" && written.status === "closed" &&
      written.search.includes("status=closed"),
    `clicked status = closed: status ${before.status} → ${written.status}, address ` +
      `${before.search} → ${written.search}`,
  )
  check(
    "the first real filter change is what rewrites a spelling the filters never agreed with",
    before.search === "?size=huge" && !written.search.includes("huge"),
    `the address carried ${before.search} through every read; the first write settled it at ` +
      `${written.search}`,
  )
  check(
    "a filter changed in the page costs one history entry, so Back can undo it",
    written.entries - before.entries === 1,
    `history.length ${before.entries} → ${written.entries} across one filter change — none would ` +
      `mean Back cannot undo a filter, two that it takes two presses`,
  )

  // A parameter this hook knows nothing about, put into the address by hand. The write below
  // rebuilds the whole query string, and an application's address holds more than three filters.
  const foreign = await act(
    devtools,
    push("?sort=name&status=closed"),
    "a push to ?sort=name&status=closed",
  )
  const kept = await act(
    devtools,
    click("url-filters-next-page"),
    "a click on the next page button",
  )
  check(
    "a parameter the hook does not own survives a filter written next to it",
    foreign.search.includes("sort=name") && kept.search.includes("sort=name") &&
      foreign.page === "1" && kept.page === "2" && kept.search.includes("page=2"),
    `clicked next page on ${foreign.search}: page ${foreign.page} → ${kept.page}, address ` +
      `${kept.search}`,
  )

  const cleared = await act(devtools, click("url-filters-clear"), "a click on the clear button")
  check(
    "clearing the filters empties the query string of what the hook owns, and nothing else",
    cleared.status === "(any)" && cleared.page === "1" && cleared.size === "md" &&
      cleared.search === "?sort=name",
    `clicked clear on ${kept.search}: status ${kept.status} → ${cleared.status}, page ` +
      `${kept.page} → ${cleared.page}, address ${cleared.search}`,
  )
  // This one passes with or without `clearFilterFields`'s `batch`, because Preact's signals adapter
  // batches writes made inside an event handler and this clear is a click. What the batch covers is
  // an application clearing from a timer or after a request, which no control here can reach;
  // `signals/use-url-filters.test.ts` holds that, and goes red when the batch is removed.
  check(
    "clearing several filters at once costs one history entry, not one for each",
    cleared.entries - kept.entries === 1,
    `history.length ${kept.entries} → ${cleared.entries} across a clear that moved two filters — ` +
      `without a batch it is one entry per field, and Back walks back through each of them`,
  )

  return cleared
}

/**
 * Arriving backwards: the browser's own Back button, which reaches the hook as a `popstate` rather
 * than as a push.
 *
 * One press, not a loop. A loop is what this file used to do, because every address change left two
 * entries and the first press landed on an address that read identically — which is the defect this
 * round fixed, and a loop tolerant of it could never have seen it. One press has to move the
 * reader.
 *
 * This is also the case the hook used to answer with a `popstate` listener of its own. That
 * listener is gone — the router already re-renders on `popstate` — so this check is what says the
 * behaviour survived its removal.
 *
 * @param devtools The connected session.
 * @param before The reading this group starts from.
 * @returns The reading it ends on.
 */
async function backChecks(devtools: Devtools, before: FilterState): Promise<FilterState> {
  const backed = await act(devtools, "history.back()", "one press of Back")
  check(
    "one press of Back moves the address, and the filters move with it",
    backed.search !== before.search && before.status === "(any)" && before.page === "1" &&
      backed.status === "closed" && backed.page === "2",
    `${before.search} → ${backed.search} in one press: status ${before.status} → ` +
      `${backed.status}, page ${before.page} → ${backed.page}`,
  )

  return backed
}

/**
 * The other part of the address a filter change is not allowed to touch: the fragment.
 *
 * The Pages demo is the case the defect is about — a statically hosted site whose route lives in
 * `location.hash` — so a filter change that replaced the whole address took the reader's route out
 * of the address bar. Reading, arriving and remounting already left both halves alone; these are
 * about the one thing that writes.
 *
 * Every assertion here reads the query string moving in the same breath as the fragment holding
 * still. "The fragment is unchanged" is true of a write that never happened at all, so on its own
 * it would be satisfied by a hook with the signals-to-address effect deleted.
 *
 * The three things beyond the fragment surviving are each a way the obvious repair goes wrong. A
 * write that put the fragment back by assigning `location.hash` would fire a `hashchange`, which
 * this page answers by re-deriving its route, re-marking a card and scrolling to it — so the events
 * are counted. A write that put it back with a second `navigate` would cost two history entries,
 * and Back would appear to do nothing the first time it was pressed — so the entries are counted
 * and Back is pressed. A write that appended the fragment unconditionally would leave a bare `#` on
 * an address that never had one — so the last three read the whole address rather than
 * `location.hash`, which is empty for both.
 *
 * The last of them is about the other thing the same step tidies. The router navigates to
 * `pathname + "?" + ""` when a write empties the query string, so a clear used to end at `/list?`
 * on an address with no fragment and at `/list#section` on one with a fragment, and only `href`
 * can tell those two apart: `location.search` is empty for both.
 *
 * The group opens with a push, and every count is taken across an action that follows one: this
 * group starts where {@link backChecks} left the reader, one entry back from the end, and a push
 * made there replaces that entry instead of appending one.
 *
 * @param devtools The connected session.
 * @param before The reading this group starts from.
 */
async function fragmentChecks(devtools: Devtools, before: FilterState): Promise<void> {
  const anchored = await act(
    devtools,
    push("?status=open", ROUTE_FRAGMENT),
    `a push to ?status=open${ROUTE_FRAGMENT}`,
  )
  const { state: paged, events } = await actWatched(
    devtools,
    click("url-filters-next-page"),
    "a click on next page with a hash route on the address",
  )

  check(
    "a filter changed in the page writes the query string and leaves the fragment alone",
    before.hash !== ROUTE_FRAGMENT && anchored.hash === ROUTE_FRAGMENT &&
      paged.hash === ROUTE_FRAGMENT && anchored.search === "?status=open" &&
      paged.search === "?status=open&page=2",
    `clicked next page on ${anchored.search}${anchored.hash}: the query string moved ` +
      `${anchored.search} → ${paged.search} and the fragment stayed ${paged.hash}`,
  )
  check(
    "that write fires no hashchange, so a page routing through the fragment hears nothing",
    events.hashchange === 0 && events.pushState >= 1,
    `the same action fired ${events.pushState} pushState and ${events.replaceState} replaceState ` +
      `events, which is what says the listeners were attached, and ${events.hashchange} ` +
      `hashchange events`,
  )
  check(
    "a filter change on an address carrying a fragment still costs one history entry",
    paged.entries - anchored.entries === 1,
    `history.length ${anchored.entries} → ${paged.entries} across one filter change — two would ` +
      `mean the fragment was put back with a second navigation`,
  )

  // A second filter change, so the entry Back lands on is one the *hook* wrote rather than one
  // this file pushed. Backing onto a pushed entry would prove nothing: that entry carries the
  // fragment because the push put it there, whatever the hook did on the way past.
  const twice = await act(
    devtools,
    click("url-filters-set-closed"),
    "a second filter change, so Back lands on an entry the hook wrote",
  )
  const back = await act(devtools, "history.back()", "one press of Back out of that filter change")
  check(
    "one press of Back restores the query string the hook wrote, fragment included",
    // The two query strings are different literals, so asserting both is the transition; a third
    // clause comparing them is a comparison TypeScript can already answer, and it refuses it.
    twice.search === "?status=closed&page=2" && back.search === "?status=open&page=2" &&
      back.hash === ROUTE_FRAGMENT,
    `${twice.search}${twice.hash} → ${back.search}${back.hash} in one press — the entry Back ` +
      `landed on is the one the first filter change wrote`,
  )

  // The card mounts here, while the address carries one fragment, and the page moves to another
  // before the next filter change. A hook that read the fragment once, at mount, would put the
  // first one back.
  const remounted = await act(
    devtools,
    click("url-filters-remount"),
    "a click on remount with the hash route on the address",
  )
  const moved = await act(
    devtools,
    push("?status=open", MOVED_FRAGMENT),
    "the page moving its own route while the card stays mounted",
  )
  const rewritten = await act(
    devtools,
    click("url-filters-set-closed"),
    "a click on status = closed after the page moved its route",
  )
  check(
    "the fragment a write keeps is the one the address has then, not the one it had at mount",
    remounted.hash === ROUTE_FRAGMENT && moved.hash === MOVED_FRAGMENT &&
      rewritten.hash === MOVED_FRAGMENT && moved.search === "?status=open" &&
      rewritten.search === "?status=closed",
    `the card mounted on ${remounted.hash}, the page moved to ${moved.hash}, and the write that ` +
      `took the query string ${moved.search} → ${rewritten.search} left ${rewritten.hash}`,
  )

  const cleared = await act(
    devtools,
    click("url-filters-clear"),
    "a click on clear with a fragment on the address",
  )
  check(
    "clearing the filters empties the query string and leaves the fragment alone too",
    rewritten.search === "?status=closed" && cleared.search === "" &&
      cleared.hash === MOVED_FRAGMENT,
    `clicked clear on ${rewritten.search}${rewritten.hash}: the query string went ` +
      `"${cleared.search}" and the fragment stayed ${cleared.hash}`,
  )

  const plain = await act(
    devtools,
    push("?status=open", ""),
    "a push to ?status=open with no fragment",
  )
  const written = await act(
    devtools,
    click("url-filters-next-page"),
    "a click on next page with no fragment on the address",
  )
  check(
    "a filter change on an address with no fragment adds none, not even a bare hash",
    !plain.href.includes("#") && !written.href.includes("#") && plain.search === "?status=open" &&
      written.search === "?status=open&page=2",
    `clicked next page on ${plain.href}: the query string moved ${plain.search} → ` +
      `${written.search} and the address settled at ${written.href}`,
  )

  // The same clear as above, on an address carrying no fragment. The router navigates to
  // `pathname + "?" + ""`, so without the tidying step the two would end a clear differently:
  // `…/#/url-filters-check/moved` with a fragment and `…/?` without one.
  const emptied = await act(
    devtools,
    click("url-filters-clear"),
    "a click on clear with no fragment on the address",
  )
  check(
    "clearing on an address with no fragment leaves no bare question mark behind",
    written.search === "?status=open&page=2" && emptied.search === "" &&
      !emptied.href.endsWith("?") && !emptied.href.includes("#"),
    `clicked clear on ${written.href}: the query string went "${emptied.search}" and the address ` +
      `settled at ${emptied.href}`,
  )
}

/** What the page reports from the one task that remounts the card and types into its search field. */
interface EarlyInput {
  /** Whether the new card's search field was in the page and focused before anything was typed. */
  focused: boolean
  /** Whether an animation frame had run by the time the letter was typed. */
  framed: boolean
}

/**
 * A letter typed into a search field that was focused on mount, before the hook has read the
 * address, survives that read and reaches the address.
 *
 * The hook reads the address in an effect, and Preact runs effects after an animation frame. The
 * remount, the wait for the new field and the typing all happen in one task here, chained through
 * microtasks only, so the letter lands in the gap between the render and that effect on every run
 * rather than by chance — two protocol commands land in such a gap only by chance (see AGENTS.md).
 * `framed` records that no frame had run when the letter was typed; the microtask chain above is
 * what makes that hold, so the flag guards against a change in scheduling rather than proving it.
 * The letter is typed as the page sees a key press: the field's value set, then an `input` event.
 *
 * The address carries a `status` the reader did not touch, so the same remount also proves that a
 * value the address legitimately carries still loads on the first read. Back and forward close the
 * group: a later read lets the address win again.
 *
 * @param devtools The connected session.
 */
async function earlyInputChecks(devtools: Devtools): Promise<void> {
  const before = await act(
    devtools,
    push("?status=open", OWN_FRAGMENT),
    `a push to ?status=open${OWN_FRAGMENT}`,
  )
  const typedAt = await read<EarlyInput | null>(
    devtools,
    `(async () => {
      let framed = false
      requestAnimationFrame(() => { framed = true })
      const old = document.querySelector('[data-e2e="url-filters-query"]')
      const button = document.querySelector('[data-e2e="url-filters-remount-search"]')
      if (!button) throw new Error('no element with data-e2e="url-filters-remount-search"')
      button.click()
      let field = null
      for (let i = 0; i < 100 && !field; i++) {
        await Promise.resolve()
        const node = document.querySelector('[data-e2e="url-filters-query"]')
        if (node && node !== old && document.activeElement === node) field = node
      }
      if (!field) return { focused: false, framed }
      field.value = "h"
      field.dispatchEvent(new Event("input", { bubbles: true }))
      return { focused: true, framed }
    })()`,
    null,
  )
  const typed = await settled(devtools, "a letter typed into the search field focused on mount")

  check(
    "a letter typed into a field focused on mount, before the first read, survives and reaches " +
      "the address",
    typedAt?.focused === true && typedAt.framed === false && before.query === "" &&
      typed.query === "h" && typed.search === "?status=open&q=h" && typed.hash === OWN_FRAGMENT,
    `field focused before typing: ${typedAt?.focused}, a frame had run: ${typedAt?.framed}; ` +
      `the field reads "${before.query}" → "${typed.query}" and the address ` +
      `${before.search}${before.hash} → ${typed.search}${typed.hash}`,
  )
  check(
    "on that same first read, a filter the reader did not touch still loads from the address",
    typed.status === "open" && typed.page === "1",
    `status ${typed.status}, page ${typed.page} on ${typed.search}`,
  )
  check(
    "keeping that letter costs one history entry, like any other filter change",
    typed.entries - before.entries === 1,
    `history.length ${before.entries} → ${typed.entries}`,
  )

  const back = await act(devtools, "history.back()", "one press of Back out of the typed letter")
  const forward = await act(devtools, "history.forward()", "one press of Forward back onto it")
  check(
    "after the first read, back and forward move the search field with the address",
    typed.query === "h" && back.query === "" && back.search === "?status=open" &&
      forward.query === "h" && forward.search === "?status=open&q=h",
    `"${typed.query}" → Back "${back.query}" on ${back.search} → Forward "${forward.query}" on ` +
      `${forward.search}`,
  )
}

/** What {@link nowChecks} reads in the page around one mount and unmount of `useNow`. */
interface NowReading {
  /** Whether the demo section and its button were on the page. */
  found: boolean
  /** `document.visibilityState` when the event was fired. */
  visibility: string
  /** The reading right after mounting, and after `visibilitychange` fired. */
  before: string
  after: string
  /** `visibilitychange` listeners on `document`, and timers due within 5 s of the next UTC
   * midnight, still in place: after mounting and after unmounting. */
  listenersMounted: number
  timersMounted: number
  listenersUnmounted: number
  timersUnmounted: number
}

/**
 * `useNow`: the one part of it no unit test reaches is the effect that starts the store and stops
 * it on unmount (`signals/now.test.ts` drives the store itself with a fake clock).
 *
 * The probe wraps `document.addEventListener`/`removeEventListener` and `setTimeout`/`clearTimeout`
 * before mounting, counts the `visibilitychange` listeners and the timers set for the next UTC
 * midnight (the demo's zone; within 5 s of it, so a run near midnight still finds it) that are still
 * live, then fires `visibilitychange` on a visible page and unmounts. Every wrapper is put back
 * before the expression returns.
 *
 * @param devtools The connected session.
 */
async function nowChecks(devtools: Devtools): Promise<void> {
  const reading = await read<NowReading | null>(
    devtools,
    `(async () => {
      const until = ${PAGE_UNTIL}
      const section = document.querySelector('[data-e2e="now-demo"]')
      const toggle = section?.querySelector('[data-e2e="now-toggle"]')
      const empty = { found: false, visibility: document.visibilityState, before: "", after: "",
        listenersMounted: 0, timersMounted: 0, listenersUnmounted: 0, timersUnmounted: 0 }
      if (!section || !toggle) return empty
      const shown = () => section.querySelector('[data-e2e="now-reading"]')?.textContent ?? ""

      const listeners = new Set()
      const timers = new Map()
      const add = document.addEventListener
      const remove = document.removeEventListener
      const set = globalThis.setTimeout
      const clear = globalThis.clearTimeout
      document.addEventListener = function (type, listener, options) {
        if (type === "visibilitychange") listeners.add(listener)
        return add.call(this, type, listener, options)
      }
      document.removeEventListener = function (type, listener, options) {
        if (type === "visibilitychange") listeners.delete(listener)
        return remove.call(this, type, listener, options)
      }
      globalThis.setTimeout = function (callback, ms, ...rest) {
        const id = set.call(globalThis, (...args) => {
          timers.delete(id)
          return typeof callback === "function" ? callback(...args) : undefined
        }, ms, ...rest)
        timers.set(id, Date.now() + Number(ms ?? 0))
        return id
      }
      globalThis.clearTimeout = function (id) {
        timers.delete(id)
        return clear.call(globalThis, id)
      }
      const midnightTimers = () => {
        const midnight = new Date()
        midnight.setUTCHours(24, 0, 0, 0)
        return [...timers.values()].filter((due) => Math.abs(due - midnight.getTime()) < 5000)
          .length
      }

      try {
        toggle.click()
        await until(() => shown() !== "")
        const before = shown()
        const listenersMounted = listeners.size
        const timersMounted = midnightTimers()
        await new Promise((resolve) => set.call(globalThis, resolve, 20))
        document.dispatchEvent(new Event("visibilitychange"))
        await until(() => shown() !== before)
        const after = shown()
        toggle.click()
        await until(() => shown() === "")
        return { found: true, visibility: document.visibilityState, before, after,
          listenersMounted, timersMounted, listenersUnmounted: listeners.size,
          timersUnmounted: midnightTimers() }
      } finally {
        document.addEventListener = add
        document.removeEventListener = remove
        globalThis.setTimeout = set
        globalThis.clearTimeout = clear
      }
    })()`,
    null,
  )

  const r = reading ?? {
    found: false,
    visibility: "(unread)",
    before: "",
    after: "",
    listenersMounted: 0,
    timersMounted: 0,
    listenersUnmounted: 0,
    timersUnmounted: 0,
  }
  check(
    "mounting useNow sets one timer for the next midnight in its zone and one visibilitychange listener",
    r.found && r.timersMounted === 1 && r.listenersMounted === 1,
    r.found
      ? `${r.timersMounted} midnight timer(s), ${r.listenersMounted} listener(s)`
      : "no now-demo section with a toggle on the page",
  )
  check(
    "useNow reads the clock again when the page reports itself visible",
    r.found && r.visibility === "visible" && r.before !== "" && r.after > r.before,
    `visibility ${r.visibility}: ${r.before || "(nothing)"} → ${r.after || "(nothing)"}`,
  )
  check(
    "unmounting useNow clears its midnight timer and removes its visibilitychange listener",
    r.found && r.timersMounted === 1 && r.listenersMounted === 1 && r.timersUnmounted === 0 &&
      r.listenersUnmounted === 0,
    `after unmount: ${r.timersUnmounted} midnight timer(s), ${r.listenersUnmounted} listener(s)`,
  )
}
