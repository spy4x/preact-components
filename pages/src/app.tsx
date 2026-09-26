/**
 * The demo's host page — the app shell this library deliberately does not ship.
 *
 * The guide — `uiGuideRoute.component`, which is `UIGuide` routed by the address's hash — owns
 * the page: its header, its side navigation, one page at a time,
 * the deep links that mark and scroll to a card, and reading the address. What the host adds is
 * what only it knows: the hash to render before hydration, the document's title, set from the route
 * the guide reports, and manual scroll restoration, because this page is the whole app and the
 * guide scrolls on its first read itself.
 *
 * The UI page ends with two demos that are not cards, because each needs a page that owns an
 * address: {@link UrlFilterDemo}, `useUrlFilters` bound directly to filter signals, and
 * {@link DataTableSortDemo}, the same hook underneath `DataTable`'s own `sort` prop.
 * They were on the Signals page until the guide stopped showing helpers (#357); the browser checks
 * in `pages/checks/signals.ts` and `pages/checks/ui.ts` drive them there.
 */

import { copyToClipboard } from "@spy4x/preact-ui/copy-button"
import {
  type ColorSchemePort,
  type GuideRouteChange,
  type MapTiles,
  uiGuideRoute,
} from "@spy4x/preact-ui-guide"
import { useEffect, useState } from "preact/hooks"
import { DataTableSortDemo } from "./data-table-sort.tsx"
import { LOCAL_MAP_TILES_FLAG, PAGE_TITLE, REPOSITORY } from "./site.ts"
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

/**
 * The Map card's tiles during `verify`'s browser checks: one tiny local image, requested unchanged
 * for every tile Leaflet asks for, relative so it resolves against whatever base the page is served
 * at. Everywhere else the guide draws OpenStreetMap's tiles.
 */
const LOCAL_MAP_TILES: MapTiles = {
  url: "map-demo/tile.png",
  attribution: "© Example tile provider",
}

/**
 * The tiles to hand the guide: the local ones when `verify` set {@link LOCAL_MAP_TILES_FLAG}, and
 * the guide's own default otherwise. Read during render, which is safe for hydration: the Map card
 * draws its map only in the browser, after its module loads, and its served form names no tile.
 */
function mapTiles(): MapTiles | undefined {
  return (globalThis as Record<string, unknown>)[LOCAL_MAP_TILES_FLAG] === true
    ? LOCAL_MAP_TILES
    : undefined
}

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
        mapTiles={mapTiles()}
        pageExtras={{
          ui: (
            <div class="flex flex-col gap-12">
              <UrlFilterDemo />
              <DataTableSortDemo />
            </div>
          ),
        }}
      />
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
