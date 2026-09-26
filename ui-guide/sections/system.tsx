/**
 * The System section: all nine of the package's components, live.
 *
 * Two of them are platform integration, and their cards are reduced on purpose:
 *
 * - **`SEOHead` returns `<title>`, `<meta>` and `<link>` tags.** Rendered inside a card it would put
 *   a second `<title>` into the document body, and the browser reads the first `<title>` anywhere
 *   as `document.title`, which would rename the host app's page. The card shows `seoHeadTags`, the
 *   exported data the component maps over, instead.
 * - **`SWUpdater` renders an empty live region until a waiting worker is found.** Its card has three
 *   parts: the component mounted against a container that exists only in this page (so the empty
 *   region is there from page load and nothing is registered with the browser); `watchForUpdate`
 *   run on a fake registration in each branch; and the component against a real worker, which only
 *   a visitor's press installs, because this catalogue is published. That worker (`sw-demo/sw.js`)
 *   has no `fetch` handler, no cache and no `clients.claim()`, and its scope is a directory below
 *   this page, so this page is never controlled by it.
 *
 * Every date is injected: the calendars take `today` and `timeZone` as props and are pinned to
 * `2026-03-10` in `UTC`. The two calendar owners that refuse or answer late count what they were
 * asked and what they did, because "the month did not change" is otherwise indistinguishable from a
 * key press that never arrived.
 *
 * The `data-e2e` hooks throughout are what `pages/checks/system.ts` drives in a real browser.
 */

import {
  IconBell,
  IconBookOpen,
  IconChartPie,
  IconCog6Tooth,
  IconFolder,
  IconHome,
  IconPencilSquare,
  IconSearch,
} from "@spy4x/preact-icons"
import {
  AuthForm,
  type AuthFormError,
  type AuthMode,
  type AuthStep,
} from "@spy4x/preact-system/auth-form"
import { Calendar } from "@spy4x/preact-system/calendar"
import type { PageHead } from "@spy4x/preact-system/head"
import { ImageLightbox } from "@spy4x/preact-system/image-lightbox"
import { seoHeadTags } from "@spy4x/preact-system/seo-head"
import { RailShell, type RailShellItem } from "@spy4x/preact-system/rail-shell"
import { Shell } from "@spy4x/preact-system/shell"
import { SiteHeader } from "@spy4x/preact-system/site-header"
import { readStateInit, StateInit } from "@spy4x/preact-system/state-init"
import {
  type ContainerLike,
  type RegistrationLike,
  SWUpdater,
  watchForUpdate,
  type WorkerLike,
} from "@spy4x/preact-system/sw-updater"
import { Button, Cluster, Grid, Stack } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import type { ComponentChildren } from "preact"
import { useRef } from "preact/hooks"
import type { DemoFragment } from "../registry.ts"

/** One captioned part of a card whose demo shows several things side by side. */
function Part({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <Stack gap="sm">
      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</h4>
      {children}
    </Stack>
  )
}

/** The muted line of text a demo prints its state or its instructions in. */
const NOTE = "text-xs text-gray-500 dark:text-gray-400"

/**
 * A page head with every optional tag populated, so the card shows the whole set, not a subset.
 *
 * The canonical address carries a fragment on purpose: the tag set below is the proof that one is
 * dropped before it is published, and that the `BreadcrumbList` identifier ends up with a single
 * `#` rather than two.
 */
const pageHead: PageHead = {
  title: "Blue widget — Acme",
  description: "Specifications, prices and reviews for the blue widget.",
  canonical: "https://example.com/products/widgets/12#reviews",
  ogImage: "https://example.com/og/widgets.png",
  ogType: "article",
  siteName: "Acme",
  twitterSite: "@acme",
  locale: "en_GB",
  jsonLd: [{ "@type": "Organization", name: "Acme" }],
  crumbs: [
    { name: "Home", href: "/" },
    { name: "Widgets", href: "/products/widgets" },
    { name: "Blue widget" },
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
    <Stack gap="sm">
      <p class={NOTE}>
        {seoHeadTags(pageHead).length} tags, in document order: the array{" "}
        <code>&lt;SEOHead /&gt;</code> renders.
      </p>
      <pre class="max-h-72 overflow-auto font-mono text-xs text-gray-900 dark:text-gray-100">
        <code>{JSON.stringify(seoHeadTags(pageHead), null, 2)}</code>
      </pre>
    </Stack>
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
    <div data-e2e="sw-quiet">
      <Stack gap="sm">
        <p class={NOTE}>
          Mounted now with nothing waiting, it renders an empty live region. The button makes an
          update ready inside that same element.
        </p>
        <Cluster>
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
          <span class={NOTE}>
            announced <span data-e2e="sw-quiet-count">{announcements.value}</span>{" "}
            times, reload port called <span data-e2e="sw-quiet-reloads">{reloads.value}</span> times
          </span>
        </Cluster>
      </Stack>
      {/* Block flow on purpose: in a flex or grid parent the empty region would still cost a gap. */}
      <SWUpdater
        container={rig.current.container}
        message={QUIET_MESSAGE}
        reload={() => reloads.value++}
        class="static mt-4 shadow-none"
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
    <Stack gap="sm">
      <Cluster>
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
      </Cluster>
      {log.value.length > 0
        ? (
          <ul class="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {log.value.map((line, index) => <li key={index}>{line}</li>)}
          </ul>
        )
        : (
          <p class={NOTE}>
            Each button runs the real function against a registration it builds on the spot.
          </p>
        )}
    </Stack>
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
    <Stack gap="sm">
      <Cluster>
        <Button variant="outline" size="sm" data-e2e="sw-install" onClick={stageUpdate}>
          Install a worker and stage an update
        </Button>
        <Button variant="outline" size="sm" data-e2e="sw-reset" onClick={reset}>
          Unregister and reset
        </Button>
        <span class={NOTE}>
          reload port called <span data-e2e="sw-reloads">{reloads.value}</span> times
        </span>
      </Cluster>
      <ul class="space-y-1 text-xs text-gray-600 dark:text-gray-300" data-e2e="sw-log">
        {log.value.map((line, index) => <li key={index}>{line}</li>)}
      </ul>
      <div data-e2e="sw-mount">
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
        <p class={NOTE}>
          {scriptUrl.value
            ? "<SWUpdater> is mounted. Its bar is the orange one at the top of the window."
            : "<SWUpdater> is not mounted: it registers a worker, so it waits for the button."}
        </p>
      </div>
    </Stack>
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
 *
 * A second, separate `[data-lightbox-bare]` container and its own `<ImageLightbox fallbackAlt="">`
 * show the opposite case: one image with no `alt` attribute at all, wrapped in a link, and
 * `fallbackAlt` turned off so nothing substitutes a name for it. That image is never marked a zoom
 * control — no Tab stop, no role, no name a reader could act on — and a click on it is left for the
 * browser's own default action, so the link it sits in still works. The other two images above keep
 * the card's default `fallbackAlt`, unaffected by the second instance: each already carries a real
 * `alt`, which `fallbackAlt` never overrides.
 */
function ImageLightboxDemo() {
  return (
    <Stack>
      <div data-lightbox class="flex flex-wrap items-start gap-2">
        <p class={`w-full ${NOTE}`}>
          Click an image, or Tab to it and press Enter. The second sits in a link, which opening the
          lightbox does not follow.
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
      <div data-e2e="lightbox-bare" data-lightbox-bare class="flex flex-wrap items-start gap-2">
        <p class={`w-full ${NOTE}`}>
          With{" "}
          <code>fallbackAlt=""</code>, an image with no description stays a plain image, and its
          link still works.
        </p>
        <a href="#lightbox-bare-target" data-e2e="lightbox-bare-link" class="inline-block">
          <img
            data-e2e="lightbox-bare-image"
            src={placeholder("9ca3af")}
          />
        </a>
        <span id="lightbox-bare-target" class={NOTE}>
          (the link's target)
        </span>
      </div>
      <ImageLightbox containerSelector="[data-lightbox-bare]" fallbackAlt="" />
    </Stack>
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
    <Stack gap="sm" data-e2e="calendar-interactive">
      <Calendar
        monthAnchor={month.value}
        minDate="2026-01-01"
        maxDate="2026-12-31"
        today="2026-03-10"
        timeZone="UTC"
        availableByDate={{ "2026-03-11": 6, "2026-03-12": 3, "2026-03-18": 2, "2026-04-14": 5 }}
        selectedDate={picked.value}
        onSelectDate={(date) => picked.value = date}
        onSelectMonth={(anchor) => month.value = anchor}
      />
      <p class={NOTE}>
        onSelectDate: <span data-e2e="calendar-picked">{picked.value}</span> · onSelectMonth:{" "}
        <span data-e2e="calendar-month">{month.value}</span>
      </p>
      <p class={NOTE}>
        Tab once to reach the grid; the arrow keys, Home, End, Page Up and Page Down move inside it.
      </p>
    </Stack>
  )
}

/**
 * A controlled calendar whose owner is asked for a month and declines to draw it.
 *
 * `monthAnchor` is a constant here, and that constant *is* the refusal: the callback is supplied,
 * so Page Up, Page Down and both month arrows really do ask, and March is what the owner keeps
 * showing whatever they ask for. It is the shape a caller ends up with whenever the month is
 * clamped to a range the reader may not leave, and the reason it has a card is that the calendar's
 * answer to it is a focus move nothing else on this page demonstrates: the press changes neither
 * the month nor where the reader is standing.
 *
 * Both counters are on screen because a refusal is otherwise indistinguishable from a key press
 * that never arrived. The reset control is an ordinary button outside the calendar, which is also
 * what a reader — or a check — needs in order to move the focus out of the grid while a request
 * is outstanding and watch the calendar leave it alone.
 */
function CalendarRefusingDemo() {
  const asked = useSignal("nothing yet")
  const refused = useSignal(0)
  const picked = useSignal<string | null>(null)

  return (
    <Stack gap="sm" data-e2e="calendar-refused">
      <Calendar
        monthAnchor="2026-03-01"
        minDate="2026-01-01"
        maxDate="2026-12-31"
        today="2026-03-10"
        timeZone="UTC"
        availableByDate={{ "2026-03-11": 6, "2026-03-19": 4, "2026-03-25": 2 }}
        selectedDate={picked.value}
        onSelectDate={(date) => picked.value = date}
        onSelectMonth={(anchor) => {
          // The whole demo: the request is recorded and then not acted on. `monthAnchor` above is a
          // constant, so nothing here could change the month even if it wanted to.
          asked.value = anchor
          refused.value = refused.value + 1
        }}
      />
      <p class={NOTE}>
        Last month asked for:{" "}
        <span data-e2e="calendar-refused-asked">{asked.value}</span>; requests refused:{" "}
        <span data-e2e="calendar-refused-count">{refused.value}</span>.
      </p>
      <p class={NOTE}>
        Focus a day and press Page Down: the count rises, the grid stays on March, and the focus
        stays on your day.
      </p>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="calendar-refused-reset"
          onClick={() => {
            asked.value = "nothing yet"
            refused.value = 0
          }}
        >
          Reset the count
        </Button>
      </Cluster>
    </Stack>
  )
}

/**
 * How long this card's slower owner waits before it answers, in milliseconds.
 *
 * `pages/checks/system.ts` races this number: it presses Page Down, then scrolls the page and reads
 * the reader's day in the next round trip, and that read has to land before the answer does (#267).
 * Under `stress-ng --cpu 0` on all sixteen cores that read ran 65 to 72ms after the key went
 * down (the check prints the figure every run); the issue asked the check to survive an extra
 * 350ms pause as well. It was 300ms, which a 350ms pause alone overran. 1000ms leaves about 580ms
 * past both, eight measured round trips, and is still plainly "late" to a person pressing the key.
 */
const LATE_ANSWER_MS = 1000

/** The two ways the card below can be late, as a reader picks them. */
const LATE_MODES = [
  { id: "timer", label: `A timer, ${LATE_ANSWER_MS} ms` },
  { id: "microtask", label: "A microtask" },
]

/**
 * A controlled calendar whose owner draws the month it was asked for, but not straight away.
 *
 * This is the shape of every owner that checks something before it answers — a fetch for the new
 * month's availability is the ordinary case — reduced to something deterministic that needs no
 * network. It is here because the calendar cannot tell a slow yes from a no at the moment it has
 * to decide: a refusal is judged by the render that follows the call, so this owner is read as a
 * refusal first and the reader is put back on their day, and the press is finished when the month
 * finally arrives. Both counters are on screen because that two-step answer is otherwise
 * invisible, and because a check needs to know the month really was asked for.
 *
 * The two kinds of lateness are both offered because they are not the same for a reader holding a
 * key down. An owner that answers on a microtask has answered before the next key press is
 * delivered, so two presses move two months. An owner slower than the reader's fingers has not,
 * so the second press is made against the month still on screen and asks for the same month again:
 * two presses, both of them answered, one month. The same difference shows up in a Page Down
 * followed by a Page Up: the quick owner brings the reader back to the month they started on, and
 * the slow one leaves them a month before it. Neither loses a press, and both counters are here
 * so a reader can see which of the two they are looking at.
 */
function CalendarLateDemo() {
  const month = useSignal("2026-03-01")
  const asked = useSignal("nothing yet")
  const answered = useSignal(0)
  const picked = useSignal<string | null>(null)
  const mode = useSignal("timer")

  return (
    <Stack gap="sm" data-e2e="calendar-late" data-answer-ms={LATE_ANSWER_MS}>
      <Cluster>
        {LATE_MODES.map(({ id, label }) => (
          <Button
            key={id}
            variant={mode.value === id ? "primary" : "outline"}
            size="sm"
            data-e2e={`calendar-late-mode-${id}`}
            onClick={() => mode.value = id}
          >
            {label}
          </Button>
        ))}
      </Cluster>
      <Calendar
        monthAnchor={month.value}
        minDate="2026-01-01"
        maxDate="2026-12-31"
        today="2026-03-10"
        timeZone="UTC"
        availableByDate={{ "2026-03-19": 4, "2026-04-19": 3, "2026-02-19": 5 }}
        selectedDate={picked.value}
        onSelectDate={(date) => picked.value = date}
        onSelectMonth={(anchor) => {
          asked.value = anchor
          // The whole demo: the month asked for is drawn, but not in the render this call is part
          // of, which is the only render in which the calendar can read the answer as a yes.
          const draw = () => {
            month.value = anchor
            answered.value = answered.value + 1
          }
          if (mode.value === "microtask") queueMicrotask(draw)
          else setTimeout(draw, LATE_ANSWER_MS)
        }}
      />
      <p class={NOTE}>
        Answers by <span data-e2e="calendar-late-mode">{mode.value}</span>. Last month asked for:
        {" "}
        <span data-e2e="calendar-late-asked">{asked.value}</span>; answers drawn:{" "}
        <span data-e2e="calendar-late-answered">{answered.value}</span>; showing:{" "}
        <span data-e2e="calendar-late-month">{month.value}</span>.
      </p>
      <p class={NOTE}>
        Focus a day and press Page Down: the month changes a moment later and the focus follows it
        to the same day number.
      </p>
    </Stack>
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
 * It is also the card's link-mode calendar: no `onSelectDate`, so every cell is a link, and its
 * availability puts every kind of cell on screen at once — selected, low, none left, and closed.
 *
 * The week starts on Monday in the United Kingdom, on Sunday in the United States and on Saturday
 * in Egypt, so the columns move under the same dates; and the headers are whatever `Intl`
 * abbreviates a weekday to, which is why they are not cut to a fixed number of characters — every
 * Arabic weekday opens with the same two.
 */
function CalendarLocaleDemo() {
  const locale = useSignal("en-GB")

  return (
    <Stack gap="sm" data-e2e="calendar-locale">
      <Cluster>
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
      </Cluster>
      <Calendar
        locale={locale.value}
        monthAnchor="2026-03-01"
        minDate="2026-03-01"
        maxDate="2026-04-30"
        today="2026-03-10"
        timeZone="UTC"
        availableByDate={{
          "2026-03-11": 6,
          "2026-03-12": 3,
          "2026-03-13": 0,
          "2026-03-14": 18,
          "2026-03-18": 2,
          "2026-04-02": 9,
        }}
        selectedDate="2026-03-12"
      />
      <p class={NOTE}>
        locale: <span data-e2e="calendar-locale-tag">{locale.value}</span>
      </p>
    </Stack>
  )
}

/**
 * Two real, simultaneously mounted instances — the card a password manager, or
 * `pages/checks/system.ts`, reads. Each one gets its own real `<form>`, its own `<label for>`
 * pairing and, because `AuthForm` derives every id from `useId()`, its own ids: two instances on
 * one page is the one thing a single-instance card could never prove either way.
 */
function AuthFormAutofillDemo() {
  return (
    <Grid minColumnWidth="md" gap="lg" data-e2e="auth-form-autofill">
      <AuthForm mode="sign-in" step="credentials" action="/auth/sign-in" onSignIn={() => {}} />
      <AuthForm mode="sign-up" step="credentials" action="/auth/sign-up" onSignUp={() => {}} />
    </Grid>
  )
}

/** The two errors this card's buttons can set, kept next to each other for that reason. */
const FORM_ERROR = "Wrong login or password"
const FIELD_ERROR: AuthFormError = { message: "No account with that login", field: "login" }

/**
 * Fill every empty field of `form` and submit it through `requestSubmit()`.
 *
 * A `requestSubmit()` runs the browser's own constraint validation exactly as a click on the
 * submit button would, so a form with an empty `required` field never reaches `AuthForm`'s submit
 * handler at all — that would prove "nothing was required" rather than "busy stopped it". Filling
 * every field first, the same way a person or a password manager would, is what isolates the one
 * thing this card's `requestSubmit()` button is for.
 */
function fillAndRequestSubmit(container: HTMLElement | null) {
  const form = container?.querySelector("form")
  if (!form) return
  for (const input of form.querySelectorAll("input")) {
    if (input.value === "") input.value = input.name === "code" ? "123456" : "demo value"
  }
  form.requestSubmit()
}

/**
 * One instrumented instance, standing in for the round trip an app's own server would otherwise
 * drive: buttons set the error, move the step, toggle `busy`, and submit — including through
 * `form.requestSubmit()`, so a check can prove a busy submit calls nothing even when it bypasses
 * the (disabled) submit button. Every callback counts its own calls, because with nothing on
 * screen to show a submit happened, "the count did not rise" is the only way to tell a busy submit
 * that was stopped from one that was never attempted.
 */
function AuthFormInteractiveDemo() {
  const mode = useSignal<AuthMode>("sign-in")
  const step = useSignal<AuthStep>("credentials")
  const busy = useSignal(false)
  const error = useSignal<string | AuthFormError | null>(null)
  const signIns = useSignal(0)
  const signUps = useSignal(0)
  const codes = useSignal(0)
  const container = useRef<HTMLDivElement>(null)

  return (
    <div data-e2e="auth-form-interactive" ref={container}>
      <Grid minColumnWidth="md" gap="xl">
        <Stack gap="sm" class="items-start">
          <Button
            variant="outline"
            size="sm"
            data-e2e="auth-form-set-form-error"
            onClick={() => error.value = FORM_ERROR}
          >
            Set a form-level error
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-e2e="auth-form-set-field-error"
            onClick={() => error.value = FIELD_ERROR}
          >
            Set a field-level error
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-e2e="auth-form-clear-error"
            onClick={() => error.value = null}
          >
            Clear the error
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-e2e="auth-form-step-code"
            onClick={() => step.value = "one-time-code"}
          >
            Go to the code step
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-e2e="auth-form-step-credentials"
            onClick={() => step.value = "credentials"}
          >
            Back to credentials
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-e2e="auth-form-toggle-busy"
            onClick={() => busy.value = !busy.value}
          >
            Toggle busy ({busy.value ? "on" : "off"})
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-e2e="auth-form-request-submit"
            onClick={() => fillAndRequestSubmit(container.current)}
          >
            Fill fields and form.requestSubmit()
          </Button>
          <p class={NOTE}>
            sign-ins: <span data-e2e="auth-form-signins">{signIns.value}</span>, sign-ups:{" "}
            <span data-e2e="auth-form-signups">{signUps.value}</span>, codes:{" "}
            <span data-e2e="auth-form-codes">{codes.value}</span>
          </p>
        </Stack>
        <AuthForm
          mode={mode.value}
          onModeChange={(next) => mode.value = next}
          step={step.value}
          busy={busy.value}
          error={error.value}
          onSignIn={() => signIns.value++}
          onSignUp={() => signUps.value++}
          onOneTimeCode={() => codes.value++}
        />
      </Grid>
    </div>
  )
}

/**
 * `SiteHeader`, at the guide's own width.
 *
 * The links below `lg` (1024px) collapse into the `<details>` menu the component builds them
 * into — resize the browser window itself (the breakpoint reads the viewport, not this card's own
 * width) to open it, or see `pages/checks/system.ts` for the same thing driven at phone width. The
 * panel overlays the page instead of pushing the bar down, so the card below has no `overflow-hidden`
 * of its own to clip it. The "Get started" button stays exactly where it is at every width. `Docs`
 * carries an icon and `Pricing` is marked as `currentPath`, so both of the optional pieces
 * `SiteHeader` renders are on screen at once.
 */
function SiteHeaderDemo() {
  return (
    <div data-e2e="site-header-demo">
      <SiteHeader
        brand={
          <span
            data-e2e="site-header-brand"
            class="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Acme
          </span>
        }
        currentPath="/pricing"
        links={[
          { label: "Product", href: "/product" },
          { label: "Pricing", href: "/pricing" },
          { label: "Docs", href: "/docs", Icon: IconBookOpen },
        ]}
        actions={
          <Button size="sm" data-e2e="site-header-cta">
            Get started
          </Button>
        }
      />
    </div>
  )
}

/**
 * `Shell`, constrained to a fixed height so the card does not take over the guide's own page —
 * `min-h-screen` is overridden the same way any Tailwind utility is, by naming a conflicting one
 * later. The mobile drawer and the user menu still overlay the real viewport when opened, exactly as
 * they would in a full page, rather than being clipped to this box: that is what a caller's own app
 * gets, so that is what this card shows too.
 */
function ShellDemo() {
  return (
    <div class="overflow-hidden" data-e2e="shell-demo">
      <Shell
        class="h-[420px] min-h-0"
        brand={<span class="text-lg font-semibold text-gray-900 dark:text-white">Acme</span>}
        currentPath="/dashboard"
        navItems={[
          { name: "Dashboard", href: "/dashboard", Icon: IconHome },
          { name: "Docs", href: "/docs", Icon: IconBookOpen },
          {
            name: "Settings",
            children: [
              { name: "Billing", href: "/settings/billing" },
              { name: "Team", href: "/settings/team", counter: 2 },
            ],
          },
        ]}
        user={{ name: "Ada Lovelace", email: "ada@example.com" }}
        userMenuItems={[
          { label: "Your profile", href: "/profile" },
          { label: "Sign out", dataE2E: "signout" },
        ]}
        status={
          <span class="text-xs text-gray-500 dark:text-gray-400" data-e2e="shell-status">
            Connected
          </span>
        }
      >
        <p class="text-sm text-gray-600 dark:text-gray-300">The page goes here.</p>
      </Shell>
    </div>
  )
}

/**
 * `StateInit` written once and read back on a real click — the round trip the component exists for,
 * not a description of it. `sampleData` carries a `</script>` on purpose, so a successful read-back
 * is also proof the escaping survived.
 */
function StateInitDemo() {
  const readBack = useSignal("(not read yet)")
  const sampleData = {
    userId: 42,
    features: ["</script>", "<!--", "  "],
  }

  return (
    <Stack gap="sm" data-e2e="state-init-demo">
      <StateInit id="state-init-demo" data={sampleData} />
      <p class={NOTE}>Written into the page by the server render:</p>
      <pre class="overflow-auto font-mono text-xs whitespace-pre-wrap text-gray-900 dark:text-gray-100">
        <code>{JSON.stringify(sampleData, null, 2)}</code>
      </pre>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="state-init-read"
          onClick={() => {
            readBack.value = JSON.stringify(readStateInit("state-init-demo"))
          }}
        >
          Read it back
        </Button>
      </Cluster>
      <pre
        class="max-h-40 overflow-auto font-mono text-xs whitespace-pre-wrap text-gray-900 dark:text-gray-100"
        data-e2e="state-init-readback"
      >
        <code>{readBack.value}</code>
      </pre>
    </Stack>
  )
}

/** The rail shell demo's destinations: seven, so the phone bar needs its "More" slot. */
const railShellItems: RailShellItem[] = [
  { key: "home", label: "Home", Icon: IconHome },
  { key: "projects", label: "Projects", Icon: IconFolder },
  { key: "notes", label: "Notes", Icon: IconBookOpen },
  { key: "stats", label: "Stats", Icon: IconChartPie },
  { key: "search", label: "Search", Icon: IconSearch },
  { key: "alerts", label: "Alerts", Icon: IconBell },
  { key: "settings", label: "Settings", Icon: IconCog6Tooth },
]

/**
 * `RailShell` inside a bounded, scrolling frame, so the card does not take over the guide's page.
 *
 * `min-h-full` replaces the component's own `min-h-dvh`, so the frame is the scroll container the
 * rail's contents and the tab bar stick to. Which of the two shows follows the viewport, not this
 * frame: the guide at desktop width shows the rail, and a phone-width window shows the tab bar with
 * "More". Every entry is a button through the `navigate` port, so choosing one moves the current
 * marker and prints the key it was handed instead of leaving the guide.
 */
function RailShellDemo() {
  const current = useSignal("home")
  return (
    <div
      class="h-[420px] overflow-y-auto"
      data-e2e="rail-shell-demo"
    >
      <RailShell
        class="min-h-full"
        items={railShellItems}
        currentKey={current.value}
        primary={{ key: "compose", label: "Write", Icon: IconPencilSquare }}
        navigate={(key) => {
          current.value = key
        }}
      >
        <div class="flex flex-col gap-4 p-4 text-sm">
          <p>
            Navigated to: <strong data-e2e="rail-shell-demo-current">{current.value}</strong>
          </p>
          {Array.from(
            { length: 12 },
            (_, index) => (
              <p key={index} class="text-gray-600 dark:text-gray-300">
                Paragraph {index + 1}{" "}
                of the page. It is here so the frame scrolls and the rail and the tab bar can be
                seen staying in place while it does.
              </p>
            ),
          )}
          <p data-e2e="rail-shell-demo-last-line">The last line of the page.</p>
        </div>
      </RailShell>
    </div>
  )
}

export const systemDemos = {
  Shell: {
    summary:
      "The frame of a signed-in app: a header with the brand and a user menu, a sidebar from `lg` up, and the same navigation in a drawer below it.",
    wide: true,
    props: [
      {
        name: "navItems",
        type: "ShellNavItem[]",
        description: "The navigation, drawn in both the sidebar and the drawer.",
      },
      {
        name: "currentPath",
        type: "string",
        description: "Marks the item whose `href` equals it as the current page.",
      },
      { name: "brand", type: "ComponentChildren", description: "The header's left-hand side." },
      {
        name: "user",
        type: "ShellUser | null",
        description: "Who is signed in; the user menu opens from their avatar.",
      },
      {
        name: "userMenuItems",
        type: "ShellUserMenuItem[]",
        description: "Links and actions in the user menu.",
      },
      {
        name: "status",
        type: "ComponentChildren",
        description: "A small slot in the header, such as a connection indicator.",
      },
    ],
    snippet: `<Shell
  brand={<Logo />}
  currentPath={url.pathname}
  navItems={[
    { name: "Dashboard", href: "/dashboard", Icon: IconHome },
    { name: "Docs", href: "/docs", Icon: IconBookOpen },
    { name: "Settings", children: [
      { name: "Billing", href: "/settings/billing" },
      { name: "Team", href: "/settings/team", counter: unreadInvites },
    ] },
  ]}
  user={session ? { name: session.name, email: session.email } : null}
  userMenuItems={[
    { label: "Your profile", href: "/profile" },
    { label: "Sign out", onClick: () => auth.signOut(), dataE2E: "signout" },
  ]}
  status={<ConnectionIndicator />}
>
  <PageContent />
</Shell>`,
    render: () => <ShellDemo />,
  },
  RailShell: {
    summary:
      "An app frame with a rail of icon buttons from `md` up and a bottom tab bar on a phone, whose **More** slot holds the rest.",
    wide: true,
    props: [
      {
        name: "items",
        type: "RailShellItem[]",
        description: "The destinations; past five, the phone bar grows a **More** slot.",
      },
      {
        name: "primary",
        type: "RailShellItem",
        description: "The one action pinned apart from the rest, such as **Write**.",
      },
      {
        name: "currentPath",
        type: "string",
        description: "Marks the item whose `href` equals it; `currentKey` does the same by key.",
      },
      {
        name: "navigate",
        type: "(key: string) => void",
        description: "Called for an item with no `href`, instead of following a link.",
      },
    ],
    snippet: `<RailShell
  items={[
    { key: "home", label: "Home", href: "/", Icon: IconHome },
    { key: "projects", label: "Projects", href: "/projects", Icon: IconFolder },
    // … more than five entries in all, and the phone bar grows a "More" slot
  ]}
  currentPath={location.pathname}
  primary={{ key: "compose", label: "Write", href: "/new", Icon: IconPencilSquare }}
>
  <Page />
</RailShell>`,
    render: () => <RailShellDemo />,
  },
  SiteHeader: {
    summary:
      "The top bar of a public site: the brand, its links, and a menu that holds the links on a narrow screen and works without JavaScript.",
    wide: true,
    props: [
      {
        name: "links",
        type: "SiteHeaderLink[]",
        description: "The links, each a label, an `href` and an optional icon.",
      },
      {
        name: "currentPath",
        type: "string",
        description: "Marks the link whose `href` equals it as the current page.",
      },
      { name: "brand", type: "ComponentChildren", description: "The bar's left-hand side." },
      {
        name: "actions",
        type: "ComponentChildren",
        description: "Buttons that stay in view at every width.",
      },
    ],
    snippet: `<SiteHeader
  brand={<Logo />}
  currentPath={url.pathname}
  links={[
    { label: "Product", href: "/product" },
    { label: "Pricing", href: "/pricing" },
    { label: "Docs", href: "/docs", Icon: IconBookOpen },
  ]}
  actions={<Button size="sm" onClick={() => navigate("/get-started")}>Get started</Button>}
/>`,
    render: () => <SiteHeaderDemo />,
  },
  AuthForm: {
    summary:
      "Sign-in, sign-up and one-time-code forms that hand what was typed to your callbacks and post natively before the page's script has loaded.",
    wide: true,
    props: [
      { name: "mode", type: '"sign-in" | "sign-up"', description: "Which form to show." },
      {
        name: "step",
        type: '"credentials" | "one-time-code"',
        description: "The login and password, or the code sent to the user.",
      },
      {
        name: "onSignIn",
        type: "({ login, password }) => void",
        description: "Called on submit; `onSignUp` and `onOneTimeCode` match the other forms.",
      },
      {
        name: "busy",
        type: "boolean",
        default: "false",
        description: "Disables the form while a request is running.",
      },
      {
        name: "error",
        type: "string | { message, field? }",
        description: "Shown above the form, and beside the field it names.",
      },
      {
        name: "action",
        type: "string",
        description: "Where the form posts when no script is running.",
      },
    ],
    snippet: `<AuthForm
  mode={mode}
  step={step}
  onModeChange={setMode}
  onSignIn={({ login, password }) => auth.signIn(login, password)}
  onSignUp={({ login, password }) => auth.signUp(login, password)}
  onOneTimeCode={(code) => auth.verify(code)}
  busy={pending}
  error={error} // string, or { message, field: "login" | "password" | "code" }
  action="/auth/sign-in"
/>`,
    render: () => (
      <Stack gap="xl">
        <Part title="Sign in and sign up, side by side">
          <AuthFormAutofillDemo />
        </Part>
        <Part title="Driven by buttons in place of a server">
          <AuthFormInteractiveDemo />
        </Part>
      </Stack>
    ),
  },
  Calendar: {
    summary:
      "A month grid of days to pick from, each showing how many places are left, as links or as buttons with full keyboard support.",
    wide: true,
    props: [
      {
        name: "monthAnchor",
        type: "string",
        description: "The first day of the month on screen, as `YYYY-MM-DD`.",
      },
      {
        name: "minDate",
        type: "string",
        description: "The first day that can be picked; `maxDate` is the last.",
      },
      {
        name: "availableByDate",
        type: "Record<string, number>",
        description: "Places left per day; a day left out or at `0` cannot be picked.",
      },
      {
        name: "onSelectDate",
        type: "(date: string) => void",
        description: "Turns the days into buttons; without it they are links.",
      },
      {
        name: "onSelectMonth",
        type: "(monthAnchor: string) => void",
        description: "Asked for another month; the owner decides whether to show it.",
      },
      {
        name: "today",
        type: "string",
        default: "the clock's date",
        description: "Pins today, with `timeZone`, so a render does not depend on the clock.",
      },
      {
        name: "locale",
        type: "string",
        default: '"en-GB"',
        description: "Sets the first day of the week and the weekday names.",
      },
    ],
    snippet: `<Calendar
  monthAnchor="2026-03-01"
  minDate="2026-03-01"
  maxDate="2026-04-30"
  today="2026-03-10"
  timeZone="UTC"
  availableByDate={{ "2026-03-12": 3, "2026-03-13": 0 }}
  selectedDate="2026-03-12"
  onSelectDate={(date) => picked.value = date}
/>`,
    render: () => (
      <Grid minColumnWidth="md" gap="lg" class="sm:grid-cols-2">
        <Part title="Links, in three locales">
          <CalendarLocaleDemo />
        </Part>
        <Part title="Buttons and the keyboard">
          <CalendarInteractiveDemo />
        </Part>
        <Part title="An owner that refuses every month">
          <CalendarRefusingDemo />
        </Part>
        <Part title="An owner that answers late">
          <CalendarLateDemo />
        </Part>
      </Grid>
    ),
  },
  StateInit: {
    summary:
      "Hands data from the server render to the browser as JSON in the page, which `readStateInit` reads back.",
    wide: false,
    snippet: `// Wherever the server renders the page:
<StateInit data={{ userId: user.id, features: enabledFeatures }} />

// Anywhere on the client:
const state = readStateInit<{ userId: string; features: string[] }>()`,
    render: () => <StateInitDemo />,
  },
  ImageLightbox: {
    summary:
      "Lets a reader open any image inside a container at full size, by click or keyboard, and page through the others.",
    wide: false,
    snippet: `<ImageLightbox
  containerSelector="[data-lightbox]"
  fallbackAlt="Figure"
  zoomLabel="Zoom"
  onOpen={(image) => analytics.track("lightbox", image.src)}
/>`,
    render: () => <ImageLightboxDemo />,
  },
  SEOHead: {
    summary:
      "The title, description, social-card and structured-data tags a page needs in its head, from one object; this card shows them as `seoHeadTags` returns them.",
    wide: true,
    props: [
      { name: "title", type: "string", description: "The page's title." },
      { name: "description", type: "string", description: "One or two sentences for results." },
      {
        name: "canonical",
        type: "string",
        description: "The page's one address; a fragment is dropped.",
      },
      {
        name: "crumbs",
        type: "Crumb[]",
        description: "The breadcrumb trail, root first, published as a `BreadcrumbList`.",
      },
      { name: "jsonLd", type: "unknown[]", description: "More structured data for the graph." },
    ],
    snippet: `<SEOHead
  title="Blue widget — Acme"
  description="Specifications, prices and reviews for the blue widget."
  canonical="https://example.com/products/widgets/12"
  ogImage="https://example.com/og/widgets.png"
  siteName="Acme"
  jsonLd={[{ "@type": "Organization", name: "Acme" }]}
  crumbs={[
    { name: "Home", href: "/" },
    { name: "Widgets", href: "/products/widgets" },
    { name: "Blue widget" },
  ]}
/>

// The same tag set as data, for an app whose head is not a component tree:
const tags = seoHeadTags(head)`,
    render: () => <SeoHeadTagList />,
  },
  SWUpdater: {
    summary:
      "Registers the service worker and, once a new version is waiting, offers the visitor a reload.",
    wide: true,
    props: [
      {
        name: "scriptUrl",
        type: "string",
        default: '"/sw.js"',
        description: "The worker's script.",
      },
      {
        name: "reload",
        type: "() => void",
        default: "reloads the page",
        description: "Runs once the new version has taken over.",
      },
      {
        name: "message",
        type: "string",
        default: '"New version available"',
        description: "The bar's text.",
      },
      {
        name: "updateMessage",
        type: "unknown",
        default: '{ action: "skipWaiting" }',
        description: "What the button posts to the waiting worker; it must recognise it.",
      },
      {
        name: "onUpdate",
        type: "() => void",
        description: "Called when an update is found; `onError` when registering fails.",
      },
    ],
    snippet: `<SWUpdater
  scriptUrl="/sw.js"
  reload={() => globalThis.location.reload()}
  onUpdate={() => app.toast.info({ body: "Updating…" })}
  onError={(error) => app.report(error)}
/>

// Only when the worker speaks another dialect — the default is { action: "skipWaiting" }:
<SWUpdater scriptUrl="/sw.js" updateMessage={{ type: "SKIP_WAITING" }} />`,
    render: () => (
      <Stack gap="xl">
        <Part title="Mounted with nothing waiting">
          <SwUpdaterQuietDemo />
        </Part>
        <Part title="The function underneath, on a fake registration">
          <SwUpdaterDemo />
        </Part>
        <Part title="Against a real service worker">
          <SwUpdaterLiveDemo />
        </Part>
      </Stack>
    ),
  },
} satisfies DemoFragment
