/**
 * `Shell` — the frame every signed-in app built from `spy4x/template` needs: a top bar, a side
 * navigation that collapses into a mobile drawer, a user menu, and a content area with a skip link
 * in front of all of it.
 *
 * Extracted from two source applications' own shells, neither of which could be ported as-is: both
 * read their app's state directly — who is signed in, the connection status, the brand name — and
 * one ran an effect at import time. This version takes every one of those as a prop or a port
 * instead, per `AGENTS.md`'s component rules: no router import, no app state, no hard-coded link,
 * brand text or URL.
 *
 * The mobile drawer reuses `useMobilePanel` — the same `<details>`-based disclosure `SiteHeader`
 * uses (#139) — rather than a second implementation of the same open/close behaviour. `navItems` is
 * rendered from data twice, once for the desktop sidebar and once inside the drawer, the same way
 * `SiteHeader`'s `links` are: a caller's own vnode can only ever be mounted in one place, so `brand`
 * and `status`, both caller-supplied elements, are rendered exactly once each, in the header, rather
 * than duplicated into the sidebar as well.
 */

import { cn } from "@spy4x/preact-cn"
import { IconBars3, type IconProps, IconXMark } from "@spy4x/preact-icons"
import { Avatar } from "@spy4x/preact-ui/avatar"
import { Dropdown, DropdownItem } from "@spy4x/preact-ui/dropdown"
import type { ComponentChildren, ComponentType, JSX } from "preact"
import { useId } from "preact/hooks"
import { isCurrentLink } from "./site-header.tsx"
import { useMobilePanel } from "./mobile-panel.ts"

/** One entry of {@link ShellProps.navItems}, or of one entry's own `children`. */
export interface ShellNavItem {
  /** Visible text and the link's accessible name. */
  name: string
  /** Rendered as a link when given; a heading with no link otherwise — see {@link children}. */
  href?: string
  /** Rendered at `size-5` beside `name`, in every place this item is drawn. */
  Icon?: ComponentType<IconProps>
  /** A count shown as a trailing badge. Omitted for `undefined`, `0` or a negative number. */
  counter?: number
  /**
   * Sub-items, drawn nested and always visible beneath this one. An item with `children` is a
   * group heading rather than a link unless it also has an `href` of its own.
   */
  children?: readonly ShellNavItem[]
}

/** {@link ShellProps.user}, or `null` for a signed-out visitor — the user menu renders only then. */
export interface ShellUser {
  /** The user menu trigger's accessible name comes from here, via `Avatar`. */
  name: string
  email?: string
  avatarUrl?: string
}

/** One entry of {@link ShellProps.userMenuItems}. */
export interface ShellUserMenuItem {
  label: string
  /** Rendered as a link when given; a button otherwise. */
  href?: string
  onClick?: () => void
  /** `data-e2e` on the rendered menu item, for an app's end-to-end tests. */
  dataE2E?: string
}

/** Every user-visible or accessible string `Shell` prints that is not data the caller supplied. */
export interface ShellLabels {
  /** The mobile menu button's accessible name. Defaults to `"Menu"`. */
  menu?: string
  /** `aria-label` shared by the desktop sidebar's `<nav>` and the mobile drawer's copy of it. */
  nav?: string
  /** The skip link's visible text. Defaults to `"Skip to content"`. */
  skipToContent?: string
  /** `aria-label` on the user menu's panel. Defaults to `"Account menu"`. */
  userMenu?: string
}

export interface ShellProps {
  /** The navigation, in display order. Rendered once for the desktop sidebar, once in the drawer. */
  navItems: readonly ShellNavItem[]
  /** Compared against every item's `href` to mark the current page. No item is current by default. */
  currentPath?: string
  /** The logo/name slot. Rendered once, in the header, exactly as given. */
  brand: ComponentChildren
  /** The signed-in user, or `null` to render no user menu at all. */
  user: ShellUser | null
  /** The user menu's own items. Ignored when {@link user} is `null`. */
  userMenuItems?: readonly ShellUserMenuItem[]
  /** A trailing header slot, e.g. a connection indicator. Rendered once, in the header. */
  status?: ComponentChildren
  /** The page. Lands inside the skip link's target, a `<main>` this component owns. */
  children: ComponentChildren
  labels?: ShellLabels
  /** Utilities merged over the root element's own. */
  class?: string
}

const navLinkClasses =
  "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
const navLinkActiveClasses = "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"

function ShellNavContent(
  { name, Icon, counter }: Pick<ShellNavItem, "name" | "Icon" | "counter">,
): JSX.Element {
  return (
    <>
      {Icon && <Icon class="size-5 shrink-0" />}
      <span class="min-w-0 flex-1 truncate">{name}</span>
      {typeof counter === "number" && counter > 0 && (
        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {counter}
        </span>
      )}
    </>
  )
}

/**
 * One item of {@link ShellNavItem}: a link when it has an `href`, a plain group heading otherwise —
 * `children` is what makes a heading useful, drawn by {@link ShellNavList} right after it.
 */
function ShellNavLink(
  { item, currentPath, onNavigate }: {
    item: ShellNavItem
    currentPath: string | undefined
    /** Fired when this instance is inside the mobile drawer, so a navigation closes it first. */
    onNavigate?: () => void
  },
): JSX.Element {
  const { name, href, Icon, counter } = item
  const current = href !== undefined && isCurrentLink(href, currentPath)

  if (href === undefined) {
    return (
      <span
        class={cn(navLinkClasses, "cursor-default hover:bg-transparent dark:hover:bg-transparent")}
      >
        <ShellNavContent name={name} Icon={Icon} counter={counter} />
      </span>
    )
  }

  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      class={cn(navLinkClasses, current && navLinkActiveClasses)}
      onClick={onNavigate}
    >
      <ShellNavContent name={name} Icon={Icon} counter={counter} />
    </a>
  )
}

/** {@link ShellProps.navItems}, redrawn from data — see this file's own doc for why that matters. */
function ShellNavList(
  { items, currentPath, onNavigate }: {
    items: readonly ShellNavItem[]
    currentPath: string | undefined
    onNavigate?: () => void
  },
): JSX.Element {
  return (
    <ul class="space-y-1">
      {items.map((item, index) => (
        <li key={`${index}-${item.name}`}>
          <ShellNavLink item={item} currentPath={currentPath} onNavigate={onNavigate} />
          {item.children && item.children.length > 0 && (
            <ul class="mt-1 space-y-1 pl-6">
              {item.children.map((child, childIndex) => (
                <li key={`${childIndex}-${child.name}`}>
                  <ShellNavLink item={child} currentPath={currentPath} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The frame for a signed-in app: a header (menu button, brand, status, user menu) that is always in
 * view, a sidebar below it from `lg` up, and the same navigation in a `<details>`-built drawer below
 * `lg` — see `mobile-panel.ts`.
 *
 * **The skip link is the first focusable element on the page.** It targets `<main>`, which this
 * component gives `tabindex="-1"` so activating the link moves focus there — not only the address
 * bar's hash — for a visitor who does not want to tab through the whole navigation first.
 *
 * **The header and the drawer never overlap, and the header is drawn on top regardless.** The
 * drawer's overlay starts below the header's own height (`top-16`, matching the header's `h-16`)
 * and sits at a lower `z-index`, so the menu button, `status` and the user menu all stay reachable
 * while the drawer is open — which is what lets the user menu's Escape and the drawer's Escape stay
 * scoped to whichever one a visitor actually has open, proven in `pages/checks/system.ts` by opening
 * both at once and pressing Escape.
 *
 * **The user menu names itself from `Avatar`.** `Dropdown`'s `triggerNamedByContent` is what lets an
 * accessible name computed from `Avatar`'s own `alt`/`aria-label` — the user's name — become the
 * trigger button's name, the same way `DateRangePicker` names its own trigger.
 */
export function Shell(props: ShellProps): JSX.Element {
  const {
    navItems,
    currentPath,
    brand,
    user,
    userMenuItems = [],
    status,
    children,
    labels,
    class: className,
  } = props
  const menuLabel = labels?.menu ?? "Menu"
  const navLabel = labels?.nav ?? "Main navigation"
  const skipLabel = labels?.skipToContent ?? "Skip to content"
  const userMenuLabel = labels?.userMenu ?? "Account menu"
  const panelId = useId()
  const contentId = useId()

  const { open, detailsRef, triggerRef, handleToggle, close } = useMobilePanel()

  return (
    <div class={cn("flex min-h-screen flex-col", className)}>
      <a
        href={`#${contentId}`}
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-900 focus:shadow-lg dark:focus:bg-gray-900 dark:focus:text-white"
        data-e2e="shell-skip-link"
      >
        {skipLabel}
      </a>

      <header
        class="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900"
        data-e2e="shell-header"
      >
        <details ref={detailsRef} class="group lg:hidden" onToggle={handleToggle}>
          <summary
            ref={triggerRef}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={menuLabel}
            class="flex size-10 cursor-pointer list-none items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 [&::-webkit-details-marker]:hidden"
            data-e2e="shell-menu-button"
          >
            <IconBars3 class="size-6 group-open:hidden" aria-hidden="true" />
            <IconXMark class="hidden size-6 group-open:block" aria-hidden="true" />
          </summary>

          <div id={panelId} class="fixed inset-x-0 bottom-0 top-16 z-20" data-e2e="shell-panel">
            {
              /* A tap here is a dismiss by pointer, not a request for keyboard focus back — the
                same reasoning `onNavigate` below uses `close(false)` for, so a scrim tap does too:
                nothing the visitor touched needs focus returned to it, and pulling focus back onto
                the now-hidden menu button would be a surprise for a tap that landed a whole panel
                away from it. */
            }
            <div
              class="absolute inset-0 bg-gray-900/25"
              aria-hidden="true"
              data-e2e="shell-scrim"
              onClick={() => close(false)}
            />
            <nav
              aria-label={navLabel}
              class="relative h-full w-72 max-w-[80vw] overflow-y-auto bg-white p-4 shadow-lg dark:bg-gray-900"
            >
              <ShellNavList
                items={navItems}
                currentPath={currentPath}
                onNavigate={() => close(false)}
              />
            </nav>
          </div>
        </details>

        <div class="flex items-center gap-2" data-e2e="shell-brand">{brand}</div>

        <div class="flex flex-1 items-center justify-end gap-4">
          {status}
          {user && (
            <Dropdown
              trigger={<Avatar name={user.name} src={user.avatarUrl} size="sm" />}
              triggerNamedByContent
              triggerDataE2E="shell-user-menu-button"
              menuLabel={userMenuLabel}
              // The drawer's own panel sits at z-20 inside this header's sticky z-30 stacking
              // context; left at Dropdown's default z-10, the drawer painted over the open menu at
              // phone width and swallowed every click meant for it. z-30 keeps the menu above both.
              panelClasses="z-30"
            >
              {userMenuItems.map((item, index) => (
                <DropdownItem
                  key={`${index}-${item.label}`}
                  href={item.href}
                  onClick={item.onClick}
                  dataE2E={item.dataE2E}
                >
                  {item.label}
                </DropdownItem>
              ))}
            </Dropdown>
          )}
        </div>
      </header>

      <div class="flex flex-1">
        <aside
          class="hidden shrink-0 border-r border-gray-200 dark:border-gray-700 lg:block lg:w-64"
          data-e2e="shell-sidebar"
        >
          <nav aria-label={navLabel} class="space-y-1 p-4">
            <ShellNavList items={navItems} currentPath={currentPath} />
          </nav>
        </aside>

        <main
          id={contentId}
          tabindex={-1}
          class="min-w-0 flex-1 p-4 focus:outline-none"
          data-e2e="shell-content"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
