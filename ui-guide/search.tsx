/**
 * The guide's search: every page and card name, filtered as you type, in a modal dialog.
 *
 * The index is built from the registry, so a card added to a section is searchable with no second
 * edit. The dialog, its keys and its hotkeys (`/`, Ctrl+K and ⌘K) are the library's own
 * `CommandPalette`; this file keeps only the guide's index and what an empty query shows.
 */

import {
  CommandPalette,
  type CommandPaletteOption,
  rankOptions,
} from "@spy4x/preact-ui/command-palette"
import type { JSX } from "preact"
import { useMemo } from "preact/hooks"
import {
  cardLabel,
  catalogueSections,
  type GuidePage,
  guidePages,
  pageOfSection,
  type PartialDemoRegistry,
} from "./registry.ts"
import { demoHref, pageHref } from "./routes.ts"

/** What a search result points at. */
export enum SearchKind {
  PAGE = 1,
  COMPONENT = 2,
  CLASSES = 4,
}

/** One searchable name and where it leads. */
export interface SearchEntry {
  /** The name a reader types, e.g. `"Badge"` or `"Colour atoms"`. */
  label: string
  /** Where it lives, e.g. `"UI · Badges"`. */
  detail: string
  /** The route it opens, e.g. `"#/badges/badge"`. */
  href: string
  kind: SearchKind
}

/**
 * Every page and card the registry carries, in navigation order.
 *
 * A component card is found by its component's name, a class card by its title.
 *
 * @param registry The registry the guide renders; cards it does not carry are left out.
 * @returns The index, one entry per name.
 */
export function searchIndex(registry: PartialDemoRegistry, guidePlace = "Guide"): SearchEntry[] {
  const titles = new Map<string, string>(guidePages.map((page) => [page.id, page.title]))
  const entries: SearchEntry[] = guidePages
    .map((page: GuidePage) => ({
      label: page.title,
      detail: page.packageName ?? guidePlace,
      href: pageHref(page.id),
      kind: SearchKind.PAGE,
    }))
  const seen = new Set(entries.map((entry) => `${entry.label} ${entry.href}`))
  const add = (entry: SearchEntry) => {
    const key = `${entry.label} ${entry.href}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push(entry)
  }
  for (const section of catalogueSections) {
    const where = `${titles.get(pageOfSection(section))} · ${section.title}`
    for (const name of section.names) {
      if (!(name in registry)) continue
      const href = demoHref(section.id, name)
      add(
        section.kind === "component"
          ? { label: name, detail: where, href, kind: SearchKind.COMPONENT }
          : { label: cardLabel(name), detail: where, href, kind: SearchKind.CLASSES },
      )
    }
  }
  return entries
}

/**
 * The entries that match `query`, best first, at most `limit` of them: `rankOptions` from the
 * library, except that an empty query matches the pages only.
 *
 * @param entries The index.
 * @param query What the reader typed.
 * @param limit The most results to return.
 */
export function searchEntries<Entry extends SearchEntry>(
  entries: readonly Entry[],
  query: string,
  limit = 12,
): Entry[] {
  if (query.trim() === "") {
    return entries.filter((entry) => entry.kind === SearchKind.PAGE).slice(0, limit)
  }
  return rankOptions(entries, query, limit)
}

/** The word beside a result for each kind of entry. */
export interface SearchKindWords {
  page: string
  component: string
  classes: string
}

/** The search's own strings. Each has an English default in the shell's labels. */
export interface GuideSearchLabels {
  /** The dialog's, the field's and the result list's name. */
  search: string
  /** The dialog's close button's name. */
  closeSearch: string
  /** The word beside each result, by kind. */
  searchKinds: SearchKindWords
  /**
   * The field's placeholder, and the header button's visible text and accessible name: a speech
   * user says what they see.
   */
  searchPlaceholder: string
  /** What the list says when nothing matches. */
  searchEmpty: string
}

/** Props of {@link GuideSearch}. */
export interface GuideSearchProps {
  entries: readonly SearchEntry[]
  labels: GuideSearchLabels
  /** Opens a result's route: the shell's own link handling. */
  go: (href: string) => void
}

/** Which of {@link SearchKindWords} names each kind. */
const KIND_WORD: Record<SearchKind, keyof SearchKindWords> = {
  [SearchKind.PAGE]: "page",
  [SearchKind.COMPONENT]: "component",
  [SearchKind.CLASSES]: "classes",
}

/** A search entry as the palette lists it. */
type SearchOption = SearchEntry & CommandPaletteOption

/**
 * The header's search button and the dialog it opens: the library's `CommandPalette` over the
 * guide's index.
 *
 * @param props See {@link GuideSearchProps}.
 */
export function GuideSearch({ entries, labels, go }: GuideSearchProps): JSX.Element {
  const options = useMemo<SearchOption[]>(
    () =>
      entries.map((entry) => ({
        ...entry,
        id: `${entry.label} ${entry.href}`,
        hint: labels.searchKinds[KIND_WORD[entry.kind]],
      })),
    [entries, labels.searchKinds],
  )
  return (
    <CommandPalette
      options={options}
      filter={(all, query) => searchEntries(all, query)}
      onSelect={(option) => go(option.href)}
      // Both chords on every platform, as the guide's search always had, rather than the
      // library's `mod+k`.
      hotkeys={["/", "ctrl+k", "meta+k"]}
      dataE2E="ui-guide-search"
      labels={{
        search: labels.search,
        placeholder: labels.searchPlaceholder,
        close: labels.closeSearch,
        empty: labels.searchEmpty,
      }}
    />
  )
}
