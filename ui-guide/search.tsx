/**
 * The guide's search: every page, card and helper name, filtered as you type, in a modal dialog.
 *
 * The index is built from the registry, so a card added to a section is searchable with no second
 * edit. The keyboard follows the library's own combobox (`comboboxKey`, `comboboxKeyAction` from
 * `@spy4x/preact-ui/combobox`): the arrows move through the results, Home and End jump to either end,
 * Enter opens the highlighted one, and Escape closes the dialog. `/` and Ctrl+K (⌘K on a Mac) open
 * it from anywhere on the page that is not a text field.
 */

import { cn } from "@spy4x/preact-cn"
import { IconSearch, IconXMark } from "@spy4x/preact-icons"
import { comboboxKey, comboboxKeyAction, type ComboboxState, fold } from "@spy4x/preact-ui/combobox"
import type { JSX } from "preact"
import { useEffect, useId, useRef, useState } from "preact/hooks"
import {
  cardLabel,
  catalogueSections,
  exampleDemos,
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
  HELPER = 3,
  CLASSES = 4,
}

/** One searchable name and where it leads. */
export interface SearchEntry {
  /** The name a reader types, e.g. `"Badge"` or `"clampProgress"`. */
  label: string
  /** Where it lives, e.g. `"UI · Badges"`. */
  detail: string
  /** The route it opens, e.g. `"#/badges/badge"`. */
  href: string
  kind: SearchKind
}

/**
 * Every page, card and helper the registry carries, in navigation order.
 *
 * A component card is found by its component's name, a class card and an example card by their
 * titles, and every export an example covers by its own name as well, so a helper with no card of
 * its own (`clampProgress`) still leads to the example that runs it.
 *
 * @param registry The registry the guide renders; cards it does not carry are left out.
 * @returns The index, one entry per name.
 */
export function searchIndex(registry: PartialDemoRegistry, guidePlace = "Guide"): SearchEntry[] {
  const titles = new Map<string, string>(guidePages.map((page) => [page.id, page.title]))
  const entries: SearchEntry[] = guidePages
    .filter((page) => page.id !== "all")
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
      if (section.kind === "component") {
        add({ label: name, detail: where, href, kind: SearchKind.COMPONENT })
        continue
      }
      const kind = section.kind === "class" ? SearchKind.CLASSES : SearchKind.HELPER
      add({ label: cardLabel(name), detail: where, href, kind })
      for (const covered of exampleDemos[name]?.covers ?? []) {
        add({ label: covered, detail: where, href, kind: SearchKind.HELPER })
      }
    }
  }
  return entries
}

/**
 * The entries that match `query`, best first, at most `limit` of them.
 *
 * A name equal to the query comes first, then names that start with it, then names that contain
 * it, then entries whose place (`detail`) contains it; the index order breaks ties. Matching folds
 * case and accents the way the library's combobox does. An empty query matches the pages only.
 *
 * @param entries The index.
 * @param query What the reader typed.
 * @param limit The most results to return.
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  limit = 12,
): SearchEntry[] {
  const needle = fold(query.trim())
  if (needle === "") {
    return entries.filter((entry) => entry.kind === SearchKind.PAGE).slice(0, limit)
  }
  const rank = (entry: SearchEntry): number => {
    const label = fold(entry.label)
    if (label === needle) return 0
    if (label.startsWith(needle)) return 1
    if (label.includes(needle)) return 2
    if (fold(entry.detail).includes(needle)) return 3
    return -1
  }
  return entries
    .map((entry, index) => ({ entry, index, rank: rank(entry) }))
    .filter((scored) => scored.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((scored) => scored.entry)
}

/** The word beside a result for each kind of entry. */
export interface SearchKindWords {
  page: string
  component: string
  helper: string
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
  [SearchKind.HELPER]: "helper",
  [SearchKind.CLASSES]: "classes",
}

/**
 * The header's search button and the dialog it opens.
 *
 * @param props See {@link GuideSearchProps}.
 */
export function GuideSearch({ entries, labels, go }: GuideSearchProps): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [query, setQuery] = useState("")
  const [state, setState] = useState<ComboboxState>({ activeIndex: 0, isOpen: true })
  const results = searchEntries(entries, query)

  const open = () => {
    setQuery("")
    setState({ activeIndex: 0, isOpen: true })
    dialog.current?.showModal()
    input.current?.focus()
  }
  const choose = (entry: SearchEntry | undefined) => {
    if (!entry) return
    dialog.current?.close()
    go(entry.href)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.closest("input, textarea, select, [contenteditable]") !== null &&
        target !== null
      const shortcut = (event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey)
      if (!shortcut && (event.key !== "/" || typing || event.altKey || event.ctrlKey)) return
      if (dialog.current?.open) return
      event.preventDefault()
      open()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    const key = comboboxKey(event)
    if (key === undefined) return
    if (key === "Escape") {
      event.preventDefault()
      dialog.current?.close()
      return
    }
    const action = comboboxKeyAction(key, state, results.length)
    if (action.preventDefault) event.preventDefault()
    if (action.select >= 0) return choose(results[action.select])
    setState({ activeIndex: action.state.activeIndex, isOpen: true })
  }

  const listbox = `${id}-results`
  const option = (index: number) => `${id}-result-${index}`
  const active = results.length === 0 ? -1 : Math.min(state.activeIndex, results.length - 1)

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={labels.searchPlaceholder}
        data-e2e="ui-guide-search-open"
        class={cn(
          // An icon button on a phone, like the header's other controls; a field-shaped button
          // with its placeholder and shortcut from `sm`.
          "flex h-9 items-center gap-2 rounded-lg border border-transparent px-2 text-sm text-gray-600 hover:text-gray-950",
          "sm:w-56 sm:border-gray-200 sm:bg-white sm:px-3 sm:text-gray-500 sm:hover:border-gray-300 lg:w-72",
          "dark:text-gray-300 dark:hover:text-gray-50 sm:dark:border-gray-700 sm:dark:bg-gray-800/60 sm:dark:text-gray-400 sm:dark:hover:border-gray-600",
        )}
      >
        <IconSearch class="size-5 shrink-0 sm:size-4" />
        <span class="hidden flex-1 text-left sm:inline">{labels.searchPlaceholder}</span>
        <kbd class="hidden rounded border border-gray-200 px-1 font-sans text-xs text-gray-500 sm:inline dark:border-gray-600 dark:text-gray-400">
          /
        </kbd>
      </button>
      <dialog
        ref={dialog}
        aria-label={labels.search}
        data-e2e="ui-guide-search"
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === dialog.current) dialog.current?.close()
        }}
        class={cn(
          "mx-auto mt-16 w-[min(36rem,calc(100vw-2rem))] max-w-none rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl",
          "backdrop:bg-gray-950/50 backdrop:backdrop-blur-sm",
          "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
        )}
      >
        <div class="flex items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
          <IconSearch class="size-4 shrink-0 text-gray-500 dark:text-gray-400" />
          <input
            ref={input}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listbox}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? option(active) : undefined}
            aria-label={labels.search}
            placeholder={labels.searchPlaceholder}
            autocomplete="off"
            spellcheck={false}
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value)
              setState({ activeIndex: 0, isOpen: true })
            }}
            onKeyDown={onKeyDown}
            class="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
          {
            /* Escape and a backdrop click close it too, but a phone has neither a key nor much
            backdrop: the button is the way out a reader can see. */
          }
          <button
            type="button"
            aria-label={labels.closeSearch}
            data-e2e="ui-guide-search-close"
            onClick={() => dialog.current?.close()}
            class="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
          >
            <IconXMark class="size-5" />
          </button>
        </div>
        <ul
          id={listbox}
          role="listbox"
          aria-label={labels.search}
          class="max-h-96 overflow-y-auto bg-transparent p-2"
        >
          {results.length === 0
            ? (
              <li role="presentation" class="px-3 py-6 text-center text-sm text-gray-500">
                {labels.searchEmpty}
              </li>
            )
            : results.map((entry, index) => (
              <li
                key={`${entry.label} ${entry.href}`}
                id={option(index)}
                role="option"
                aria-selected={index === active}
                onClick={() => choose(entry)}
                onMouseMove={() =>
                  index !== active && setState({ activeIndex: index, isOpen: true })}
                class={cn(
                  "flex cursor-pointer items-baseline justify-between gap-4 rounded-lg px-3 py-2",
                  index === active &&
                    "bg-purple-50 text-purple-900 dark:bg-purple-950/60 dark:text-purple-100",
                )}
              >
                <span class="min-w-0">
                  <span class="block text-sm font-medium [overflow-wrap:anywhere]">
                    {entry.label}
                  </span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400">{entry.detail}</span>
                </span>
                <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {labels.searchKinds[KIND_WORD[entry.kind]]}
                </span>
              </li>
            ))}
        </ul>
      </dialog>
    </>
  )
}
