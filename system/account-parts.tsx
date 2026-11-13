/**
 * The parts `AccountMenu` and `AppShell`'s phone sheet share: the role badge, the identity row
 * (avatar, name, e-mail, badge), the language row's content and the renderer of one account
 * item. Internal to this package, so it is not in the package's exports; `account-menu.tsx`
 * re-exports `AccountTag`.
 *
 * @module
 */

import { IconGlobe } from "@spy4x/preact-icons"
import { Avatar } from "@spy4x/preact-ui/avatar"
import { Badge } from "@spy4x/preact-ui/badge"
import { languageName } from "@spy4x/preact-ui/language-picker"
import { textDirection } from "@spy4x/platform/universal/i18n"
import type { ComponentChildren, ComponentType, JSX } from "preact"
import type { AccountMenuItem, AccountMenuLanguage, AccountMenuUser } from "./account-menu.tsx"

/** The neutral role badge `AccountMenuProps.tag` draws. */
export function AccountTag({ tag }: { tag: string }): JSX.Element {
  return (
    <Badge
      text={tag}
      color="gray"
      class="rounded-[var(--radius-control,0.375rem)] px-1 py-0 leading-4"
    />
  )
}

/**
 * Who is signed in, on one row: the decorative avatar (`alt=""`, as the name is printed beside it),
 * then the name with the tag after it, and the e-mail under them. A fragment, so the caller's own
 * flex row (a trigger, a menu header, the sheet's header) lays it out.
 */
export function AccountIdentity(
  { user, tag }: { user: AccountMenuUser; tag?: string },
): JSX.Element {
  return (
    <>
      <Avatar name={user.name} src={user.avatarUrl} size="sm" alt="" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex min-w-0 items-center gap-2">
          <span class="truncate text-sm font-medium text-foreground">{user.name}</span>
          {tag && <AccountTag tag={tag} />}
        </span>
        {user.email && <span class="truncate text-xs text-muted">{user.email}</span>}
      </span>
    </>
  )
}

/**
 * The language row's content: `IconGlobe`, the label, and the language in use (`current`, else
 * `automatic`) at the row's end, named in itself with its own `lang` and `dir`. A fragment, so the
 * menu item or the sheet row around it lays it out.
 */
export function AccountLanguage(
  { label, language }: { label: string; language: AccountMenuLanguage },
): JSX.Element {
  const inUse = language.current ?? language.automatic
  return (
    <>
      <IconGlobe class="size-4" aria-hidden="true" />
      <span>{label}</span>
      {inUse && (
        <span class="notranslate ms-auto ps-4 text-muted" lang={inUse} dir={textDirection(inUse)}>
          {languageName(inUse)}
        </span>
      )}
    </>
  )
}

/** What {@link AccountEntry} hands its control: a link, a submit button or a plain button. */
export interface AccountControlProps {
  href?: string
  navigate?: (href: string) => void
  onClick?: () => void
  type?: "button" | "submit"
  /** The item's {@link AccountMenuItem.keyshortcuts}, to announce and show; never bound. */
  keyshortcuts?: readonly string[]
  dataE2E?: string
  children: ComponentChildren
}

/**
 * One account item: a form post when it has an `action`, the given control as a link or a button
 * otherwise. The menu's control is `DropdownItem`, the sheet's a row of its own.
 *
 * The form carries `role="none"`, so the accessibility tree keeps the submit button as the item
 * itself, the way `Dropdown` expects its items to sit in a wrapper with no role of its own (#535,
 * #537). The post needs no client code; once hydrated, an `onClick` cancels it and runs instead.
 */
export function AccountEntry(
  { item, navigate, Control }: {
    item: AccountMenuItem
    navigate?: (href: string) => void
    Control: ComponentType<AccountControlProps>
  },
): JSX.Element {
  const { label, href, action, method = "post", onClick, keyshortcuts, dataE2E } = item
  if (action === undefined) {
    return (
      <Control
        href={href}
        navigate={navigate}
        onClick={onClick}
        keyshortcuts={keyshortcuts}
        dataE2E={dataE2E}
      >
        {label}
      </Control>
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
      <Control type="submit" keyshortcuts={keyshortcuts} dataE2E={dataE2E}>{label}</Control>
    </form>
  )
}
