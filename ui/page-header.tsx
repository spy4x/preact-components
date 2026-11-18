import type { ComponentChildren, ComponentType, JSX } from "preact"
import { IconArrowLeft, IconEllipsisVertical, type IconProps } from "@spy4x/preact-icons"
import { Button, buttonClasses, type ButtonVariant } from "./button.tsx"
import { Dropdown } from "./dropdown.tsx"
import type { HotkeyProps } from "./hotkeys.ts"
import { TOUCH_TARGET } from "./touch-target.ts"
import { useLabels } from "./i18n.tsx"

export { TOUCH_TARGET }

/** What {@link PageHeader} takes. */
export interface PageHeaderProps {
  /**
   * The page's heading. On a phone it wraps to at most two lines, from `sm` up it keeps to one; a
   * longer one ends in an ellipsis, and the full text is its tooltip.
   */
  title: string
  /**
   * Level of the heading, `<h1>` to `<h6>`. Defaults to `1`. Pick another when the page already
   * has its `<h1>`; the look stays the same.
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
  /**
   * Drawn inside the heading in place of `title`, such as a field that renames in place. PageHeader does
   * not truncate it: give it `min-w-0` and truncate inside, as `InlineEdit` does.
   */
  heading?: ComponentChildren
  /**
   * Quiet text under the title, such as the group a list belongs to. Like the title, it wraps to at
   * most two lines on a phone and keeps to one from `sm` up, ending in an ellipsis when cut.
   */
  subtitle?: ComponentChildren
  /** A small picture before the title, such as a group's mark. Decoration: name it in `title`. */
  mark?: ComponentChildren
  /** A link back to the parent page, drawn as an arrow before the title. `label` is its name. */
  back?: { href: string; label: string }
  /** Follows `back` without a page load: the app's router. Left out, the link loads the page. */
  navigate?: (href: string) => void
  /** The page's one primary action, usually a {@link PageAction}. */
  action?: ComponentChildren
  /**
   * The page's supplementary actions, as `DropdownItem`s. Given, they sit behind one "More
   * actions" button (three dots) after the primary action.
   */
  menu?: ComponentChildren
  /** The overflow button's accessible name. Defaults to `"More actions"`. */
  menuLabel?: string
  /** `data-e2e` of the overflow button. */
  menuDataE2E?: string
  /** `data-e2e` of the heading. */
  titleDataE2E?: string
  /** `data-e2e` of the subtitle. */
  subtitleDataE2E?: string
}

/** The English words of `PageHeader`, each one a prop of its own. */
const PAGE_HEADER_LABELS: Required<Pick<PageHeaderProps, "menuLabel">> = {
  menuLabel: "More actions",
}

/**
 * The header a page starts with: an optional back arrow, the title (and a subtitle) on the left,
 * the primary action and an optional "More actions" menu on the right.
 *
 * On a phone the title wraps to at most two lines and the actions stay beside it, so a long title
 * never pushes them under it; from `sm` up it keeps to one line. A cut title ends in an ellipsis.
 * The root carries no margin: the space under it is the parent's gap.
 *
 * @param props See {@link PageHeaderProps}.
 */
export function PageHeader(
  {
    title,
    headingLevel = 1,
    heading,
    subtitle,
    mark,
    back,
    navigate,
    action,
    menu,
    menuLabel: menuLabelProp,
    menuDataE2E,
    titleDataE2E,
    subtitleDataE2E,
  }: PageHeaderProps,
): JSX.Element {
  const { menuLabel } = useLabels(
    "PageHeader",
    PAGE_HEADER_LABELS,
    { menuLabel: menuLabelProp },
  )
  const Heading = `h${headingLevel}` as "h1"
  return (
    <header class="flex min-w-0 items-center gap-3" data-e2e="page-header">
      {back && (
        <Button
          href={back.href}
          navigate={navigate}
          variant="icon"
          size="md"
          aria-label={back.label}
          class={`-ms-2 ${TOUCH_TARGET}`}
          data-e2e="page-back"
        >
          <IconArrowLeft class="size-5" aria-hidden="true" />
        </Button>
      )}
      {mark}
      <div class="flex min-w-0 flex-1 flex-col gap-1 [text-align-last:left] [&:dir(rtl)]:[text-align-last:right]">
        {
          /* The plain title is cut short in its own span: clipping on the heading would clip the focus
            ring of whatever the heading slot puts there. `dir="auto"` gives the span the direction
            of its own words and `text-start` lines its lines up with their start, so a long Latin
            title in an Arabic page keeps its start and loses its end to the ellipsis. Chromium draws
            the two-line clamp's ellipsis just past the last line's end: a line pushed against its
            end edge, as aligning it to the page's start does when the words run the other way,
            leaves no room there and the ellipsis is clipped away. This column's `text-align-last`
            sets the last line, so a short title's only one, at the page's start, left or right;
            the clamp's last visible line is not the text's last, so it keeps its own start. */
        }
        <Heading
          class="min-w-0 text-xl font-semibold text-foreground sm:text-2xl"
          title={title}
          data-e2e={titleDataE2E}
        >
          {heading ?? <span dir="auto" class={OWN_DIRECTION}>{title}</span>}
        </Heading>
        {subtitle && (
          <p dir="auto" class={`${OWN_DIRECTION} text-sm text-muted`} data-e2e={subtitleDataE2E}>
            {subtitle}
          </p>
        )}
      </div>
      {(action || menu) && (
        <div class="flex shrink-0 items-center gap-2">
          {action}
          {menu && <MoreMenu label={menuLabel} dataE2E={menuDataE2E}>{menu}</MoreMenu>}
        </div>
      )}
    </header>
  )
}

/** What {@link MoreMenu} takes. */
export interface MoreMenuProps {
  /**
   * The button's accessible name and the menu's, such as `"More actions"` or
   * `` `Actions for ${name}` `` on a row. Required: the button shows only three dots.
   */
  label: string
  /** `data-e2e` of the button. */
  dataE2E?: string
  /** The menu's `DropdownItem`s. */
  children: ComponentChildren
}

/**
 * Text in its own direction, set from its own start and cut short at its own end with an ellipsis:
 * at most two lines on a phone, where a long word breaks rather than overflows, and one line from
 * `sm` up, where `white-space: nowrap` leaves the clamp nothing to clamp. Its last line follows the
 * header column's `text-align-last`, the page's start: a short text lines up with the page, and so
 * does the second line of one that runs against the page's direction and fits in two lines uncut.
 */
const OWN_DIRECTION = "line-clamp-2 break-words text-start sm:block sm:truncate"

/**
 * A three-dots button that opens a menu of `DropdownItem`s: the overflow menu of a page header or
 * of one row in a list. It is a {@link Dropdown} with an icon trigger of the phone touch size.
 *
 * @param props See {@link MoreMenuProps}.
 */
export function MoreMenu({ label, dataE2E, children }: MoreMenuProps): JSX.Element {
  return (
    <Dropdown
      triggerLabel={label}
      menuLabel={label}
      triggerDataE2E={dataE2E}
      triggerClasses={buttonClasses("icon", "md", TOUCH_TARGET)}
      trigger={<IconEllipsisVertical class="size-5" aria-hidden="true" />}
    >
      {children}
    </Dropdown>
  )
}

/** What {@link PageAction} takes: `href` makes it a link, otherwise it is a button. */
export interface PageActionProps extends HotkeyProps {
  /** Visible from `sm` up, and always the accessible name. */
  label: string
  /** Shown on every screen; on a phone it is all a person sees of the action. */
  Icon: ComponentType<IconProps>
  /** Makes the action a link to this address. */
  href?: string
  /** Follows `href` without a page load: the app's router. */
  navigate?: (href: string) => void
  /** Runs on a press of the button form. */
  onClick?: () => void
  /** The button's look. Defaults to `"primary"`. */
  variant?: ButtonVariant
  disabled?: boolean
  /** `data-e2e` of the link or button. */
  dataE2E?: string
  /** Keys the app binds itself, shown and announced only; see `ButtonProps.keyshortcuts`. */
  keyshortcuts?: readonly string[]
}

/**
 * A page header's primary action: icon and label from `sm` up, the icon alone on a phone.
 *
 * The label stays in the markup for screen readers, so the action keeps its name at every width.
 *
 * @param props See {@link PageActionProps}.
 */
export function PageAction(
  {
    label,
    Icon,
    href,
    navigate,
    onClick,
    variant = "primary",
    disabled,
    dataE2E,
    hotkey,
    hotkeyHint,
    kbdLabels,
    keyshortcuts,
  }: PageActionProps,
): JSX.Element {
  const keys = { hotkey, hotkeyHint, kbdLabels, keyshortcuts }
  const content = (
    <>
      <Icon class="size-5" aria-hidden="true" />
      <span class="sr-only sm:not-sr-only">{label}</span>
    </>
  )
  return href !== undefined
    ? (
      <Button
        href={href}
        navigate={navigate}
        variant={variant}
        disabled={disabled}
        class={TOUCH_TARGET}
        data-e2e={dataE2E}
        {...keys}
      >
        {content}
      </Button>
    )
    : (
      <Button
        type="button"
        variant={variant}
        onClick={onClick}
        disabled={disabled}
        class={TOUCH_TARGET}
        data-e2e={dataE2E}
        {...keys}
      >
        {content}
      </Button>
    )
}
