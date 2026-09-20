/**
 * The System section.
 *
 * All eight of the package's components are here. Six render from props with no platform access at
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
 * - **`SWUpdater` renders `null` until a waiting service worker is detected**, so its server render is
 *   nothing at all. There is no markup-level reduction that says anything true: the bar cannot exist
 *   without `navigator.serviceWorker`, a registration and a real deploy. The card demonstrates the
 *   pure half instead — `watchForUpdate`, on a fake registration, in every branch, with the outcome
 *   printed — and says plainly that mounting the component needs a browser, a worker and two
 *   deploys.
 *
 * The rest are honest full demos. `Calendar`, `TimeSlots` and `ThemeToggle` all read state, so each
 * lives in its own component with its own local state, and every date is injected: `Calendar` takes
 * `today` and `timeZone` as props precisely so a render can be pinned, and it is pinned to
 * `2026-03-10`/`UTC` here. `TimeSlots` is a pure function of its props.
 */

import { BlogImageEnhancer } from "@preact-components/system/blog-image-enhancer"
import { Calendar } from "@preact-components/system/calendar"
import type { PageHead } from "@preact-components/system/head"
import { seoHeadTags } from "@preact-components/system/seo-head"
import {
  type RegistrationLike,
  SWUpdater,
  watchForUpdate,
  type WorkerLike,
} from "@preact-components/system/sw-updater"
import { ThemeToggle, themeToggleLabel } from "@preact-components/system/theme-toggle"
import { Button } from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import type { DemoFragment } from "../registry.ts"

/** A page head with every optional tag populated, so the card shows the whole set, not a subset. */
const pageHead: PageHead = {
  title: "Zone availability — Acme",
  description: "Live slot availability for every zone, refreshed every minute.",
  canonical: "https://example.com/bookings/zones/12",
  ogImage: "https://example.com/og/zones.png",
  ogType: "article",
  siteName: "Acme",
  twitterSite: "@acme",
  locale: "en_GB",
  jsonLd: [{ "@type": "Organization", name: "Acme" }],
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
            Nothing has been watched yet. The rendered component is below — and it is empty.
          </p>
        )}
      <div class="rounded-md border border-dashed border-gray-300 p-3 dark:border-gray-600">
        <p class="mb-1 text-xs text-gray-500 dark:text-gray-400">
          &lt;SWUpdater /&gt; on this page, server-rendered:
        </p>
        <SWUpdater reload={() => {}} />
        <p class="text-xs text-gray-400 dark:text-gray-500">
          (nothing — it renders null until a worker is waiting)
        </p>
      </div>
    </div>
  )
}

/**
 * The enhancer as it exists before anything is clicked.
 *
 * The element it renders is a real `<dialog>`, and it is really closed — no `open` attribute, no
 * `showModal()`. Opening it needs a click on an image inside the container the component watches,
 * which needs a document; that is stated on the card rather than staged.
 */
function BlogImageEnhancerDemo() {
  return (
    <div class="space-y-3">
      <div class="blog-content flex flex-wrap gap-3">
        <p class="w-full text-xs text-gray-500 dark:text-gray-400">
          &lt;BlogImageEnhancer /&gt; renders the dialog below, then listens on{" "}
          <code>.blog-content</code> for clicks. In a browser, clicking this image would open it:
        </p>
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect width='120' height='80' fill='%23c4b5fd'/%3E%3C/svg%3E"
          alt="A placeholder article image"
          class="rounded border border-gray-200 dark:border-gray-700"
        />
      </div>
      <BlogImageEnhancer />
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

/** The same grid with `onSelectDate`, which is what turns every cell from an `<a>` into a `<button>`. */
function CalendarInteractiveDemo() {
  const picked = useSignal("nothing picked")
  return (
    <div class="space-y-3">
      <Calendar
        monthAnchor="2026-03-01"
        minDate="2026-03-01"
        maxDate="2026-04-30"
        today="2026-03-10"
        timeZone="UTC"
        slotsByDate={{ "2026-03-11": 6, "2026-03-12": 3, "2026-03-18": 2 }}
        selectedDate={picked.value}
        onSelectDate={(date) => picked.value = date}
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">onSelectDate: {picked.value}</p>
    </div>
  )
}

/** Three toggles, one per mode, plus the placeholder the app renders before it has read storage. */
function ThemeToggleDemo() {
  const mode = useSignal<"auto" | "light" | "dark">("auto")
  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-xs text-gray-500 dark:text-gray-400">
          one per mode, then the cycle, then the unread placeholder
        </span>
        <ThemeToggle mode="auto" onChange={() => {}} />
        <ThemeToggle mode="light" onChange={() => {}} />
        <ThemeToggle mode="dark" onChange={() => {}} />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <ThemeToggle mode={mode.value} onChange={(next) => mode.value = next} />
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {mode.value}: {themeToggleLabel(mode.value)}
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <ThemeToggle onChange={() => {}} />
        <span class="text-xs text-gray-500 dark:text-gray-400">
          no <code>mode</code>{" "}
          — the inert, same-size placeholder rendered while the stored preference is still unknown
        </span>
      </div>
    </div>
  )
}

export const systemDemos = {
  Calendar: {
    summary:
      "Six-week month grid. **Dual-mode**: with no `onSelectDate` every cell is an `<a href>` and a month arrow with nothing to show is a `<span>` rather than a dead link; supplying the callback turns the cells into `<button>`. `today` and `timeZone` are props, so a render can be pinned — this card passes `2026-03-10` and `UTC` and reads no clock. A date missing from `slotsByDate` has no availability, a `0` is fully booked, and the two are visually alike but carry different accessible labels. Cells also show today, past dates, dates outside the window, and a scarcity dot at or below `lowSlotsThreshold`.",
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
      </div>
    ),
  },
  ThemeToggle: {
    summary:
      "One icon button cycling `auto → light → dark`. Mode in, mode out: the component holds no preference and reads no storage, so the app owns where the setting lives and can keep tabs in sync. `mode` is optional because the stored preference is unknowable during server rendering — with no `mode` it renders an inert, same-size placeholder, which is what stops the layout shifting when the real button hydrates. `nextThemeMode` and `themeToggleLabel` are exported for the app's own keyboard shortcuts and status text.",
    snippet: `<ThemeToggle mode={mode.value} onChange={(next) => mode.value = next} />

// Before the stored preference is known — the placeholder, not a wrong icon:
<ThemeToggle onChange={(next) => mode.value = next} />`,
    render: () => <ThemeToggleDemo />,
  },
  SEOHead: {
    summary:
      "The page-head tag set as a fragment, plus the JSON-LD `@graph` that mirrors it: title, description, canonical and robots first, then the Twitter card, then Open Graph, then a `BreadcrumbList` derived from the canonical URL so structured data and the visible trail cannot disagree. Optional tags are omitted rather than emitted empty, and `<` is escaped in the script body so a description containing `</script>` cannot close the element it is embedded in. **This card shows `seoHeadTags`, the exported data the component maps over, not the component itself**: rendering `<SEOHead />` here would splice a second `<title>` into this document's body, and a browser reads the first `<title>` anywhere in a document as `document.title` — which would rename every deep link in the host app. The tag set below is real and complete; where it goes is the host's head pipeline, and this guide has none.",
    snippet: `<SEOHead
  title="Zone availability — Acme"
  description="Live slot availability for every zone."
  canonical="https://example.com/bookings/zones/12"
  ogImage="https://example.com/og/zones.png"
  siteName="Acme"
  jsonLd={[{ "@type": "Organization", name: "Acme" }]}
/>

// The same tag set as data, for an app whose head is not a component tree:
const tags = seoHeadTags(head)`,
    render: () => <SeoHeadTagList />,
  },
  SWUpdater: {
    summary:
      "Registers the service worker and offers a reload once a new version is *waiting*. **It renders `null` until then**, which is what makes it safe to mount in a layout for every visitor — and it means this component has no honest markup-level demo: the bar cannot exist without `navigator.serviceWorker`, a registration and a real deploy. The card therefore exercises the pure half it is built from, `watchForUpdate`, against a fake registration, in all three branches: a worker already waiting, a first install where no controller exists (silent, because reloading gains the visitor nothing), and an update arriving while the page is controlled. `skipWaiting`, `reloadOnControllerChange` and `serviceWorkerContainer` are exported the same way. The empty box at the bottom is `<SWUpdater />` itself, on this page, for real.",
    snippet: `<SWUpdater
  scriptUrl="/sw.js"
  reload={() => globalThis.location.reload()}
  onUpdate={() => app.toast.info({ body: "Updating…" })}
  onError={(error) => app.report(error)}
/>`,
    render: () => <SwUpdaterDemo />,
  },
  BlogImageEnhancer: {
    summary:
      "Makes images in rendered prose zoomable through a native `<dialog>` lightbox. Progressive enhancement in the strict sense: the server renders the article and this only adds a click layer after hydration, so a reader without JavaScript loses a zoom they never had. The click is delegated to the container — one listener rather than one per image, and images arriving later still work — and `resolveImage` returns `null` for a click on a link wrapping an image, which is what stops the enhancer stealing navigation from prose. **The `<dialog>` below is the component's real output and it is really closed**: opening it needs a click inside the watched container, which needs a document. Escape and the backdrop both close it, the first being native `<dialog>` behaviour.",
    snippet: `<BlogImageEnhancer
  containerSelector=".blog-content"
  fallbackAlt="Article figure"
  onOpen={(image) => analytics.track("lightbox", image.src)}
/>`,
    render: () => <BlogImageEnhancerDemo />,
  },
} satisfies DemoFragment
