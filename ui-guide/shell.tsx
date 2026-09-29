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
import { buttonClasses } from "@spy4x/preact-ui/button"
import { Stack } from "@spy4x/preact-ui/layout"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks"
import { DEFAULT_CARD_LABELS, DemoCard, type DemoCardLabels, MissingDemoBanner } from "./card.tsx"
import { type GuideAuthor, GuideFooter } from "./footer.tsx"
import { IconGallery } from "./icons.tsx"
import { InlineMarkdown } from "./markdown.tsx"
import {
  DEFAULT_WHY,
  defaultCardCount,
  defaultIconCount,
  defaultStats,
  Overview,
  type OverviewTotals,
  type WhyFact,
  type WhyFactId,
} from "./overview.tsx"
import { type MapTiles, MapTilesContext, OPENSTREETMAP_TILES } from "./map-tiles.ts"
import {
  cardLabel,
  type CatalogueSection,
  classDemos,
  type Demo,
  demoRegistry,
  type GuidePage,
  type GuidePageId,
  guidePages,
  missingDemos,
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
  { id: "start", pages: ["overview"] },
  { id: "packages", pages: ["ui", "icons", "theme", "charts", "map", "system", "crud"] },
] as const satisfies readonly { id: string; pages: readonly GuidePageId[] }[]

/** Identifier of one navigation group. */
export type NavGroupId = (typeof navGroups)[number]["id"]

/** Every string the shell prints that is not catalogue data. Each has an English default. */
export interface UIGuideLabels {
  /** The library's name: the header's, the overview's eyebrow and the footer's. Defaults to `"preact-components"`. */
  title?: string
  /** The overview's heading: what the library is, in one line. */
  headline?: string
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
  /**
   * The header's repository link: its accessible name, and its words from `xl`. Defaults to
   * `"Star on GitHub"`.
   */
  repository?: string
  /** The overview's repository button. Defaults to `"Star on GitHub"`. */
  star?: string
  /** The author link, in the header from `xl` and in the footer. Defaults to `"Made by <name>"`. */
  madeBy?: (name: string) => string
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
  /** The heading over the overview's live mini app. Defaults to `"See it in an app"`. */
  exampleHeading?: string
  /** The mini app card's title. Defaults to `"A dashboard, built from the library"`. */
  exampleTitle?: string
  /** The mini app card's sentence, in inline Markdown. */
  exampleSummary?: string
  /** The mini app's copy control. Defaults to `"Copy the dashboard's code"`. */
  copyExample?: string
  /** The heading over the overview's "why" strip. Defaults to `"Why preact-components"`. */
  whyHeading?: string
  /** The "why" strip's facts, each a title and a sentence in inline Markdown. */
  why?: Partial<Record<WhyFactId, WhyFact>>
  /** The heading over "Get started". Defaults to `"Get started"`. */
  startHeading?: string
  /** The sentence under it. */
  startLead?: string
  /** The first step's title: the styles. Defaults to `"Add the styles"`. */
  startStyles?: string
  /** The first step's sentence, in inline Markdown. */
  startStylesBody?: string
  /** The theme install command's copy control. Defaults to `"Copy the theme install command"`. */
  copyThemeInstall?: string
  /** The link to the theme's README. Defaults to `"How to build the stylesheet"`. */
  themeReadme?: string
  /** The second step's title: a component in use. Defaults to `"Use a component"`. */
  startUse?: string
  /** The second step's sentence, in inline Markdown. */
  startUseBody?: string
  /** The usage snippet's copy control. Defaults to `"Copy the usage example"`. */
  copyUsage?: string
  /** The third step's title: the documentation. Defaults to `"Read on"`. */
  startRead?: string
  /** The third step's sentence, in inline Markdown. */
  startReadBody?: string
  /** The link to `docs/usage.md`. Defaults to `"Install and use"`. */
  usageDoc?: string
  /** A package's README link. Defaults to `"<package> README"`. */
  readme?: (packageName: string) => string
  /** The line beside the footer's name. */
  footerNote?: string
  /** The footer's repository link. Defaults to `"Source on GitHub"`. */
  sourceCode?: string
  /** The footer's link to the packages on JSR. Defaults to `"Packages on JSR"`. */
  jsr?: string
  /** The footer's licence link. Defaults to `"MIT licence"`. */
  licence?: string
  /** The words before the design credit's link. Defaults to `"Design system by"`. */
  designBy?: string
  /** The overview's install command's copy control. Defaults to `"Copy the install command"`. */
  copyInstall?: string
  /** The overview's package grid heading. Defaults to `"Packages"`. */
  packagesHeading?: string
  /**
   * The overview's line of totals, every one computed from the registry. Defaults to
   * `"<components> components · <icons> icons · <packages> packages"`.
   */
  stats?: (totals: OverviewTotals) => string
  /** An overview card's count of live cards. Defaults to `"<count> cards"`, and `"1 card"`. */
  cardCount?: (count: number) => string
  /** The icons page's overview card. Defaults to `"<count> icons"`. */
  iconCount?: (count: number) => string
  /** An overview card for a package with no card in the registry. Defaults to `"Examples coming"`. */
  examplesComing?: string
}

const DEFAULT_LABELS:
  & Required<Omit<UIGuideLabels, "navGroups" | "searchKinds" | "card" | "why">>
  & {
    navGroups: Record<NavGroupId, string>
    searchKinds: SearchKindWords
    card: DemoCardLabels
    why: Record<WhyFactId, WhyFact>
  } = {
    title: "preact-components",
    headline: "Preact components that render on the server and work from the keyboard.",
    tagline:
      "Components, charts, Tailwind styles and icons for Deno apps. Every one runs live in this guide, with its code one click away.",
    nav: "Guide",
    openNav: "Menu",
    closeNav: "Close the guide navigation",
    navGroups: {
      start: "Start here",
      packages: "Packages",
    },
    comingSoon:
      "Runnable examples for this package are coming. Its README documents it until then.",
    skipToContent: "Skip to content",
    search: "Search",
    searchPlaceholder: "Search components…",
    searchEmpty: "Nothing matches that name.",
    closeSearch: "Close the search",
    searchKinds: { page: "Page", component: "Component", classes: "Classes" },
    searchGuidePlace: "Guide",
    card: DEFAULT_CARD_LABELS,
    repository: "Star on GitHub",
    star: "Star on GitHub",
    madeBy: (name) => `Made by ${name}`,
    onThisPage: "On this page",
    switchToDark: "Switch to dark mode",
    switchToLight: "Switch to light mode",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    browse: "Browse components",
    exampleHeading: "See it in an app",
    exampleTitle: "A dashboard, built from the library",
    exampleSummary:
      "Every part of this frame is a component from these packages, running on local state: filter and sort the projects, run the checks for a toast, add a project in the dialog. The header's switches repaint it.",
    copyExample: "Copy the dashboard's code",
    copyInstall: "Copy the install command",
    whyHeading: "Why preact-components",
    why: DEFAULT_WHY,
    startHeading: "Get started",
    startLead: "The command above installs the components. Two more steps and a page renders.",
    startStyles: "Add the styles",
    startStylesBody:
      "Components render against the theme's tokens and classes, compiled by Tailwind into your stylesheet.",
    copyThemeInstall: "Copy the theme install command",
    themeReadme: "How to build the stylesheet",
    startUse: "Use a component",
    startUseBody:
      "Import it, pass props. It renders on the server and hydrates in the browser like any Preact component.",
    copyUsage: "Copy the usage example",
    startRead: "Read on",
    startReadBody:
      "Each package's README lists every component and helper it exports, with its props.",
    usageDoc: "Install and use",
    readme: (packageName) => `${packageName} README`,
    footerNote: "— open-source Preact components for Deno apps.",
    sourceCode: "Source on GitHub",
    jsr: "Packages on JSR",
    licence: "MIT licence",
    designBy: "Design system by",
    packagesHeading: "Packages",
    stats: defaultStats,
    cardCount: defaultCardCount,
    iconCount: defaultIconCount,
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
  /**
   * The repository the header, the overview and the footer link to ("Star on GitHub"), and the
   * base of the overview's README and licence links. Left out, there is no repository link, and the
   * README links go to each package's page on JSR.
   */
  repository?: string
  /**
   * Who made the library: the header (from `xl`) and the footer link to them as "Made by <name>".
   * Left out, neither does.
   */
  author?: GuideAuthor
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
  /**
   * The tile provider the Map card draws with. Defaults to OpenStreetMap's standard tiles and their
   * credit line (`OPENSTREETMAP_TILES`).
   */
  mapTiles?: MapTiles
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
    author,
    install = "deno add jsr:@spy4x/preact-ui",
    colorScheme,
    actions,
    contentAs: Content = "div",
    mapTiles = OPENSTREETMAP_TILES,
    class: className,
  }: UIGuideProps,
): JSX.Element {
  const labels: Labels = {
    ...DEFAULT_LABELS,
    ...labelOverrides,
    navGroups: { ...DEFAULT_LABELS.navGroups, ...labelOverrides?.navGroups },
    searchKinds: { ...DEFAULT_LABELS.searchKinds, ...labelOverrides?.searchKinds },
    card: { ...DEFAULT_LABELS.card, ...labelOverrides?.card },
    why: { ...DEFAULT_LABELS.why, ...labelOverrides?.why },
  }
  const route = parseRoute(hash ?? "")

  // A route that names no page keeps the one showing. Held in a ref rather than state: it is
  // derived during render from the route and its own last value, and never re-renders anything.
  // Before the host has read the address, the guide renders every page at once: the served
  // document, for a reader without JavaScript and for hydration to match. That is no page — it has
  // no route and no navigation entry — so nothing is kept: a first route that names none opens the
  // overview.
  const served = hash === undefined
  const shownPage = useRef<GuidePageId>("overview")
  if (!served) shownPage.current = pageOfRoute(route) ?? pageOfFragment(hash) ?? shownPage.current
  const page = guidePages.find((candidate) => candidate.id === shownPage.current) ?? guidePages[0]

  const [navOpen, setNavOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  const contentId = useId()
  const content = useRef<HTMLElement>(null)
  const scrolledPage = useRef<GuidePageId | undefined>(undefined)
  const inView = useCardInView(!served, page.id)
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

    // The first route read replaces the served document with one page, which is not a page change
    // a reader made. It starts where the address points, or at the top: the server sent the longer
    // document of every page, so a position the browser restored would land somewhere unrelated.
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
      // element was not on the page yet — a page switched to hold it, or a fresh load whose served
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
  // The overview and the served document have no "On this page" column: their content takes its
  // place.
  const listed = !served && page.id !== "overview"

  return (
    <MapTilesContext.Provider value={mapTiles}>
      <div class={cn("ui-guide w-full", className)} data-guide-page={served ? "all" : page.id}>
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
            target.addEventListener("blur", () => target.removeAttribute("tabindex"), {
              once: true,
            })
            target.focus()
            target.scrollIntoView({ block: "start" })
          }}
          class="sr-only rounded-md bg-surface px-3 py-2 text-sm font-medium text-purple-900 shadow focus:not-sr-only focus:absolute focus:z-50 focus:px-3 focus:py-2 dark:text-purple-200"
          data-e2e="ui-guide-skip"
        >
          {labels.skipToContent}
        </a>

        <header class="sticky top-0 z-30 h-14 border-b border-subtle bg-surface-overlay backdrop-blur">
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
              class="flex min-w-0 items-center gap-2 font-semibold text-foreground"
            >
              <span class="truncate">{labels.title}</span>
              {version
                ? (
                  <span class="hidden rounded-full bg-canvas px-2 text-xs font-medium text-muted sm:inline">
                    v{version}
                  </span>
                )
                : null}
            </a>
            <div class="ml-auto flex items-center gap-2">
              <GuideSearch entries={entries} labels={labels} go={go} />
              {author
                ? (
                  <a
                    href={author.href}
                    rel="noreferrer"
                    class="hidden text-sm text-muted hover:text-foreground xl:inline"
                    data-e2e="ui-guide-author"
                  >
                    {labels.madeBy(author.name)}
                  </a>
                )
                : null}
              {repository
                ? (
                  <a
                    href={repository}
                    rel="noreferrer"
                    aria-label={labels.repository}
                    title={labels.repository}
                    class={buttonClasses("ghost", "sm")}
                    data-e2e="ui-guide-repository"
                  >
                    <IconGitHub class="size-5" />
                    <span class="hidden xl:inline">{labels.repository}</span>
                  </a>
                )
                : null}
              {colorScheme ? <ThemeSwitch scheme={colorScheme} labels={labels} /> : null}
              {actions}
            </div>
          </div>
        </header>

        <div class="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:px-8 xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
          <aside class="hidden lg:sticky lg:top-14 lg:block lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:py-8">
            <GuideNav
              label={labels.nav}
              labels={labels}
              page={served ? undefined : page}
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
            class="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none overflow-y-auto border-r border-subtle bg-surface p-0 text-foreground shadow-xl backdrop:bg-scrim backdrop:backdrop-blur-sm"
          >
            <div class="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-subtle bg-surface px-4">
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
            <p class="sr-only" aria-live="polite">{served ? labels.title : page.title}</p>
            <Stack gap="2xl">
              {missing.length > 0 ? <MissingDemoBanner names={missing} /> : null}
              {(served ? guidePages : [page]).map((shown) =>
                shown.id === "overview"
                  ? (
                    <Overview
                      key={shown.id}
                      labels={labels}
                      registry={registry}
                      follow={follow}
                      install={install}
                      repository={repository}
                      copy={copy}
                    />
                  )
                  : (
                    <PackagePage
                      key={shown.id}
                      page={shown}
                      nested={served}
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
              <div class="hidden xl:sticky xl:top-14 xl:block xl:max-h-[calc(100dvh-3.5rem)] xl:overflow-y-auto xl:py-12">
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
        <GuideFooter labels={labels} repository={repository} author={author} />
      </div>
    </MapTilesContext.Provider>
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
    if (!active || !("IntersectionObserver" in globalThis)) return
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
  /** The page showing; `undefined` in the served document, which marks none. */
  page: GuidePage | undefined
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
 * Every page, in its group, and under the one showing, its sections and cards — under every page
 * in the served document, which shows them all.
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
            <p class="px-3 pb-1 text-xs font-semibold text-muted">
              {labels.navGroups[group.id]}
            </p>
            <ul>
              {group.pages.map((id) => {
                const candidate = guidePages.find((each) => each.id === id)
                if (!candidate) return null
                const current = candidate.id === page?.id
                // The served document shows every page, so its navigation lists every page's
                // sections and cards: the links a reader without JavaScript has.
                const expanded = current || page === undefined
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
                          ? "bg-selected-soft font-semibold text-selected"
                          : "text-muted hover:bg-hover hover:text-foreground",
                      )}
                    >
                      {candidate.title}
                    </a>
                    {expanded && candidate.sections.length > 0
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
    <li class="border-l border-subtle">
      {titled
        ? (
          <a
            href={sectionHref}
            aria-current={route.kind === "section" && route.sectionId === section.id
              ? "true"
              : undefined}
            onClick={(event) => follow(sectionHref, event)}
            class="-ml-px block border-l border-transparent px-3 py-1 font-medium text-foreground hover:border-strong aria-[current]:border-selected aria-[current]:font-semibold aria-[current]:text-selected"
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
                    ? "border-selected font-semibold text-selected"
                    : "border-transparent text-muted hover:border-strong hover:text-foreground",
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
 * class card.
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
      <p class="pb-2 text-xs font-semibold text-muted">{label}</p>
      <ul class="flex flex-col gap-4">
        {sections.map((section) => (
          <li key={section.id}>
            {sections.length > 1
              ? (
                <a
                  href={routeHref(section.id)}
                  onClick={(event) => follow(routeHref(section.id), event)}
                  class="block pb-1 font-medium text-foreground hover:text-selected"
                >
                  {section.title}
                </a>
              )
              : null}
            <ul class="border-l border-subtle">
              {section.names.filter((name) => name in registry).map((name) => {
                const href = demoHref(section.id, name)
                return (
                  <li key={name}>
                    <a
                      href={href}
                      aria-current={inView === name ? "location" : undefined}
                      onClick={(event) => follow(href, event)}
                      class="-ml-px block border-l border-transparent py-1 pl-3 [overflow-wrap:anywhere] text-muted hover:text-foreground aria-[current]:border-selected aria-[current]:font-medium aria-[current]:text-selected"
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
    /** Rendered in the served document, under the overview: the page heading is an `h2` there. */
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
      <header class="flex flex-col gap-4 border-b border-subtle pb-8">
        <p class="font-mono text-sm text-purple-700 dark:text-purple-300">{page.packageName}</p>
        <Heading class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {page.title}
        </Heading>
        <p class="max-w-prose text-base text-muted sm:text-lg">
          <InlineMarkdown text={page.blurb} />
        </p>
      </header>

      {page.id === "icons" ? <IconGallery copy={copy} /> : null}
      {page.id !== "icons" &&
          page.sections.every((section) => section.names.every((name) => !(name in registry)))
        ? <p class="text-sm text-muted">{labels.comingSoon}</p>
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
              <SectionHeading class="text-2xl font-semibold tracking-tight text-foreground">
                {section.title}
              </SectionHeading>
              <p class="max-w-prose text-sm text-muted">
                <InlineMarkdown text={section.blurb} />
              </p>
            </div>
            <div
              class={cn(
                "grid grid-cols-1 gap-4 @2xl:grid-cols-2 @2xl:[&>article[data-card-size=auto]:has([data-card-part=demo]_:is(table,[role=menu]))]:col-span-2",
              )}
            >
              {demos.map(([name, demo], index) => {
                // A class card is headed by its own title and lists the classes it applies; a
                // component card is headed by the component.
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
                    wide={demo.wide}
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
