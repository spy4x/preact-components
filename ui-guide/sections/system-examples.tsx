/**
 * Examples of the helpers `system/` exports beside its components.
 *
 * Each card runs the real export when it renders; see `example.tsx`. The service-worker and
 * lightbox helpers take structural ports rather than browser objects, so their cards hand them the
 * smallest plain object — or an `EventTarget` — that satisfies the port, and print what the helper
 * did with it.
 */

import {
  breadcrumbItems,
  breadcrumbListJsonLd,
  canonicalUrl,
  createHeadStore,
  DEFAULT_UPDATE_MESSAGE,
  describeCalendarDay,
  isCurrentLink,
  jsonLdText,
  normalizeCanonical,
  readStateInit,
  reloadOnControllerChange,
  resolveImage,
  seoHeadJsonLd,
  seoHeadTags,
  serviceWorkerContainer,
  skipWaiting,
  startUpdates,
  stateInitText,
  TAB_BAR_SLOTS,
  tabBarSlots,
  watchForUpdate,
} from "@preact-components/system"
import type { CalendarDay, PageHead, RailShellItem } from "@preact-components/system"
import { collectSequence, zoomableAlt } from "@preact-components/system/image-lightbox"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

/** A stand-in for an `<img>`: the three members `resolveImage` reads. */
function image(src: string, alt: string | null) {
  return { matches: (selector: string) => selector === "img", src, alt: alt ?? undefined }
}

/** The smallest service-worker container: an `EventTarget` whose `register` never settles. */
function fakeContainer(registered: string[]) {
  return Object.assign(new EventTarget(), {
    controller: null,
    register: (url: string, options?: { scope?: string }) => {
      registered.push(`${url} (scope ${options?.scope ?? "default"})`)
      return new Promise<never>(() => {})
    },
  })
}

const examples: ExampleFragment = {
  normalizeCanonical: {
    title: "normalizeCanonical()",
    summary:
      "A canonical address in the one spelling a search engine should see: resolved, with dot segments removed.",
    snippet: `import { normalizeCanonical } from "@preact-components/system"

normalizeCanonical("https://example.com/docs/../guide?page=2")`,
    covers: ["normalizeCanonical"],
    run: () => normalizeCanonical("https://example.com/docs/../guide?page=2"),
  },
  breadcrumbListJsonLd: {
    title: "Breadcrumbs as structured data",
    summary:
      "`canonicalUrl` parses a page address and refuses anything that is not `http`/`https`; `breadcrumbItems` resolves the crumbs the caller states against it, and `breadcrumbListJsonLd` wraps them in a `BreadcrumbList` anchored to the page.",
    snippet: `import {
  breadcrumbItems,
  breadcrumbListJsonLd,
  canonicalUrl,
} from "@preact-components/system"

const page = "https://example.com/docs/setup#install"
const crumbs = [{ name: "Docs", href: "/docs" }, { name: "Setup" }]

canonicalUrl(page).href
breadcrumbItems(page, crumbs)
breadcrumbListJsonLd(page, crumbs)["@id"]`,
    covers: ["canonicalUrl", "breadcrumbItems", "breadcrumbListJsonLd"],
    run: () => {
      const page = "https://example.com/docs/setup#install"
      const crumbs = [{ name: "Docs", href: "/docs" }, { name: "Setup" }]
      return {
        canonical: canonicalUrl(page).href,
        items: breadcrumbItems(page, crumbs),
        id: breadcrumbListJsonLd(page, crumbs)["@id"],
      }
    },
  },
  createHeadStore: {
    title: "createHeadStore()",
    summary:
      "One page-head signal per request: `setHead` merges a page's fields over the defaults, and `resetHead` puts the defaults back before the next page.",
    snippet: `import { createHeadStore } from "@preact-components/system"

const { head, setHead, resetHead } = createHeadStore({
  title: "Acme",
  description: "Tools for small teams.",
  canonical: "https://example.com/",
})
setHead({ title: "Pricing — Acme", canonical: "https://example.com/pricing" })
const onPricing = head.value.title
resetHead()
const afterReset = head.value.title`,
    covers: ["createHeadStore"],
    run: () => {
      const { head, setHead, resetHead } = createHeadStore({
        title: "Acme",
        description: "Tools for small teams.",
        canonical: "https://example.com/",
      })
      setHead({ title: "Pricing — Acme", canonical: "https://example.com/pricing" })
      const onPricing = head.value.title
      resetHead()
      return { onPricing, afterReset: head.value.title }
    },
  },
  seoHeadTags: {
    title: "The head tags as data",
    summary:
      "`seoHeadTags` is every tag `SEOHead` renders, in document order, for a head pipeline that is not a component tree; `seoHeadJsonLd` is the JSON-LD graph, and `jsonLdText` serialises it for a `<script>` body with `<` escaped.",
    snippet: `import { jsonLdText, seoHeadJsonLd, seoHeadTags } from "@preact-components/system"

const head = {
  title: "Pricing — Acme",
  description: "Plans for teams of every size.",
  canonical: "https://example.com/pricing",
  jsonLd: [{ "@type": "Offer", name: "Starter", description: "For <5 people." }],
  crumbs: [{ name: "Home", href: "/" }, { name: "Pricing" }],
}

seoHeadTags(head).map(({ tag, attrs }) => attrs.name ?? attrs.property ?? attrs.rel ?? tag)
jsonLdText(seoHeadJsonLd(head))`,
    covers: ["seoHeadTags", "seoHeadJsonLd", "jsonLdText"],
    run: () => {
      const head: PageHead = {
        title: "Pricing — Acme",
        description: "Plans for teams of every size.",
        canonical: "https://example.com/pricing",
        jsonLd: [{ "@type": "Offer", name: "Starter", description: "For <5 people." }],
        crumbs: [{ name: "Home", href: "/" }, { name: "Pricing" }],
      }
      return {
        tags: seoHeadTags(head).map(({ tag, attrs }) =>
          attrs.name ?? attrs.property ?? attrs.rel ?? tag
        ),
        script: jsonLdText(seoHeadJsonLd(head)),
      }
    },
  },
  stateInitText: {
    title: "Server state into the page and back",
    summary:
      '`stateInitText` is the JSON body `StateInit` writes, with `<` escaped so `</script>` cannot end it; `readStateInit` reads it back, trusting only a `<script type="application/json">` — here from a stand-in for `document`.',
    snippet: `import { readStateInit, stateInitText } from "@preact-components/system"

const text = stateInitText({ user: "Ada", note: "</script> is safe" })
const page = {
  getElementById: () => ({
    tagName: "SCRIPT",
    getAttribute: () => "application/json",
    textContent: text,
  }),
}
readStateInit("state-init", page)`,
    covers: ["stateInitText", "readStateInit"],
    run: () => {
      const text = stateInitText({ user: "Ada", note: "</script> is safe" })
      const page = {
        getElementById: () => ({
          tagName: "SCRIPT",
          getAttribute: () => "application/json",
          textContent: text,
        }),
      }
      return { text, read: readStateInit("state-init", page) }
    },
  },
  describeCalendarDay: {
    title: "describeCalendarDay()",
    summary:
      "The default accessible description of one calendar cell: the date as the locale writes it, then how many are left or why it cannot be picked.",
    snippet: `import { describeCalendarDay } from "@preact-components/system"

const day = {
  date: "2026-03-11",
  label: "11 March 2026",
  inMonth: true,
  disabled: false,
  reason: null,
  availableCount: 3,
  selected: false,
  today: false,
}
describeCalendarDay(day)
describeCalendarDay({ ...day, disabled: true, reason: "past", availableCount: undefined })`,
    covers: ["describeCalendarDay"],
    run: () => {
      const day: CalendarDay = {
        date: "2026-03-11",
        label: "11 March 2026",
        inMonth: true,
        disabled: false,
        reason: null,
        availableCount: 3,
        selected: false,
        today: false,
      }
      return [
        describeCalendarDay(day),
        describeCalendarDay({ ...day, disabled: true, reason: "past", availableCount: undefined }),
      ]
    },
  },
  isCurrentLink: {
    title: "isCurrentLink()",
    summary:
      "Whether a header link is the current page — exact equality, so `/docs` is not current while `/docs/intro` is on screen.",
    snippet: `import { isCurrentLink } from "@preact-components/system"

isCurrentLink("/pricing", "/pricing")
isCurrentLink("/docs", "/docs/intro")
isCurrentLink("/docs", undefined)`,
    covers: ["isCurrentLink"],
    run: () => [
      isCurrentLink("/pricing", "/pricing"),
      isCurrentLink("/docs", "/docs/intro"),
      isCurrentLink("/docs", undefined),
    ],
  },
  tabBarSlots: {
    title: "The phone tab bar's split",
    summary:
      '`tabBarSlots` decides which `RailShell` entries become tabs and which go behind "More": everything fits in `TAB_BAR_SLOTS` or fewer, otherwise four tabs and the primary action leads the overflow.',
    snippet: `import { TAB_BAR_SLOTS, tabBarSlots } from "@preact-components/system"

const items = ["home", "inbox", "files", "reports", "people", "settings"]
  .map((key) => ({ key, label: key }))
const { tabs, more } = tabBarSlots(items, { key: "new", label: "New" })

TAB_BAR_SLOTS
tabs.map((item) => item.key)
more.map((item) => item.key)`,
    covers: ["TAB_BAR_SLOTS", "tabBarSlots"],
    run: () => {
      const items: RailShellItem[] = ["home", "inbox", "files", "reports", "people", "settings"]
        .map((key) => ({ key, label: key }))
      const { tabs, more } = tabBarSlots(items, { key: "new", label: "New" })
      return {
        slots: TAB_BAR_SLOTS,
        tabs: tabs.map((item) => item.key),
        more: more.map((item) => item.key),
      }
    },
  },
  collectSequence: {
    title: "What the lightbox opens",
    summary:
      "`zoomableAlt` picks an image's description or the fallback, `resolveImage` turns a clicked element into a lightbox image, and `collectSequence` builds the images the lightbox pages through and where the clicked one sits — here from stand-ins for `<img>` elements.",
    snippet: `import { resolveImage } from "@preact-components/system"
import { collectSequence, zoomableAlt } from "@preact-components/system/image-lightbox"

const image = (src, alt) => ({ matches: (s) => s === "img", src, alt })
const images = [image("/a.jpg", "Harbour at dawn"), image("/b.jpg", null), image("/c.jpg", " ")]

zoomableAlt("  Harbour at dawn ", "Image")
resolveImage(images[1])
collectSequence(images, images[2])`,
    covers: ["zoomableAlt", "resolveImage", "collectSequence"],
    run: () => {
      const images = [
        image("/a.jpg", "Harbour at dawn"),
        image("/b.jpg", null),
        image("/c.jpg", " "),
      ]
      return {
        alt: zoomableAlt("  Harbour at dawn ", "Image"),
        resolved: resolveImage(images[1]),
        sequence: collectSequence(images, images[2]),
      }
    },
  },
  startUpdates: {
    title: "Finding and registering the service worker",
    summary:
      "`serviceWorkerContainer` returns `navigator.serviceWorker`, or nothing off a browser; `startUpdates` registers the worker with it and watches for an update, and the function it returns stops watching.",
    snippet: `import { serviceWorkerContainer, startUpdates } from "@preact-components/system"

const registered = []
const container = Object.assign(new EventTarget(), {
  controller: null,
  register: (url, options) => {
    registered.push(\`\${url} (scope \${options?.scope ?? "default"})\`)
    return new Promise(() => {})
  },
})

serviceWorkerContainer({})
const stop = startUpdates(container, { scope: "/app/" })
stop()`,
    covers: ["serviceWorkerContainer", "startUpdates"],
    run: () => {
      const registered: string[] = []
      const container = fakeContainer(registered)
      const offBrowser = serviceWorkerContainer({})
      const stop = startUpdates(container, { scope: "/app/" })
      stop()
      return { offBrowser, registered }
    },
  },
  watchForUpdate: {
    title: "Handing over to a waiting worker",
    summary:
      "`watchForUpdate` reports once that a new worker is waiting, and `skipWaiting` tells it to take over by posting `DEFAULT_UPDATE_MESSAGE`, the message the worker has to recognise.",
    snippet: `import {
  DEFAULT_UPDATE_MESSAGE,
  skipWaiting,
  watchForUpdate,
} from "@preact-components/system"

const log = []
const waiting = Object.assign(new EventTarget(), {
  state: "installed",
  postMessage: (message) => log.push(message),
})
const registration = Object.assign(new EventTarget(), { installing: null, waiting })

const stop = watchForUpdate(registration, {
  hasController: () => true,
  onUpdate: () => log.push("update waiting"),
})
skipWaiting(registration, DEFAULT_UPDATE_MESSAGE)
stop()`,
    covers: ["watchForUpdate", "skipWaiting", "DEFAULT_UPDATE_MESSAGE"],
    run: () => {
      const log: unknown[] = []
      const waiting = Object.assign(new EventTarget(), {
        state: "installed",
        postMessage: (message: unknown) => log.push(message),
      })
      const registration = Object.assign(new EventTarget(), { installing: null, waiting })
      const stop = watchForUpdate(registration, {
        hasController: () => true,
        onUpdate: () => log.push("update waiting"),
      })
      const posted = skipWaiting(registration, DEFAULT_UPDATE_MESSAGE)
      stop()
      return { posted, log }
    },
  },
  reloadOnControllerChange: {
    title: "reloadOnControllerChange()",
    summary:
      "Reloads once the new worker controls the page — armed when the visitor asks for the reload, never at registration, so other tabs are left alone.",
    snippet: `import { reloadOnControllerChange } from "@preact-components/system"

let reloads = 0
const container = Object.assign(new EventTarget(), {
  controller: null,
  register: () => new Promise(() => {}),
})

const stop = reloadOnControllerChange(container, () => reloads++)
container.dispatchEvent(new Event("controllerchange"))
stop()
container.dispatchEvent(new Event("controllerchange"))`,
    covers: ["reloadOnControllerChange"],
    run: () => {
      let reloads = 0
      const container = fakeContainer([])
      const stop = reloadOnControllerChange(container, () => reloads++)
      container.dispatchEvent(new Event("controllerchange"))
      stop()
      container.dispatchEvent(new Event("controllerchange"))
      return { reloads }
    },
  },
}

/** The `system/` examples, as registry cards. */
export const systemExamples = toExampleDemos(examples)
