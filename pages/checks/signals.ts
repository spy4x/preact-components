import { check, type Devtools, poll } from "./harness.ts"

/**
 * `signals/`'s browser checks: `useUrlFilters`, bound to the host page's own address bar.
 *
 * The hook is two effects and nothing else, so no test in this repository can reach it — every unit
 * test renders to an HTML string and runs no effect. What this file drives is the section
 * `pages/src/url-filters.tsx` puts below the catalogue: three filters — `status`, `page` and a
 * `size` with a custom parser — bound to the query string in both directions, with a link or a
 * button for every one of them.
 *
 * Most assertions below are **transitions**: the filters read one way, the address changes, they
 * read another. A single end state would be satisfied by a hook that read the address only at
 * mount, which is the bug this file exists for. Nine are something else and say so where they are
 * raised — the card that arrives on a filtered address is a guard on the mount path; two assert
 * that an address does *not* move, which is the whole of what "reading never writes" means; four
 * are counts, because "one change, one history entry" and "no `hashchange` fired" are numbers
 * rather than transitions; one asserts that a fragment stays absent; and the last collects what the
 * page threw.
 *
 * The group about the fragment pairs every one of its assertions with a transition on the query
 * string, for the reason the shared rules give: "the fragment did not change" is also true of a
 * write that never happened, so each of those checks reads the query string moving in the same
 * breath.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function signalsChecks(devtools: Devtools): Promise<void> {
  await urlFilterChecks(devtools)
  check(
    "every URL-filter reading came back without a page exception",
    pageErrors.length === 0,
    pageErrors.length === 0
      ? "each expression this file evaluated returned a value, and every action settled"
      : pageErrors.join(" | "),
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
      now.page === previous.page && now.size === previous.size &&
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
