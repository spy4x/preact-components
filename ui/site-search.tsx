import type { JSX } from "preact"
import { useSignal } from "@preact/signals"
import { useRef } from "preact/hooks"
import {
  CommandPalette,
  type CommandPaletteLabels,
  type CommandPaletteOption,
  groupOptions,
  matchOptions,
} from "./command-palette.tsx"
import { useLabels } from "./i18n.tsx"
import type { KbdLabels } from "./kbd-keys.tsx"
import {
  fetchSiteIndex,
  orderGroups,
  reportedQuery,
  searchSite,
  type SiteIndex,
} from "./site-search-index.ts"

/** How many results a query lists, besides the commands it matches. */
const RESULT_ROWS = 10

/** Where the trigger leads until the page hydrates: the site's own search page. */
const SEARCH_PAGE = "/search?q="

/** A client-side command, such as "Copy email" or "Toggle theme": a palette option that runs. */
export interface SiteSearchCommand extends CommandPaletteOption {
  run: () => void
}

/**
 * The words of {@link SiteSearch}: `CommandPalette`'s, with `empty` naming the query. `empty` and
 * `error` have their English defaults in {@link defaultSiteSearchLabels}, the rest in
 * `defaultCommandPaletteLabels`.
 */
export interface SiteSearchLabels extends Omit<CommandPaletteLabels, "empty"> {
  /** What the list says when nothing matches `query`. */
  empty: (query: string) => string
}

/** English defaults for the {@link SiteSearchLabels} a website's search words its own way. */
export const defaultSiteSearchLabels: Readonly<Pick<SiteSearchLabels, "empty" | "error">> = {
  empty: (query) => `Nothing for “${query}”`,
  error: "Search couldn't load. Check your connection and type again.",
}

/** What {@link SiteSearch} tells `onSearched` once per palette session. */
export interface SiteSearchEvent {
  /** The last query, trimmed and cut to 64 characters; `""` when nothing was typed. */
  query: string
  /** How many rows the last query listed, results and commands. */
  results: number
  /** The chosen row's place in the list, from 1; absent when the reader chose nothing. */
  chosenPosition?: number
  /** Whether the chosen row was an index entry or one of `commands`. */
  chosenKind?: "result" | "command"
  /** `"layout"` or `"typo"` when the index answered a corrected query. */
  correction?: "layout" | "typo"
}

/** Props of {@link SiteSearch}. */
export interface SiteSearchProps {
  /** The site's prebuilt index, `JSON.stringify` of an `@spy4x/search` index. */
  src?: string
  /**
   * How the index is fetched: pass the page's own `fetch`. A port, because no component of this
   * library talks to the network by itself.
   */
  fetch: (src: string) => Promise<Response>
  /** Commands listed with the results, filtered by the query, all of them on an empty query. */
  commands?: readonly SiteSearchCommand[]
  /** Group names listed first, in this order; other groups follow as they come. */
  groupOrder?: readonly string[]
  /** Overrides for the words; see {@link defaultSiteSearchLabels}. */
  labels?: Partial<SiteSearchLabels>
  /**
   * Called once per palette session, when a result is chosen or the palette closes. Nothing is
   * sent anywhere by the component itself.
   */
  onSearched?: (event: SiteSearchEvent) => void
  /** `"field"`, the default, reads the placeholder with the hotkey hint; `"icon"` is a magnifier. */
  trigger?: "field" | "icon"
  /** What opens the palette; see `CommandPalette`'s `hotkeys`. Defaults to `/` and Ctrl/⌘+K. */
  hotkeys?: readonly string[]
  /** The words the hotkey hint shows for a key; see `KBD_LABELS`. */
  kbdLabels?: Partial<KbdLabels>
  /** The dialog's `data-e2e`; see `CommandPalette`. */
  dataE2E?: string
  /** Extra classes for the trigger; see `CommandPalette`. */
  class?: string
}

/** A palette row: an index entry, which has an `href`, or a command, which has a `run`. */
interface SiteSearchOption extends CommandPaletteOption {
  href?: string
}

/** What one palette session has learned so far, for `onSearched`. */
interface Session {
  query: string
  rows: readonly SiteSearchOption[]
  correction?: "layout" | "typo"
  chosen?: SiteSearchOption
  reported: boolean
}

/**
 * Opens a result: a heading on this page by its hash, focused so its `:target` tint shows and a
 * keyboard reader goes on from there; any other address in this tab, or in a new one when the
 * reader asked for that.
 */
function openHref(href: string, newTab: boolean): void {
  const url = new URL(href, location.href)
  if (newTab && url.protocol !== "mailto:") {
    globalThis.open(url.href, "_blank", "noopener")
    return
  }
  const here = url.origin === location.origin && url.pathname === location.pathname &&
    url.search === location.search
  if (!here || url.hash === "") return location.assign(url.href)
  location.hash = url.hash
  const target = document.getElementById(decodeURIComponent(url.hash.slice(1)))
  if (target === null) return
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
  target.focus()
}

/**
 * A website's search: a field-shaped button people notice, and the `CommandPalette` it opens on a
 * click, `/` or Ctrl/⌘+K, over the site's own prebuilt `@spy4x/search` index at `src` and the
 * site's `commands`. The index is fetched when the pointer reaches the trigger, when it takes focus
 * or when the palette opens, then kept; a failed fetch shows the error and the next keystroke tries
 * again. Entries that would link off the site, or to `javascript:`, are never listed. Until the
 * page hydrates the trigger is a link to `/search?q=`, which the site serves.
 *
 * @param props See {@link SiteSearchProps}.
 */
export function SiteSearch(props: SiteSearchProps): JSX.Element {
  const { src = "/search.json", commands = [], groupOrder = [], trigger = "field" } = props
  const own = useLabels("SiteSearch", defaultSiteSearchLabels, props.labels, { empty: ["query"] })
  const query = useSignal("")
  const loading = useRef<Promise<SiteIndex> | null>(null)
  const session = useRef<Session>({ query: "", rows: [], reported: true })
  const latest = useRef(props)
  latest.current = props

  /** The index, fetched once; a failure is forgotten, so the next call fetches again. */
  const load = () =>
    loading.current ??= fetchSiteIndex(latest.current.fetch, src, location.href).catch((error) => {
      loading.current = null
      throw error
    })

  /** Tells `onSearched` about the session, once. */
  const report = () => {
    const now = session.current
    if (now.reported) return
    now.reported = true
    const position = now.chosen === undefined
      ? 0
      : groupOptions(now.rows).flatMap((group) => group.options).indexOf(now.chosen) + 1
    latest.current.onSearched?.({
      query: reportedQuery(now.query),
      results: now.rows.length,
      chosenPosition: position > 0 ? position : undefined,
      chosenKind: now.chosen === undefined ? undefined : now.chosen.run ? "command" : "result",
      correction: now.correction,
    })
  }

  const commandRows = commands.map((command) => {
    const row: SiteSearchOption = {
      ...command,
      run: () => {
        session.current.chosen = row
        if (!command.keepOpen) report()
        command.run()
      },
    }
    return row
  })

  const search = async (typed: string, signal: AbortSignal): Promise<SiteSearchOption[]> => {
    const text = typed.trim()
    query.value = text
    let rows: SiteSearchOption[] = matchOptions(commandRows, text)
    let correction: Session["correction"]
    if (text === "") {
      // Opening the palette fetches the index; the commands show at once.
      load().catch(() => {})
    } else {
      const hits = searchSite(await load(), text, RESULT_ROWS, location.href)
      correction = hits.correction
      rows = [
        ...hits.entries.map((entry, index) => ({
          id: entry.id ?? entry.href,
          label: entry.label,
          detail: entry.detail ?? hits.snippets[index],
          hint: hits.aliases[index],
          group: entry.group,
          href: entry.href,
        })),
        ...rows,
      ]
    }
    rows = orderGroups(rows, latest.current.groupOrder ?? groupOrder)
    if (!signal.aborted) Object.assign(session.current, { query: text, rows, correction })
    return rows
  }

  return (
    <div
      class="contents"
      onPointerOver={() => load().catch(() => {})}
      onFocusIn={() => load().catch(() => {})}
    >
      <CommandPalette<SiteSearchOption>
        search={search}
        debounce={0}
        trigger={trigger}
        triggerHref={SEARCH_PAGE}
        hotkeys={props.hotkeys}
        kbdLabels={props.kbdLabels}
        dataE2E={props.dataE2E}
        class={props.class}
        labels={{
          ...props.labels,
          error: own.error,
          empty: query.value === "" ? "" : own.empty(query.value),
        }}
        onOpenChange={(open) => {
          if (open) session.current = { query: "", rows: [], reported: false }
          else report()
        }}
        onSelect={(option, { alternative }) => {
          session.current.chosen = option
          report()
          if (option.href !== undefined) openHref(option.href, alternative)
        }}
      />
    </div>
  )
}
