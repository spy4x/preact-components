/**
 * The demo's host page — the app shell this library deliberately does not ship.
 *
 * The page reads as a designed multipage document rather than one long scroll: a sticky header, a
 * sticky route bar that names the route the reader is on, a rail that lists the catalogue's sections
 * with their demos beneath them, and the catalogue itself in the content column beside the rail.
 *
 * Everything stateful lives in its own component, and the catalogue is a sibling of all of them:
 * nothing the navigation, the route bar or the colour-scheme toggle does can re-render the guide, so
 * the DOM the deep links mark up is exactly the DOM that hydration produced. The route bar and the
 * rail each derive the route from {@link parseRoute} themselves — the resolver is pure and cheap, and
 * neither then has to be handed state by the other — and the rail, which is also what writes the
 * URLs, is the one that owns the effect that marks, scrolls and titles.
 */

import { IconGitHub } from "@preact-components/icons"
import { buttonClasses } from "@preact-components/ui/button"
import { copyToClipboard } from "@preact-components/ui/copy-button"
import { iconNames, UIGuide } from "@preact-components/ui-guide"
import {
  catalogueNames,
  type CatalogueSection,
  catalogueSections,
  classDemoNames,
  type DemoedName,
  demoRegistry,
  packageIds,
} from "@preact-components/ui-guide/registry"
import {
  demoHref,
  parseRoute,
  routeHref,
  type RouteMatch,
} from "@preact-components/ui-guide/routes"
import { cn } from "@preact-components/signals/cn"
import { useEffect, useState } from "preact/hooks"
import { demoElementId } from "./deep-link.ts"
import { PAGE_TITLE, REPOSITORY } from "./site.ts"

/** Storage key shared with the bootstrap script in `<head>` (`document.ts`). */
const THEME_KEY = "pc-theme"

/** How long a chip reports "copied" before it goes back to "copy". */
const COPIED_FEEDBACK_MS = 1600

/** The rail's DOM id: the target of the route bar's own section list on narrow screens. */
const RAIL_ID = "sections"

/**
 * Clipboard port handed to the catalogue, and used by the rail's own copy chips.
 *
 * The library's own helper, so the legacy `execCommand` path is not reimplemented here and the two
 * ways to copy a snippet — the chip and the usage block's own button — behave the same.
 *
 * @param text Text to place on the clipboard.
 */
const copyText = (text: string): void => copyToClipboard(text)

/**
 * The page.
 *
 * Prerendered by `src/prerender.tsx` and hydrated by `src/+main.tsx` — the same component, so the
 * markup on the wire and the island's first render are the same tree.
 */
export function App() {
  useEffect(() => {
    // The island's boot marker. `verify.ts` asserts it, which is how the check tells "hydrated" from
    // "the script was fetched and threw".
    document.documentElement.dataset.hydrated = "true"
  }, [])

  return (
    <div id="top" class="min-h-dvh">
      <SiteHeader />
      <main class="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <Intro />
        <RouteBar />
        <div class="guide-columns grid grid-cols-1 items-start gap-6 pt-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-8 lg:gap-y-0">
          <GuideRail />
          <UIGuide copy={copyText} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/**
 * Title, links and the colour-scheme switch.
 *
 * One fixed-height row — `h-14` — because the route bar below it sticks at `top-14` and the rest of
 * the layout is measured off that stack: a header that grew a second row at narrow widths (the
 * tagline wrapping) would leave the route bar sliding under it. The tagline is dropped below `sm`
 * instead, which is what keeps the row to one line at 375px.
 */
function SiteHeader() {
  return (
    <header class="sticky top-0 z-30 h-14 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <div class="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <a
          href="#top"
          class="font-mono text-sm font-semibold text-purple-900 dark:text-purple-300"
        >
          preact-components
        </a>
        <span class="hidden text-sm text-gray-500 sm:inline dark:text-gray-400">
          live UI guide
        </span>
        <div class="ml-auto flex items-center gap-2">
          <a
            href={REPOSITORY}
            class={buttonClasses("outline", "sm")}
            rel="noreferrer"
          >
            <IconGitHub class="size-4" />
            <span class="hidden sm:inline">Source</span>
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

/**
 * Light/dark switch.
 *
 * The class on `<html>` is set by the inline script in `<head>` before first paint; this reads it
 * back in an effect, so the island's first render still matches the prerendered button.
 */
function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light")
    } catch {
      // Storage blocked (private mode): the palette still switches for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      title={dark ? "Switch to the light palette" : "Switch to the dark palette"}
      class={buttonClasses("outline", "sm")}
    >
      {dark ? "Light" : "Dark"}
    </button>
  )
}

/**
 * The route `location.hash` currently names, re-derived on every `hashchange`.
 *
 * `undefined` until the first effect runs, which is what makes the prerendered markup and the
 * island's first render the same tree: the server has no `location`, so the first render is the
 * landing route and the effect replaces it with the route the URL actually names.
 *
 * Deliberately a hook rather than a module-level signal: `pages/` is the host app and may own its
 * state, but a singleton here would be state the library's components could not be handed as a prop.
 * Each caller gets its own listener and reads the same pure resolver, so neither component can
 * re-render the catalogue ({@link UIGuide}) on a hash change.
 *
 * @returns The current route, or `undefined` before the first read.
 */
function useRoute(): RouteMatch | undefined {
  const [route, setRoute] = useState<RouteMatch | undefined>(undefined)

  useEffect(() => {
    const read = () => setRoute(parseRoute(location.hash))
    read()
    globalThis.addEventListener("hashchange", read)
    return () => globalThis.removeEventListener("hashchange", read)
  }, [])

  return route
}

/** What the route bar says about the route the reader is on. */
interface Landing {
  /** Which of the four route shapes this is, in one word. */
  eyebrow: string
  /** The section's heading, the component's name, or the index's title. */
  title: string
  /** One line of context: the section blurb, or what the index contains. */
  blurb: string
  /** The count for a section, the canonical URL for a demo. */
  meta: string
}

/**
 * The landing header of a route: what the reader is looking at, in one row.
 *
 * The route is the only input — a section route names its own section, a demo route is resolved
 * against the catalogue so the bar and the card cannot disagree about which section a demo is in.
 *
 * @param route The current route, or `undefined` before the first read.
 * @returns The label, title, blurb and meta the bar renders.
 */
function landingFor(route: RouteMatch | undefined): Landing {
  const demos = catalogueNames.length

  if (route === undefined || route.kind === "index") {
    return {
      eyebrow: "Index",
      title: "All sections",
      blurb: `${catalogueSections.length} sections, ${demos} live demos — the rail lists every ` +
        `section, and every section is its own route.`,
      meta: `${catalogueSections.length} sections · ${demos} demos`,
    }
  }

  const section = catalogueSections.find((candidate) => candidate.id === route.sectionId)

  if (route.kind === "demo") {
    return {
      eyebrow: "Demo",
      title: route.name,
      blurb: section?.blurb ?? "",
      meta: route.href,
    }
  }

  return {
    eyebrow: "Section",
    title: route.title,
    blurb: section?.blurb ?? "",
    meta: `${section?.names.length ?? 0} demos`,
  }
}

/**
 * The per-route landing header: a section's title, blurb and size, the index's contents, or the demo
 * the hash names.
 *
 * Sticky, one fixed row tall, and it sits directly under the header — so a reader who lands mid
 * document on `#/inputs` is told which section they are in instead of meeting a bare `<h2>` that
 * scrolled past. `aria-live="polite"` is the whole reason it is a `<p>` and not a heading: a hash
 * route is not a navigation a screen reader announces, and this is where that announcement comes
 * from. `top-14` is the header's own height (`h-14`), so the two never overlap.
 */
function RouteBar() {
  const landing = landingFor(useRoute())

  return (
    <div
      data-route-landing
      aria-live="polite"
      class="sticky top-14 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <p class="hidden shrink-0 font-mono text-[0.65rem] tracking-widest text-gray-500 uppercase sm:block dark:text-gray-400">
        {landing.eyebrow}
      </p>
      <p class="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
        {landing.title}
      </p>
      <p class="hidden min-w-0 truncate text-sm text-gray-500 lg:block dark:text-gray-400">
        {landing.blurb}
      </p>
      <p class="ml-auto min-w-0 truncate font-mono text-xs text-gray-500 dark:text-gray-400">
        {landing.meta}
      </p>
    </div>
  )
}

/** What the rail needs to mark, and nothing else: the section the route is in, and the demo it names. */
interface RailState {
  /** Section the current route lives in, `undefined` on the landing route. */
  section: string | undefined
  /** Demo the current route names, `undefined` unless the hash is a demo route. */
  demo: DemoedName | undefined
}

/**
 * The rail: every section as a link to its own page, with that section's demos beneath it.
 *
 * The section link is the primary affordance — `#/inputs` is a page — and the demos are secondary:
 * one disclosure per section, closed until the reader opens it, opened by the route effect when the
 * route is in that section. Every demo stays a link in the prerendered document either way, which is
 * what `verify.ts`'s "every emitted route is a link in the prerendered navigation" reads.
 *
 * It owns the hash routes, because it is also what writes them: each link is the canonical
 * `#/<section>/<demo>` (the legacy `#<demo>` still resolves, and `#top`/`#icons` are left to the
 * browser). {@link parseRoute} turns `location.hash` into a route: a demo route marks that card
 * ({@link demoElementId}, outlined by `styles.css`) and scrolls it into view, a section route scrolls
 * the section, and the index route — an empty or unknown hash — clears the mark and does nothing
 * else, so the browser keeps its own anchors. `document.title` follows the route.
 *
 * The effect depends on the route rather than running inside the `hashchange` listener, so it runs
 * after the bar and the rail have re-rendered: the target's own position is final when it is
 * scrolled to, which is what keeps a sticky bar of a shifting height out of the measurement.
 *
 * What the effect does not do is hide the other sections: the document is prerendered whole, so a
 * reader without JavaScript gets the whole catalogue, and the rail — a section list on a phone, a
 * sticky column from `lg` up — is how the reader moves between sections.
 */
function GuideRail() {
  const route = useRoute()
  const [copied, setCopied] = useState<DemoedName | undefined>(undefined)

  const state: RailState = {
    section: route === undefined || route.kind === "index" ? undefined : route.sectionId,
    demo: route?.kind === "demo" ? route.name : undefined,
  }

  useEffect(() => {
    if (route === undefined) return

    const name = route.kind === "demo" ? route.name : undefined
    const sectionId = route.kind === "index" ? undefined : route.sectionId
    document.title = name
      ? `${name} — ${PAGE_TITLE}`
      : route.kind === "section"
      ? `${route.title} — ${PAGE_TITLE}`
      : PAGE_TITLE

    for (const marked of document.querySelectorAll("[data-deep-link]")) {
      marked.removeAttribute("data-deep-link")
    }

    // The active section's demos are the ones on screen, so they are the ones left open. `open` is
    // not a rendered attribute: Preact would then fight a reader who closed the list by hand.
    for (const list of document.querySelectorAll<HTMLDetailsElement>("[data-section-demos]")) {
      list.open = list.dataset.sectionDemos === sectionId
    }

    if (route.kind === "demo") {
      const card = document.getElementById(demoElementId(route.name))
      if (!card) return
      card.setAttribute("data-deep-link", "")
      card.scrollIntoView({ block: "start" })
      return
    }

    if (route.kind === "section") {
      document.getElementById(route.sectionId)?.scrollIntoView({ block: "start" })
    }
  }, [route])

  const copySnippet = (name: DemoedName) => {
    // The same port the catalogue's own copy controls get, so both routes copy identically.
    copyText(demoRegistry[name].snippet)
    setCopied(name)
    setTimeout(
      () => setCopied((current) => (current === name ? undefined : current)),
      COPIED_FEEDBACK_MS,
    )
  }

  return (
    <aside
      id={RAIL_ID}
      class="min-w-0 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto"
    >
      <nav aria-label="Catalogue sections" class="lg:pt-4">
        <h2 class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Sections
        </h2>
        <ol class="mt-2 flex flex-wrap gap-1 lg:mt-3 lg:flex-col lg:gap-0 lg:border-t lg:border-gray-200 lg:dark:border-gray-700">
          {catalogueSections.map((section) => (
            <RailSection
              key={section.id}
              section={section}
              state={state}
              copied={copied}
              copy={copySnippet}
            />
          ))}
        </ol>
        <p class="measure mt-4 text-xs text-gray-500 dark:text-gray-400">
          Each section is a page — <code>{routeHref("inputs")}</code> — and each demo is one too:
          {" "}
          <code>{demoHref("inputs", "ToggleSwitch")}</code>.{" "}
          The old bare fragments (<code>#toggle-switch</code>) still resolve. <em>copy</em>{" "}
          puts a snippet's JSX on the clipboard.
        </p>
      </nav>
    </aside>
  )
}

/** Props of one section in the rail: the section, the route, and the clipboard port. */
interface RailSectionProps {
  section: CatalogueSection
  state: RailState
  /** Demo whose snippet was just copied, so the chip can say so. */
  copied: DemoedName | undefined
  /** Clipboard port the copy chip calls; the rail owns the "copied" feedback. */
  copy: (name: DemoedName) => void
}

/**
 * One section in the rail: its link, and a disclosure holding its demos.
 *
 * The demos are `hidden lg:block` unless the route is in this section: a phone gets the sections as
 * a wrapped row of links and only the active section's demos, and the wide layout gets the whole
 * tree in a sticky column. Both shapes keep every demo link in the document.
 *
 * @param props See {@link RailSectionProps}.
 */
function RailSection({ section, state, copied, copy }: RailSectionProps) {
  const active = state.section === section.id
  const current = active && state.demo === undefined
  const count = section.names.length

  return (
    <li
      class={cn(
        "lg:border-b lg:border-gray-100 lg:py-1 lg:dark:border-gray-800",
        active && "w-full lg:w-auto",
      )}
    >
      <a
        href={routeHref(section.id)}
        aria-current={current ? "page" : undefined}
        data-section-link={section.id}
        title={section.blurb}
        class={cn(
          "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
          "lg:py-1.5 lg:text-sm",
          active
            ? "bg-purple-100 font-medium text-purple-900 dark:bg-purple-900/60 dark:text-purple-50"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
        )}
      >
        <span class="min-w-0 truncate">{section.title}</span>
        <span class="ml-auto hidden font-mono text-[0.65rem] text-gray-500 lg:block dark:text-gray-400">
          <span class="sr-only">{`${count} demos`}</span>
          <span aria-hidden="true">{count}</span>
        </span>
      </a>
      <details
        data-section-demos={section.id}
        class={cn("mt-0.5", active ? "block" : "hidden lg:block")}
      >
        <summary class="cursor-pointer rounded px-2 py-0.5 font-mono text-[0.65rem] text-gray-500 hover:bg-gray-100 lg:ml-2 dark:text-gray-400 dark:hover:bg-gray-800">
          <span class="sr-only">{`Demos in ${section.title}`}</span>
          <span aria-hidden="true">{`${count} demos`}</span>
        </summary>
        <ul class="mt-1 mb-1 space-y-px lg:ml-2">
          {section.names.map((name) => (
            <li key={name} class="flex items-center gap-1">
              <a
                href={demoHref(section.id, name)}
                aria-current={state.demo === name ? "true" : undefined}
                title={`${name} — ${section.title}`}
                class={cn(
                  // The chip's text is exactly the component name: `verify.ts` reads the active
                  // chip's `textContent` to prove the deep link marked the right one.
                  "min-w-0 flex-1 truncate rounded px-2 py-0.5 font-mono text-xs",
                  state.demo === name
                    ? "bg-purple-900 text-purple-50 dark:bg-purple-700 dark:text-purple-50"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                )}
              >
                {name}
              </a>
              <button
                type="button"
                onClick={() => copy(name)}
                title={`Copy the <${name} /> snippet`}
                aria-label={`Copy the ${name} snippet`}
                class="shrink-0 rounded px-1 py-0.5 font-mono text-[0.65rem] text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                {copied === name ? "copied" : "copy"}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

/** What the page is, in two sentences, generated from the modules themselves. */
function Intro() {
  return (
    <section class="py-6">
      <h1 class="h1">The whole library, running in your browser</h1>
      <p class="measure mt-3 text-sm text-gray-600 dark:text-gray-300">
        {catalogueNames.length} live demos — components from{" "}
        <code>{`@preact-components/{${packageIds.join(", ")}}`}</code> and {classDemoNames.length}
        {" "}
        cards of <code>theme/</code> classes — plus {iconNames.length} icons from{" "}
        <code>@preact-components/icons</code>, with the JSX next to each. Nothing here is a
        screenshot: the dropdowns open, the switches report through their ports, the icon filter
        runs in the page, every usage block copies.
      </p>
      <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
        <code class="rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-800">
          {`import { Badge } from "@preact-components/ui"`}
        </code>
      </p>
    </section>
  )
}

/** Where the library lives and what the demo is built from. */
function SiteFooter() {
  return (
    <footer class="border-t border-gray-200 py-8 dark:border-gray-700">
      <div class="mx-auto max-w-7xl space-y-2 px-4 text-xs text-gray-500 sm:px-6 dark:text-gray-400">
        <p class="measure">
          Prerendered with <code>preact-render-to-string</code>{" "}
          and hydrated with one Preact island. Styled with{" "}
          <code>theme/preset.css</code>, the same stylesheet an app imports.
        </p>
        <p class="measure">
          <a class="link" href={REPOSITORY} rel="noreferrer">github.com/spy4x/preact-components</a>
        </p>
        <p class="measure">
          Design, original markup, CSS and Tailwind by{" "}
          <a class="link" href="https://github.com/Eirene" rel="noreferrer">Eirene</a>{" "}
          (<a class="link" href="https://isorokina.com/" rel="noreferrer">isorokina.com</a>) — the
          extraction into a Preact + signals package is this repository's work.
        </p>
      </div>
    </footer>
  )
}
