/**
 * The icon gallery — the one genuinely meta-driven part of the catalogue.
 *
 * It reads the whole `@spy4x/preact-icons` namespace instead of a hand-written list, so a new
 * glyph appears here, is searchable and is copyable the moment it is exported. There is no registry
 * entry for it and no count to bump: `icons.test.ts` asserts that the gallery renders exactly the
 * module's exports.
 */

import * as icons from "@spy4x/preact-icons"
import { copyToClipboard } from "@spy4x/preact-ui/copy-button"
import { Input } from "@spy4x/preact-ui/input"
import { Cluster, Grid, Stack } from "@spy4x/preact-ui/layout"
import { useSignal } from "@preact/signals"
import type { ComponentType, JSX } from "preact"
import { DemoCard } from "./card.tsx"

/** One glyph, with the prop surface every icon in the package shares. */
type IconComponent = ComponentType<{ class?: string }>

/** Every glyph the icon package exports, in module order. */
export const iconNames: string[] = Object.entries(icons)
  .filter(([, value]) => typeof value === "function")
  .map(([name]) => name)

/**
 * The JSX a click on a gallery cell puts on the clipboard.
 *
 * @param name Export name of the glyph, e.g. `"IconSearch"`.
 * @returns The self-closing JSX tag for that glyph.
 */
export function iconSnippet(name: string): string {
  return `<${name} />`
}

/**
 * Filter glyph names by a case-insensitive substring of the whole name.
 *
 * Split out of the gallery so the filter can be tested without a DOM: the gallery only wires it to
 * an input.
 *
 * @param names Names to filter, normally {@link iconNames}.
 * @param query Raw search text; an empty or whitespace-only query keeps every name.
 * @returns The matching names, in the order they were given.
 */
export function filterIconNames(names: string[], query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return names
  return names.filter((name) => name.toLowerCase().includes(needle))
}

/** Every word the gallery prints. Each has an English default ({@link DEFAULT_ICON_GALLERY_LABELS}). */
export interface IconGalleryLabels {
  /** The card's name. Defaults to `"Icon gallery"`. */
  title: string
  /** The card's one sentence, in inline Markdown. */
  summary: string
  /** The search field's placeholder and accessible name. Defaults to `"Search icons"`. */
  search: string
  /** The live status line: how many glyphs show, and the snippet last copied, if any. */
  status: (shown: number, total: number, copied: string | undefined) => string
  /** What shows when no glyph matches the query. */
  noMatch: (query: string) => string
  /** The code row's copy control. Defaults to `"Copy the icon example"`. */
  copyCode: string
}

/** The gallery's English words. */
export const DEFAULT_ICON_GALLERY_LABELS: IconGalleryLabels = {
  title: "Icon gallery",
  summary:
    "Each glyph is a component that draws in the text colour and takes a `class` for its size and colour; click one to copy its JSX.",
  search: "Search icons",
  status: (shown, total, copied) =>
    `${shown} of ${total} shown${copied ? ` · copied ${copied}` : ""}`,
  noMatch: (query) => `No glyph matches “${query}”.`,
  copyCode: "Copy the icon example",
}

/** The code row of the gallery's card: how an app uses one glyph. */
const GALLERY_SNIPPET = `import { IconSearch } from "@spy4x/preact-icons"

<IconSearch class="size-5 text-gray-500" />`

export interface IconGalleryProps {
  /**
   * Clipboard port. Left out, the `ui` package's `copyToClipboard` is used, which prefers
   * `navigator.clipboard` and falls back to `document.execCommand`.
   */
  copy?: (text: string) => void | Promise<void>
  /** Overrides for the gallery's own words. */
  labels?: Partial<IconGalleryLabels>
  class?: string
}

/**
 * Searchable grid of every icon on one wide guide card, each cell copying `<IconName />` on click.
 *
 * The card is the guide's own (`card.tsx`), addressed as `#icons`. The search term and the last
 * copied name are local visual state, so they stay inside the component; the clipboard is a port.
 */
export function IconGallery(
  { copy, labels: labelOverrides, class: className }: IconGalleryProps,
): JSX.Element {
  const labels = { ...DEFAULT_ICON_GALLERY_LABELS, ...labelOverrides }
  const query = useSignal("")
  const copied = useSignal("")
  const matches = filterIconNames(iconNames, query.value)

  const handleCopy = (name: string) => {
    copyToClipboard(iconSnippet(name), copy)
    copied.value = name
  }

  return (
    <DemoCard
      name="icons"
      anchorId="icons"
      label={labels.title}
      copyLabel={labels.copyCode}
      summary={labels.summary}
      snippet={GALLERY_SNIPPET}
      wide
      copy={copy}
      class={className}
    >
      <Stack gap="md">
        <Cluster gap="md" justify="between">
          <p class="text-sm text-gray-600 dark:text-gray-300" aria-live="polite">
            {labels.status(
              matches.length,
              iconNames.length,
              copied.value ? iconSnippet(copied.value) : undefined,
            )}
          </p>
          <Input
            type="search"
            name="icon-search"
            class="sm:w-72"
            placeholder={labels.search}
            aria-label={labels.search}
            value={query.value}
            onInput={(event) => query.value = event.currentTarget.value}
          />
        </Cluster>

        {matches.length === 0
          ? (
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {labels.noMatch(query.value.trim())}
            </p>
          )
          : (
            <Grid
              gap="sm"
              class="grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]"
            >
              {matches.map((name) => {
                const Icon = icons[name as keyof typeof icons] as IconComponent
                return (
                  <button
                    key={name}
                    type="button"
                    title={`Copy ${iconSnippet(name)}`}
                    data-icon={name}
                    onClick={() => handleCopy(name)}
                    class="group flex min-w-0 flex-col items-center gap-2 rounded-lg p-3 text-gray-600 hover:bg-white hover:text-purple-700 hover:shadow-xs focus-visible:outline-2 focus-visible:outline-purple-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-purple-300"
                  >
                    <Icon class="size-6 transition-transform duration-300 group-hover:scale-125" />
                    <span class="w-full truncate text-center text-xs" title={name}>
                      {name.replace(/^Icon/, "")}
                    </span>
                  </button>
                )
              })}
            </Grid>
          )}
      </Stack>
    </DemoCard>
  )
}
