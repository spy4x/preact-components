/**
 * The guide's shell: a side navigation and one page at a time.
 *
 * The host owns the address and passes it in as `hash`; the shell resolves it with `routes.ts`,
 * renders that route's page, and — once the host has read the address — marks and scrolls to the
 * card or section the route names. Nothing here reads `location`, so the guide renders on a server
 * and in any router: a host that routes by hash passes `location.hash` and lets the links work as
 * links, and a host that routes some other way passes a `navigate` port as well.
 *
 * A route that names nothing (`#top`, a card's own in-page link) keeps the page that is showing.
 * Switching to the overview under it would take the element the fragment points at off the page.
 * A bare fragment that names a section's or a page's own id (`#inputs`, `#icons`) opens the page
 * that holds it, and the shell scrolls to it there.
 *
 * At `lg` and up the navigation is a sticky column beside the page. Below that it is a native modal
 * `<dialog>` behind a menu button: the button opens it with a click, Enter or Space, Escape closes
 * it, and closing it puts focus back on the button.
 */

import { cn } from "@preact-components/cn"
import { IconBars3, IconXMark } from "@preact-components/icons"
import { buttonClasses } from "@preact-components/ui/button"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef, useState } from "preact/hooks"
import { DemoCard, MissingDemoBanner } from "./card.tsx"
import { IconGallery, iconNames } from "./icons.tsx"
import { CatalogInstructions } from "./instructions.tsx"
import {
  cardLabel,
  catalogueNames,
  type CatalogueSection,
  classDemos,
  demoRegistry,
  type GuidePage,
  type GuidePageId,
  guidePages,
  missingDemos,
  packagePages,
  type PartialDemoRegistry,
} from "./registry.ts"
import {
  demoHref,
  pageHref,
  pageOfFragment,
  pageOfRoute,
  parseRoute,
  routeHref,
  type RouteMatch,
} from "./routes.ts"

/** Every string the shell prints that is not catalogue data. Each has an English default. */
export interface UIGuideLabels {
  /** The overview's heading. Defaults to `"preact-components"`. */
  title?: string
  /** The line under the overview's heading. */
  tagline?: string
  /** The navigation's accessible name, and the phone dialog's. Defaults to `"Guide"`. */
  nav?: string
  /** The phone menu button's text. Defaults to `"Menu"`. */
  openNav?: string
  /** The dialog's close button's accessible name. Defaults to `"Close the guide navigation"`. */
  closeNav?: string
  /** What a package page with no card in the registry says. */
  comingSoon?: string
  /** The link that jumps past the navigation to the page. Defaults to `"Skip to content"`. */
  skipToContent?: string
  /**
   * The overview's line of totals. Defaults to
   * `"<cards> live cards · <icons> icons · <packages> packages"`.
   */
  stats?: (totals: { cards: number; icons: number; packages: number }) => string
  /** An overview card's count of live cards. Defaults to `"<count> cards"`, and `"1 card"`. */
  cardCount?: (count: number) => string
  /** The icons page's overview card. Defaults to `"<count> icons"`. */
  iconCount?: (count: number) => string
  /** An overview card for a package with no card in the registry. Defaults to `"Examples coming"`. */
  examplesComing?: string
}

const DEFAULT_LABELS: Required<UIGuideLabels> = {
  title: "preact-components",
  tagline:
    "Preact components, Tailwind styles, icons and signal helpers for Deno apps — every one running live on this page, with the code next to it.",
  nav: "Guide",
  openNav: "Menu",
  closeNav: "Close the guide navigation",
  comingSoon: "Runnable examples for this package are coming. Its README documents it until then.",
  skipToContent: "Skip to content",
  stats: ({ cards, icons, packages }) =>
    `${cards} live cards · ${icons} icons · ${packages} packages`,
  cardCount: (count) => `${count} ${count === 1 ? "card" : "cards"}`,
  iconCount: (count) => `${count} icons`,
  examplesComing: "Examples coming",
}

/** What the shell tells its host after it has shown a route. */
export interface GuideRouteChange {
  /** The route the address named. */
  route: RouteMatch
  /** The page showing: the route's own, or the one kept for a route that names none. */
  page: GuidePage
}

export interface UIGuideProps {
  /**
   * The address's fragment, `location.hash` for a hash-routed host.
   *
   * Leave it `undefined` until the host has read the address — on the server and in the first
   * client render — and the shell renders the `all` page, every package at once, and touches
   * nothing; a string makes it render that route's page and mark, scroll and report it.
   * `useLocationHash` (`location-hash.ts`) is that value for a host that routes by the fragment.
   */
  hash?: string
  /**
   * Called instead of following a link, with the link's `#/…` href, when the host routes by
   * something other than the fragment. Left out, every link is a plain link.
   */
  navigate?: (href: string) => void
  /** Called after a route is shown, so the host can title the document. */
  onRouteChange?: (change: GuideRouteChange) => void
  /** Host content appended to one page, after its cards — a demo that needs a page of its own. */
  pageExtras?: Partial<Record<GuidePageId, ComponentChildren>>
  /**
   * Registry to render. Defaults to {@link demoRegistry}, the complete one.
   *
   * Pass a partial registry to render a trimmed guide; the cards left out are named in a warning
   * banner, so a guide that renders less than the catalogue says so on the page.
   */
  registry?: PartialDemoRegistry
  /** Clipboard port, forwarded to every copy control in the catalogue. */
  copy?: (text: string) => void | Promise<void>
  /** Overrides for the shell's own strings. */
  labels?: UIGuideLabels
  class?: string
}

/**
 * The live catalogue: a navigation and the page the route names.
 *
 * @param props See {@link UIGuideProps}.
 */
export function UIGuide(
  {
    hash,
    navigate,
    onRouteChange,
    pageExtras,
    registry = demoRegistry,
    copy,
    labels: labelOverrides,
    class: className,
  }: UIGuideProps,
): JSX.Element {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  const route = parseRoute(hash ?? "")

  // A route that names no page keeps the one showing. Held in a ref rather than state: it is
  // derived during render from the route and its own last value, and never re-renders anything.
  // Before the host has read the address, the page is `all`: the served document carries every
  // page, for a reader without JavaScript and for hydration to match. That is not a page the reader
  // chose, so it is not kept: a first route that names none opens the overview.
  const shownPage = useRef<GuidePageId>("overview")
  const pageId = hash === undefined
    ? "all"
    : pageOfRoute(route) ?? pageOfFragment(hash) ?? shownPage.current
  if (hash !== undefined) shownPage.current = pageId
  const page = guidePages.find((candidate) => candidate.id === pageId) ?? guidePages[0]

  const [navOpen, setNavOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  const contentId = useId()
  const content = useRef<HTMLDivElement>(null)
  const scrolledPage = useRef<GuidePageId | undefined>(undefined)

  // The dialog is opened and closed on the element itself, in the handler, and `navOpen` follows
  // it through the `close` event. Driving the element from state instead loses a reopen that
  // comes before the close has rendered: false then true in one batch is no change to Preact.
  const openNav = () => {
    dialog.current?.showModal()
    setNavOpen(true)
  }
  const closeNav = () => dialog.current?.close()

  useEffect(() => {
    if (hash === undefined) return
    closeNav()

    for (const marked of document.querySelectorAll("[data-deep-link]")) {
      marked.removeAttribute("data-deep-link")
    }
    onRouteChange?.({ route, page })

    // The first route read replaces the `all` document with one page, which is not a page change a
    // reader made. It starts where the address points, or at the top: the server sent the longer
    // `all` document, so a position the browser restored would land somewhere unrelated.
    const firstRead = scrolledPage.current === undefined
    const pageChanged = !firstRead && scrolledPage.current !== page.id
    scrolledPage.current = page.id

    if (route.kind === "demo") {
      const card = document.getElementById(`demo-${route.name}`)
      if (!card) return
      card.setAttribute("data-deep-link", "")
      card.scrollIntoView({ block: "start" })
      return
    }
    // A section that shares its page's id (`#/crud`) is that page's own route, so it opens the page
    // at its title, below; scrolling to the section would land past the heading.
    if (route.kind === "section" && route.sectionId !== page.id) {
      document.getElementById(route.sectionId)?.scrollIntoView({ block: "start" })
      return
    }
    if (route.kind === "index" && route.reason === "unknown") {
      // A bare fragment: the browser scrolled to its element when the address changed, unless the
      // element was not on the page yet — a page switched to hold it, or a fresh load whose `all`
      // document was just replaced. Only then does the shell scroll there itself.
      const target = /^#([^/]+)$/.exec(hash)?.[1]
      const element = target === undefined ? null : document.getElementById(target)
      if (element && (firstRead || pageChanged)) element.scrollIntoView({ block: "start" })
      // A fragment that names a page with no element of that id (`#ui`, `#theme`) opened the page
      // itself, which starts at its top like the page's own route.
      if (!element && pageOfFragment(hash) !== undefined) {
        globalThis.scrollTo({ top: 0, behavior: pageChanged ? "instant" : "auto" })
      }
      return
    }
    // A page's route starts it at its top: at once for a new page, since animating down a page that
    // was just replaced shows nothing but the wrong content moving, and by the page's own scroll
    // for the page already showing. A fresh load starts at the top.
    globalThis.scrollTo({ top: 0, behavior: pageChanged || firstRead ? "instant" : "auto" })
  }, [hash])

  const follow = (href: string, event: JSX.TargetedMouseEvent<HTMLAnchorElement>) => {
    closeNav()
    if (!navigate) return
    event.preventDefault()
    navigate(href)
  }

  const missing = missingDemos(registry)

  return (
    <div class={cn("ui-guide w-full", className)} data-guide-page={page.id}>
      {
        /* First in the guide, ahead of every navigation link. It moves focus itself rather than
        leaving it to the fragment, so it works under a host that routes by something else, and the
        fragment stays for a reader without JavaScript. */
      }
      <a
        href={`#${contentId}`}
        onClick={(event) => {
          event.preventDefault()
          const target = content.current
          if (!target) return
          // Focusable only while the skip link has put focus there: a column that stayed focusable
          // would take the focus of every click on a non-focusable spot inside it, which a menu
          // reads as focus leaving it, and closes.
          target.tabIndex = -1
          target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true })
          target.focus()
          target.scrollIntoView({ block: "start" })
        }}
        class="sr-only rounded-md bg-white px-3 py-2 text-sm font-medium text-purple-900 shadow focus:not-sr-only focus:absolute focus:px-3 focus:py-2 focus:z-40 dark:bg-gray-900 dark:text-purple-200"
        data-e2e="ui-guide-skip"
      >
        {labels.skipToContent}
      </a>
      <div class="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <div class="sticky top-[var(--ui-guide-top,0px)] z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 py-2 backdrop-blur lg:hidden dark:border-gray-700 dark:bg-gray-900/95">
          <button
            ref={trigger}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={navOpen}
            aria-controls={dialogId}
            onClick={openNav}
            class={buttonClasses("outline", "sm")}
            data-e2e="ui-guide-nav-open"
          >
            <IconBars3 class="size-4" />
            {labels.openNav}
          </button>
          <span class="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {page.title}
          </span>
        </div>

        <aside class="hidden lg:sticky lg:top-[var(--ui-guide-top,0px)] lg:block lg:max-h-[calc(100dvh-var(--ui-guide-top,0px))] lg:overflow-y-auto lg:py-8">
          <GuideNav
            label={labels.nav}
            page={page}
            route={route}
            registry={registry}
            follow={follow}
          />
        </aside>

        <dialog
          ref={dialog}
          id={dialogId}
          aria-label={labels.nav}
          data-e2e="ui-guide-nav-dialog"
          onClose={() => {
            // The `close` event is a queued task, so a reopen can land before it; that event is
            // stale, and acting on it would empty a dialog that is open again.
            if (dialog.current?.open) return
            setNavOpen(false)
            // Chromium already returns focus to the button that opened a modal dialog, so the
            // browser check passes with or without this line; it is here for engines that do not.
            trigger.current?.focus()
          }}
          class="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none overflow-y-auto border-r border-gray-200 bg-white p-4 text-gray-900 backdrop:bg-gray-950/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <span class="font-mono text-sm font-semibold text-purple-900 dark:text-purple-300">
              {labels.title}
            </span>
            <button
              type="button"
              aria-label={labels.closeNav}
              onClick={closeNav}
              class={buttonClasses("ghost", "sm")}
            >
              <IconXMark class="size-4" />
            </button>
          </div>
          {navOpen
            ? (
              <GuideNav
                label={labels.nav}
                page={page}
                route={route}
                registry={registry}
                follow={follow}
              />
            )
            : null}
        </dialog>

        {
          /* `overflow-x: clip`, not `hidden`: a demo whose tooltip or code runs past a phone's
          edge is cut there instead of scrolling the whole page sideways, and a clip is no scroll
          container, so nothing inside loses its sticky or its vertical overflow. */
        }
        <div
          ref={content}
          id={contentId}
          class="min-w-0 space-y-10 overflow-x-clip py-8 outline-none"
        >
          <p class="sr-only" aria-live="polite">{page.title}</p>
          {missing.length > 0 ? <MissingDemoBanner names={missing} /> : null}
          {(page.id === "all" ? [guidePages[0], ...packagePages] : [page]).map((shown) =>
            shown.id === "overview"
              ? <Overview key={shown.id} labels={labels} registry={registry} follow={follow} />
              : (
                <PackagePage
                  key={shown.id}
                  page={shown}
                  nested={page.id === "all"}
                  registry={registry}
                  copy={copy}
                  labels={labels}
                  extra={pageExtras?.[shown.id]}
                />
              )
          )}
        </div>
      </div>
    </div>
  )
}

/** Props of {@link GuideNav}. */
interface GuideNavProps {
  label: string
  page: GuidePage
  route: RouteMatch
  registry: PartialDemoRegistry
  /** Called on every link's click, with its href. */
  follow: (href: string, event: JSX.TargetedMouseEvent<HTMLAnchorElement>) => void
}

/**
 * Every page, and under the one showing, its sections and cards.
 *
 * `aria-current="page"` marks the page showing; `aria-current="true"` marks the section or the card
 * the route names, never both, so a reader and a check can each ask for the one current link.
 */
function GuideNav({ label, page, route, registry, follow }: GuideNavProps) {
  return (
    <nav aria-label={label} class="text-sm">
      <ul class="space-y-0.5">
        {guidePages.map((candidate) => {
          const current = candidate.id === page.id
          const href = pageHref(candidate.id)
          return (
            <li key={candidate.id}>
              <a
                href={href}
                aria-current={current ? "page" : undefined}
                data-guide-page-link={candidate.id}
                onClick={(event) => follow(href, event)}
                class={cn(
                  "block rounded-md px-3 py-1.5 font-medium",
                  current
                    ? "bg-purple-100 text-purple-900 dark:bg-purple-900/60 dark:text-purple-50"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                )}
              >
                {candidate.title}
              </a>
              {current && candidate.sections.length > 0
                ? (
                  <ul class="mt-1 mb-3 ml-3 space-y-2 border-l border-gray-200 pl-3 dark:border-gray-700">
                    {candidate.sections.map((section) => (
                      <NavSection
                        key={section.id}
                        section={section}
                        titled={candidate.sections.length > 1}
                        route={route}
                        registry={registry}
                        follow={follow}
                      />
                    ))}
                  </ul>
                )
                : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** One section in the navigation: its link, when the page has more than one, then its cards. */
function NavSection(
  { section, titled, route, registry, follow }: {
    section: CatalogueSection
    titled: boolean
    route: RouteMatch
    registry: PartialDemoRegistry
    follow: GuideNavProps["follow"]
  },
) {
  const sectionHref = routeHref(section.id)
  return (
    <li>
      {titled
        ? (
          <a
            href={sectionHref}
            aria-current={route.kind === "section" && route.sectionId === section.id
              ? "true"
              : undefined}
            onClick={(event) => follow(sectionHref, event)}
            class="block py-0.5 text-xs font-semibold tracking-wide text-gray-500 uppercase hover:text-gray-900 aria-[current]:text-purple-800 dark:text-gray-400 dark:hover:text-gray-100 dark:aria-[current]:text-purple-300"
          >
            {section.title}
          </a>
        )
        : null}
      <ul class="mt-0.5">
        {section.names.filter((name) => name in registry).map((name) => {
          const href = demoHref(section.id, name)
          const current = route.kind === "demo" && route.name === name
          return (
            <li key={name}>
              <a
                href={href}
                aria-current={current ? "true" : undefined}
                onClick={(event) => follow(href, event)}
                class={cn(
                  "block truncate rounded px-2 py-0.5",
                  section.kind === "component" && "font-mono text-xs",
                  current
                    ? "bg-purple-900 text-purple-50 dark:bg-purple-700"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                )}
              >
                {section.kind === "component" ? name : cardLabel(name)}
              </a>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

/**
 * Prose with `backtick` spans rendered as code, for the hand-written blurbs.
 *
 * @param text Blurb text.
 * @returns The text, with every backtick pair as a `<code>`.
 */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, index) =>
        index % 2 === 1
          ? (
            <code
              key={index}
              class="rounded bg-gray-100 px-1 font-mono text-[0.9em] [overflow-wrap:anywhere] dark:bg-gray-800"
            >
              {part}
            </code>
          )
          : part
      )}
    </>
  )
}

/** The landing page: what the library is, and a card per page. */
function Overview(
  { labels, registry, follow }: {
    labels: Required<UIGuideLabels>
    registry: PartialDemoRegistry
    follow: GuideNavProps["follow"]
  },
) {
  const cards = catalogueNames.filter((name) => name in registry).length
  return (
    <>
      <header class="space-y-4">
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-50">
          {labels.title}
        </h1>
        <p class="max-w-[65ch] text-base text-gray-600 dark:text-gray-300">{labels.tagline}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {labels.stats({ cards, icons: iconNames.length, packages: packagePages.length })}
        </p>
      </header>
      <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {packagePages.map((page) => {
          const count = page.sections.reduce(
            (total, section) => total + section.names.filter((name) => name in registry).length,
            0,
          )
          const href = pageHref(page.id)
          return (
            <li key={page.id} class="min-w-0">
              <a
                href={href}
                onClick={(event) => follow(href, event)}
                class="block h-full rounded-lg border border-gray-200 bg-white p-4 shadow-xs transition-colors hover:border-purple-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-500"
              >
                <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {page.title}
                </h2>
                <p class="mt-0.5 font-mono text-xs text-purple-700 dark:text-purple-300">
                  {page.packageName}
                </p>
                <p class="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-300">
                  <Prose text={page.blurb} />
                </p>
                <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {page.id === "icons"
                    ? labels.iconCount(iconNames.length)
                    : count > 0
                    ? labels.cardCount(count)
                    : labels.examplesComing}
                </p>
              </a>
            </li>
          )
        })}
      </ul>
      <CatalogInstructions />
    </>
  )
}

/** One package's page: its header, then its sections, the gallery, or a note that it has none. */
function PackagePage(
  { page, nested, registry, copy, labels, extra }: {
    page: GuidePage
    /** Rendered inside the `all` page, under its overview: the page heading is an `h2` there. */
    nested: boolean
    registry: PartialDemoRegistry
    copy?: (text: string) => void | Promise<void>
    labels: Required<UIGuideLabels>
    /** The host's own content for this page, after the cards. */
    extra: ComponentChildren
  },
) {
  const single = page.sections.length === 1
  const Heading = nested ? "h2" : "h1"
  const SectionHeading = nested ? "h3" : "h2"
  return (
    <div id={nested ? `page-${page.id}` : undefined} class="space-y-10">
      <header class="space-y-2 border-b border-gray-200 pb-6 dark:border-gray-700">
        <p class="font-mono text-xs text-purple-700 dark:text-purple-300">{page.packageName}</p>
        <Heading class="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          {page.title}
        </Heading>
        <p class="max-w-[65ch] text-base text-gray-600 dark:text-gray-300">
          <Prose text={page.blurb} />
        </p>
      </header>

      {page.id === "icons" ? <IconGallery copy={copy} /> : null}
      {page.id !== "icons" &&
          page.sections.every((section) => section.names.every((name) => !(name in registry)))
        ? <p class="text-sm text-gray-600 dark:text-gray-300">{labels.comingSoon}</p>
        : null}

      {page.sections.map((section) => {
        const demos = section.names.flatMap((name) => {
          const demo = registry[name]
          return demo ? [[name, demo] as const] : []
        })
        if (demos.length === 0) return null

        return (
          <section key={section.id} id={section.id} class="scroll-mt-8">
            <div class={cn("mb-4", single && "sr-only")}>
              <SectionHeading class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {section.title}
              </SectionHeading>
              <p class="mt-1 max-w-[65ch] text-sm text-gray-500 dark:text-gray-400">
                <Prose text={section.blurb} />
              </p>
            </div>
            <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4 [&>article:has([role=menu])]:col-span-full [&>article:has(table)]:col-span-full">
              {demos.map(([name, demo]) => {
                // A class card is headed by its own title and lists the classes it applies, an
                // example card by its title with its code open; a component card is headed by the
                // component.
                const classDemo = section.kind === "class" ? classDemos[name] : undefined
                return (
                  <DemoCard
                    key={name}
                    name={name}
                    label={cardLabel(name)}
                    summary={demo.summary}
                    snippet={demo.snippet}
                    classes={classDemo?.classes}
                    usageOpen={section.kind === "example"}
                    copy={copy}
                  >
                    {demo.render()}
                  </DemoCard>
                )
              })}
            </div>
          </section>
        )
      })}
      {extra}
    </div>
  )
}
