/**
 * `SettingsLayout` — a settings page split into sections: a sub-navigation beside the open section
 * from `md` up, and the list first, then one section, on a phone.
 *
 * Props and ports only: the sections, the current one and the router come from the caller. It
 * reads no `location` and holds no state; the only browser work is moving focus after a change of
 * section, in an effect.
 */

import { cn } from "@spy4x/preact-cn"
import { IconArrowLeft, IconChevronRight } from "@spy4x/preact-icons"
import { Link } from "@spy4x/preact-ui/link"
import { PageHeader } from "@spy4x/preact-ui/page-header"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { useT } from "@spy4x/preact-ui/i18n"
import { translate } from "./i18n.ts"

/** One entry of {@link SettingsLayoutProps.sections}: a sub-page of the settings. */
export interface SettingsSection {
  /** Stable key, matched against {@link SettingsLayoutProps.current}. */
  id: string
  /** The nav item's text and the open section's heading. */
  label: string
  /** The sub-page's address. Rendered as a real link. */
  href: string
  /** One quiet line under the open section's heading. */
  description?: string
  /**
   * `"danger"` for an item such as "Delete account": drawn in danger text, last, after a divider,
   * whatever its place in the list.
   */
  tone?: "danger"
  /** The section's state in a few words, such as "Two-factor off": muted, in the phone list only. */
  value?: string
}

/** Every string {@link SettingsLayout} prints that is not data the caller supplied. */
export interface SettingsLayoutLabels {
  /** The `<nav>` name. Defaults to the title. */
  nav?: string
  /** The phone's link back to the list. Defaults to `` `Back to ${title}` ``. */
  back?: string
}

/** What {@link SettingsLayout} takes. */
export interface SettingsLayoutProps {
  /** The page's title, drawn by `PageHeader`, such as "Profile". */
  title: string
  /** The address of the list itself, such as `/profile`: where the phone's back link goes. */
  href: string
  /** The sub-pages, in order. Danger ones are drawn last whatever their place. */
  sections: readonly SettingsSection[]
  /**
   * The open section's `id`, or `null` on the list's own address. With `null`, a phone shows the
   * list as the page; from `md` up the nav and `children` show as always.
   */
  current: string | null
  /**
   * A section's `id` to show from `md` up while `current` is `null`: its heading over `children` and
   * its nav item in the current look, by CSS alone, so a phone still shows the plain list and no
   * script reads the width. It sets no `aria-current`, since on a phone that address is the list.
   * Left out, `null` shows `children` with no heading and no current item.
   */
  defaultSection?: string
  /**
   * Port to the app's client router: a plain left click on a nav item or the back link calls it
   * with the `href` instead of loading the page. Left out, every link loads the page.
   */
  navigate?: (href: string) => void
  /**
   * Level of the title's heading; the open section's heading is one level below. Defaults to `1`.
   * Pick another when the page already has its `<h1>`; the look stays the same.
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5
  /** Drawn under the title wherever the title shows, such as who is signed in. */
  intro?: ComponentChildren
  /** The open section's content, under its heading. */
  children?: ComponentChildren
  labels?: SettingsLayoutLabels
}

/** A nav item's own look, at both widths. */
const itemBase =
  "flex min-w-0 cursor-pointer items-center gap-3 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-ring) motion-safe:transition-colors motion-safe:duration-150"

/** A phone row: 44 px tall, edge to edge in its card. */
const itemPhone = "max-md:min-h-11 max-md:px-4 max-md:py-2"

/** A desktop row: 36 px, rounded, filled when hovered or current. */
const itemDesktop = "md:min-h-9 md:rounded-primary md:px-3 md:py-2"

/**
 * The current item: the accent tint the rail's current cell wears, with an outline in forced
 * colours where fills disappear.
 */
const itemCurrent =
  "bg-[var(--color-surface-active,var(--color-accent-100))] dark:bg-[var(--color-surface-active,var(--color-selected-soft))] text-[color:var(--color-nav-active,var(--color-selected-text))] forced-colors:outline-2 forced-colors:outline-solid forced-colors:outline-[CanvasText]"

/** The default section's item: {@link itemCurrent}'s look from `md` up, a plain row on a phone. */
const itemDefault =
  "max-md:text-foreground max-md:hover:bg-hover md:bg-[var(--color-surface-active,var(--color-accent-100))] md:dark:bg-[var(--color-surface-active,var(--color-selected-soft))] md:text-[color:var(--color-nav-active,var(--color-selected-text))] md:forced-colors:outline-2 md:forced-colors:outline-solid md:forced-colors:outline-[CanvasText]"

/**
 * A danger item's text. The dark palette's danger falls to 3.6:1 on the hovered row's fill, so a
 * hovered row there takes red-300, as `DropdownItem`'s danger items do.
 */
const dangerText = "text-danger dark:hover:text-red-300"

/** The current danger item: the danger tint, keeping its danger text, outlined in forced colours. */
const dangerCurrent =
  "bg-danger-soft text-danger dark:text-red-300 forced-colors:outline-2 forced-colors:outline-solid forced-colors:outline-[CanvasText]"

/** A default danger item: {@link dangerCurrent}'s look from `md` up, a plain danger row on a phone. */
const dangerDefault =
  "text-danger max-md:hover:bg-hover max-md:dark:hover:text-red-300 md:bg-danger-soft md:dark:text-red-300 md:forced-colors:outline-2 md:forced-colors:outline-solid md:forced-colors:outline-[CanvasText]"

/** The list as a card of rows on a phone; a plain column of rows from `md`. */
const groupClasses = "flex flex-col max-md:divide-y max-md:divide-subtle md:gap-1"

/**
 * A settings page with sub-pages, such as a profile split into Account, Security and Danger zone.
 *
 * **From `md` up** the page is a 200 px sticky nav on the left and the open section on the right,
 * in a `max-w-2xl` column under its own heading. The current item carries `aria-current="page"` and
 * the accent tint. Danger items sit last, after a divider, in danger text.
 *
 * **Below `md`** the list is the page while `current` is `null`: 44 px rows in a card, each with a
 * chevron and its optional `value`. With a section open, only the section shows, under a "Back to
 * {title}" link to the list, above the section's heading. The title stays in the document for screen readers.
 *
 * **`defaultSection`** names the section a wide screen shows on the list's own address: from `md`
 * up its heading tops `children` and its item wears the current look, while a phone shows the list.
 *
 * **Focus follows the change.** When `current` changes to a section, focus moves to its heading;
 * when it goes back to `null`, to the nav item of the section that was open. The first render moves
 * nothing. An app that runs `useRouteAnnouncer` passes it `keepPageFocus: true`, or the announcer
 * moves focus on to the page's `<h1>` after this does.
 *
 * Every nav item is a real link, so the page works before any script and a modified click opens a
 * new tab.
 *
 * @param props See {@link SettingsLayoutProps}.
 */
export function SettingsLayout(props: SettingsLayoutProps): JSX.Element {
  const {
    title,
    href,
    sections,
    current,
    defaultSection,
    navigate,
    headingLevel = 1,
    intro,
    children,
    labels,
  } = props
  const translator = useT()
  const SectionHeading = `h${headingLevel + 1}` as "h2"
  const byId = (id: string) => sections.find((section) => section.id === id)
  const open = current === null ? undefined : byId(current)
  const fallback = defaultSection === undefined ? undefined : byId(defaultSection)
  /** The section whose heading shows: the open one, else the default from `md` up. */
  const shown = open ?? (current === null ? fallback : undefined)
  const headingId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const nav = useRef<HTMLElement>(null)
  const previous = useRef(current)

  useEffect(() => {
    const was = previous.current
    if (was === current) return
    previous.current = current
    if (current !== null) {
      heading.current?.focus()
      return
    }
    nav.current?.querySelector<HTMLElement>(`[data-settings-id="${CSS.escape(was ?? "")}"]`)
      ?.focus()
  }, [current])

  if (current !== null && !open) {
    throw new Error(`SettingsLayout: no section has the id "${current}"`)
  }
  if (defaultSection !== undefined && !fallback) {
    throw new Error(`SettingsLayout: no section has the id "${defaultSection}"`)
  }
  const regular = sections.filter((section) => section.tone !== "danger")
  const danger = sections.filter((section) => section.tone === "danger")

  const item = (section: SettingsSection) => {
    const isCurrent = section.id === current
    const isDefault = section.id === shown?.id
    return (
      <li key={section.id}>
        <Link
          href={section.href}
          navigate={navigate}
          aria-current={isCurrent ? "page" : undefined}
          data-settings-id={section.id}
          data-e2e={`settings-nav-${section.id}`}
          class={cn(
            itemBase,
            itemPhone,
            itemDesktop,
            isCurrent
              ? section.tone === "danger" ? dangerCurrent : itemCurrent
              : isDefault
              ? section.tone === "danger" ? dangerDefault : itemDefault
              : cn("hover:bg-hover", section.tone === "danger" ? dangerText : "text-foreground"),
          )}
        >
          <span class="min-w-0 flex-1 truncate">{section.label}</span>
          {section.value && (
            <span class="max-w-[50%] shrink-0 truncate font-normal text-muted md:hidden">
              {section.value}
            </span>
          )}
          <IconChevronRight class="size-4 shrink-0 text-muted md:hidden" aria-hidden="true" />
        </Link>
      </li>
    )
  }

  return (
    <div class="flex flex-col gap-6" data-e2e="settings-layout">
      <div class={cn(open && "max-md:sr-only")}>
        <PageHeader title={title} headingLevel={headingLevel} />
      </div>
      {intro && <div class={cn(open && "max-md:hidden")}>{intro}</div>}
      <div class="flex flex-col gap-6 md:grid md:grid-cols-[12.5rem_minmax(0,1fr)] md:items-start md:gap-8">
        <nav
          ref={nav}
          aria-label={labels?.nav ?? title}
          data-e2e="settings-nav"
          class={cn(
            "flex flex-col max-md:overflow-hidden max-md:rounded-card max-md:border max-md:border-subtle max-md:bg-surface max-md:divide-y max-md:divide-subtle md:sticky md:top-6 md:gap-2",
            open && "max-md:hidden",
          )}
        >
          <ul class={groupClasses}>{regular.map(item)}</ul>
          {danger.length > 0 && (
            <ul class={cn(groupClasses, "md:border-t md:border-subtle md:pt-2")}>
              {danger.map(item)}
            </ul>
          )}
        </nav>
        <section
          aria-labelledby={shown ? headingId : undefined}
          data-e2e="settings-section"
          class={cn("flex min-w-0 max-w-2xl flex-col gap-6", !open && "max-md:hidden")}
        >
          {shown && (
            <div class="flex flex-col gap-2">
              {open && (
                <Link
                  href={href}
                  navigate={navigate}
                  data-e2e="settings-back"
                  class="-ml-2 inline-flex min-h-11 items-center gap-2 self-start rounded-primary px-2 text-sm font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ring) md:hidden"
                >
                  <IconArrowLeft class="size-4" aria-hidden="true" />
                  {labels?.back ??
                    translate(translator, "SettingsLayout.back", `Back to ${title}`, { title })}
                </Link>
              )}
              <header class="flex flex-col gap-1">
                <SectionHeading
                  ref={heading}
                  id={headingId}
                  tabIndex={-1}
                  data-e2e="settings-heading"
                  class="text-base font-medium text-foreground outline-none lg:text-lg"
                >
                  {shown.label}
                </SectionHeading>
                {shown.description && <p class="text-sm text-muted">{shown.description}</p>}
              </header>
            </div>
          )}
          {children}
        </section>
      </div>
    </div>
  )
}
