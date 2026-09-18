/**
 * The icon gallery — the one genuinely meta-driven part of the catalogue.
 *
 * It reads the whole `@preact-components/icons` namespace instead of a hand-written list, so a new
 * glyph appears here, is searchable and is copyable the moment it is exported. There is no registry
 * entry for it and no count to bump: `icons.test.ts` asserts that the gallery renders exactly the
 * module's exports.
 */

import * as icons from "@preact-components/icons"
import { copyToClipboard } from "@preact-components/ui/copy-button"
import { useSignal } from "@preact/signals"
import { cn } from "@preact-components/signals/cn"
import type { ComponentType } from "preact"

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

export interface IconGalleryProps {
  /**
   * Clipboard port. Left out, the `ui` package's `copyToClipboard` is used, which prefers
   * `navigator.clipboard` and falls back to `document.execCommand`.
   */
  copy?: (text: string) => void | Promise<void>
  class?: string
}

/**
 * Searchable grid of every icon, each cell copying `<IconName />` on click.
 *
 * The search term and the last copied name are local visual state, so they stay inside the
 * component; the clipboard is a port.
 */
export function IconGallery({ copy, class: className }: IconGalleryProps) {
  const query = useSignal("")
  const copied = useSignal("")
  const matches = filterIconNames(iconNames, query.value)

  const handleCopy = (name: string) => {
    copyToClipboard(iconSnippet(name), copy)
    copied.value = name
  }

  return (
    <section id="icons" class={cn("scroll-mt-8", className)}>
      <div class="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-2 dark:border-gray-700">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Icons</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {iconNames.length} glyphs, read from the package. Click one to copy{" "}
            <code>{"<IconName />"}</code>.
          </p>
        </div>
        <div class="relative w-64">
          <input
            type="search"
            name="icon-search"
            class="w-full rounded-md border border-gray-300 bg-white py-2 pr-10 pl-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 focus:outline-hidden dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Search icons"
            aria-label="Search icons"
            value={query.value}
            onInput={(event) => query.value = event.currentTarget.value}
          />
          <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-400">
            <icons.IconSearch class="size-5" />
          </span>
        </div>
      </div>

      <p class="mb-3 text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
        {matches.length} of {iconNames.length} shown
        {copied.value ? ` · copied ${iconSnippet(copied.value)}` : ""}
      </p>

      <div class="flex flex-wrap gap-3">
        {matches.map((name) => {
          const Icon = icons[name as keyof typeof icons] as IconComponent
          return (
            <button
              key={name}
              type="button"
              title={`Copy ${iconSnippet(name)}`}
              data-icon={name}
              onClick={() => handleCopy(name)}
              class="group flex w-32 flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-gray-600 hover:border-purple-400 hover:text-purple-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-purple-500"
            >
              <span class="flex h-10 items-center justify-center">
                <Icon class="size-6 transition-transform duration-300 group-hover:scale-125" />
              </span>
              <span class="w-full truncate text-center text-xs" title={name}>
                {name.replace(/^Icon/, "")}
              </span>
            </button>
          )
        })}
        {matches.length === 0
          ? (
            <p class="text-sm text-gray-500 dark:text-gray-400">
              No glyph matches “{query.value.trim()}”.
            </p>
          )
          : null}
      </div>
    </section>
  )
}
