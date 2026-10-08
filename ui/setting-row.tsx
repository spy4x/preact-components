import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"
import { Card } from "./card.tsx"

/** What {@link SettingList} takes. */
export interface SettingListProps {
  /** The list's {@link SettingRow}s. */
  children: ComponentChildren
}

/**
 * A card of {@link SettingRow}s, one per line, divided by a rule: the shape of a settings page,
 * where each row names a setting, shows its value and offers one action.
 *
 * @param props See {@link SettingListProps}.
 */
export function SettingList({ children }: SettingListProps): JSX.Element {
  return (
    <Card>
      <dl class="divide-y divide-subtle">{children}</dl>
    </Card>
  )
}

/** What {@link SettingRow} takes. */
export interface SettingRowProps {
  /** The setting's name. */
  label: string
  /** Its current value, under the name. */
  value: ComponentChildren
  /** One control on the right, such as an Edit button. Name it after the setting. */
  action?: ComponentChildren
  /** `data-e2e` of the row. */
  dataE2E?: string
}

/**
 * One setting: its name, its current value under it, and an optional action on the right that
 * stays beside the text on a phone. A row of a {@link SettingList}.
 *
 * @param props See {@link SettingRowProps}.
 */
export function SettingRow({ label, value, action, dataE2E }: SettingRowProps): JSX.Element {
  return (
    <div
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-4 sm:px-6"
      data-e2e={dataE2E}
    >
      <dt class="text-sm font-medium text-foreground">{label}</dt>
      {action && <dd class="col-start-2 row-span-2 row-start-1 flex items-center">{action}</dd>}
      <dd class="min-w-0 text-sm text-muted">{value}</dd>
    </div>
  )
}

/** What {@link SettingGroup} takes. */
export interface SettingGroupProps {
  /** The group's name, drawn as its `h2`. */
  title: string
  /** One quiet line under the name. */
  description?: ComponentChildren
  /** `data-e2e` of the group's `section`. */
  dataE2E?: string
  /** The group's content, usually one {@link SettingList}. */
  children: ComponentChildren
}

/**
 * A named group of settings, such as Account or Security: a small `h2` over its rows, so the page
 * title stays the one large heading on a settings page. The `section` is named by that heading.
 *
 * @param props See {@link SettingGroupProps}.
 */
export function SettingGroup(
  { title, description, dataE2E, children }: SettingGroupProps,
): JSX.Element {
  const headingId = useId()
  return (
    <section class="flex flex-col gap-3" aria-labelledby={headingId} data-e2e={dataE2E}>
      <header class="flex flex-col gap-1">
        <h2 id={headingId} class="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p class="text-sm text-muted">{description}</p>}
      </header>
      {children}
    </section>
  )
}
