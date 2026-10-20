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
import { AccountEntry, AccountIdentity, AccountTag } from "./account-parts.tsx"

export { AccountTag }

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
  /**
   * A short word for the role the person is signed in as, such as `"Admin"`, drawn as a neutral
   * gray badge: under the avatar on the avatar trigger, after the name on the wide one, and in
   * {@link header}. It is never accent-coloured, so it does not read as a second accent.
   */
  tag?: string
  /**
   * Draw a header row at the top of the menu with the avatar, the name, the e-mail and the
   * {@link tag}. It is not an item, and it is hidden from assistive technology, because the
   * trigger's name already says who is signed in.
   */
  header?: boolean
  /** Utilities merged over the trigger's own, such as a rail cell's shape. */
  triggerClasses?: string
  /** Utilities merged over the open menu's own, such as a placement beside a rail. */
  panelClasses?: string
  labels?: AccountMenuLabels
}

const fullTriggerClasses =
  "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring,var(--color-accent-900,oklch(0.381_0.176_304.987)))]"

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
 * replaces either with a name of the caller's, such as "Account: Ada Lovelace". A `tag` is part of
 * the text, so it is part of the name too: "Ada Lovelace Admin" unless `labels.trigger` says more.
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
    tag,
    header = false,
    triggerClasses,
    panelClasses,
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
        <AccountIdentity user={user} tag={tag} />
        <IconChevronDown
          class={cn("size-4 shrink-0 text-muted", vertical === "up" && "rotate-180")}
          aria-hidden="true"
        />
      </>
    )
    : tag
    ? (
      <span class="flex flex-col items-center gap-1">
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        <AccountTag tag={tag} />
      </span>
    )
    : <Avatar name={user.name} src={user.avatarUrl} size="sm" />

  const naming = labels?.trigger === undefined
    ? { triggerNamedByContent: true as const }
    : { triggerLabel: labels.trigger }

  return (
    <Dropdown
      trigger={trigger}
      {...naming}
      triggerClasses={full ? cn(fullTriggerClasses, triggerClasses) : triggerClasses}
      containerClasses={full ? "flex w-full" : undefined}
      triggerDataE2E={dataE2E}
      menuLabel={labels?.menu ?? "Account menu"}
      vertical={vertical}
      horizontal={horizontal}
      panelClasses={cn("z-30", full && "min-w-full", panelClasses)}
    >
      {header && (
        <div
          aria-hidden="true"
          class="mb-1 flex items-center gap-3 border-b border-subtle px-4 py-2"
          data-e2e="account-menu-header"
        >
          <AccountIdentity user={user} tag={tag} />
        </div>
      )}
      {items.map((item, index) => (
        <AccountEntry
          key={`${index}-${item.label}`}
          item={item}
          navigate={navigate}
          Control={DropdownItem}
        />
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
          <AccountEntry item={signOut} navigate={navigate} Control={DropdownItem} />
        </>
      )}
    </Dropdown>
  )
}
