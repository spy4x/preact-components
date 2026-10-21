/**
 * `SiteFooter` — a public-site footer: groups of links, each its own named `<nav>`, plus optional
 * `brand`, `aside` and `bottom` slots. The counterpart of `SiteHeader` at the bottom of the page.
 *
 * Props only, and no JavaScript: every link is a plain `<a href>`, and nothing here uses a hook,
 * so the footer works the same before hydration, with scripts off, and in a server-only page.
 * Every word it prints is the caller's: group titles, link labels and the three slots.
 */

import { cn } from "@spy4x/preact-cn"
import { IconExternalLink } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { barFocusOffset } from "./mobile-panel.ts"

/** One link of a {@link SiteFooterGroup}. */
export interface SiteFooterLink {
  /** Visible text and the link's accessible name. */
  label: string
  href: string
  /**
   * Marks a link that leaves the site: an icon follows the label. The link still opens in the same
   * tab; whether to leave the page is the visitor's choice, not this component's.
   */
  external?: boolean
  /**
   * Words a screen reader hears after the label of an `external` link, such as
   * `"(opens example.com)"`, since the icon is hidden from it. Printed only with `external`.
   */
  externalHint?: string
}

/** One column of the footer: a titled list of links. */
export interface SiteFooterGroup {
  /** The column's heading, and the accessible name of its `<nav>`. */
  title: string
  links: readonly SiteFooterLink[]
}

/** Props of {@link SiteFooter}: the link groups, three optional slots and a class. */
export interface SiteFooterProps {
  /** The link columns, in display order. Two per row on a phone, all in one row from `lg` up. */
  groups: readonly SiteFooterGroup[]
  /** Shown above the groups, e.g. the logo and a one-line pitch. Nothing is drawn without it. */
  brand?: ComponentChildren
  /**
   * A free slot beside the groups, e.g. a newsletter form: full width below them on a phone, the
   * last third of the row from `lg` up. Nothing is drawn without it.
   */
  aside?: ComponentChildren
  /** The bottom line, e.g. the copyright, under a top border. Nothing is drawn without it. */
  bottom?: ComponentChildren
  /** Utilities merged over the root `<footer>`'s own. */
  class?: string
}

/**
 * A footer for a public site: `brand` on top, then `groups` as named `<nav>` columns with `aside`
 * beside them, then `bottom` under a border.
 *
 * **Touch targets.** Each link has `py-3` around its `text-sm` line on a phone, 44 px tall in all,
 * and `py-1` from `lg` up, where a pointer needs less.
 *
 * **Colours come from the theme's tokens** (`bg-surface`, `dark:bg-canvas`, `border-subtle`,
 * `text-muted`), the same as `SiteHeader`'s bar, so it follows the light, dark and ink palettes.
 */
export function SiteFooter(props: SiteFooterProps): JSX.Element {
  const { groups, brand, aside, bottom, class: className } = props
  const hasAside = isGiven(aside)

  return (
    <footer
      class={cn("border-t border-subtle bg-surface dark:bg-canvas", barFocusOffset, className)}
    >
      <div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        {isGiven(brand) && <div>{brand}</div>}

        <div class="grid gap-8 lg:grid-cols-3">
          <div
            class={cn(
              "grid grid-cols-2 gap-8 lg:flex",
              hasAside ? "lg:col-span-2" : "lg:col-span-3",
            )}
          >
            {groups.map((group, index) => (
              <nav
                key={`${index}-${group.title}`}
                aria-label={group.title}
                class="flex min-w-0 flex-col gap-2 lg:flex-1"
              >
                <h2 class="text-sm font-semibold text-balance text-foreground">{group.title}</h2>
                <ul class="flex flex-col">
                  {group.links.map((link, linkIndex) => (
                    <li key={`${linkIndex}-${link.href}`}>
                      <a
                        href={link.href}
                        class="flex items-center gap-1 py-3 text-sm text-muted hover:text-foreground lg:py-1"
                      >
                        {link.label}
                        {link.external && <IconExternalLink class="size-4" aria-hidden="true" />}
                        {link.external && link.externalHint && (
                          <span class="sr-only">{` ${link.externalHint}`}</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {hasAside && <div>{aside}</div>}
        </div>

        {isGiven(bottom) && (
          <div class="border-t border-subtle pt-8 text-sm text-muted">{bottom}</div>
        )}
      </div>
    </footer>
  )
}

/** Whether a slot holds something to draw: `false`, as from `show && <Form />`, counts as absent. */
function isGiven(slot: ComponentChildren): boolean {
  return slot !== undefined && slot !== null && slot !== false
}
