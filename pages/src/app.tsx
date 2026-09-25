/**
 * The demo's host page — the app shell this library deliberately does not ship.
 *
 * A sticky header, the guide, a footer. The guide (`UIGuide`) owns everything between: its side
 * navigation, one page at a time, and the deep links that mark and scroll to a card. What the host
 * adds is what only it knows — the address, read from `location.hash` and handed in as a prop, and
 * the document's title, set from the route the guide reports.
 *
 * The signals page carries two demos that are not cards, because each needs a page that owns an
 * address: {@link UrlFilterDemo}, `useUrlFilters` bound directly to filter signals, and
 * {@link DataTableSortDemo}, the same hook underneath `DataTable`'s own `sort` prop.
 */

import { IconGitHub } from "@preact-components/icons"
import { buttonClasses } from "@preact-components/ui/button"
import { copyToClipboard } from "@preact-components/ui/copy-button"
import { type GuideRouteChange, UIGuide } from "@preact-components/ui-guide"
import { useEffect, useState } from "preact/hooks"
import { DataTableSortDemo } from "./data-table-sort.tsx"
import { PAGE_TITLE, REPOSITORY } from "./site.ts"
import { UrlFilterDemo } from "./url-filters.tsx"

/** Storage key shared with the bootstrap script in `<head>` (`document.tsx`). */
const THEME_KEY = "pc-theme"

/**
 * Clipboard port handed to the catalogue.
 *
 * The library's own helper, so the legacy `execCommand` path is not reimplemented here.
 *
 * @param text Text to place on the clipboard.
 */
const copyText = (text: string): void => copyToClipboard(text)

/** Props of {@link App}. */
export interface AppProps {
  /**
   * The hash to render as if the address carried it. Only a server render passes one — the build's
   * and `verify`'s static renders of every page; the island leaves it out and reads `location`.
   */
  initialHash?: string
}

/**
 * The page.
 *
 * Prerendered by `src/prerender.tsx` and hydrated by `src/+main.tsx` — the same component, so the
 * markup on the wire and the island's first render are the same tree.
 *
 * @param props See {@link AppProps}.
 */
export function App({ initialHash }: AppProps) {
  const hash = useHash(initialHash)

  useEffect(() => {
    // The island's boot marker. `verify.ts` asserts it, which is how the check tells "hydrated" from
    // "the script was fetched and threw".
    document.documentElement.dataset.hydrated = "true"
  }, [])

  return (
    <div id="top" class="min-h-dvh">
      <SiteHeader />
      <main class="mx-auto max-w-7xl px-4 sm:px-6">
        <UIGuide
          hash={hash}
          copy={copyText}
          onRouteChange={titleDocument}
          pageExtras={{
            signals: (
              <div class="space-y-10">
                <UrlFilterDemo />
                <DataTableSortDemo />
              </div>
            ),
          }}
        />
      </main>
      <SiteFooter />
    </div>
  )
}

/**
 * Title the document after the route the guide shows: the card, the section, or the page.
 *
 * @param change What the guide reports once it has shown a route.
 */
function titleDocument({ route, page }: GuideRouteChange): void {
  document.title = route.kind === "demo"
    ? `${route.name} — ${PAGE_TITLE}`
    : route.kind === "section"
    ? `${route.title} — ${PAGE_TITLE}`
    : page.id === "overview"
    ? PAGE_TITLE
    : `${page.title} — ${PAGE_TITLE}`
}

/**
 * `location.hash`, re-read on every `hashchange`.
 *
 * `undefined` until the first effect runs, which is what makes the prerendered markup and the
 * island's first render the same tree: the server has no `location`, so both render the overview,
 * and the effect then hands the guide the route the URL actually names.
 *
 * @param initialHash What to answer before the first read; see {@link AppProps.initialHash}.
 * @returns The current hash, or `undefined` before the first read.
 */
function useHash(initialHash?: string): string | undefined {
  const [hash, setHash] = useState<string | undefined>(initialHash)

  useEffect(() => {
    const read = () => setHash(location.hash)
    read()
    globalThis.addEventListener("hashchange", read)
    return () => globalThis.removeEventListener("hashchange", read)
  }, [])

  return hash
}

/**
 * Title, links and the colour-scheme switch.
 *
 * One fixed-height row — `h-14` — because the guide's own sticky rows stick under it at
 * `--ui-guide-top` (`styles.css`): a header that grew a second row at narrow widths (the tagline
 * wrapping) would leave them sliding under it. The tagline is dropped below `sm` instead, which is
 * what keeps the row to one line at 375px.
 */
function SiteHeader() {
  return (
    <header class="sticky top-0 z-30 h-14 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <div class="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <a
          href="#/"
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
