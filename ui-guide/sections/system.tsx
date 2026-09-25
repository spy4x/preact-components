/**
 * The System section.
 *
 * All nine of the package's components are here. Seven render from props with no reduction needed —
 * `Shell` and `StateInit` included, `useMobilePanel`'s effects and `StateInit`'s inert
 * `type="application/json"` script notwithstanding, neither touches anything this guide's own page
 * could not safely hand it — and two are platform integration, handled with an explicit, stated
 * reduction rather than a demo that claims behaviour it cannot show. Those two are the interesting
 * part of this file, so here is the reasoning in full:
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
 * a render can be pinned, and it is pinned to `2026-03-10`/`UTC` here. It has five cards rather
 * than one, because five things about it can only be shown by driving it: the dual-mode swap, the
 * keyboard inside the grid, what changes when the locale does, and then what each of the two
 * answers an owner can give to `onSelectMonth` does to the reader's place in the grid.
 *
 * Those last two are the cards whose shape is not obvious, and they are a pair. `onSelectMonth` is
 * a request: a controlled calendar is free to leave the month where it is — an owner clamping to an
 * allowed range does it routinely — and it is equally free to answer later than the render the call
 * is part of, which is what any owner that fetches before it answers does. The calendar cannot tell
 * those two apart at the moment it has to decide, so it treats the second as the first and finishes
 * the press when the month arrives. The fourth card supplies the callback and never acts on it; the
 * fifth draws the month it was asked for on a short timer.
 *
 * Both count what they were asked and what they did about it, because neither answer is visible
 * otherwise: "the month did not change" is equally true of a key press that never reached the
 * calendar at all, and the counts are what tell the two apart, on screen and in
 * `pages/checks/system.ts`.
 *
 * `ImageLightbox` renders its dialog closed, with nothing else to pin, and the images beside it are
 * the demo's own — one plain and one wrapped in a link, because "opens the lightbox instead of
 * following the link" is a claim that needs a link to be a claim at all. Two images is also what
 * makes the card honest about the shared `Lightbox` it now opens: with more than one image in the
 * sequence, Left and Right page between them and the previous/next buttons render. A second,
 * separate `ImageLightbox` instance on the same card, with `fallbackAlt=""`, shows the opposite
 * case: one image with no description at all, inside its own link, that never becomes a zoom
 * control and whose link a click still follows.
 *
 * `AuthForm` gets two cards. The first mounts two instances side by side, sign-in and sign-up,
 * which is the card a password manager or `pages/checks/system.ts` reads: real `<form>`s, real
 * `<label for>`s, the right `autocomplete`/`name`/`type` on every field, and — because there are
 * two instances on the one page — proof that their ids do not collide. The second is one
 * instrumented instance with buttons standing in for what an app's own server round trip would
 * otherwise drive: setting a form-level or a field-level error, moving to the one-time-code step,
 * toggling `busy`, and calling `form.requestSubmit()` directly so a check can prove a busy submit
 * calls nothing even when it bypasses the (disabled) submit button. Every submit callback counts
 * its own calls, because "nothing happened" is otherwise indistinguishable from "the submit never
 * reached the handler". **This second card has callbacks and no `action`, on purpose**: it is the
 * ordinary shape of a hydrated app, and it is also the card `pages/checks/system.ts` disables
 * script execution against and presses Submit on, to prove a visitor who submits before the bundle
 * has run never sends the password into the URL.
 *
 * `SiteHeader`'s one card is honest about what it can and cannot show at the guide's own width: the
 * mobile `<details>` panel only replaces the inline links below `lg` (1024px) — `actions` and the
 * menu button are always in view — so the card renders the desktop row here and says, in its own
 * summary, to resize the browser window itself to see the disclosure (the breakpoint reads the
 * viewport, not the card). What that leaves for a reader to take on faith — the panel opening
 * without moving the bar around it, Escape closing it and returning focus to the button, a
 * client-side navigation closing it without returning focus, its state reaching the accessibility
 * tree natively, catching up correctly for a menu opened before the bundle finishes loading, and
 * every link staying reachable with script execution disabled — is exactly what
 * `pages/checks/system.ts` drives in a real browser at phone width instead.
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
} from "@preact-components/icons"
import {
  AuthForm,
  type AuthFormError,
  type AuthMode,
  type AuthStep,
} from "@preact-components/system/auth-form"
import { Calendar } from "@preact-components/system/calendar"
import type { PageHead } from "@preact-components/system/head"
import { ImageLightbox } from "@preact-components/system/image-lightbox"
import { seoHeadTags } from "@preact-components/system/seo-head"
import { RailShell, type RailShellItem } from "@preact-components/system/rail-shell"
import { Shell } from "@preact-components/system/shell"
import { SiteHeader } from "@preact-components/system/site-header"
import { readStateInit, StateInit } from "@preact-components/system/state-init"
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
      <div data-e2e="lightbox-bare" data-lightbox-bare class="flex flex-wrap items-start gap-3">
        <p class="w-full text-xs text-gray-500 dark:text-gray-400">
          With{" "}
          <code>fallbackAlt=""</code>, an image with no description at all is not a zoom control —
          it stays a plain image, and the link below still works.
        </p>
        <a href="#lightbox-bare-target" data-e2e="lightbox-bare-link" class="inline-block">
          <img
            data-e2e="lightbox-bare-image"
            src={placeholder("9ca3af")}
          />
        </a>
        <span id="lightbox-bare-target" class="text-xs text-gray-500 dark:text-gray-400">
          (the link's target)
        </span>
      </div>
      <ImageLightbox containerSelector="[data-lightbox-bare]" fallbackAlt="" />
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
        availableByDate={{ "2026-03-11": 6, "2026-03-12": 3, "2026-03-18": 2, "2026-04-14": 5 }}
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
    <div class="space-y-3" data-e2e="calendar-refused">
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
      <p class="text-xs text-gray-500 dark:text-gray-400">
        This owner refuses every month change. Last month asked for:{" "}
        <span data-e2e="calendar-refused-asked">{asked.value}</span>; requests refused:{" "}
        <span data-e2e="calendar-refused-count">{refused.value}</span>.
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Focus a day, then press Page Down: the count rises, the grid stays on March, and the focus
        stays on the day you were on.
      </p>
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
    </div>
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
    <div class="space-y-3" data-e2e="calendar-late" data-answer-ms={LATE_ANSWER_MS}>
      <div class="flex flex-wrap items-center gap-2">
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
      </div>
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
      <p class="text-xs text-gray-500 dark:text-gray-400">
        This owner answers late, by{" "}
        <span data-e2e="calendar-late-mode">{mode.value}</span>. Last month asked for:{" "}
        <span data-e2e="calendar-late-asked">{asked.value}</span>; answers drawn:{" "}
        <span data-e2e="calendar-late-answered">{answered.value}</span>; showing:{" "}
        <span data-e2e="calendar-late-month">{month.value}</span>.
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Focus a day and press Page Down: the month changes a moment later and the focus follows it
        to the same day number, the way it would if the owner had answered at once.
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
        availableByDate={{ "2026-03-11": 6, "2026-03-12": 3, "2026-03-18": 2 }}
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        locale: <span data-e2e="calendar-locale-tag">{locale.value}</span>
      </p>
    </div>
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
    <div class="grid gap-4 sm:grid-cols-2" data-e2e="auth-form-autofill">
      <AuthForm mode="sign-in" step="credentials" action="/auth/sign-in" onSignIn={() => {}} />
      <AuthForm mode="sign-up" step="credentials" action="/auth/sign-up" onSignUp={() => {}} />
    </div>
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
    <div class="space-y-3" data-e2e="auth-form-interactive" ref={container}>
      <div class="flex flex-wrap gap-2">
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
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        sign-ins: <span data-e2e="auth-form-signins">{signIns.value}</span>, sign-ups:{" "}
        <span data-e2e="auth-form-signups">{signUps.value}</span>, codes:{" "}
        <span data-e2e="auth-form-codes">{codes.value}</span>
      </p>
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
 * of its own to clip it. The "Book a call" button stays exactly where it is at every width. `Docs`
 * carries an icon and `Pricing` is marked as `currentPath`, so both of the optional pieces
 * `SiteHeader` renders are on screen at once.
 */
function SiteHeaderDemo() {
  return (
    <div class="rounded-md border border-gray-200 dark:border-gray-700" data-e2e="site-header-demo">
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
            Book a call
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
    <div
      class="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700"
      data-e2e="shell-demo"
    >
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
        userMenuItems={[{ label: "Your profile", href: "/profile" }, { label: "Sign out" }]}
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
    <div class="space-y-3" data-e2e="state-init-demo">
      <StateInit id="state-init-demo" data={sampleData} />
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
      <pre
        class="max-h-40 overflow-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100"
        data-e2e="state-init-readback"
      >
        <code>{readBack.value}</code>
      </pre>
    </div>
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
      class="h-[420px] overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700"
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
        <div class="space-y-3 p-4 text-sm">
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
  AuthForm: {
    summary:
      'Sign-in, sign-up and a one-time-code step, drawn from `mode`, `step`, `busy` and `error` and reported through `onSignIn`/`onSignUp`/`onOneTimeCode`/`onModeChange` — it makes no network call and stores no credential outside the input it came from. **Submitted values are read from `FormData` inside the submit handler, never from controlled state**, so a password sits nowhere but its own input\'s `value` until the one moment it is needed, and it reaches the callback exactly as typed, untrimmed. **`action` is the no-JavaScript path**: before hydration, or whenever the matching callback is left out, the form posts natively. **`method` is always `"post"`, unconditionally — there is no `method` prop** — because a card with callbacks and no `action`, the ordinary shape of a hydrated app, would otherwise have no `method` attribute at all, and a browser reads that as GET: a submit in the gap before hydration, or with scripts off, would put the password in the address bar. **A busy submit calls no callback**, including one started with `form.requestSubmit()`, which bypasses the disabled submit button the way a person cannot. **The one-time-code step moves the focus to its field**, and no other render does. **`error` is a string or `{ message, field? }`**: every error reaches the always-present `role="alert"` region — present before anything goes wrong, exactly like `SWUpdater`\'s — and a named field also gets the message and `aria-invalid` through its own `Field` (read twice by some screen readers; accepted, see `system/README.md`). The show/hide password control is a real `type="button"` with `aria-pressed`, and every visible string has an English default and a `labels` override.',
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
      <div class="space-y-4">
        <AuthFormAutofillDemo />
        <AuthFormInteractiveDemo />
      </div>
    ),
  },
  Calendar: {
    summary:
      "Six-week month grid. **Dual-mode**: with no `onSelectDate` every cell is an `<a href>` and a month arrow with nothing to show is a `<span>` rather than a dead link; supplying the callback turns the cells into `<button>`. `today` and `timeZone` are props, so a render can be pinned — this card passes `2026-03-10` and `UTC` and reads no clock, and a zone the platform cannot resolve falls back to UTC instead of throwing. A date missing from `availableByDate` has no availability and a `0` has none left: both are greyed out, the none-left day is also struck through, and each carries its own accessible label. Cells also show today, past dates, dates outside the window, and a low-availability dot at or below `lowAvailabilityThreshold`. **The whole grid is one Tab stop** once hydrated: the arrow keys step a day and a week, Home and End go to the ends of the week, Page Up and Page Down ask `onSelectMonth` for the neighbouring month, and why a day cannot be picked is the cell's own accessible name plus the hint under the grid rather than a `title` nobody can hover. **A month is asked for, never taken**, and the reader keeps their place whatever the owner answers: an owner that draws the month lands them on the same day number in it, an owner that leaves `monthAnchor` where it was — clamping to an allowed range, say — leaves them on the day they pressed from rather than on the grid container, and an owner that draws the month a render or more later, as anything that fetches first does, still lands them on that same day number once it arrives. The fourth card below refuses every month change and the fifth answers a second late; both count what they were asked, because \"the month did not change\" is otherwise indistinguishable from a key press that never arrived. **The week is the locale's**: both the column order and the header text come from `Intl`, so the third card below moves the columns under the same dates as it changes language.",
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
      <div class="space-y-4">
        <CalendarDemo />
        <CalendarInteractiveDemo />
        <CalendarLocaleDemo />
        <CalendarRefusingDemo />
        <CalendarLateDemo />
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
  Shell: {
    summary:
      "The frame every signed-in app built from `spy4x/template` needs: a header that is always in view (menu button, `brand`, `status`, user menu), a sidebar from `lg` up, and the same navigation in a `<details>`-built drawer below it — reusing `useMobilePanel`, the same hook `SiteHeader` (#139) uses, rather than a second implementation. **No router import, no app state, no hard-coded link, brand text or URL** — `navItems`, `brand`, `user` and `children` are exactly what the caller passes in. **The skip link is the first focusable element**, and it targets a `<main>` this component gives `tabindex=\"-1\"`, so activating it moves focus there rather than only changing the address bar's hash. **The active item is decided by exact string equality**, `href === currentPath`, the same rule `SiteHeader`'s `isCurrentLink` already uses — reused here rather than re-implemented. **The user menu is `ui/`'s own `Dropdown`, named from `Avatar`**: `Avatar`'s own accessible name — the user's name — becomes the trigger's name through `triggerNamedByContent`, the same way `DateRangePicker` names its trigger. **The header and the drawer never overlap, and the header stays on top**: the drawer's overlay starts below the header's own height and sits at a lower `z-index`, which is what keeps the menu button and the user menu independently reachable whichever one is open — proved in `pages/checks/system.ts` by opening both at once and pressing Escape, which closes only the one that was actually focused. **`navItems` is redrawn from data for the sidebar and the drawer — `brand` and `status` are rendered exactly once**, in the header, for the same reason `SiteHeader`'s `actions` is: a caller's own element can only ever be mounted in one place.",
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
    { label: "Sign out", onClick: () => auth.signOut() },
  ]}
  status={<ConnectionIndicator />}
>
  <PageContent />
</Shell>`,
    render: () => <ShellDemo />,
  },
  SiteHeader: {
    summary:
      "A public-site top bar: `brand` on the left; `links` on the right from `lg` up, and in a `<details>` disclosure this card's menu button opens below it; an optional `actions` slot and the menu button always in view, beside whichever form `links` is currently taking. **Every link, and every word of `brand`, is a prop** — this component writes no `href`, no label and no brand text of its own, which the card below proves: the only two addresses on the page are `links`' own. **`aria-current=\"page\"` marks the one link whose `href` equals `currentPath`** — exact string equality, so a caller whose routes want prefix matching normalises the comparison itself before handing either one in. **`links` is reachable with no JavaScript at all**: a click on `<summary>` opens and closes the native `<details>` disclosure with nothing running, so every link is there before hydration and with scripts off — proved in `pages/checks/system.ts` by disabling script execution and pressing the button, and by holding the island bundle back so a menu opened before it loads still catches up correctly once it does. **`links` is redrawn from data, not duplicated as markup — `actions` is rendered once, because a caller's own element can only ever be mounted in one place.** **The panel overlays the page instead of pushing the bar down**, positioned against the `<header>` rather than sitting in the row beside the button, so opening it moves nothing else. What JavaScript adds, through the `useMobilePanel` hook `system/README.md` names, is Escape closing the panel and returning focus to the button, a client-side navigation on a panel link closing the panel *without* returning focus (it is moving to the new page, not back to the button), and `aria-expanded` tracking the disclosure's own state — which Chromium already exposes on the accessibility tree natively, `aria-expanded` or not. The menu button keeps one fixed accessible name rather than a pair that swaps with the state, so the state is never announced twice and never goes stale for as long as no script has run. The icon swap between the two glyphs in the button costs no script at all, because `group-open:` is a Tailwind variant compiled from the `<details>` element's own `[open]` attribute. **The desktop row and the mobile panel never coexist in the accessibility tree** — one is always `display:none` — so Tab never reaches a link twice at one viewport width. Every string beyond `links` and `brand` — the menu button's name, the shared `<nav>` label — has an English default and a `labels` override. This hook is shared with the app shell's side navigation (#135), which opens and closes the same way.",
    snippet: `<SiteHeader
  brand={<Logo />}
  currentPath={url.pathname}
  links={[
    { label: "Product", href: "/product" },
    { label: "Pricing", href: "/pricing" },
    { label: "Docs", href: "/docs", Icon: IconBookOpen },
  ]}
  actions={<Button size="sm" onClick={() => navigate("/book-a-call")}>Book a call</Button>}
/>`,
    render: () => <SiteHeaderDemo />,
  },
  StateInit: {
    summary:
      "A generic SSR→client hydration bridge: the server writes one JSON value into the page with `StateInit`, and the browser reads it back with `readStateInit` — which keys the value holds is the app's business, and this component knows none of them. **The escaping is `SEOHead`'s own `jsonLdText`, reused rather than reimplemented**: `<` becomes `\\u003c`, which is what keeps the literal text `</script>` — or `<!--`, itself a `<` — from closing the element it is embedded in, whatever the script's own `type`. **U+2028 and U+2029 need no escaping here**, unlike the classic `window.x = {…}` shape of this pattern: this component renders `type=\"application/json\"`, which the browser never executes, and `readStateInit` reads it back with `JSON.parse`, which has always accepted both characters inside a JSON string. This card's own sample data carries `</script>`, `<!--` and both separators, and the button below reads it back with the real function, not a copy of it — press it to see the exact value survive the round trip.",
    snippet: `// Wherever the server renders the page:
<StateInit data={{ userId: user.id, features: enabledFeatures }} />

// Anywhere on the client:
const state = readStateInit<{ userId: string; features: string[] }>()`,
    render: () => <StateInitDemo />,
  },
  SWUpdater: {
    summary:
      'Registers the service worker and offers a reload once a new version is *waiting*. **Its live region is in the page from the first render, empty**, and the bar appears inside it: a region that arrives carrying its first message is commonly not announced at all, because assistive technology announces a *change* to a region it is already watching. Nothing else is always rendered — the region carries no class, no padding and no border, so an empty one paints nothing and is zero pixels tall. It is an ordinary in-flow element rather than a `fixed` one, so a `flex` or `grid` parent charges a full 16px for it whether it spaces its children with `gap-4` or with a `space-y-4` margin — neither collapses between flex or grid items — while block flow costs nothing either way; mount it outside a flex or grid container, and see `system/README.md` for the measurements. The `class` prop goes to the bar rather than the region, so no caller can give the region a box. A dismissal covers one update rather than the component, so a later version puts the message back. The container comes from `navigator.serviceWorker`, read inside the effect so a server render touches nothing but still emits the empty region. Nothing reloads until the visitor presses Reload: `controllerchange` fires in every open tab, so the listener that reloads is armed by the button and not by the registration — otherwise a first install reloads the page mid-visit and one tab\'s Reload reloads the tab with the half-filled form. Pressing Reload posts `{ action: "skipWaiting" }` to the waiting worker, which is a **contract**: a worker that expects a different message ignores it and the button does nothing, so the message is the `updateMessage` prop. The bar can be dismissed, and every string it shows has an English default and a prop. **This card has three parts.** The first is the contract above: the component mounted with nothing waiting, and a button that puts a message into the region already there. The second drives the pure function underneath, `watchForUpdate`, against a fake registration in all three branches. The third is the component itself against a real worker — press the button, because this site is published and nothing registers a worker on its own.',
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
      "Makes the images inside a container zoomable, opening `@preact-components/ui`'s shared `Lightbox` — the same dialog `ImageGallery` opens on a thumbnail. Progressive enhancement in the strict sense: the server renders the page and this only adds a zoom layer after hydration, so a reader without JavaScript loses a zoom they never had. The layer is delegated to the container — one listener rather than one per image, and images arriving later still work. **A zoomable image behaves like a button**: it takes a Tab stop, carries a button's role and a name saying what it does, and opens with Enter or Space, with Space cancelled so the page does not scroll away underneath. A click or an Enter press is cancelled too, so the second image below opens the lightbox instead of following the link it sits in. **The dialog is the component's real output and it is really closed** until an image is opened. Escape closes it natively and a click on the backdrop closes it, which is only true because the image is positioned inside the dialog rather than filling it — a child that covers the dialog is a backdrop no click can reach. **Previous and next page through the container's other zoomable images**, snapshotted at the moment one opens — the two images below are what makes that a claim the card can show rather than describe. Every string it shows is a prop with an English default.",
    snippet: `<ImageLightbox
  containerSelector="[data-lightbox]"
  fallbackAlt="Figure"
  zoomLabel="Zoom"
  onOpen={(image) => analytics.track("lightbox", image.src)}
/>`,
    render: () => <ImageLightboxDemo />,
  },
  RailShell: {
    summary:
      "A third page frame beside `Shell` and `SiteHeader`: a vertical rail of icon-over-label items with a pinned, visually distinct primary action from `md` up, and below `md` a bottom tab bar of at most five slots whose last slot, **More**, opens a native modal `<dialog>` with the remaining items and the primary action. **The switch is a CSS breakpoint**, so the server render carries both and nothing reads the window while rendering — resize the browser window itself to see the tab bar, since the breakpoint reads the viewport, not this card. **The overlay is a modal `<dialog>`**: More opens it with `showModal()` and focus moves inside; Escape, a backdrop click, the close button and choosing an entry all close it, and focus returns to More. **With no JavaScript** every entry with an `href` is a link, and More and the close button carry `command`/`commandfor`, so a browser that supports invoker commands still opens and closes the overlay. **Nothing covers the page**: the rail is a column in the layout and the tab bar keeps its place in the flow, padded by the bottom safe-area inset. An entry with an `href` is a plain link, so the shell works with no JavaScript; one without calls the `navigate` port with its `key`, which is what every entry in this demo does. Every colour is a theme token read through `var()` with the default palette's value as its fallback, so the shell follows whichever palette the page sets and still draws without the theme preset. Every string — the nav's name, More, the dialog's name, its close button, the skip link — has an English default and a `labels` override.",
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
} satisfies DemoFragment
