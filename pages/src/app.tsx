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
 * The UI page ends with three demos that are not cards. Two need a page that owns an address:
 * {@link UrlFilterDemo}, `useUrlFilters` bound directly to filter signals, and
 * {@link DataTableSortDemo}, the same hook underneath `DataTable`'s own `sort` prop. The third,
 * {@link NowDemo}, is `useNow`, a hook with no markup of its own, mounted and unmounted on a button.
 * They were on the Signals page until the guide stopped showing helpers (#357); the browser checks
 * in `pages/checks/signals.ts` and `pages/checks/ui.ts` drive them there.
 *
 * The System page ends with {@link RouteAnnouncerDemo}, `useRouteAnnouncer` on a path the demo holds
 * itself; `pages/checks/system.ts` drives it.
 */

import { copyToClipboard } from "@spy4x/platform/browser/clipboard"
import {
  type ColorSchemePort,
  type GuideRouteChange,
  type MapTiles,
  uiGuideRoute,
} from "@spy4x/preact-ui-guide"
import { createThemeStore, ThemeValue } from "@spy4x/preact-signals/theme"
import { useEffect } from "preact/hooks"
import { AccentSwitch } from "./accent-switch.tsx"
import { DataTableSortDemo } from "./data-table-sort.tsx"
import { NowDemo } from "./now-demo.tsx"
import { RouteAnnouncerDemo } from "./route-announcer-demo.tsx"
import { AUTHOR, LOCAL_MAP_TILES_FLAG, PAGE_TITLE, REPOSITORY, THEME_KEY } from "./site.ts"
import { UrlFilterDemo } from "./url-filters.tsx"

/**
 * The page's theme: `@spy4x/preact-signals/theme`'s store, on the same key as the bootstrap script.
 * Inert until the island attaches it, so prerendering reads no storage.
 */
const theme = createThemeStore({ storageKey: THEME_KEY })

/**
 * Clipboard port handed to the catalogue.
 *
 * The shared helper from spy4x/ts-libs, so the legacy `execCommand` path is not reimplemented here.
 *
 * @param text Text to place on the clipboard.
 */
const copyText = (text: string): void => void copyToClipboard(text)

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
        author={AUTHOR}
        colorScheme={colorScheme}
        actions={<AccentSwitch />}
        contentAs="main"
        mapTiles={mapTiles()}
        pageExtras={{
          ui: (
            <div class="flex flex-col gap-12">
              <UrlFilterDemo />
              <DataTableSortDemo />
              <NowDemo />
            </div>
          ),
          system: <RouteAnnouncerDemo />,
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
 * The colour scheme the guide's theme switch reads and changes, from the page's theme store: the
 * store toggles the `dark` class and `color-scheme` on `<html>` and remembers the choice.
 *
 * The bootstrap script in `<head>` paints the same theme before first paint; the store attaches in
 * an effect, so the island's first render still reads light and matches the prerendered switch.
 */
function useColorScheme(): ColorSchemePort {
  useEffect(() => theme.attach(), [])
  return { dark: theme.actual.value === ThemeValue.DARK, toggle: theme.toggle }
}
