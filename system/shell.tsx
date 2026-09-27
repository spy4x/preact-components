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
 * than duplicated into the sidebar as well. The sidebar slots (`sidebarTop`, `sidebarBottom`) are
 * drawn in both places, so they are functions the shell calls once per place rather than elements.
 *
 * Routing and persistence are ports, as in `RailShell`: a plain click on a link goes through
 * `navigate` when the caller passes one, and the desktop sidebar's collapsed state is a controlled
 * `collapsed` / `onCollapsedChange` pair the caller stores wherever it likes.
 */

import { cn } from "@spy4x/preact-cn"
import { IconBars3, IconPlus, type IconProps, IconXMark } from "@spy4x/preact-icons"
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
  /** A secondary control drawn beside this item, such as a "+" that opens a create form. */
  action?: ShellNavItemAction
}

/**
 * {@link ShellNavItem.action}: a control of its own beside an item's link, never inside it, so it is
 * a separate Tab stop with its own accessible name.
 */
export interface ShellNavItemAction {
  /** The control's accessible name. Required: only the caller knows what the control does. */
  label: string
  /** Rendered as a link when given, following {@link ShellProps.navigate} like the item's own link. */
  href?: string
  /** Called on activation. Used alone, the control is a button. */
  onClick?: () => void
  /** Drawn inside the control. Defaults to `IconPlus`. */
  Icon?: ComponentType<IconProps>
  /** `data-e2e` on the control. Defaults to `"shell-nav-action"`. */
  dataE2E?: string
}

/** Where a sidebar slot is being drawn: the desktop sidebar, or the mobile drawer's copy of it. */
export type ShellSidebarPlace = "sidebar" | "drawer"

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
  /** The desktop collapse button's accessible name. Defaults to `"Toggle sidebar"`. */
  sidebarToggle?: string
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
  /**
   * Port to the app's client router. Given, a plain left click on a nav link (or a link action)
   * calls it with the link's `href` and prevents the browser's own navigation. A click with Ctrl,
   * Meta, Shift or Alt held, or another mouse button, keeps the browser's behaviour. Without it,
   * every link is an ordinary link.
   */
  navigate?: (href: string) => void
  /**
   * Caller content above the navigation, such as a workspace switcher. Called once for the
   * sidebar and once for the drawer, because one element can only be mounted in one place; use
   * `place` to keep ids unique.
   */
  sidebarTop?: (place: ShellSidebarPlace) => ComponentChildren
  /** Caller content pinned below the navigation, such as filters or a theme control. */
  sidebarBottom?: (place: ShellSidebarPlace) => ComponentChildren
  /**
   * Whether the desktop sidebar is hidden. Controlled: the shell never changes it on its own. The
   * drawer below `lg` is not affected.
   */
  collapsed?: boolean
  /**
   * Called with the new value when the collapse button is pressed. The button is drawn only when
   * this is given; store the value wherever it should survive a reload.
   */
  onCollapsedChange?: (collapsed: boolean) => void
  labels?: ShellLabels
  /** Utilities merged over the root element's own. */
  class?: string
}

const navLinkClasses =
  "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
const navLinkActiveClasses = "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
const navActionClasses =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
const iconButtonClasses =
  "flex size-10 cursor-pointer list-none items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"

/**
 * Whether a click is one the page may take over: the primary button with no modifier. Ctrl or Meta
 * opens a new tab, Shift a new window and Alt a download, so those stay the browser's.
 */
function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
    !event.altKey
}

/** What every link in the navigation needs to follow a click: the port, and the drawer's close. */
interface ShellLinkPorts {
  navigate?: (href: string) => void
  /** Fired when this instance is inside the mobile drawer, so a navigation closes it first. */
  onNavigate?: () => void
}

/**
 * The click handler of a link at `href`. A modified click is left alone entirely, so the drawer
 * stays open behind a new tab. A plain click goes through `navigate` unless something earlier
 * already cancelled it, and closes the drawer either way.
 */
function followLink(
  href: string,
  { navigate, onNavigate }: ShellLinkPorts,
): (event: MouseEvent) => void {
  return (event) => {
    if (!isPlainClick(event)) return
    if (navigate && !event.defaultPrevented) {
      event.preventDefault()
      navigate(href)
    }
    onNavigate?.()
  }
}

function ShellNavContent(
  { name, Icon, counter }: Pick<ShellNavItem, "name" | "Icon" | "counter">,
): JSX.Element {
  return (
    <>
      {Icon && <Icon class="size-5 shrink-0" />}
      <span class="min-w-0 flex-1 truncate">{name}</span>
      {typeof counter === "number" && counter > 0 && (
        <span class="rounded-full bg-gray-100 px-2 py-px text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {counter}
        </span>
      )}
    </>
  )
}

/** {@link ShellNavItem.action}: a link or a button, a sibling of the item's own link. */
function ShellNavAction(
  { action, ports }: { action: ShellNavItemAction; ports: ShellLinkPorts },
): JSX.Element {
  const { label, href, onClick, Icon = IconPlus, dataE2E = "shell-nav-action" } = action
  const icon = <Icon class="size-4" aria-hidden="true" />
  if (href !== undefined) {
    const follow = followLink(href, ports)
    return (
      <a
        href={href}
        aria-label={label}
        class={navActionClasses}
        data-e2e={dataE2E}
        onClick={(event) => {
          if (isPlainClick(event)) onClick?.()
          follow(event)
        }}
      >
        {icon}
      </a>
    )
  }
  return (
    <button
      type="button"
      aria-label={label}
      class={cn(navActionClasses, "cursor-pointer")}
      data-e2e={dataE2E}
      onClick={() => {
        onClick?.()
        ports.onNavigate?.()
      }}
    >
      {icon}
    </button>
  )
}

/**
 * One item of {@link ShellNavItem}: a link when it has an `href`, a plain group heading otherwise —
 * `children` is what makes a heading useful, drawn by {@link ShellNavList} right after it. An item
 * with an `action` puts that control beside it, in a row, never inside the link.
 */
function ShellNavLink(
  { item, currentPath, ports }: {
    item: ShellNavItem
    currentPath: string | undefined
    ports: ShellLinkPorts
  },
): JSX.Element {
  const { name, href, Icon, counter, action } = item
  const current = href !== undefined && isCurrentLink(href, currentPath)

  const main = href === undefined
    ? (
      <span
        class={cn(
          navLinkClasses,
          "cursor-default hover:bg-transparent dark:hover:bg-transparent",
          action && "min-w-0 flex-1",
        )}
      >
        <ShellNavContent name={name} Icon={Icon} counter={counter} />
      </span>
    )
    : (
      <a
        href={href}
        aria-current={current ? "page" : undefined}
        class={cn(navLinkClasses, current && navLinkActiveClasses, action && "min-w-0 flex-1")}
        onClick={followLink(href, ports)}
      >
        <ShellNavContent name={name} Icon={Icon} counter={counter} />
      </a>
    )

  if (!action) return main
  return (
    <div class="flex items-center gap-1">
      {main}
      <ShellNavAction action={action} ports={ports} />
    </div>
  )
}

/** {@link ShellProps.navItems}, redrawn from data — see this file's own doc for why that matters. */
function ShellNavList(
  { items, currentPath, ports }: {
    items: readonly ShellNavItem[]
    currentPath: string | undefined
    ports: ShellLinkPorts
  },
): JSX.Element {
  return (
    <ul class="space-y-1">
      {items.map((item, index) => (
        <li key={`${index}-${item.name}`}>
          <ShellNavLink item={item} currentPath={currentPath} ports={ports} />
          {item.children && item.children.length > 0 && (
            <ul class="mt-1 space-y-1 pl-6">
              {item.children.map((child, childIndex) => (
                <li key={`${childIndex}-${child.name}`}>
                  <ShellNavLink item={child} currentPath={currentPath} ports={ports} />
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
 *
 * **Collapsing hides the desktop sidebar rather than shrinking it to icons.** The sidebar slots hold
 * content with no icon form (filters, a switcher), and an item may have no icon; `RailShell` is the
 * frame for a navigation of icons. The collapse button stays in the header, so the sidebar can
 * always come back, and reports its state through `aria-expanded`.
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
    navigate,
    sidebarTop,
    sidebarBottom,
    collapsed = false,
    onCollapsedChange,
    labels,
    class: className,
  } = props
  const menuLabel = labels?.menu ?? "Menu"
  const navLabel = labels?.nav ?? "Main navigation"
  const skipLabel = labels?.skipToContent ?? "Skip to content"
  const userMenuLabel = labels?.userMenu ?? "Account menu"
  const sidebarToggleLabel = labels?.sidebarToggle ?? "Toggle sidebar"
  const panelId = useId()
  const contentId = useId()
  const sidebarId = useId()

  const { open, detailsRef, triggerRef, handleToggle, close } = useMobilePanel()
  const drawerPorts: ShellLinkPorts = { navigate, onNavigate: () => close(false) }
  const sidebarPorts: ShellLinkPorts = { navigate }

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
            class={cn(iconButtonClasses, "[&::-webkit-details-marker]:hidden")}
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
            <div class="relative flex h-full w-72 max-w-[80vw] flex-col gap-4 overflow-y-auto bg-white p-4 shadow-lg dark:bg-gray-900">
              {sidebarTop && <div data-e2e="shell-sidebar-top">{sidebarTop("drawer")}</div>}
              <nav aria-label={navLabel} class="flex-1">
                <ShellNavList items={navItems} currentPath={currentPath} ports={drawerPorts} />
              </nav>
              {sidebarBottom && <div data-e2e="shell-sidebar-bottom">{sidebarBottom("drawer")}
              </div>}
            </div>
          </div>
        </details>

        {onCollapsedChange && (
          <button
            type="button"
            aria-label={sidebarToggleLabel}
            aria-expanded={!collapsed}
            aria-controls={sidebarId}
            class={cn(iconButtonClasses, "hidden lg:flex")}
            data-e2e="shell-sidebar-toggle"
            onClick={() => onCollapsedChange(!collapsed)}
          >
            <IconBars3 class="size-6" aria-hidden="true" />
          </button>
        )}

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
        {
          /* Hidden by `collapsed` at every width; below `lg` it is hidden anyway, the drawer being
            the navigation there. The inner column sticks under the header and is at most one
            screen tall, so `sidebarBottom` stays in view on a long page. */
        }
        <aside
          id={sidebarId}
          class={cn(
            "hidden shrink-0 border-r border-gray-200 dark:border-gray-700 lg:w-64",
            !collapsed && "lg:block",
          )}
          data-e2e="shell-sidebar"
        >
          <div class="sticky top-16 flex h-[calc(100dvh-4rem)] max-h-full flex-col gap-4 overflow-y-auto p-4">
            {sidebarTop && <div data-e2e="shell-sidebar-top">{sidebarTop("sidebar")}</div>}
            <nav aria-label={navLabel} class="flex-1">
              <ShellNavList items={navItems} currentPath={currentPath} ports={sidebarPorts} />
            </nav>
            {sidebarBottom && <div data-e2e="shell-sidebar-bottom">{sidebarBottom("sidebar")}</div>}
          </div>
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
