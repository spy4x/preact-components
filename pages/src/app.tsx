/**
 * The demo's host page — the app shell this library deliberately does not ship.
 *
 * The guide and a footer. The guide — `uiGuideRoute.component`, which is `UIGuide` routed by the
 * address's hash — owns the rest: its header, its side navigation, one page at a time,
 * the deep links that mark and scroll to a card, and reading the address. What the host adds is
 * what only it knows: the hash to render before hydration, the document's title, set from the route
 * the guide reports, and manual scroll restoration, because this page is the whole app and the
 * guide scrolls on its first read itself.
 *
 * The signals page carries two demos that are not cards, because each needs a page that owns an
 * address: {@link UrlFilterDemo}, `useUrlFilters` bound directly to filter signals, and
 * {@link DataTableSortDemo}, the same hook underneath `DataTable`'s own `sort` prop.
 */

import { copyToClipboard } from "@spy4x/preact-ui/copy-button"
import { type ColorSchemePort, type GuideRouteChange, uiGuideRoute } from "@spy4x/preact-ui-guide"
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
  /** The library version the guide's header shows; `build.ts` reads it from the packages. */
  version?: string
}

/**
 * The page.
 *
 * Prerendered by `src/prerender.tsx` and hydrated by `src/+main.tsx` — the same component, so the
 * markup on the wire and the island's first render are the same tree.
 *
 * @param props See {@link AppProps}.
 */
export function App({ initialHash, version }: AppProps) {
  const colorScheme = useColorScheme()
  useEffect(() => {
    // The island's boot marker. `verify.ts` asserts it, which is how the check tells "hydrated" from
    // "the script was fetched and threw".
    document.documentElement.dataset.hydrated = "true"
    history.scrollRestoration = "manual"
  }, [])

  return (
    <div id="top" class="min-h-dvh">
      {/* The one-line mount an app uses: the route's component reads the hash itself. */}
      <uiGuideRoute.component
        hash={initialHash}
        copy={copyText}
        onRouteChange={titleDocument}
        version={version}
        repository={REPOSITORY}
        colorScheme={colorScheme}
        contentAs="main"
        pageExtras={{
          signals: (
            <div class="flex flex-col gap-12">
              <UrlFilterDemo />
              <DataTableSortDemo />
            </div>
          ),
        }}
      />
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
 * The colour scheme the guide's theme switch reads and changes: the `dark` class on `<html>`,
 * remembered in storage.
 *
 * The class is set by the inline script in `<head>` before first paint; this reads it back in an
 * effect, so the island's first render still matches the prerendered switch.
 */
function useColorScheme(): ColorSchemePort {
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

  return { dark, toggle }
}

/** Where the library lives and what the demo is built from. */
function SiteFooter() {
  return (
    <footer class="border-t border-gray-200 py-8 dark:border-gray-800">
      <div class="mx-auto flex max-w-screen-2xl flex-col gap-2 px-4 text-xs text-gray-500 sm:px-6 lg:px-8 dark:text-gray-400">
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
