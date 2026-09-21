/**
 * The System section.
 *
 * All four of the package's components are here. Two render from props with no platform access at
 * all; two are platform integration and are handled with an explicit, stated reduction rather than a
 * demo that claims behaviour it cannot show. Those two are the interesting part of this file, so
 * here is the reasoning in full:
 *
 * - **`SEOHead` returns `<title>`, `<meta>` and `<link>` tags.** Rendering it inside a catalogue card
 *   would splice a second `<title>` into the document *body*, and the browser reads the first
 *   `<title>` anywhere in the document as `document.title` — which would silently rename every deep
 *   link in the host app and is exactly the class of cross-talk a component library must not cause.
 *   The card therefore shows `seoHeadTags`, the component's own exported source of truth and the
 *   function the component maps over: the tag set is real, complete, and asserted by the card's own
 *   content. What is *not* claimed is that the tags reach a document head — this package has no head
 *   pipeline, and the guide has none to offer.
 * - **`SWUpdater` renders an empty live region and nothing else until a waiting service worker is
 *   detected**, so its server render is that region alone. The card has three parts. The first is
 *   the contract itself: the component mounted against a container that exists only in this page,
 *   so the always-present empty region can be seen with nothing waiting anywhere, and a button that
 *   makes an update ready inside that same element. Nothing is registered with the browser by it,
 *   which is what makes mounting it on page load acceptable here. The second drives the pure
 *   function the component is built on — `watchForUpdate`, on a fake registration, in every branch,
 *   with the outcome printed.
 *   The third is the component itself against a real service worker, and it is deliberately
 *   visitor-triggered: this catalogue is published, so **nothing registers a worker on page load**.
 *   Pressing the card's button installs `sw-demo/sw.js`, a worker with no `fetch` handler, no cache
 *   and no `clients.claim()`, scoped to `sw-demo/` — one directory below this page, which therefore
 *   is never controlled by it. The button then registers the same script under a second version
 *   marker, which is a genuine update: the new worker installs and *waits*, because the first one
 *   still controls the hidden frame the card opened inside the scope. That is the state `SWUpdater`
 *   exists for, so mounting it there shows the real bar. The card's reset control unregisters
 *   everything again, and `pages/checks/system.ts` drives all of it in headless Chromium.
 *
 * The rest are honest full demos. `Calendar` reads state, so it lives in its own component with its
 * own local state, and every date is injected: it takes `today` and `timeZone` as props precisely so
 * a render can be pinned, and it is pinned to `2026-03-10`/`UTC` here. It has three cards rather
 * than one, because three things about it can only be shown by driving it: the dual-mode swap, the
 * keyboard inside the grid, and what changes when the locale does.
 *
 * `ImageLightbox` renders its dialog closed, with nothing else to pin, and the images beside it are
 * the demo's own — one plain and one wrapped in a link, because "opens the lightbox instead of
 * following the link" is a claim that needs a link to be a claim at all.
 */

import { Calendar } from "@preact-components/system/calendar"
import type { PageHead } from "@preact-components/system/head"
import { ImageLightbox } from "@preact-components/system/image-lightbox"
import { seoHeadTags } from "@preact-components/system/seo-head"
import {
  type ContainerLike,
  type RegistrationLike,
  SWUpdater,
  watchForUpdate,
  type WorkerLike,
} from "@preact-components/system/sw-updater"
import { Button } from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import { useRef } from "preact/hooks"
import type { DemoFragment } from "../registry.ts"

/**
 * A page head with every optional tag populated, so the card shows the whole set, not a subset.
 *
 * The canonical address carries a fragment on purpose: the tag set below is the proof that one is
 * dropped before it is published, and that the `BreadcrumbList` identifier ends up with a single
 * `#` rather than two.
 */
const pageHead: PageHead = {
  title: "Zone availability — Acme",
  description: "Live slot availability for every zone, refreshed every minute.",
  canonical: "https://example.com/bookings/zones/12#reviews",
  ogImage: "https://example.com/og/zones.png",
  ogType: "article",
  siteName: "Acme",
  twitterSite: "@acme",
  locale: "en_GB",
  jsonLd: [{ "@type": "Organization", name: "Acme" }],
  crumbs: [
    { name: "Home", href: "/" },
    { name: "Zones", href: "/bookings/zones" },
    { name: "Zone availability" },
  ],
}

/**
 * The tag set as the text a reader can compare against the usage block.
 *
 * `JSON.stringify` on `HeadTag`s rather than on arbitrary props: the helper returns
 * `{ tag, attrs, text? }` records in document order, so this is the component's own data shown
 * without pretending the host page's head is being managed.
 */
function SeoHeadTagList() {
  return (
    <div class="space-y-2">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {seoHeadTags(pageHead).length} tags, in document order — the exact array{" "}
        <code>&lt;SEOHead /&gt;</code> maps over
      </p>
      <pre class="max-h-72 overflow-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
        <code>{JSON.stringify(seoHeadTags(pageHead), null, 2)}</code>
      </pre>
    </div>
  )
}

/** A worker that reports the state the watcher asks about. */
function fakeWorker(state: string): WorkerLike {
  return {
    state,
    postMessage: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

/** A registration double carrying one handler per event type, so the card can fire them by hand. */
function fakeRegistration(init: {
  waiting?: WorkerLike | null
  installing?: WorkerLike | null
} = {}): RegistrationLike & { fire(type: string): void } {
  const handlers = new Map<string, Array<() => void>>()
  const registration = {
    waiting: init.waiting ?? null,
    installing: init.installing ?? null,
    addEventListener: (type: string, listener: () => void) => {
      handlers.set(type, [...(handlers.get(type) ?? []), listener])
    },
    removeEventListener: (type: string, listener: () => void) => {
      handlers.set(type, (handlers.get(type) ?? []).filter((entry) => entry !== listener))
    },
    fire: (type: string) => {
      for (const listener of handlers.get(type) ?? []) listener()
    },
  }
  return registration
}

/**
 * A worker double that really dispatches `statechange` to whoever listened for it.
 *
 * {@link fakeWorker} ignores its listeners, which is enough for a scenario that only reads
 * `state`. The card below needs the other half: `watchForUpdate` subscribes to the installing
 * worker and reports the update from that event, so a double that swallows the subscription can
 * never produce an update at all.
 */
function scriptedWorker(state: string): WorkerLike & { emit(type: string): void } {
  const handlers = new Map<string, Array<() => void>>()
  return {
    state,
    postMessage: () => {},
    addEventListener: (type: string, listener: () => void) => {
      handlers.set(type, [...(handlers.get(type) ?? []), listener])
    },
    removeEventListener: (type: string, listener: () => void) => {
      handlers.set(type, (handlers.get(type) ?? []).filter((entry) => entry !== listener))
    },
    emit: (type: string) => {
      for (const listener of handlers.get(type) ?? []) listener()
    },
  }
}

/** A container the card owns, plus the button that makes an update ready inside it. */
interface QuietRig {
  /** Handed to `SWUpdater` as its `container` prop, so `navigator` is never consulted. */
  container: ContainerLike
  /** Run one complete install → installed cycle, which is what reports an update. */
  announce(): void
}

/**
 * A service-worker container that exists only in this page.
 *
 * Nothing here reaches the browser's own registry: `register` answers with a registration object
 * the card built, so mounting `SWUpdater` against it installs no worker and leaves no state behind
 * when the visitor navigates away. That is what makes it safe to mount this one on page load,
 * which the live demo further down deliberately is not — and being mounted on page load is the
 * only way to show the thing this card is about, a live region that is already in the page before
 * there is anything to announce.
 *
 * `controller` is set, because a registration with nothing controlling the page is a *first*
 * install and `watchForUpdate` stays silent through those on purpose.
 */
function quietRig(): QuietRig {
  const registration = fakeRegistration()
  return {
    container: {
      controller: {},
      register: () => Promise.resolve(registration),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    announce: () => {
      const worker = scriptedWorker("installing")
      registration.installing = worker
      registration.fire("updatefound")
      worker.state = "installed"
      worker.emit("statechange")
    },
  }
}

/** The message this card announces. Not the component's English default, on purpose. */
const QUIET_MESSAGE = "A newer catalogue build is ready"

/**
 * The live region before, during and after there is something to say.
 *
 * This is the card for the component's contract rather than for its plumbing. `SWUpdater` is
 * mounted here from page load, against a container that exists only in this page, so the empty
 * live region it always renders can be seen — and measured — with nothing waiting anywhere. The
 * button then runs a whole install cycle through `watchForUpdate`, which is what puts the message
 * *into* the region that was already there, rather than putting a region carrying a message into
 * the page. That difference is the whole reason the component is shaped this way, and it is not
 * visible: the region is an empty, unstyled element, and what proves the message arrived as a
 * change to it is `pages/checks/system.ts`, which parks a reference to the element and a
 * `MutationObserver` on it before pressing the button.
 *
 * The bar is laid out `static` here so it sits inside the card. Shipped, it is `fixed` across the
 * top of the window, which the live demo below shows; inside the card it can be compared against
 * an empty region that reserves no height at all.
 *
 * Dismissing it and pressing the button again is the other half of the contract: the message has
 * to leave the region and arrive again, because a visitor who put one version away still has to
 * be told about the next one.
 */
function SwUpdaterQuietDemo() {
  const announcements = useSignal(0)
  const reloads = useSignal(0)
  const rig = useRef<QuietRig | null>(null)
  rig.current ??= quietRig()

  return (
    <div class="space-y-3" data-e2e="sw-quiet">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Mounted right now, with nothing waiting: the only thing it renders is an empty live region,
        zero pixels tall and painting nothing. Press the button to make an update ready inside that
        same element.
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          data-e2e="sw-quiet-announce"
          onClick={() => {
            rig.current?.announce()
            announcements.value++
          }}
        >
          Make an update ready
        </Button>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          announced <span data-e2e="sw-quiet-count">{announcements.value}</span>{" "}
          times, reload port called <span data-e2e="sw-quiet-reloads">{reloads.value}</span> times
        </span>
      </div>
      <SWUpdater
        container={rig.current.container}
        message={QUIET_MESSAGE}
        reload={() => reloads.value++}
        class="static shadow-none"
      />
    </div>
  )
}

/**
 * `watchForUpdate` driven through both races, with no browser and no service worker.
 *
 * The demo's whole point is that this is *not* a mock of the component: it is the exact function
 * `SWUpdater` calls in its effect, given the same inputs a browser would give it, so the branch
 * that decides "first install, say nothing" versus "update waiting, show the bar" is executed here
 * rather than described.
 */
function SwUpdaterDemo() {
  const log = useSignal<string[]>([])

  const run = (label: string, scenario: () => boolean) => {
    log.value = [...log.value, `${label}: ${scenario() ? "update reported" : "silent"}`]
  }

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            run("worker already waiting", () => {
              let reported = false
              watchForUpdate(fakeRegistration({ waiting: fakeWorker("installed") }), {
                hasController: () => true,
                onUpdate: () => reported = true,
              })
              return reported
            })}
        >
          A worker is already waiting
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            run("first install (no controller)", () => {
              const registration = fakeRegistration()
              let reported = false
              watchForUpdate(registration, {
                hasController: () => false,
                onUpdate: () => reported = true,
              })
              registration.installing = fakeWorker("installed")
              registration.fire("updatefound")
              return reported
            })}
        >
          First install
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            run("update while controlled", () => {
              const registration = fakeRegistration()
              let reported = false
              watchForUpdate(registration, {
                hasController: () => true,
                onUpdate: () => reported = true,
              })
              registration.installing = fakeWorker("installed")
              registration.fire("updatefound")
              return reported
            })}
        >
          Update while controlled
        </Button>
      </div>
      {log.value.length > 0
        ? (
          <ul class="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {log.value.map((line, index) => <li key={index}>{line}</li>)}
          </ul>
        )
        : (
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Nothing has been watched yet. Each button runs the real function against a registration
            it builds on the spot.
          </p>
        )}
    </div>
  )
}

/** Where the demo worker is served from, relative to whatever path this guide is mounted at. */
const DEMO_SCOPE = "sw-demo/"
/** The demo worker's script, without its version marker. */
const DEMO_SCRIPT = "sw-demo/sw.js"

/** Resolve a demo asset against the page, so the card works under any base path. */
function demoUrl(path: string): string {
  return new URL(path, globalThis.location.href).href
}

/**
 * Poll until `read` returns something, or give up.
 *
 * Service-worker state machines advance on their own schedule — `active`, `waiting` and
 * `controller` all appear a beat after the promise that led to them resolves — so the card waits
 * for the state rather than assuming it.
 */
async function waitFor<T>(read: () => T | null | undefined, timeoutMs = 10_000): Promise<T | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = read()
    if (value) return value
    await new Promise((done) => setTimeout(done, 50))
  }
  return null
}

/**
 * `SWUpdater` against a real service worker, staged by the visitor.
 *
 * **Nothing here happens on page load.** This catalogue is a published site, and a worker installed
 * by merely opening a page would sit in real visitors' browsers; the button is the consent. What it
 * installs is `sw-demo/sw.js`, which has no `fetch` handler, opens no cache and never calls
 * `clients.claim()`, scoped to `sw-demo/` — a directory below this page, so this page is never
 * controlled by it.
 *
 * Producing the state `SWUpdater` exists for takes a real update cycle, which is the rest of what
 * the button does:
 *
 * 1. register the script with `?v=1` and wait for it to activate;
 * 2. load `sw-demo/` in a hidden frame, which that worker then controls — a new worker stays
 *    *waiting* only while the one it replaces still controls a page, and this page is not in scope;
 * 3. register the same script with `?v=2`. A different URL is a different script, so the browser
 *    installs it, and it waits behind version 1.
 *
 * Only then is `<SWUpdater>` mounted, pointed at `?v=2`. It finds the waiting worker through
 * `navigator.serviceWorker` for itself — the card passes it no container — and shows the bar.
 * Reload posts the skip-waiting message to that worker, which is what hands over. The reload port
 * is replaced by a counter, because a guide that reloaded itself would be unreadable.
 */
function SwUpdaterLiveDemo() {
  const log = useSignal<string[]>([])
  const scriptUrl = useSignal<string | null>(null)
  const scopeUrl = useSignal("")
  const reloads = useSignal(0)
  const busy = useSignal(false)
  const frame = useRef<HTMLIFrameElement | null>(null)

  const note = (line: string) => log.value = [...log.value, line]

  const stageUpdate = async () => {
    if (busy.value) return
    busy.value = true
    log.value = []
    try {
      const container = globalThis.navigator?.serviceWorker
      if (!container) {
        note("This browser has no service workers, so there is nothing to demonstrate.")
        return
      }

      const scope = demoUrl(DEMO_SCOPE)
      const first = await container.register(demoUrl(`${DEMO_SCRIPT}?v=1`), { scope })
      note(`Registered version 1 at ${new URL(scope).pathname}.`)
      if (!await waitFor(() => first.active)) {
        note("Version 1 never activated — stopping here rather than claiming an update.")
        return
      }
      note("Version 1 is active. It controls nothing yet, and never controls this page.")

      const created = document.createElement("iframe")
      created.title = "A page inside the demo worker's scope"
      created.src = scope
      created.style.cssText = "position:absolute;left:-9999px;width:0;height:0;border:0"
      document.body.appendChild(created)
      frame.current?.remove()
      frame.current = created
      await new Promise((done) => created.addEventListener("load", done, { once: true }))
      const controlled = await waitFor(() =>
        created.contentWindow?.navigator.serviceWorker.controller
      )
      note(
        controlled
          ? "A hidden frame inside the scope is now controlled by version 1."
          : "The hidden frame was not controlled — version 2 will activate instead of waiting.",
      )

      const second = await container.register(demoUrl(`${DEMO_SCRIPT}?v=2`), { scope })
      const waiting = await waitFor(() => second.waiting)
      if (!waiting) {
        note("Version 2 took over immediately, so nothing is waiting and there is no bar to show.")
        return
      }

      note("Version 2 is installed and waiting. <SWUpdater> mounts below and finds it itself.")
      scopeUrl.value = scope
      scriptUrl.value = demoUrl(`${DEMO_SCRIPT}?v=2`)
    } catch (error) {
      note(`The demo could not stage an update: ${error}`)
    } finally {
      busy.value = false
    }
  }

  const reset = async () => {
    scriptUrl.value = null
    reloads.value = 0
    frame.current?.remove()
    frame.current = null
    const container = globalThis.navigator?.serviceWorker
    const registration = await container?.getRegistration(demoUrl(DEMO_SCOPE))
    if (registration) await registration.unregister()
    log.value = ["Reset: this page has no service worker registered any more."]
  }

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" data-e2e="sw-install" onClick={stageUpdate}>
          Install a worker and stage an update
        </Button>
        <Button variant="outline" size="sm" data-e2e="sw-reset" onClick={reset}>
          Unregister and reset
        </Button>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          reload port called <span data-e2e="sw-reloads">{reloads.value}</span> times
        </span>
      </div>
      <ul class="space-y-1 text-xs text-gray-600 dark:text-gray-300" data-e2e="sw-log">
        {log.value.map((line, index) => <li key={index}>{line}</li>)}
      </ul>
      <div
        class="rounded-md border border-dashed border-gray-300 p-3 dark:border-gray-600"
        data-e2e="sw-mount"
      >
        {scriptUrl.value
          ? (
            <SWUpdater
              scriptUrl={scriptUrl.value}
              scope={scopeUrl.value}
              reload={() => reloads.value++}
              onDismiss={() => note("The visitor dismissed the bar.")}
              onError={(error) => note(`Registration failed: ${error}`)}
            />
          )
          : null}
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {scriptUrl.value
            ? "<SWUpdater> is mounted. Its bar is the orange one at the top of the window."
            : "<SWUpdater> is not mounted: it registers a worker, so it waits for the button."}
        </p>
      </div>
    </div>
  )
}

/** A flat placeholder rectangle, as a data URI, so the card needs no image asset. */
function placeholder(fill: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect width='120' height='80' fill='%23${fill}'/%3E%3C/svg%3E`
}

/**
 * The lightbox as it exists before anything is opened, with two images to open it from.
 *
 * The element it renders is a real `<dialog>`, and it is really closed — no `open` attribute, no
 * `showModal()`. Both images are inside the container the component watches, and the second is
 * wrapped in a link on purpose: the component cancels the event it opens on, so the lightbox opens
 * and the link is not followed. Without JavaScript that link is simply a link, which is the whole
 * progressive-enhancement claim in one element.
 */
function ImageLightboxDemo() {
  return (
    <div class="space-y-3">
      <div data-lightbox class="flex flex-wrap items-start gap-3">
        <p class="w-full text-xs text-gray-500 dark:text-gray-400">
          &lt;ImageLightbox /&gt; renders the dialog below, then watches{" "}
          <code>[data-lightbox]</code>{" "}
          for clicks and key presses. Both images below are Tab stops that open it with Enter or
          Space; the second is wrapped in a link to{" "}
          <code>example.com</code>, which opening the lightbox does not follow.
        </p>
        <img
          data-e2e="lightbox-image"
          src={placeholder("c4b5fd")}
          alt="A placeholder image"
          class="rounded border border-gray-200 dark:border-gray-700"
        />
        <a href="https://example.com/" data-e2e="lightbox-link" class="inline-block">
          <img
            data-e2e="lightbox-linked-image"
            src={placeholder("a5b4fc")}
            alt="A placeholder image inside a link"
            class="rounded border border-gray-200 dark:border-gray-700"
          />
        </a>
      </div>
      <ImageLightbox />
    </div>
  )
}

/**
 * The grid with every cell kind on screen at once.
 *
 * `today`, `timeZone` and the whole window are props, so this render is identical on every machine
 * in every zone — the component reads the clock only for the `today` this passes in.
 */
function CalendarDemo() {
  return (
    <Calendar
      monthAnchor="2026-03-01"
      minDate="2026-03-01"
      maxDate="2026-04-30"
      today="2026-03-10"
      timeZone="UTC"
      slotsByDate={{
        "2026-03-11": 6,
        "2026-03-12": 3,
        "2026-03-13": 0,
        "2026-03-14": 18,
        "2026-03-18": 2,
        "2026-04-02": 9,
      }}
      selectedDate="2026-03-12"
    />
  )
}

/**
 * The same grid with both ports supplied, which is the shape its keyboard needs.
 *
 * `onSelectDate` is what turns every cell from an `<a>` into a `<button>`; `onSelectMonth` is what
 * Page Up and Page Down call, so the month this card shows is state it owns rather than a constant.
 * The horizon is a whole year for the same reason: a month arrow with nothing to show is inert, and
 * paging is only demonstrable where there is a month to page to.
 */
function CalendarInteractiveDemo() {
  const picked = useSignal("nothing picked")
  const month = useSignal("2026-03-01")

  return (
    <div class="space-y-3" data-e2e="calendar-interactive">
      <Calendar
        monthAnchor={month.value}
        minDate="2026-01-01"
        maxDate="2026-12-31"
        today="2026-03-10"
        timeZone="UTC"
        slotsByDate={{ "2026-03-11": 6, "2026-03-12": 3, "2026-03-18": 2, "2026-04-14": 5 }}
        selectedDate={picked.value}
        onSelectDate={(date) => picked.value = date}
        onSelectMonth={(anchor) => month.value = anchor}
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        onSelectDate: <span data-e2e="calendar-picked">{picked.value}</span> · onSelectMonth:{" "}
        <span data-e2e="calendar-month">{month.value}</span>
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Tab once to reach the grid, then the arrow keys, Home, End, Page Up and Page Down move
        inside it.
      </p>
    </div>
  )
}

/** The locales this card offers, as a reader picks them. */
const CALENDAR_LOCALES = [
  { tag: "en-GB", label: "English (UK)" },
  { tag: "en-US", label: "English (US)" },
  { tag: "ar-EG", label: "Arabic (Egypt)" },
]

/**
 * The same month in three locales, because two things about a calendar are the locale's to decide.
 *
 * The week starts on Monday in the United Kingdom, on Sunday in the United States and on Saturday
 * in Egypt, so the columns move under the same dates; and the headers are whatever `Intl`
 * abbreviates a weekday to, which is why they are not cut to a fixed number of characters — every
 * Arabic weekday opens with the same two.
 */
function CalendarLocaleDemo() {
  const locale = useSignal("en-GB")

  return (
    <div class="space-y-3" data-e2e="calendar-locale">
      <div class="flex flex-wrap gap-2">
        {CALENDAR_LOCALES.map(({ tag, label }) => (
          <Button
            key={tag}
            variant="outline"
            size="sm"
            data-e2e={`calendar-locale-${tag}`}
            onClick={() => locale.value = tag}
          >
            {label}
          </Button>
        ))}
      </div>
      <Calendar
        locale={locale.value}
        monthAnchor="2026-03-01"
        minDate="2026-03-01"
        maxDate="2026-04-30"
        today="2026-03-10"
        timeZone="UTC"
        slotsByDate={{ "2026-03-11": 6, "2026-03-12": 3, "2026-03-18": 2 }}
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        locale: <span data-e2e="calendar-locale-tag">{locale.value}</span>
      </p>
    </div>
  )
}

export const systemDemos = {
  Calendar: {
    summary:
      "Six-week month grid. **Dual-mode**: with no `onSelectDate` every cell is an `<a href>` and a month arrow with nothing to show is a `<span>` rather than a dead link; supplying the callback turns the cells into `<button>`. `today` and `timeZone` are props, so a render can be pinned — this card passes `2026-03-10` and `UTC` and reads no clock, and a zone the platform cannot resolve falls back to UTC instead of throwing. A date missing from `slotsByDate` has no availability, a `0` has no slots left, and the two are visually alike but carry different accessible labels. Cells also show today, past dates, dates outside the window, and a scarcity dot at or below `lowSlotsThreshold`. **The whole grid is one Tab stop** once hydrated: the arrow keys step a day and a week, Home and End go to the ends of the week, Page Up and Page Down ask `onSelectMonth` for the neighbouring month, and why a day cannot be picked is the cell's own accessible name plus the hint under the grid rather than a `title` nobody can hover. **The week is the locale's**: both the column order and the header text come from `Intl`, so the third card below moves the columns under the same dates as it changes language.",
    snippet: `<Calendar
  monthAnchor="2026-03-01"
  minDate="2026-03-01"
  maxDate="2026-04-30"
  today="2026-03-10"
  timeZone="UTC"
  slotsByDate={{ "2026-03-12": 3, "2026-03-13": 0 }}
  selectedDate="2026-03-12"
  onSelectDate={(date) => picked.value = date}
/>`,
    render: () => (
      <div class="space-y-4">
        <CalendarDemo />
        <CalendarInteractiveDemo />
        <CalendarLocaleDemo />
      </div>
    ),
  },
  SEOHead: {
    summary:
      "The page-head tag set as a fragment, plus the JSON-LD `@graph` that mirrors it: title, description, canonical and robots first, then the Twitter card, then Open Graph, then a `BreadcrumbList` built from the crumbs the caller stated. Optional tags are omitted rather than emitted empty, and `<` is escaped in the script body so a description containing `</script>` cannot close the element it is embedded in. **The canonical address is cleaned before it is published**: this card is built from an address ending in `#reviews`, and the tag set below carries that address without it, because a fragment names a position inside a page rather than a page — and because `…#reviews#breadcrumb` is an identifier nothing can match. The usage block above is written the way a route should write it, which is why it carries no fragment to begin with. A user name and password are dropped the same way, and an address that is not an `http`/`https` page — `javascript:alert(1)`, or a relative path — throws rather than being printed, the way an impossible month anchor does: a canonical address is the route's own arithmetic. **Crumbs are a prop, never a guess.** Reading them out of the path assumed every segment is a page, so `/bookings/zones/12` used to publish a crumb named `12`. **This card shows `seoHeadTags`, the exported data the component maps over, not the component itself**: rendering `<SEOHead />` here would splice a second `<title>` into this document's body, and a browser reads the first `<title>` anywhere in a document as `document.title` — which would rename every deep link in the host app. The tag set below is real and complete; where it goes is the host's head pipeline, and this guide has none.",
    snippet: `<SEOHead
  title="Zone availability — Acme"
  description="Live slot availability for every zone."
  canonical="https://example.com/bookings/zones/12"
  ogImage="https://example.com/og/zones.png"
  siteName="Acme"
  jsonLd={[{ "@type": "Organization", name: "Acme" }]}
  crumbs={[
    { name: "Home", href: "/" },
    { name: "Zones", href: "/bookings/zones" },
    { name: "Zone availability" },
  ]}
/>

// The same tag set as data, for an app whose head is not a component tree:
const tags = seoHeadTags(head)`,
    render: () => <SeoHeadTagList />,
  },
  SWUpdater: {
    summary:
      'Registers the service worker and offers a reload once a new version is *waiting*. **Its live region is in the page from the first render, empty**, and the bar appears inside it: a region that arrives carrying its first message is commonly not announced at all, because assistive technology announces a *change* to a region it is already watching. Nothing else is always rendered — the region carries no class, no padding and no border, so an empty one paints nothing and is zero pixels tall. It is an ordinary in-flow element rather than a `fixed` one, so a parent that uses `gap` still allocates one gap for it; `system/README.md` measures that and says where to mount it. A dismissal covers one update rather than the component, so a later version puts the message back. The container comes from `navigator.serviceWorker`, read inside the effect so a server render touches nothing but still emits the empty region. Nothing reloads until the visitor presses Reload: `controllerchange` fires in every open tab, so the listener that reloads is armed by the button and not by the registration — otherwise a first install reloads the page mid-visit and one tab\'s Reload reloads the tab with the half-filled form. Pressing Reload posts `{ action: "skipWaiting" }` to the waiting worker, which is a **contract**: a worker that expects a different message ignores it and the button does nothing, so the message is the `updateMessage` prop. The bar can be dismissed, and every string it shows has an English default and a prop. **This card has three parts.** The first is the contract above: the component mounted with nothing waiting, and a button that puts a message into the region already there. The second drives the pure function underneath, `watchForUpdate`, against a fake registration in all three branches. The third is the component itself against a real worker — press the button, because this site is published and nothing registers a worker on its own.',
    snippet: `<SWUpdater
  scriptUrl="/sw.js"
  reload={() => globalThis.location.reload()}
  onUpdate={() => app.toast.info({ body: "Updating…" })}
  onError={(error) => app.report(error)}
/>

// Only when the worker speaks another dialect — the default is { action: "skipWaiting" }:
<SWUpdater scriptUrl="/sw.js" updateMessage={{ type: "SKIP_WAITING" }} />`,
    render: () => (
      <div class="space-y-4">
        <SwUpdaterQuietDemo />
        <SwUpdaterDemo />
        <SwUpdaterLiveDemo />
      </div>
    ),
  },
  ImageLightbox: {
    summary:
      "Makes the images inside a container zoomable through a native `<dialog>` lightbox. Progressive enhancement in the strict sense: the server renders the page and this only adds a zoom layer after hydration, so a reader without JavaScript loses a zoom they never had. The layer is delegated to the container — one listener rather than one per image, and images arriving later still work. **A zoomable image behaves like a button**: it takes a Tab stop, carries a button's role and a name saying what it does, and opens with Enter or Space, with Space cancelled so the page does not scroll away underneath. A click or an Enter press is cancelled too, so the second image below opens the lightbox instead of following the link it sits in. **The `<dialog>` is the component's real output and it is really closed** until an image is opened. Escape closes it natively and a click on the backdrop closes it, which is only true because the image is positioned inside the dialog rather than filling it — a child that covers the dialog is a backdrop no click can reach. Every string it shows is a prop with an English default.",
    snippet: `<ImageLightbox
  containerSelector="[data-lightbox]"
  fallbackAlt="Figure"
  zoomLabel="Zoom"
  onOpen={(image) => analytics.track("lightbox", image.src)}
/>`,
    render: () => <ImageLightboxDemo />,
  },
} satisfies DemoFragment
