/**
 * `AccountMenu` — the signed-in person's menu: a trigger showing who is signed in, and a menu of
 * the caller's items, an optional theme choice and an optional "Sign out".
 *
 * Extracted from `Shell`'s built-in user menu (#756) so `RailShell`'s sidebar can carry the same
 * menu at its bottom: `Shell` draws it as an avatar in its header, a sidebar draws it as the avatar,
 * name and e-mail on one wide button whose menu opens upward. It is `ui/`'s `Dropdown` underneath,
 * so the keyboard, the no-JavaScript `<details>` fallback and the focus moves are that component's.
 *
 * Props and ports only: the person, the items, the theme and every label come from the caller; the
 * theme choice reports through `onThemeChange` and stores nothing.
 */

import { cn } from "@spy4x/preact-cn"
import { IconChevronDown } from "@spy4x/preact-icons"
import { Avatar } from "@spy4x/preact-ui/avatar"
import { Dropdown, DropdownItem } from "@spy4x/preact-ui/dropdown"
import type { JSX } from "preact"

/** The signed-in person {@link AccountMenu} names and draws. */
export interface AccountMenuUser {
  /** Visible on the wide trigger, and the avatar trigger's accessible name, via `Avatar`. */
  name: string
  /** Drawn under the name on the wide trigger. */
  email?: string
  avatarUrl?: string
}

/**
 * One entry of {@link AccountMenuProps.items}: a link (`href`), a form post (`action`), or a button
 * (neither).
 */
export interface AccountMenuItem {
  label: string
  /** Rendered as a link when given and {@link action} is not; a button when neither is given. */
  href?: string
  /**
   * Rendered as a `<form method="post">` to this address, with the item as its submit button: a
   * real form post that needs no client code to reach the server once the menu is open — a
   * sign-out, for instance, which must not be a link. The menu itself still needs JavaScript to
   * open. Takes precedence over {@link href}.
   */
  action?: string
  /** The form's method when {@link action} is given. Only `"post"`, which is also the default. */
  method?: "post"
  /**
   * Called on activation. On an {@link action} item it runs on submit, once hydrated, and cancels
   * the browser's own post, so the app can sign out through its own client instead.
   */
  onClick?: () => void
  /** `data-e2e` on the rendered menu item, for an app's end-to-end tests. */
  dataE2E?: string
}

/** The theme preferences {@link AccountMenu} offers; `"system"` follows the device. */
export type AccountMenuTheme = "system" | "light" | "dark"

/** Every string {@link AccountMenu} prints that is not data the caller supplied. */
export interface AccountMenuLabels {
  /** `aria-label` on the open menu. Defaults to `"Account menu"`. */
  menu?: string
  /**
   * The trigger's accessible name. Left out, the trigger is named by what it shows: the person's
   * name (and, on the wide trigger, the e-mail after it).
   */
  trigger?: string
  /** The theme choice's group name, shown above its three items. Defaults to `"Theme"`. */
  theme?: string
  /** Defaults to `"System"`. */
  system?: string
  /** Defaults to `"Light"`. */
  light?: string
  /** Defaults to `"Dark"`. */
  dark?: string
}

export interface AccountMenuProps {
  /** The signed-in person. */
  user: AccountMenuUser
  /** The caller's own items, first in the menu, such as "Profile". */
  items?: readonly AccountMenuItem[]
  /** The current theme preference, marked as checked in the theme choice. Defaults to `"system"`. */
  theme?: AccountMenuTheme
  /**
   * Called with the chosen preference. The theme choice (System, Light, Dark) is drawn only when
   * this is given, after {@link items}.
   */
  onThemeChange?: (theme: AccountMenuTheme) => void
  /** The last item, after a divider, such as a sign-out form post. Left out, there is none. */
  signOut?: AccountMenuItem
  /**
   * What the trigger shows. `"full"`, the default, is a wide button with the avatar, the name and
   * the e-mail, for a sidebar. `"avatar"` is the avatar alone, for a header or an icon rail.
   */
  display?: "full" | "avatar"
  /** Which way the menu opens. Defaults to `"up"`, for a trigger at the bottom of a sidebar. */
  vertical?: "auto" | "up" | "down"
  /** Which edge of the trigger the menu lines up with. Defaults to `"left"`. */
  horizontal?: "left" | "right"
  /**
   * Port to the app's client router. Given, a plain left click on a link item (one with an
   * {@link AccountMenuItem.href} and no {@link AccountMenuItem.action}) calls it with the item's
   * `href` instead of the browser following the link, so choosing "Profile" does not reload the
   * app. A click with a modifier held, a middle click and a link to another origin stay the
   * browser's, as on `DropdownItem`. Ignored on items without `href` and on form posts. Without it,
   * every link is an ordinary link.
   */
  navigate?: (href: string) => void
  /** `data-e2e` on the trigger. Defaults to `"account-menu-button"`. */
  dataE2E?: string
  labels?: AccountMenuLabels
}

/**
 * One menu item: a form post when it has an `action`, `DropdownItem`'s link or button otherwise.
 *
 * The form carries `role="none"`, so the accessibility tree keeps the submit button as the menu's
 * own item, the way `Dropdown` expects its items to sit in a wrapper with no role of its own. The
 * button is a `DropdownItem` with `type="submit"`, so it follows its `Dropdown` like every other
 * item: a plain submit button in the tab order before hydration, a `role="menuitem"` out of the tab
 * order after, which `Dropdown` finds for the arrow keys and closes on its click (#535, #537).
 */
function AccountMenuEntry(
  { item, navigate }: { item: AccountMenuItem; navigate?: (href: string) => void },
): JSX.Element {
  const { label, href, action, method = "post", onClick, dataE2E } = item
  if (action === undefined) {
    return (
      <DropdownItem href={href} navigate={navigate} onClick={onClick} dataE2E={dataE2E}>
        {label}
      </DropdownItem>
    )
  }
  return (
    <form
      method={method}
      action={action}
      role="none"
      onSubmit={(event) => {
        if (!onClick) return
        event.preventDefault()
        onClick()
      }}
    >
      <DropdownItem type="submit" dataE2E={dataE2E}>{label}</DropdownItem>
    </form>
  )
}

const fullTriggerClasses =
  "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2"

/**
 * The account menu: a `Dropdown` whose trigger shows the signed-in person, holding the caller's
 * items, then the theme choice, then "Sign out" after a divider.
 *
 * **The theme choice is a set of radio items.** System, Light and Dark are `DropdownItem`s with
 * `checked`, so each is a `menuitemradio` with `aria-checked`, inside a `role="group"` named by the
 * visible "Theme" heading. Choosing one calls `onThemeChange` and closes the menu like any item.
 *
 * **The wide trigger names itself from its text.** The avatar beside the name is decorative there
 * (`alt=""`), because the name is already printed next to it; the avatar-only trigger is named by
 * `Avatar`'s own label, the person's name, as `Shell`'s header menu always was. `labels.trigger`
 * replaces either with a name of the caller's, such as "Account: Ada Lovelace".
 *
 * **The panel sits at `z-30`.** `Shell`'s mobile drawer is `z-20` inside its sticky `z-30` header,
 * and `RailShell`'s tab bar is `z-10`; at `Dropdown`'s default `z-10` the drawer painted over the
 * open menu at phone width and swallowed every click meant for it.
 */
export function AccountMenu(props: AccountMenuProps): JSX.Element {
  const {
    user,
    items = [],
    theme = "system",
    onThemeChange,
    signOut,
    display = "full",
    vertical = "up",
    horizontal = "left",
    navigate,
    dataE2E = "account-menu-button",
    labels,
  } = props
  const full = display === "full"
  const themes: readonly [AccountMenuTheme, string][] = [
    ["system", labels?.system ?? "System"],
    ["light", labels?.light ?? "Light"],
    ["dark", labels?.dark ?? "Dark"],
  ]
  const themeHeading = labels?.theme ?? "Theme"

  const trigger = full
    ? (
      <>
        <Avatar name={user.name} src={user.avatarUrl} size="sm" alt="" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate font-medium text-foreground">{user.name}</span>
          {user.email && <span class="truncate text-xs text-muted">{user.email}</span>}
        </span>
        <IconChevronDown
          class={cn("size-4 shrink-0 text-muted", vertical === "up" && "rotate-180")}
          aria-hidden="true"
        />
      </>
    )
    : <Avatar name={user.name} src={user.avatarUrl} size="sm" />

  const naming = labels?.trigger === undefined
    ? { triggerNamedByContent: true as const }
    : { triggerLabel: labels.trigger }

  return (
    <Dropdown
      trigger={trigger}
      {...naming}
      triggerClasses={full ? fullTriggerClasses : undefined}
      containerClasses={full ? "flex w-full" : undefined}
      triggerDataE2E={dataE2E}
      menuLabel={labels?.menu ?? "Account menu"}
      vertical={vertical}
      horizontal={horizontal}
      panelClasses={cn("z-30", full && "min-w-full")}
    >
      {items.map((item, index) => (
        <AccountMenuEntry key={`${index}-${item.label}`} item={item} navigate={navigate} />
      ))}
      {onThemeChange && (
        <div role="group" aria-label={themeHeading} data-e2e="account-menu-theme">
          <div aria-hidden="true" class="px-4 pt-2 pb-1 text-xs font-medium text-muted">
            {themeHeading}
          </div>
          {themes.map(([value, label]) => (
            <DropdownItem
              key={value}
              checked={theme === value}
              onClick={() => onThemeChange(value)}
              dataE2E={`account-menu-theme-${value}`}
            >
              {label}
            </DropdownItem>
          ))}
        </div>
      )}
      {signOut && (
        <>
          <div role="separator" class="my-1 border-t border-subtle" />
          <AccountMenuEntry item={signOut} navigate={navigate} />
        </>
      )}
    </Dropdown>
  )
}
