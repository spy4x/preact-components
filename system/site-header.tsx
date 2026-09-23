/**
 * `SiteHeader` — a public-site top bar: a brand slot, a handful of links, an optional call-to-action
 * slot, and a menu button that collapses the links into a `<details>` disclosure on small screens.
 *
 * It is the public-site sibling of the app shell's side navigation (#135): that one is a signed-in
 * app's frame, this one is a landing page's top bar, and both share the mobile-panel open/close
 * behaviour in `mobile-panel.ts` rather than each writing their own.
 *
 * Props and ports only: `links`, `brand` and `actions` are exactly what the caller passes in, so
 * this file writes no href, no brand text and no business copy of its own. `brand` is rendered as
 * given rather than wrapped in an anchor this component would have to invent a `href` for — the
 * caller's own link, if it wants one, is part of what it hands to `brand`.
 */

import { cn } from "@preact-components/cn"
import { IconBars3, type IconProps, IconXMark } from "@preact-components/icons"
import type { ComponentChildren, ComponentType, JSX } from "preact"
import { useId } from "preact/hooks"
import { useMobilePanel } from "./mobile-panel.ts"

/** One entry of {@link SiteHeaderProps.links}. */
export interface SiteHeaderLink {
  /** Visible text and the link's accessible name. */
  label: string
  href: string
  /** Rendered at `size-5` beside the label, in both the desktop row and the mobile panel. */
  Icon?: ComponentType<IconProps>
}

/** Every user-visible or accessible string this component prints that is not `links`/`brand`. */
export interface SiteHeaderLabels {
  /** Menu button's accessible name while the panel is closed. Defaults to `"Open menu"`. */
  openMenu?: string
  /** Menu button's accessible name while the panel is open. Defaults to `"Close menu"`. */
  closeMenu?: string
  /** `aria-label` on both `<nav>` elements — the desktop row and the mobile panel's copy of it. */
  nav?: string
}

export interface SiteHeaderProps {
  /** The links, in display order. Rendered once inline for large screens and once in the panel. */
  links: readonly SiteHeaderLink[]
  /** Compared against every link's `href` to mark the current page. No link is current by default. */
  currentPath?: string
  /** The logo/name slot. Rendered exactly as given — this component adds no anchor around it. */
  brand: ComponentChildren
  /**
   * A trailing slot, e.g. a "Book a call" button. Rendered once, beside the menu button, and stays
   * visible at every width — unlike `links`, it is not re-drawn inside the panel: a caller's own
   * element can only ever be mounted once, so the panel carries the links this component itself
   * redraws from data and leaves `actions` where it already is.
   */
  actions?: ComponentChildren
  labels?: SiteHeaderLabels
  /** Utilities merged over the root `<header>`'s own. */
  class?: string
}

/**
 * Whether `href` is the page `currentPath` names.
 *
 * Exact string equality, on purpose: a prefix match would mark `/docs` current while `/docs/intro`
 * is on screen, which is right for some site structures and wrong for others, and this component has
 * no way to know which. A caller whose routes want prefix matching normalises `currentPath` (or a
 * link's `href`) before handing it in.
 */
export function isCurrentLink(href: string, currentPath: string | undefined): boolean {
  return currentPath !== undefined && href === currentPath
}

const linkClasses =
  "flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
const activeLinkClasses = "text-gray-900 dark:text-white"

function SiteHeaderNavLink(
  { link, currentPath }: { link: SiteHeaderLink; currentPath: string | undefined },
): JSX.Element {
  const { label, href, Icon } = link
  const current = isCurrentLink(href, currentPath)

  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      class={cn(linkClasses, current && activeLinkClasses)}
    >
      {Icon && <Icon class="size-5" />}
      {label}
    </a>
  )
}

/**
 * A top bar for a public site: `brand` on the left; `links` on the right from `lg` up, and in a
 * `<details>`-built disclosure below it; `actions` and the menu button always in view, beside
 * whichever form `links` is currently taking.
 *
 * **`links` is reachable with no JavaScript.** `<details>`/`<summary>` opens and closes on a native
 * click with no script running at all, so every link is reachable before hydration and with scripts
 * off — `pages/checks/system.ts` proves it by disabling script execution and pressing the button.
 * What JavaScript adds, through `useMobilePanel`, is Escape closing the panel and returning focus to
 * the button, and an `aria-expanded` that tracks the disclosure's own state; neither is needed to
 * open the panel or reach a link inside it.
 *
 * **`links` is redrawn from data rather than duplicated as markup.** The desktop row and the panel
 * each call the same internal link renderer over `links`, which is what lets both exist at once
 * without a caller's own vnode ever being mounted twice — `actions`, being the caller's own element
 * rather than data this component owns, is rendered exactly once for the same reason.
 *
 * **The icon swap costs no JavaScript either.** `group-open:` is a Tailwind variant compiled from
 * the `<details>` element's own `[open]` attribute, so the hamburger and the X swap in CSS the
 * moment the browser opens the disclosure, whether or not the bundle has run.
 *
 * **The two `<nav>`s never coexist in the accessibility tree.** The desktop row is `hidden` below
 * `lg` and the `<details>` is `hidden` at `lg` and up, so exactly one is ever `display`ed — the
 * other is removed from the tree entirely rather than merely hidden behind `aria-hidden`, which is
 * what keeps two landmarks sharing one `aria-label` from ever being announced at the same time.
 */
export function SiteHeader(props: SiteHeaderProps): JSX.Element {
  const { links, currentPath, brand, actions, labels, class: className } = props
  const openMenuLabel = labels?.openMenu ?? "Open menu"
  const closeMenuLabel = labels?.closeMenu ?? "Close menu"
  const navLabel = labels?.nav ?? "Main navigation"
  const panelId = useId()

  const { open, detailsRef, triggerRef, handleToggle } = useMobilePanel()

  return (
    <header
      class={cn(
        "border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
        className,
      )}
    >
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-2">{brand}</div>

        <nav aria-label={navLabel} class="hidden lg:flex lg:items-center lg:gap-6">
          {links.map((link) => (
            <SiteHeaderNavLink key={link.href} link={link} currentPath={currentPath} />
          ))}
        </nav>

        <div class="flex items-center gap-3">
          {actions}

          <details ref={detailsRef} class="group lg:hidden" onToggle={handleToggle}>
            <summary
              ref={triggerRef}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={open ? closeMenuLabel : openMenuLabel}
              class="flex size-10 cursor-pointer list-none items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 [&::-webkit-details-marker]:hidden"
              data-e2e="site-header-menu-button"
            >
              <IconBars3 class="size-6 group-open:hidden" aria-hidden="true" />
              <IconXMark class="hidden size-6 group-open:block" aria-hidden="true" />
            </summary>

            <div id={panelId} class="space-y-1 pb-4 pt-2" data-e2e="site-header-panel">
              <nav aria-label={navLabel} class="flex flex-col gap-3">
                {links.map((link) => (
                  <SiteHeaderNavLink key={link.href} link={link} currentPath={currentPath} />
                ))}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
