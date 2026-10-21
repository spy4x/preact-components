/**
 * `AppShell` — all the chrome around an app's page, so every app (each product and its admin
 * panel) looks made by one person. An app passes data and nothing else: its destinations, the
 * signed-in person, the unread count, the connection, and the page.
 *
 * It is the icons variant of `Rail` with the house's bottom zone filled in: the connection while it
 * is not live, the bell with its unread count, and the account menu. Below `md` the tab bar's last
 * slot is the account, the avatar with the unread count, opening a sheet with the switcher, the
 * destinations that did not fit, Notifications and the account menu's choices. It draws no brand
 * mark and no top bar: the page starts with its own `PageHeader`.
 *
 * Props and ports only: nothing is read from app state or the window, and every label has an
 * English default and an override.
 *
 * @module
 */

import { cn } from "@spy4x/preact-cn"
import { IconAlertTriangle, IconBell, type IconProps } from "@spy4x/preact-icons"
import { Avatar } from "@spy4x/preact-ui/avatar"
import { useApplePlatform } from "@spy4x/preact-ui/hotkeys"
import { Kbd, type KbdLabels } from "@spy4x/preact-ui/kbd"
import { followLinkClick } from "@spy4x/preact-ui/link"
import type { ComponentChildren, ComponentType, JSX } from "preact"
import { useId } from "preact/hooks"
import {
  AccountMenu,
  type AccountMenuItem,
  type AccountMenuLabels,
  type AccountMenuTheme,
  type AccountMenuUser,
} from "./account-menu.tsx"
import { type AccountControlProps, AccountEntry, AccountIdentity } from "./account-parts.tsx"
import { Rail, type RailItem, type RailPlace } from "./rail.tsx"
import {
  currentStates,
  Entry,
  entryCurrent,
  entryIdle,
  entryKeyShortcuts,
  focusRing,
  iconsCell,
  RailCell,
  sectionRule,
} from "./rail-parts.tsx"

/** One destination of {@link AppShellProps.items}: always a link with an icon. */
export interface AppShellItem extends RailItem {
  /** Where the destination lives. */
  href: string
  /** The cell's icon; the label is its name and tooltip. */
  Icon: ComponentType<IconProps>
}

/** The realtime connection's state, as an app's socket reports it. */
export type AppShellConnection = "idle" | "connecting" | "open" | "closed" | "reconnecting"

/** {@link AppShellProps.notifications}: where the bell leads and how many are unread. */
export interface AppShellNotifications {
  href: string
  /** Drawn as a badge on the bell and the account tab; "99+" past 99. */
  unread?: number
}

/** {@link AppShellProps.account}: the signed-in person and what their menu offers. */
export interface AppShellAccount {
  /**
   * The signed-in person. Left out while the app does not know yet: the avatar's place shows a
   * plain shape after 300 ms, and the rest of the shell renders at once.
   */
  user?: AccountMenuUser
  /** The menu's own items, first, such as "Profile". */
  items?: readonly AccountMenuItem[]
  /** The current theme preference. Defaults to `"system"`. */
  theme?: AccountMenuTheme
  /** Called with the chosen preference; the theme choice is drawn only when this is given. */
  onThemeChange?: (theme: AccountMenuTheme) => void
  /** The last item, such as a sign-out form post. */
  signOut?: AccountMenuItem
  /**
   * The role the person is signed in as, such as `"Admin"` in an admin panel: a neutral badge under
   * the avatar and in the menu's header, the phone's last tab's label and the sheet's heading, and
   * part of the account button's name.
   */
  tag?: string
}

/** Every string `AppShell` prints that is not data the caller supplied. */
export interface AppShellLabels {
  /** The `<nav>` name. Defaults to `"Main navigation"`. */
  nav?: string
  /** The column's `<aside>` name. Defaults to `"Sidebar"`. */
  sidebar?: string
  /** The phone's last tab and the sheet's heading, without a tag. Defaults to `"Account"`. */
  account?: string
  /** The sheet's close button. Defaults to `"Close"`. */
  close?: string
  /** The skip link. Defaults to `"Skip to content"`. */
  skipToContent?: string
  /** The words a count adds to a name. Defaults to `(count) => \`${count} unread\``. */
  counter?: (count: number) => string
  /** The bell's label and tooltip. Defaults to `"Notifications"`. */
  notifications?: string
  /**
   * The connection's words, spoken by the live region and shown while it is not live. Defaults:
   * idle and closed "Offline", connecting "Connecting…", open "Online", reconnecting
   * "Reconnecting…".
   */
  connection?: Partial<Record<AppShellConnection, string>>
  /**
   * The account button's name. Defaults to "Account: Ada Lovelace" and, with a tag,
   * "Account: Ada Lovelace, Admin".
   */
  accountTrigger?: (name: string, tag?: string) => string
  /** The account menu's own labels: its name and the theme choice's words. */
  accountMenu?: Omit<AccountMenuLabels, "trigger">
  /** The words a key shortcut's hint shows in a tooltip, as `RailLabels.kbd`. */
  kbd?: Partial<KbdLabels>
}

/** Everything `AppShell` draws comes from here. */
export interface AppShellProps {
  /** The daily destinations. At most four reach the phone bar; the rest go to the sheet. */
  items: readonly AppShellItem[]
  /** The current item's key: `aria-current="page"`. */
  currentKey?: string
  /** The current path: `aria-current="page"` on an exact match, `"true"` inside a section. */
  currentPath?: string
  /**
   * Port to the app's router: a plain left click on any shell link calls it with the link's `href`
   * instead of loading the page. Modified clicks stay the browser's.
   */
  navigate?: (href: string) => void
  /**
   * The workspace switcher: a 40 px tile with its menu in the column (`"rail"`), the group list in
   * the sheet (`"sheet"`). Left out, the column's top zone is empty.
   */
  switcher?: (place: RailPlace) => ComponentChildren
  /** The bell. Left out, there is none. */
  notifications?: AppShellNotifications
  /** The signed-in person and their menu. */
  account: AppShellAccount
  /** The realtime connection. Left out, the live region stays empty and nothing is drawn. */
  connection?: AppShellConnection
  /** Content at the top of the page's column, above the page's own header. */
  banner?: ComponentChildren
  /** The page column's width: 48 rem by default, 64 rem for tables. Nothing else sets a width. */
  width?: "default" | "wide"
  /** The page. Lands in `<main>`. */
  children: ComponentChildren
  labels?: AppShellLabels
  /** Utilities merged over the root element's own. */
  class?: string
}

const CONNECTION_WORDS: Record<AppShellConnection, string> = {
  idle: "Offline",
  connecting: "Connecting…",
  open: "Online",
  closed: "Offline",
  reconnecting: "Reconnecting…",
}

/** Whether the connection is news to the person: not live, and not about to be. */
function connectionIsNews(connection: AppShellConnection | undefined): boolean {
  return connection === "idle" || connection === "closed" || connection === "reconnecting"
}

/** The account button's name: "Account: Ada Lovelace", with ", Admin" for a tag. */
function defaultTrigger(name: string, tag?: string): string {
  return tag ? `Account: ${name}, ${tag}` : `Account: ${name}`
}

/** The account cell's trigger: a 48 px cell, taller with a tag under the avatar. */
const accountTrigger = cn(
  "flex size-12 cursor-pointer items-center justify-center rounded-[var(--radius-primary,0.5rem)] motion-safe:transition-colors motion-safe:duration-150",
  "hover:bg-[var(--color-hover,oklch(0.967_0.003_264.542))]",
  focusRing,
)

/**
 * The account menu beside the rail: its bottom on the avatar's, its left edge 8 px past the rail's
 * border (the cell ends 12 px before it), 240 px wide.
 */
const accountPanel =
  "bottom-0 left-[calc(100%+1.25rem)] mb-0 w-60 rounded-[var(--radius-card,0.75rem)]"

/** A row of the sheet's account section. */
const sheetRow = cn(
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-primary,0.5rem)] px-3 py-2 text-left text-sm font-medium",
  focusRing,
  entryIdle,
)

/** A plain shape where the avatar goes, drawn 300 ms after the shell, while the user is unknown. */
function PendingAvatar({ size }: { size: "size-6" | "size-8" }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      class={cn(
        "block rounded-full bg-[var(--color-canvas,oklch(0.967_0.003_264.542))] transition-opacity delay-300 duration-0 starting:opacity-0",
        size,
      )}
      data-e2e="app-shell-account-pending"
    />
  )
}

/**
 * The control of one row of the sheet's account section, for `AccountEntry`: a link through the
 * router, or a button. A button closes the sheet through `data-rail-close`; `Rail` closes it on a
 * link's plain click itself, and leaves it open on a modified one.
 */
function SheetControl(
  { href, navigate, onClick, type = "button", keyshortcuts, dataE2E, children }:
    AccountControlProps,
): JSX.Element {
  const apple = useApplePlatform()
  const shortcuts = entryKeyShortcuts(keyshortcuts, apple)
  const first = keyshortcuts?.[0]
  // Hidden from screen readers, which hear `aria-keyshortcuts`, and where the pointer is coarse.
  const hint = first === undefined ? null : (
    <span
      aria-hidden="true"
      data-account-key-hint=""
      class="ml-auto hidden pointer-fine:inline-flex"
    >
      <Kbd keys={first} apple={apple} />
    </span>
  )
  if (href !== undefined) {
    return (
      <a
        href={href}
        class={sheetRow}
        aria-keyshortcuts={shortcuts}
        data-e2e={dataE2E}
        onClick={(event) => {
          onClick?.()
          followLinkClick(event, { href, navigate })
        }}
      >
        {children}
        {hint}
      </a>
    )
  }
  return (
    <button
      type={type}
      class={sheetRow}
      aria-keyshortcuts={shortcuts}
      data-rail-close=""
      data-e2e={dataE2E}
      onClick={onClick}
    >
      {children}
      {hint}
    </button>
  )
}

/**
 * The frame every app draws: a skip link, the 72 px rail from `md`, the page in one centred column,
 * and on a phone the tab bar and its sheet.
 *
 * **The bottom zone,** top to bottom: the connection while it is idle, closed or reconnecting (a
 * warning cell whose tooltip carries the word), the bell named "Notifications, 3 unread", and the
 * account cell: the 32 px avatar, with the `tag` as a neutral badge under it, opening `AccountMenu`
 * to the right of the rail with a header row of the name, e-mail and tag. Its button is named
 * "Account: Ada Lovelace, Admin", and its tooltip, the person's name, hides while the menu is open.
 *
 * **The connection has one live region,** `role="status"` with `data-e2e="shell-ws-status"`,
 * outside the rail and always present, so the word is spoken once wherever it is drawn. On a phone
 * the word shows as a one-line strip docked on top of the tab bar, so it never covers the page.
 *
 * **The page column** is centred: `px-4 md:px-8`, `py-6 sm:py-8`, at most 48 rem (`"default"`) or
 * 64 rem (`"wide"`), with `banner` above the page.
 *
 * **On a phone** the last tab is the account: the 24 px avatar, the unread count, and "Account"
 * (the `tag`, such as "Admin", in its place). Its sheet, headed the same, holds the switcher, the
 * destinations that did not fit, Notifications, then the account: a header row, the menu's items,
 * the theme as a radio group of three segments, and the sign-out last. Every row is at least 44 px.
 * Choosing a row closes the sheet, unless the click opens it elsewhere (a modifier held) or picks a
 * theme, and closing returns focus to the tab.
 */
export function AppShell(props: AppShellProps): JSX.Element {
  const {
    items,
    currentKey,
    currentPath,
    navigate,
    switcher,
    notifications,
    account,
    connection,
    banner,
    width = "default",
    children,
    labels,
    class: className,
  } = props
  const { user, tag } = account
  const counterWords = labels?.counter ?? ((count: number) => `${count} unread`)
  const tabLabel = tag ?? labels?.account ?? "Account"
  const bellLabel = labels?.notifications ?? "Notifications"
  const connectionWord = connection === undefined
    ? ""
    : labels?.connection?.[connection] ?? CONNECTION_WORDS[connection]
  const news = connectionIsNews(connection)
  const triggerName = user && (labels?.accountTrigger ?? defaultTrigger)(user.name, tag)
  const themeId = useId()

  const bell: AppShellItem | undefined = notifications && {
    key: "notifications",
    label: bellLabel,
    href: notifications.href,
    Icon: IconBell,
    counter: notifications.unread,
  }
  const bellCurrent = bell && currentStates([bell], undefined, currentPath).get(bell)
  const navigateLink = navigate && ((_key: string, href: string) => navigate(href))
  const entryPorts = { navigateLink, counterWords, variant: "icons" as const, primary: false }
  const themes: readonly [AccountMenuTheme, string][] = [
    ["system", labels?.accountMenu?.system ?? "System"],
    ["light", labels?.accountMenu?.light ?? "Light"],
    ["dark", labels?.accountMenu?.dark ?? "Dark"],
  ]

  const railBottom = (
    <>
      {news && (
        <RailCell tip={connectionWord} dataE2E="app-shell-connection">
          <span
            aria-hidden="true"
            class={cn(
              "flex flex-col items-center rounded-[var(--radius-primary,0.5rem)] bg-warning-soft text-xs font-medium text-warning",
              iconsCell,
            )}
          >
            <IconAlertTriangle class="size-6 shrink-0" />
            <span class="sr-only [@media(hover:none)]:not-sr-only">{connectionWord}</span>
          </span>
        </RailCell>
      )}
      {bell && <Entry item={bell} place="rail" current={bellCurrent} {...entryPorts} />}
      {user
        ? (
          <RailCell tip={user.name} dataE2E="app-shell-account">
            <AccountMenu
              user={user}
              items={account.items}
              theme={account.theme}
              onThemeChange={account.onThemeChange}
              signOut={account.signOut}
              display="avatar"
              tag={tag}
              header
              navigate={navigate}
              triggerClasses={cn(accountTrigger, tag && "h-auto min-h-14 py-2")}
              panelClasses={accountPanel}
              labels={{ ...labels?.accountMenu, trigger: triggerName }}
            />
          </RailCell>
        )
        : (
          <div class="flex size-12 items-center justify-center">
            <PendingAvatar size="size-8" />
          </div>
        )}
    </>
  )

  const sheetBottom = (
    <div class={cn("flex flex-col", sectionRule)}>
      {bell && (
        <div class="py-2 first:pt-0">
          <Entry item={bell} place="sheet" current={bellCurrent} {...entryPorts} />
        </div>
      )}
      {user && (
        <div class="flex flex-col gap-1 py-2 first:pt-0" data-e2e="app-shell-sheet-account">
          <div class="flex items-center gap-3 px-3 py-2" data-e2e="app-shell-sheet-account-header">
            <AccountIdentity user={user} tag={tag} />
          </div>
          {(account.items ?? []).map((item, index) => (
            <AccountEntry
              key={`${index}-${item.label}`}
              item={item}
              navigate={navigate}
              Control={SheetControl}
            />
          ))}
          {account.onThemeChange && (
            <div role="radiogroup" aria-labelledby={themeId} data-e2e="app-shell-sheet-theme">
              <div id={themeId} class="px-3 pt-2 pb-1 text-xs font-medium text-muted">
                {labels?.accountMenu?.theme ?? "Theme"}
              </div>
              <div class="flex gap-1 px-3">
                {themes.map(([value, label]) => {
                  const checked = (account.theme ?? "system") === value
                  // The radio covers its segment, invisible, so it takes the click and draws the
                  // focus ring; the label's text names it. The sheet stays open on a choice.
                  return (
                    <label
                      key={value}
                      class={cn(
                        "relative flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-primary,0.5rem)] px-2 text-sm font-medium",
                        checked ? entryCurrent : entryIdle,
                      )}
                    >
                      <input
                        type="radio"
                        name={`${themeId}-choice`}
                        value={value}
                        checked={checked}
                        class={cn(
                          "absolute inset-0 m-0 cursor-pointer appearance-none rounded-[var(--radius-primary,0.5rem)] bg-transparent",
                          focusRing,
                        )}
                        onChange={() => account.onThemeChange?.(value)}
                        data-e2e={`app-shell-theme-${value}`}
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {account.signOut && (
            <AccountEntry item={account.signOut} navigate={navigate} Control={SheetControl} />
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      <span class="sr-only" role="status" data-e2e="shell-ws-status">{connectionWord}</span>
      <Rail
        variant="icons"
        items={items}
        currentKey={currentKey}
        currentPath={currentPath}
        navigateLink={navigateLink}
        top={switcher}
        bottom={(place) => place === "rail" ? railBottom : sheetBottom}
        moreTab={{
          icon: user
            ? <Avatar name={user.name} src={user.avatarUrl} size="xs" alt="" />
            : <PendingAvatar size="size-6" />,
          counter: notifications?.unread,
        }}
        tabBarNotice={news && (
          <div
            aria-hidden="true"
            class="flex min-h-8 items-center gap-2 border-t border-subtle bg-warning-soft px-4 text-xs font-medium text-warning"
            data-e2e="app-shell-offline-strip"
          >
            <IconAlertTriangle class="size-4 shrink-0" />
            {connectionWord}
          </div>
        )}
        labels={{
          nav: labels?.nav,
          sidebar: labels?.sidebar,
          more: tabLabel,
          close: labels?.close,
          skipToContent: labels?.skipToContent,
          counter: counterWords,
          kbd: labels?.kbd,
        }}
        class={className}
      >
        <div class="px-4 py-6 sm:py-8 md:px-8">
          <div
            class={cn("mx-auto w-full", width === "wide" ? "max-w-5xl" : "max-w-3xl")}
            data-e2e="app-shell-content"
          >
            {banner && <div class="mb-6" data-e2e="app-shell-banner">{banner}</div>}
            {children}
          </div>
        </div>
      </Rail>
    </>
  )
}
