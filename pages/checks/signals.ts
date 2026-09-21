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
 * mount, which is the bug this file exists for. Six are something else and say so where they are
 * raised — the card that arrives on a filtered address is a guard on the mount path; two assert
 * that an address does *not* move, which is the whole of what "reading never writes" means; three
 * are counts, because "one change, one history entry" is a number rather than a transition; and the
 * last collects what the page threw.
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
  /** `location.hash` — the host page's own route, which only a filter write is allowed to disturb. */
  hash: string
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
      now.entries === previous.entries
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
 * Click one of the demo's controls, by the name it carries in `data-e2e`.
 *
 * A click and not a key press: the hook has no keyboard contract of its own, every control is a
 * plain `<button>` or wouter's `<Link>`, and in headless Chromium a real Enter press does not
 * activate a focused button.
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
  await backChecks(devtools, written)

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
 */
async function backChecks(devtools: Devtools, before: FilterState): Promise<void> {
  const backed = await act(devtools, "history.back()", "one press of Back")
  check(
    "one press of Back moves the address, and the filters move with it",
    backed.search !== before.search && before.status === "(any)" && before.page === "1" &&
      backed.status === "closed" && backed.page === "2",
    `${before.search} → ${backed.search} in one press: status ${before.status} → ` +
      `${backed.status}, page ${before.page} → ${backed.page}`,
  )
}
