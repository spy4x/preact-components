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
} from "@spy4x/preact-system"
import type { CalendarDay, PageHead, RailShellItem } from "@spy4x/preact-system"
import { collectSequence, zoomableAlt } from "@spy4x/preact-system/image-lightbox"
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
    wide: false,
    summary:
      "A canonical address in the one spelling a search engine should see: resolved, with dot segments removed.",
    snippet: `import { normalizeCanonical } from "@spy4x/preact-system"

normalizeCanonical("https://example.com/docs/../guide?page=2")`,
    covers: ["normalizeCanonical"],
    run: () => normalizeCanonical("https://example.com/docs/../guide?page=2"),
  },
  createHeadStore: {
    title: "createHeadStore()",
    wide: false,
    summary:
      "Holds one page head per request: `setHead` sets a page's fields over the defaults, and `resetHead` restores them.",
    snippet: `import { createHeadStore } from "@spy4x/preact-system"

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
  breadcrumbListJsonLd: {
    title: "Breadcrumbs as structured data",
    wide: true,
    summary:
      "Builds a page's breadcrumb trail as a schema.org `BreadcrumbList`, from the crumbs the caller states.",
    snippet: `import {
  breadcrumbItems,
  breadcrumbListJsonLd,
  canonicalUrl,
} from "@spy4x/preact-system"

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
  seoHeadTags: {
    title: "The head tags as data",
    wide: true,
    summary:
      "Every tag `SEOHead` renders, as data, for a head that is not built from components, plus the JSON-LD script body.",
    snippet: `import { jsonLdText, seoHeadJsonLd, seoHeadTags } from "@spy4x/preact-system"

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
    wide: true,
    summary:
      "The JSON text `StateInit` writes into the page, safe inside a script element, and `readStateInit` reading it back.",
    snippet: `import { readStateInit, stateInitText } from "@spy4x/preact-system"

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
    wide: false,
    summary:
      "The default accessible description of one calendar cell: the date as the locale writes it, then how many are left or why it cannot be picked.",
    snippet: `import { describeCalendarDay } from "@spy4x/preact-system"

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
    wide: false,
    summary:
      "Whether a link is the current page, by exact match, so `/docs` is not current on `/docs/intro`.",
    snippet: `import { isCurrentLink } from "@spy4x/preact-system"

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
  collectSequence: {
    title: "What the lightbox opens",
    wide: true,
    summary:
      "Works out which image the lightbox opens, what it is called, and which other images it pages through.",
    snippet: `import { resolveImage } from "@spy4x/preact-system"
import { collectSequence, zoomableAlt } from "@spy4x/preact-system/image-lightbox"

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
  tabBarSlots: {
    title: "The phone tab bar's split",
    wide: false,
    summary: "Decides which `RailShell` items get a tab on a phone and which go behind **More**.",
    snippet: `import { TAB_BAR_SLOTS, tabBarSlots } from "@spy4x/preact-system"

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
  startUpdates: {
    title: "Finding and registering the service worker",
    wide: false,
    summary: "Registers a service worker and watches it for updates, doing nothing off a browser.",
    snippet: `import { serviceWorkerContainer, startUpdates } from "@spy4x/preact-system"

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
    wide: false,
    summary:
      "Reports once that a new worker is waiting, and `skipWaiting` tells that worker to take over.",
    snippet: `import {
  DEFAULT_UPDATE_MESSAGE,
  skipWaiting,
  watchForUpdate,
} from "@spy4x/preact-system"

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
    wide: false,
    summary:
      "Reloads the page once the new worker is in control, armed only when the visitor asks for it.",
    snippet: `import { reloadOnControllerChange } from "@spy4x/preact-system"

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
