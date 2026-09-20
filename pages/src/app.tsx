/**
 * The demo's host page — the app shell this library deliberately does not ship.
 *
 * Everything stateful lives in its own component, and the catalogue is a sibling of all of them:
 * nothing the navigation or the colour-scheme toggle does can re-render the guide, so the DOM the
 * deep links mark up is exactly the DOM that hydration produced.
 */

import { IconGitHub } from "@preact-components/icons"
import { buttonClasses } from "@preact-components/ui/button"
import { copyToClipboard } from "@preact-components/ui/copy-button"
import { iconNames, UIGuide } from "@preact-components/ui-guide"
import {
  catalogueNames,
  catalogueSections,
  classDemoNames,
  type DemoedName,
  demoRegistry,
  packageIds,
} from "@preact-components/ui-guide/registry"
import { demoHref, parseRoute, routeHref } from "@preact-components/ui-guide/routes"
import { cn } from "@preact-components/signals/cn"
import { useEffect, useState } from "preact/hooks"
import { demoElementId } from "./deep-link.ts"
import { PAGE_TITLE, REPOSITORY } from "./site.ts"

/** Storage key shared with the bootstrap script in `<head>` (`document.ts`). */
const THEME_KEY = "pc-theme"

/** How long a chip reports "copied" before it goes back to "copy". */
const COPIED_FEEDBACK_MS = 1600

/**
 * Clipboard port handed to the catalogue, and used by the chip row.
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
      <main class="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        <Intro />
        <ComponentIndex />
      </main>
      <UIGuide copy={copyText} />
      <SiteFooter />
    </div>
  )
}

/** Title, links and the colour-scheme switch. */
function SiteHeader() {
  return (
    <header class="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <a
          href="#top"
          class="font-mono text-sm font-semibold text-purple-900 dark:text-purple-300"
        >
          preact-components
        </a>
        <span class="text-sm text-gray-500 dark:text-gray-400">live UI guide</span>
        <div class="ml-auto flex items-center gap-2">
          <a
            href={REPOSITORY}
            class={buttonClasses("outline", "sm")}
            rel="noreferrer"
          >
            <IconGitHub class="size-4" />
            <span>Source</span>
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

/** What the page is, in two sentences, generated from the modules themselves. */
function Intro() {
  return (
    <section class="space-y-3">
      <h1 class="h1">The whole library, running in your browser</h1>
      <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-300">
        {catalogueNames.length} live demos — components from{" "}
        <code>{`@preact-components/{${packageIds.join(", ")}}`}</code> and {classDemoNames.length}
        {" "}
        cards of <code>theme/</code> classes — plus {iconNames.length} icons from{" "}
        <code>@preact-components/icons</code>, with the JSX next to each. Nothing here is a
        screenshot: the dropdowns open, the switches report through their ports, the icon filter
        runs in the page, every usage block copies.
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        <code class="rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-800">
          {`import { Badge } from "@preact-components/ui"`}
        </code>
      </p>
    </section>
  )
}

/**
 * The navigation: one chip per component, in the sections the catalogue renders, across packages.
 *
 * It owns the hash routes, because it is also what writes them: each chip links to the canonical
 * `#/<section>/<demo>` (the legacy `#<demo>` still resolves, and `#top`/`#icons` are left to the
 * browser), and the section headings link to `#/<section>`. On load and on every `hashchange`
 * {@link parseRoute} turns `location.hash` into a route: a demo route marks that card
 * ({@link demoElementId}, outlined by `styles.css`) and scrolls it into view, a section route scrolls
 * the section, and the index route — an empty or unknown hash — clears the mark and does nothing else,
 * so the browser keeps its own anchors. `document.title` follows the route.
 *
 * What the effect does not do is hide the other sections: the document is prerendered whole, so a
 * reader without JavaScript gets the whole catalogue, and which sections an active route *shows* is
 * the visual pass's decision, not the route model's.
 */
function ComponentIndex() {
  const [active, setActive] = useState<DemoedName | undefined>(undefined)
  const [copied, setCopied] = useState<DemoedName | undefined>(undefined)

  useEffect(() => {
    const applyRoute = () => {
      const route = parseRoute(location.hash)
      const name = route.kind === "demo" ? route.name : undefined
      setActive(name)
      document.title = name
        ? `${name} — ${PAGE_TITLE}`
        : route.kind === "section"
        ? `${route.title} — ${PAGE_TITLE}`
        : PAGE_TITLE

      for (const marked of document.querySelectorAll("[data-deep-link]")) {
        marked.removeAttribute("data-deep-link")
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
    }

    applyRoute()
    globalThis.addEventListener("hashchange", applyRoute)
    return () => globalThis.removeEventListener("hashchange", applyRoute)
  }, [])

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
    <nav aria-label="Components" class="space-y-4">
      <h2 class="h2">Jump to a demo</h2>
      {catalogueSections.map((section) => (
        <div key={section.id} class="space-y-2">
          <h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            <a href={routeHref(section.id)} class="hover:underline">{section.title}</a>
          </h3>
          <ul class="flex flex-wrap gap-2">
            {section.names.map((name) => (
              <li
                key={name}
                class={cn(
                  "flex items-stretch overflow-hidden rounded-md border",
                  active === name
                    ? "border-purple-900 dark:border-purple-400"
                    : "border-gray-200 dark:border-gray-700",
                )}
              >
                <a
                  href={demoHref(section.id, name)}
                  aria-current={active === name ? "true" : undefined}
                  class={cn(
                    "px-2 py-1 font-mono text-xs",
                    active === name
                      ? "bg-purple-900 text-purple-50 dark:bg-purple-700"
                      : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
                  )}
                >
                  {name}
                </a>
                <button
                  type="button"
                  onClick={() => copySnippet(name)}
                  title={`Copy the <${name} /> snippet`}
                  aria-label={`Copy the ${name} snippet`}
                  class="border-l border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  {copied === name ? "copied" : "copy"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Every chip is a hash route — <code>{demoHref("badges", "Badge")}</code>,{" "}
        <code>{demoHref("inputs", "ToggleSwitch")}</code>{" "}
        and friends open this page at that demo, outlined and scrolled to; the section headings open
        the section on its own, and the old bare fragments (<code>#toggle-switch</code>) still
        resolve. <em>copy</em> puts a snippet's JSX on the clipboard.
      </p>
    </nav>
  )
}

/** Where the library lives and what the demo is built from. */
function SiteFooter() {
  return (
    <footer class="border-t border-gray-200 py-8 dark:border-gray-700">
      <div class="mx-auto max-w-5xl space-y-2 px-4 text-xs text-gray-500 sm:px-6 dark:text-gray-400">
        <p>
          Prerendered with <code>preact-render-to-string</code>{" "}
          and hydrated with one Preact island. Styled with{" "}
          <code>theme/preset.css</code>, the same stylesheet an app imports.
        </p>
        <p>
          <a class="link" href={REPOSITORY} rel="noreferrer">github.com/spy4x/preact-components</a>
        </p>
        <p>
          Design, original markup, CSS and Tailwind by{" "}
          <a class="link" href="https://github.com/Eirene" rel="noreferrer">Eirene</a>{" "}
          (<a class="link" href="https://isorokina.com/" rel="noreferrer">isorokina.com</a>) — the
          extraction into a Preact + signals package is this repository's work.
        </p>
      </div>
    </footer>
  )
}
