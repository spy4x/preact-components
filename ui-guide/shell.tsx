/**
 * The guide's shell: a header, a grouped side navigation, one page at a time, and the list of what
 * is on that page. `DESIGN.md` beside this file is the design it implements.
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
 * At `lg` and up the navigation is a sticky column beside the page, and at `xl` the page's cards
 * are listed in a second sticky column on the right, "On this page", which marks the card in view.
 * Below `lg` the navigation is a native modal `<dialog>` behind the header's menu button: the button
 * opens it with a click, Enter or Space, Escape closes it, and closing it puts focus back on the
 * button.
 */

import { cn } from "@spy4x/preact-cn"
import { IconBars3, IconGitHub, IconMoon, IconSun, IconXMark } from "@spy4x/preact-icons"
import { Button, buttonClasses } from "@spy4x/preact-ui/button"
import { InstallBox } from "@spy4x/preact-ui/install-box"
import { Cluster, Grid, Section, Stack } from "@spy4x/preact-ui/layout"
import { Badge } from "@spy4x/preact-ui/badge"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks"
import { DEFAULT_CARD_LABELS, DemoCard, type DemoCardLabels, MissingDemoBanner } from "./card.tsx"
import { IconGallery, iconNames } from "./icons.tsx"
import { CatalogInstructions } from "./instructions.tsx"
import { InlineMarkdown } from "./markdown.tsx"
import {
  cardLabel,
  catalogueNames,
  type CatalogueSection,
  classDemos,
  type Demo,
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
import { GuideSearch, searchIndex, type SearchKindWords } from "./search.tsx"

/** The navigation's groups, in order. Every page is in exactly one (`shell.test.tsx`). */
export const navGroups = [
  { id: "start", pages: ["overview", "all"] },
  { id: "components", pages: ["ui", "system", "crud", "charts", "map"] },
  { id: "helpers", pages: ["signals", "cn"] },
  { id: "foundations", pages: ["theme", "icons"] },
] as const satisfies readonly { id: string; pages: readonly GuidePageId[] }[]

/** Identifier of one navigation group. */
export type NavGroupId = (typeof navGroups)[number]["id"]

/** Every string the shell prints that is not catalogue data. Each has an English default. */
export interface UIGuideLabels {
  /** The library's name: the header's and the overview's heading. Defaults to `"preact-components"`. */
  title?: string
  /** The line under the overview's heading. */
  tagline?: string
  /** The navigation's accessible name, and the phone dialog's. Defaults to `"Guide"`. */
  nav?: string
  /** The phone menu button's accessible name. Defaults to `"Menu"`. */
  openNav?: string
  /** The dialog's close button's accessible name. Defaults to `"Close the guide navigation"`. */
  closeNav?: string
  /** The heading of each navigation group. */
  navGroups?: Partial<Record<NavGroupId, string>>
  /** What a package page with no card in the registry says. */
  comingSoon?: string
  /** The link that jumps past the navigation to the page. Defaults to `"Skip to content"`. */
  skipToContent?: string
  /** The search dialog's name, its field's and its list's. Defaults to `"Search"`. */
  search?: string
  /**
   * The search field's placeholder, and the header's search button's text and name. Defaults to
   * `"Search components…"`.
   */
  searchPlaceholder?: string
  /** The search dialog's close button's name. Defaults to `"Close the search"`. */
  closeSearch?: string
  /**
   * The word beside a search result, by kind. Defaults to `"Page"`, `"Component"`, `"Helper"` and
   * `"Classes"`.
   */
  searchKinds?: Partial<SearchKindWords>
  /** Where the search says a page outside any package lives. Defaults to `"Guide"`. */
  searchGuidePlace?: string
  /** Each card's own words: its code row, props caption and copy control. */
  card?: Partial<DemoCardLabels>
  /** What the search says when nothing matches. Defaults to `"Nothing matches that name."`. */
  searchEmpty?: string
  /** The repository link's accessible name. Defaults to `"Source on GitHub"`. */
  repository?: string
  /** The right-hand list's heading. Defaults to `"On this page"`. */
  onThisPage?: string
  /** The theme switch's name in the light palette. Defaults to `"Switch to dark mode"`. */
  switchToDark?: string
  /** The theme switch's name in the dark palette. Defaults to `"Switch to light mode"`. */
  switchToLight?: string
  /** The theme switch's visible word in the light palette, from `md`. Defaults to `"Dark mode"`. */
  darkMode?: string
  /** The theme switch's visible word in the dark palette, from `md`. Defaults to `"Light mode"`. */
  lightMode?: string
  /** The overview's button to the first package page. Defaults to `"Browse components"`. */
  browse?: string
  /** The overview's example heading. Defaults to `"A first example"`. */
  exampleHeading?: string
  /** The overview example card's title. Defaults to `"Buttons and a badge"`. */
  exampleTitle?: string
  /** The overview example card's sentence, in inline Markdown. */
  exampleSummary?: string
  /** The overview example's copy control. Defaults to `"Copy the example code"`. */
  copyExample?: string
  /** The overview's install command's copy control. Defaults to `"Copy the install command"`. */
  copyInstall?: string
  /** The overview's package grid heading. Defaults to `"Packages"`. */
  packagesHeading?: string
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

const DEFAULT_LABELS: Required<Omit<UIGuideLabels, "navGroups" | "searchKinds" | "card">> & {
  navGroups: Record<NavGroupId, string>
  searchKinds: SearchKindWords
  card: DemoCardLabels
} = {
  title: "preact-components",
  tagline:
    "Preact components, Tailwind styles, icons and signal helpers for Deno apps — every one running live in this guide, with the code next to it.",
  nav: "Guide",
  openNav: "Menu",
  closeNav: "Close the guide navigation",
  navGroups: {
    start: "Start here",
    components: "Components",
    helpers: "Helpers",
    foundations: "Foundations",
  },
  comingSoon: "Runnable examples for this package are coming. Its README documents it until then.",
  skipToContent: "Skip to content",
  search: "Search",
  searchPlaceholder: "Search components…",
  searchEmpty: "Nothing matches that name.",
  closeSearch: "Close the search",
  searchKinds: { page: "Page", component: "Component", helper: "Helper", classes: "Classes" },
  searchGuidePlace: "Guide",
  card: DEFAULT_CARD_LABELS,
  repository: "Source on GitHub",
  onThisPage: "On this page",
  switchToDark: "Switch to dark mode",
  switchToLight: "Switch to light mode",
  darkMode: "Dark mode",
  lightMode: "Light mode",
  browse: "Browse components",
  exampleHeading: "A first example",
  exampleTitle: "Buttons and a badge",
  exampleSummary:
    "Components take props, render with the library's own classes, and are laid out by `Cluster` with its default gap.",
  copyExample: "Copy the example code",
  copyInstall: "Copy the install command",
  packagesHeading: "Packages",
  stats: ({ cards, icons, packages }) =>
    `${cards} live cards · ${icons} icons · ${packages} packages`,
  cardCount: (count) => `${count} ${count === 1 ? "card" : "cards"}`,
  iconCount: (count) => `${count} icons`,
  examplesComing: "Examples coming",
}

/** The shell's labels with every default filled in. */
type Labels = typeof DEFAULT_LABELS

/** What the shell tells its host after it has shown a route. */
export interface GuideRouteChange {
  /** The route the address named. */
  route: RouteMatch
  /** The page showing: the route's own, or the one kept for a route that names none. */
  page: GuidePage
}

/** The host's colour scheme, as the guide's theme switch reads and changes it. */
export interface ColorSchemePort {
  /** Whether the dark palette is on. */
  dark: boolean
  /** Switch to the other palette. */
  toggle: () => void
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
  /** The version the header shows beside the name, e.g. `"0.1.2"`. Left out, none is shown. */
  version?: string
  /** The repository the header links to. Left out, there is no link. */
  repository?: string
  /** The command the overview offers to copy. Defaults to `"deno add jsr:@spy4x/preact-ui"`. */
  install?: string
  /**
   * The colour scheme, as a port: whether the dark palette is on, and how to switch it. Given, the
   * header shows a switch that says what a press does; left out, there is none.
   */
  colorScheme?: ColorSchemePort
  /** Host controls at the header's end, after the theme switch. */
  actions?: ComponentChildren
  /**
   * The element the page column renders. `div` by default; a host with no `<main>` of its own
   * passes `"main"`, so the document has exactly one.
   */
  contentAs?: "main" | "div"
  class?: string
}

/**
 * The live catalogue: a header, a navigation and the page the route names.
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
    version,
    repository,
    install = "deno add jsr:@spy4x/preact-ui",
    colorScheme,
    actions,
    contentAs: Content = "div",
    class: className,
  }: UIGuideProps,
): JSX.Element {
  const labels: Labels = {
    ...DEFAULT_LABELS,
    ...labelOverrides,
    navGroups: { ...DEFAULT_LABELS.navGroups, ...labelOverrides?.navGroups },
    searchKinds: { ...DEFAULT_LABELS.searchKinds, ...labelOverrides?.searchKinds },
    card: { ...DEFAULT_LABELS.card, ...labelOverrides?.card },
  }
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
  const content = useRef<HTMLElement>(null)
  const scrolledPage = useRef<GuidePageId | undefined>(undefined)
  const inView = useCardInView(hash !== undefined, page.id)
  const entries = useMemo(
    () => searchIndex(registry, labels.searchGuidePlace),
    [registry, labels.searchGuidePlace],
  )

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
  // A search result is not a link, so it changes the address itself when no port is given.
  const go = (href: string) => {
    closeNav()
    if (navigate) navigate(href)
    else globalThis.location.hash = href.slice(1)
  }

  const missing = missingDemos(registry)
  // The overview and the all-pages document have no "On this page" column: their content takes
  // its place.
  const listed = page.id !== "all" && page.id !== "overview"

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
        class="sr-only rounded-md bg-white px-3 py-2 text-sm font-medium text-purple-900 shadow focus:not-sr-only focus:absolute focus:z-50 focus:px-3 focus:py-2 dark:bg-gray-900 dark:text-purple-200"
        data-e2e="ui-guide-skip"
      >
        {labels.skipToContent}
      </a>

      <header class="sticky top-[var(--ui-guide-top,0px)] z-30 h-14 border-b border-gray-200 bg-white/85 backdrop-blur dark:border-gray-800 dark:bg-gray-900/85">
        <div class="mx-auto flex h-full max-w-screen-2xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <button
            ref={trigger}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={navOpen}
            aria-controls={dialogId}
            onClick={openNav}
            class={buttonClasses("ghost", "sm", "lg:hidden")}
            data-e2e="ui-guide-nav-open"
          >
            <IconBars3 class="size-5" />
            <span class="sr-only">{labels.openNav}</span>
          </button>
          <a
            href={pageHref("overview")}
            onClick={(event) => follow(pageHref("overview"), event)}
            class="flex min-w-0 items-center gap-2 font-semibold text-gray-950 dark:text-gray-50"
          >
            <span class="truncate">{labels.title}</span>
            {version
              ? (
                <span class="hidden rounded-full bg-gray-100 px-2 text-xs font-medium text-gray-600 sm:inline dark:bg-gray-800 dark:text-gray-300">
                  v{version}
                </span>
              )
              : null}
          </a>
          <div class="ml-auto flex items-center gap-2">
            <GuideSearch entries={entries} labels={labels} go={go} />
            {repository
              ? (
                <a
                  href={repository}
                  rel="noreferrer"
                  aria-label={labels.repository}
                  title={labels.repository}
                  class={buttonClasses("ghost", "sm")}
                >
                  <IconGitHub class="size-5" />
                </a>
              )
              : null}
            {colorScheme ? <ThemeSwitch scheme={colorScheme} labels={labels} /> : null}
            {actions}
          </div>
        </div>
      </header>

      <div class="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:px-8 xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
        <aside class="hidden lg:sticky lg:top-[calc(var(--ui-guide-top,0px)+3.5rem)] lg:block lg:max-h-[calc(100dvh-3.5rem-var(--ui-guide-top,0px))] lg:overflow-y-auto lg:py-8">
          <GuideNav
            label={labels.nav}
            labels={labels}
            page={page}
            route={route}
            registry={registry}
            follow={follow}
            pageListBelowXl
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
          class="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none overflow-y-auto border-r border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-gray-950/50 backdrop:backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        >
          <div class="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
            <span class="font-semibold">{labels.title}</span>
            <button
              type="button"
              aria-label={labels.closeNav}
              onClick={closeNav}
              class={buttonClasses("ghost", "sm")}
            >
              <IconXMark class="size-5" />
            </button>
          </div>
          <div class="p-4">
            {navOpen
              ? (
                <GuideNav
                  label={labels.nav}
                  labels={labels}
                  page={page}
                  route={route}
                  registry={registry}
                  follow={follow}
                />
              )
              : null}
          </div>
        </dialog>

        {
          /* `overflow-x: clip`, not `hidden`: a demo whose tooltip or code runs past a phone's
          edge is cut there instead of scrolling the whole page sideways, and a clip is no scroll
          container, so nothing inside loses its sticky or its vertical overflow. `@container`: the
          card grid lays out by the column's width, not the window's. */
        }
        <Content
          ref={content as never}
          id={contentId}
          class={cn(
            "@container min-w-0 overflow-x-clip py-8 outline-none lg:py-12",
            !listed && "xl:col-span-2",
          )}
        >
          <p class="sr-only" aria-live="polite">{page.title}</p>
          <Stack gap="2xl">
            {missing.length > 0 ? <MissingDemoBanner names={missing} /> : null}
            {(page.id === "all" ? [guidePages[0], ...packagePages] : [page]).map((shown) =>
              shown.id === "overview"
                ? (
                  <Overview
                    key={shown.id}
                    labels={labels}
                    registry={registry}
                    follow={follow}
                    install={install}
                    copy={copy}
                  />
                )
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
          </Stack>
        </Content>

        {listed
          ? (
            <div class="hidden xl:sticky xl:top-[calc(var(--ui-guide-top,0px)+3.5rem)] xl:block xl:max-h-[calc(100dvh-3.5rem-var(--ui-guide-top,0px))] xl:overflow-y-auto xl:py-12">
              <OnThisPage
                label={labels.onThisPage}
                page={page}
                registry={registry}
                inView={inView}
                follow={follow}
              />
            </div>
          )
          : null}
      </div>
    </div>
  )
}

/**
 * The header's light/dark switch. Its name says what a press does ("Switch to dark mode"), at
 * every width; from `md` it also shows the mode it switches to, which the name contains.
 */
function ThemeSwitch({ scheme, labels }: { scheme: ColorSchemePort; labels: Labels }) {
  const name = scheme.dark ? labels.switchToLight : labels.switchToDark
  return (
    <button
      type="button"
      onClick={scheme.toggle}
      aria-label={name}
      title={name}
      class={buttonClasses("ghost", "sm")}
      data-e2e="theme-toggle"
    >
      {scheme.dark ? <IconSun class="size-5" /> : <IconMoon class="size-5" />}
      <span class="hidden md:inline">{scheme.dark ? labels.lightMode : labels.darkMode}</span>
    </button>
  )
}

/**
 * The name of the first card in view on the page showing, followed as the reader scrolls.
 *
 * Runs once the host has read the address, and again for each page; `undefined` before that and
 * wherever the browser has no `IntersectionObserver`.
 *
 * @param active Whether the host has read the address.
 * @param pageId The page showing.
 */
function useCardInView(active: boolean, pageId: GuidePageId): string | undefined {
  const [inView, setInView] = useState<string | undefined>(undefined)
  useEffect(() => {
    setInView(undefined)
    if (!active || pageId === "all" || !("IntersectionObserver" in globalThis)) return
    const cards = [...document.querySelectorAll<HTMLElement>(`article[id^="demo-"]`)]
    const visible = new Set<string>()
    // The band a card counts as "in view" in: below the sticky header, above the lower half.
    const observer = new IntersectionObserver((changes) => {
      for (const change of changes) {
        if (change.isIntersecting) visible.add(change.target.id)
        else visible.delete(change.target.id)
      }
      const first = cards.find((card) => visible.has(card.id))
      if (first) setInView(first.id.slice("demo-".length))
    }, { rootMargin: "-64px 0px -50% 0px" })
    for (const card of cards) observer.observe(card)
    return () => observer.disconnect()
  }, [active, pageId])
  return inView
}

/** Props of {@link GuideNav}. */
interface GuideNavProps {
  label: string
  labels: Labels
  page: GuidePage
  route: RouteMatch
  registry: PartialDemoRegistry
  /** Called on every link's click, with its href. */
  follow: (href: string, event: JSX.TargetedMouseEvent<HTMLAnchorElement>) => void
  /**
   * List the current page's sections and cards only below `xl`, where there is no "On this page"
   * column to list them. The links stay in the document at every width, so the section or card a
   * route names is marked either way.
   */
  pageListBelowXl?: boolean
}

/**
 * Every page, in its group, and under the one showing, its sections and cards.
 *
 * `aria-current="page"` marks the page showing; `aria-current="true"` marks the section or the card
 * the route names, never both, so a reader and a check can each ask for the one current link.
 * Nothing is truncated: a long name wraps.
 */
function GuideNav(
  { label, labels, page, route, registry, follow, pageListBelowXl }: GuideNavProps,
) {
  return (
    <nav aria-label={label} class="text-sm">
      <Stack gap="lg" as="ul">
        {navGroups.map((group) => (
          <li key={group.id}>
            <p class="px-3 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {labels.navGroups[group.id]}
            </p>
            <ul>
              {group.pages.map((id) => {
                const candidate = guidePages.find((each) => each.id === id)
                if (!candidate) return null
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
                        "block rounded-md px-3 py-1 font-medium",
                        current
                          ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-100"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-50",
                      )}
                    >
                      {candidate.title}
                    </a>
                    {current && candidate.sections.length > 0
                      ? (
                        <ul
                          class={cn(
                            "flex flex-col gap-2 py-2 pl-3",
                            pageListBelowXl && "xl:hidden",
                          )}
                        >
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
          </li>
        ))}
      </Stack>
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
    <li class="border-l border-gray-200 dark:border-gray-800">
      {titled
        ? (
          <a
            href={sectionHref}
            aria-current={route.kind === "section" && route.sectionId === section.id
              ? "true"
              : undefined}
            onClick={(event) => follow(sectionHref, event)}
            class="-ml-px block border-l border-transparent px-3 py-1 font-medium text-gray-900 hover:border-gray-400 aria-[current]:border-purple-600 aria-[current]:text-purple-800 dark:text-gray-100 dark:aria-[current]:border-purple-400 dark:aria-[current]:text-purple-300"
          >
            {section.title}
          </a>
        )
        : null}
      <ul>
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
                  "-ml-px block border-l px-3 py-1 [overflow-wrap:anywhere]",
                  current
                    ? "border-purple-600 font-medium text-purple-800 dark:border-purple-400 dark:text-purple-300"
                    : "border-transparent text-gray-600 hover:border-gray-400 hover:text-gray-950 dark:text-gray-400 dark:hover:text-gray-50",
                )}
              >
                {cardTitle(section, name)}
              </a>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

/**
 * A card's visible name: the component's own name for a component card, the card's title for a
 * class or an example card.
 */
function cardTitle(section: Pick<CatalogueSection, "kind">, name: string): string {
  return section.kind === "component" ? name : cardLabel(name)
}

/** The right-hand column: the page's sections and cards, the one in view marked. */
function OnThisPage(
  { label, page, registry, inView, follow }: {
    label: string
    page: GuidePage
    registry: PartialDemoRegistry
    inView: string | undefined
    follow: GuideNavProps["follow"]
  },
) {
  const sections = page.sections.filter((section) => section.names.some((name) => name in registry))
  if (sections.length === 0) return null
  return (
    <nav aria-label={label} class="text-sm" data-e2e="ui-guide-on-this-page">
      <p class="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
      <ul class="flex flex-col gap-4">
        {sections.map((section) => (
          <li key={section.id}>
            {sections.length > 1
              ? (
                <a
                  href={routeHref(section.id)}
                  onClick={(event) => follow(routeHref(section.id), event)}
                  class="block pb-1 font-medium text-gray-900 hover:text-purple-800 dark:text-gray-100 dark:hover:text-purple-300"
                >
                  {section.title}
                </a>
              )
              : null}
            <ul class="border-l border-gray-200 dark:border-gray-800">
              {section.names.filter((name) => name in registry).map((name) => {
                const href = demoHref(section.id, name)
                return (
                  <li key={name}>
                    <a
                      href={href}
                      aria-current={inView === name ? "location" : undefined}
                      onClick={(event) => follow(href, event)}
                      class="-ml-px block border-l border-transparent py-1 pl-3 [overflow-wrap:anywhere] text-gray-600 hover:text-gray-950 aria-[current]:border-purple-600 aria-[current]:font-medium aria-[current]:text-purple-800 dark:text-gray-400 dark:hover:text-gray-50 dark:aria-[current]:border-purple-400 dark:aria-[current]:text-purple-300"
                    >
                      {cardTitle(section, name)}
                    </a>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** The overview's live example: what a reader writes first, and what it draws. */
const FIRST_EXAMPLE = `import { Badge, Button, Cluster } from "@spy4x/preact-ui"

<Cluster>
  <Button>Save changes</Button>
  <Button variant="outline">Cancel</Button>
  <Badge text="Draft" color="purple" />
</Cluster>`

/** The landing page: what the library is, how to install it, one example, and the packages. */
function Overview(
  { labels, registry, follow, install, copy }: {
    labels: Labels
    registry: PartialDemoRegistry
    follow: GuideNavProps["follow"]
    install: string
    copy?: (text: string) => void | Promise<void>
  },
) {
  const cards = catalogueNames.filter((name) => name in registry).length
  const firstPage = packagePages[0]
  return (
    <Stack gap="2xl">
      <header class="flex flex-col gap-6">
        <Stack gap="sm">
          <h1 class="text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl dark:text-gray-50">
            {labels.title}
          </h1>
          <p class="max-w-2xl text-lg text-gray-600 dark:text-gray-300">{labels.tagline}</p>
        </Stack>
        <InstallBox
          command={install}
          copy={copy}
          copyLabel={labels.copyInstall}
          class="max-w-md bg-white dark:bg-gray-800/60"
        />
        <Cluster>
          <a
            href={pageHref(firstPage.id)}
            onClick={(event) => follow(pageHref(firstPage.id), event)}
            class={buttonClasses("primary", "md")}
          >
            {labels.browse}
          </a>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {labels.stats({ cards, icons: iconNames.length, packages: packagePages.length })}
          </p>
        </Cluster>
      </header>

      <Section as="section" title={labels.exampleHeading}>
        <DemoCard
          name="overview-example"
          anchorId="overview-example"
          label="First example"
          copyLabel={labels.copyExample}
          labels={labels.card}
          title={labels.exampleTitle}
          summary={labels.exampleSummary}
          snippet={FIRST_EXAMPLE}
          copy={copy}
          wide
        >
          <Cluster>
            <Button>Save changes</Button>
            <Button variant="outline">Cancel</Button>
            <Badge text="Draft" color="purple" />
          </Cluster>
        </DemoCard>
      </Section>

      <Section as="section" title={labels.packagesHeading}>
        <Grid as="ul" minColumnWidth="lg">
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
                  class="flex h-full flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-xs transition-colors hover:border-purple-400 sm:p-6 dark:border-gray-700/80 dark:bg-gray-800/60 dark:hover:border-purple-500"
                >
                  <span class="flex flex-wrap items-baseline justify-between gap-2">
                    <span class="text-base font-semibold text-gray-950 dark:text-gray-50">
                      {page.title}
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {page.id === "icons"
                        ? labels.iconCount(iconNames.length)
                        : count > 0
                        ? labels.cardCount(count)
                        : labels.examplesComing}
                    </span>
                  </span>
                  <span class="font-mono text-xs text-purple-700 dark:text-purple-300">
                    {page.packageName}
                  </span>
                  <span class="text-sm text-gray-600 dark:text-gray-300">
                    <InlineMarkdown text={page.summary} />
                  </span>
                </a>
              </li>
            )
          })}
        </Grid>
      </Section>

      <CatalogInstructions />
    </Stack>
  )
}

/**
 * How a card spans the page's grid: a wide card the whole row, and a normal card half of it, except
 * the last of an odd run of normal cards, which takes the whole row so the grid has no hole. A card
 * that says nothing about its width (`wide` left out, in a section not yet laid out by hand) is
 * widened by the grid's fallback rule when its demo holds a table or a menu.
 *
 * @param demos The section's cards, in order.
 * @returns One span per card: `"full"` or `"half"`.
 */
export function cardSpans(demos: readonly Pick<Demo, "wide">[]): ("full" | "half")[] {
  const spans: ("full" | "half")[] = demos.map((demo) => demo.wide ? "full" : "half")
  let run = 0
  for (let index = 0; index <= demos.length; index++) {
    if (index < demos.length && spans[index] === "half") {
      run++
      continue
    }
    if (run % 2 === 1) spans[index - 1] = "full"
    run = 0
  }
  return spans
}

/** One package's page: its header, then its sections, the gallery, or a note that it has none. */
function PackagePage(
  { page, nested, registry, copy, labels, extra }: {
    page: GuidePage
    /** Rendered inside the `all` page, under its overview: the page heading is an `h2` there. */
    nested: boolean
    registry: PartialDemoRegistry
    copy?: (text: string) => void | Promise<void>
    labels: Labels
    /** The host's own content for this page, after the cards. */
    extra: ComponentChildren
  },
) {
  const single = page.sections.length === 1
  const Heading = nested ? "h2" : "h1"
  const SectionHeading = nested ? "h3" : "h2"
  return (
    <div id={nested ? `page-${page.id}` : undefined} class="flex flex-col gap-12">
      <header class="flex flex-col gap-4 border-b border-gray-200 pb-8 dark:border-gray-800">
        <p class="font-mono text-sm text-purple-700 dark:text-purple-300">{page.packageName}</p>
        <Heading class="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl dark:text-gray-50">
          {page.title}
        </Heading>
        <p class="max-w-prose text-base text-gray-600 sm:text-lg dark:text-gray-300">
          <InlineMarkdown text={page.blurb} />
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
        const spans = cardSpans(demos.map(([, demo]) => demo))

        return (
          <section key={section.id} id={section.id} class="flex scroll-mt-16 flex-col gap-6">
            <div
              class={cn(
                "flex flex-col gap-1",
                // Kept for the outline, hidden where it would repeat the page's own heading.
                (single || section.title === page.title) && "sr-only",
              )}
            >
              <SectionHeading class="text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
                {section.title}
              </SectionHeading>
              <p class="max-w-prose text-sm text-gray-600 dark:text-gray-300">
                <InlineMarkdown text={section.blurb} />
              </p>
            </div>
            <div class="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @2xl:[&>article[data-card-size=auto]:has([data-card-part=demo]_:is(table,[role=menu]))]:col-span-2">
              {demos.map(([name, demo], index) => {
                // A class card is headed by its own title and lists the classes it applies, an
                // example card by its title with its code open; a component card is headed by the
                // component.
                const classDemo = section.kind === "class" ? classDemos[name] : undefined
                return (
                  <DemoCard
                    key={name}
                    name={name}
                    label={cardLabel(name)}
                    title={cardTitle(section, name)}
                    summary={demo.summary}
                    description={demo.description}
                    snippet={demo.snippet}
                    classes={classDemo?.classes}
                    usageOpen={section.kind === "example"}
                    wide={demo.wide ?? (section.kind === "example" ? false : undefined)}
                    props={demo.props}
                    labels={labels.card}
                    copy={copy}
                    class={spans[index] === "full" ? "@2xl:col-span-2" : undefined}
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
