/**
 * The icon gallery — the one genuinely meta-driven part of the catalogue.
 *
 * It reads the whole `@spy4x/preact-icons` namespace instead of a hand-written list, so a new
 * glyph appears here, is searchable and is copyable the moment it is exported. There is no registry
 * entry for it and no count to bump: `icons.test.ts` asserts that the gallery renders exactly the
 * module's exports.
 */

import * as icons from "@spy4x/preact-icons"
import { copyToClipboard } from "@spy4x/platform/browser/clipboard"
import { Input } from "@spy4x/preact-ui/input"
import { Cluster, Grid, Stack } from "@spy4x/preact-ui/layout"
import { useSignal } from "@preact/signals"
import type { ComponentChildren, ComponentType, JSX } from "preact"
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

/**
 * A cell's caption: the glyph's name without its `Icon` prefix, with a line-break opportunity before
 * each inner capital, so a long name wraps between its words (`ArrowDown` / `Tray`) rather than being
 * cut off. A single word too long for the cell still wraps, through the caption's `overflow-wrap`.
 *
 * @param name Export name of the glyph, e.g. `"IconArrowDownTray"`.
 * @returns The caption's children: the words, with a `<wbr>` between them.
 */
export function glyphLabel(name: string): ComponentChildren[] {
  const words = name.replace(/^Icon/, "").split(/(?=[A-Z])/)
  return words.flatMap((word, index) => index === 0 ? [word] : [<wbr key={index} />, word])
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
  /** The line over the left-to-right and right-to-left rows of directional glyphs. */
  mirrored: string
}

/** The gallery's English words. */
export const DEFAULT_ICON_GALLERY_LABELS: IconGalleryLabels = {
  title: "Icon gallery",
  summary:
    "Each glyph is a component that draws in the text colour and takes a `class` for its size and colour. It is hidden from screen readers unless it gets an `aria-label` or a `title`. Click one to copy its JSX.",
  search: "Search icons",
  status: (shown, total, copied) =>
    `${shown} of ${total} shown${copied ? ` · copied ${copied}` : ""}`,
  noMatch: (query) => `No glyph matches “${query}”.`,
  copyCode: "Copy the icon example",
  mirrored:
    "Under a right-to-left page, the glyphs that point along the line flip; the others stay as drawn.",
}

/**
 * Glyphs the gallery shows twice, once in each direction: five that mirror under `dir="rtl"` and
 * three that never do, so a reader sees which flip.
 */
const DIRECTION_SAMPLE: IconComponent[] = [
  icons.IconChevronRight,
  icons.IconArrowRight,
  icons.IconArrowUturnLeft,
  icons.IconLogout,
  icons.IconExternalLink,
  icons.IconCheck,
  icons.IconSearch,
  icons.IconArrowUp,
]

/** The code row of the gallery's card: how an app uses one glyph. */
const GALLERY_SNIPPET = `import { IconSearch, IconStar } from "@spy4x/preact-icons"

<IconSearch class="size-5 text-muted" />
<IconSearch aria-label="Search" />
<IconStar filled aria-label="Rated" />`

export interface IconGalleryProps {
  /**
   * Clipboard port. Left out, `copyToClipboard` from `@spy4x/platform/browser/clipboard` is used,
   * which prefers `navigator.clipboard` and falls back to `document.execCommand`.
   */
  copy?: (text: string) => void | Promise<void>
  /** Overrides for the gallery's own words. */
  labels?: Partial<IconGalleryLabels>
  /**
   * Level of the card's heading. Defaults to `3`; `2` when the gallery sits straight under the
   * page's `<h1>`, with no section heading between them.
   */
  headingLevel?: 2 | 3
  class?: string
}

/**
 * Searchable grid of every icon on one wide guide card, each cell copying `<IconName />` on click.
 *
 * The card is the guide's own (`card.tsx`), addressed as `#icons`. The search term and the last
 * copied name are local visual state, so they stay inside the component; the clipboard is a port.
 */
export function IconGallery(
  { copy, labels: labelOverrides, headingLevel, class: className }: IconGalleryProps,
): JSX.Element {
  const labels = { ...DEFAULT_ICON_GALLERY_LABELS, ...labelOverrides }
  const query = useSignal("")
  const copied = useSignal("")
  const matches = filterIconNames(iconNames, query.value)

  /**
   * Copy one icon's snippet and announce it only once the copy has worked: a port that rejects or
   * a clipboard that answers `false` leaves the status without a "copied" line.
   */
  const handleCopy = async (name: string) => {
    copied.value = ""
    let worked: boolean
    try {
      const snippet = iconSnippet(name)
      worked = (await (copy ? copy(snippet) : copyToClipboard(snippet))) !== false
    } catch {
      worked = false
    }
    if (worked) copied.value = name
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
      headingLevel={headingLevel}
      class={className}
    >
      <Stack gap="md">
        <Cluster gap="md" justify="between">
          <p class="text-sm text-muted" aria-live="polite">
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

        {/* The one glyph with a prop beyond the shared three: the outline and its solid variant. */}
        <Cluster gap="sm" class="text-muted" data-star-variants>
          <icons.IconStar class="size-6" />
          <icons.IconStar filled class="size-6" />
          <code dir="ltr" class="text-xs">{"<IconStar filled />"}</code>
        </Cluster>

        <Stack gap="sm" class="text-muted" data-direction-sample>
          <p class="text-sm">{labels.mirrored}</p>
          {(["ltr", "rtl"] as const).map((dir) => (
            <Cluster key={dir} gap="sm" dir={dir} data-dir={dir}>
              <code dir="ltr" class="w-20 text-xs">{`dir="${dir}"`}</code>
              {DIRECTION_SAMPLE.map((Icon, index) => <Icon key={index} class="size-6" />)}
            </Cluster>
          ))}
        </Stack>

        {matches.length === 0
          ? (
            <p class="text-sm text-muted">
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
                    onClick={() => void handleCopy(name)}
                    class="group flex min-w-0 flex-col items-center gap-2 rounded-lg p-3 text-muted hover:bg-surface hover:text-selected hover:shadow-xs focus-visible:outline-2 focus-visible:outline-accent-600"
                  >
                    <Icon class="size-6 transition-transform duration-300 group-hover:scale-125" />
                    <span class="w-full text-center text-xs [overflow-wrap:anywhere]" title={name}>
                      {glyphLabel(name)}
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
