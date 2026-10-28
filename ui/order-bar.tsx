import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { buttonClasses, type ButtonVariant } from "./button.tsx"
import { useLabels } from "./i18n.tsx"

/** One button of an {@link OrderBar}: a link to a chat, or a submit button of the page's form. */
export interface OrderBarAction {
  /** The full words, such as `"Order on Telegram"`: the accessible name, shown from `lg`. */
  label: string
  /**
   * Shorter words shown below `lg`, where three buttons share a phone's row, such as
   * `"Telegram"`. They must be part of `label`, so a person who says what they see reaches it.
   * Left out, `label` shows at every width.
   */
  shortLabel?: string
  /** An icon before the words. On the secondary action, it is all that shows below `lg`. */
  icon?: ComponentChildren
  /**
   * A link, such as `https://t.me/<shop>?text=<message>`. Left out, the action is a submit button,
   * so the server can build the message from the form and redirect to the chat.
   */
  href?: string
  /** The submit button's `name`, sent with the form, such as `"via"`. */
  name?: string
  /** The submit button's `value`, such as `"telegram"`. */
  value?: string
  /** Extra attributes, such as `data-*` hooks, or `formaction` on a submit button. */
  attributes?: Record<string, string>
}

/** The words an {@link OrderBar} shows or announces. */
export interface OrderBarLabels {
  /** Names the bar as a region. Default: `"Order"`. */
  region: string
  /** Names the message preview, shown from `lg`. Default: `"Your message"`. */
  message: string
}

/** The English words {@link OrderBar} shows when the caller passes none. */
export const ORDER_BAR_LABELS: OrderBarLabels = {
  region: "Order",
  message: "Your message",
}

/** Props of {@link OrderBar}. */
export interface OrderBarProps {
  /** The message the shopper is about to send, shown as it will read. Line breaks are kept. */
  message: ComponentChildren
  /** The ways to order: the first is accent-filled, a second is outlined. */
  actions: readonly [OrderBarAction] | readonly [OrderBarAction, OrderBarAction]
  /** A quieter action after them, such as "Add to list": its icon alone below `lg`. */
  secondary?: OrderBarAction
  /**
   * A line under the message, such as "Sold out" or "Message copied. Paste it into Zalo.". It
   * sits in a live region, so a line set after a click is announced.
   */
  status?: ComponentChildren
  /**
   * One short line under the actions, at every width, that helps a shopper decide, such as
   * "Same-day delivery in Da Nang if you order before 16:00". Muted, and not a live region.
   */
  note?: ComponentChildren
  /** The `id` of the form the submit buttons send, when the bar sits outside it. */
  form?: string
  /** The words; see {@link ORDER_BAR_LABELS}. */
  labels?: Partial<OrderBarLabels>
  /** Utilities on the bar. */
  class?: string
}

/**
 * A bar stuck to the bottom of the screen on a phone, on the surface with a hairline above; from
 * `lg` a panel that sticks near the top of its column, with no fill of its own.
 */
const BAR =
  "sticky bottom-0 z-10 flex flex-col gap-3 border-t border-subtle bg-surface px-4 py-3 " +
  "lg:top-6 lg:bottom-auto lg:gap-4 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0"

/**
 * An outgoing chat bubble in the track grey, which stands off the canvas and the surface alike:
 * rounded, with the corner nearest the sender cut.
 */
const BUBBLE =
  "rounded-2xl rounded-ee-sm bg-track px-4 py-2 text-sm text-foreground whitespace-pre-line " +
  "break-words select-text"

/** Below this width the bar sticks to the bottom of the screen: Tailwind's `lg` breakpoint. */
const PHONE = "(width < 64rem)"

/** Room left under a control scrolled out from under the bar: its 4 px focus ring, and a gap. */
const FOCUS_ROOM = 8

/**
 * Keeps controls out from under the bar while it is stuck to the bottom of a phone's screen.
 *
 * The page's `scroll-padding-bottom` follows the bar's height, so a link to an anchor or a
 * script's `scrollIntoView` stops above the bar. Chromium does not scroll for a focused control
 * that is already partly on screen, so a control Tab reaches under the bar is also scrolled up by
 * the part the bar covers. A control drawn on its `<label>`, such as a chip's hidden radio, is
 * measured by the label. The page's own padding comes back when the bar goes away or grows to the
 * desktop panel.
 */
function useScrollRoomFor(bar: { current: HTMLElement | null }): void {
  useEffect(() => {
    const element = bar.current
    if (element === null) return
    const root = document.documentElement
    const own = root.style.scrollPaddingBottom
    const phone = matchMedia(PHONE)
    const update = () => {
      root.style.scrollPaddingBottom = phone.matches
        ? `${Math.ceil(element.getBoundingClientRect().height)}px`
        : own
    }
    update()
    const focused = (event: FocusEvent) => {
      const target = event.target
      if (!phone.matches || !(target instanceof Element) || element.contains(target)) return
      const bar = element.getBoundingClientRect()
      if (Math.round(bar.bottom) < innerHeight) return // Not stuck: the bar covers nothing.
      const control = (target.closest("label") ?? target).getBoundingClientRect()
      // 8 px more than the bar covers, so the control's focus ring clears the bar too.
      const covered = control.bottom - bar.top + FOCUS_ROOM
      if (covered > FOCUS_ROOM && control.top < innerHeight) scrollBy({ top: covered })
    }
    const resized = new ResizeObserver(update)
    resized.observe(element)
    phone.addEventListener("change", update)
    document.addEventListener("focusin", focused)
    return () => {
      resized.disconnect()
      phone.removeEventListener("change", update)
      document.removeEventListener("focusin", focused)
      root.style.scrollPaddingBottom = own
    }
  }, [])
}

/** A button's look, a 44 px target on a phone, by its role in the bar. */
function actionClasses(variant: ButtonVariant, iconOnly: boolean): string {
  // An icon-only button sizes itself: the `"lg"` size's padding would make it wider than tall.
  return buttonClasses(
    variant,
    iconOnly ? "none" : "lg",
    join(
      "min-h-11 justify-center",
      iconOnly
        ? "min-w-11 gap-2 px-2 py-2 text-base lg:w-full lg:px-4"
        : "flex-1 lg:w-full lg:flex-none",
    ),
  )
}

/** One action as a link or a submit button, with its short words below `lg`. */
function Action(
  { action, variant, secondary, form }: {
    action: OrderBarAction
    variant: ButtonVariant
    secondary: boolean
    form?: string
  },
): JSX.Element {
  // The secondary action with an icon shows the icon alone on a phone, so its words stay for
  // screen readers there; any other action shows its short words, if it has some.
  const iconOnly = secondary && action.icon !== undefined
  const short = !iconOnly && action.shortLabel !== undefined
  const words = (
    <>
      {action.icon}
      {short && <span aria-hidden="true" class="lg:hidden">{action.shortLabel}</span>}
      <span class={iconOnly || short ? "max-lg:sr-only" : undefined}>{action.label}</span>
    </>
  )
  const className = actionClasses(variant, iconOnly)
  if (action.href !== undefined) {
    return <a {...action.attributes} href={action.href} class={className}>{words}</a>
  }
  return (
    <button
      {...action.attributes}
      type="submit"
      form={form}
      name={action.name}
      value={action.value}
      class={className}
    >
      {words}
    </button>
  )
}

/**
 * The order step of a shop that takes orders by chat: the message about to be sent, in a chat
 * bubble, above the buttons that send it. A sticky bar at the bottom of a phone's screen, and a
 * sticky panel beside the photos from `lg`.
 *
 * Nothing is hidden behind a script: the message is plain, selectable text, so a shopper can copy
 * it by hand, and each action is a link to the chat or a submit button whose form the server
 * turns into a redirect. One action is accent-filled, as one view has one primary action.
 *
 * On a phone, once scripts run, it keeps the page's `scroll-padding-bottom` at its own height and
 * scrolls a control Tab reaches out from under the bar. Without scripts the page sets the padding
 * itself.
 *
 * @param props The message, the actions and options, see {@link OrderBarProps}.
 */
export function OrderBar(
  { message, actions, secondary, status, note, form, labels, class: className }: OrderBarProps,
): JSX.Element {
  const words = useLabels("OrderBar", ORDER_BAR_LABELS, labels)
  const bar = useRef<HTMLElement>(null)
  useScrollRoomFor(bar)
  return (
    <aside ref={bar} aria-label={words.region} class={join(BAR, className)} data-e2e="order-bar">
      <figure class="flex flex-col gap-1">
        <figcaption class="text-xs font-medium text-muted max-lg:sr-only">
          {words.message}
        </figcaption>
        <blockquote class={BUBBLE} data-e2e="order-bar-message">{message}</blockquote>
      </figure>
      <p role="status" class="text-sm font-medium empty:sr-only">{status}</p>
      <div class="flex gap-2 lg:flex-col">
        {actions.map((action, index) => (
          <Action
            key={action.label}
            action={action}
            variant={index === 0 ? "primary" : "outline"}
            secondary={false}
            form={form}
          />
        ))}
        {secondary && <Action action={secondary} variant="ghost" secondary form={form} />}
      </div>
      {note !== undefined && (
        <p class="text-sm text-muted text-pretty" data-e2e="order-bar-note">{note}</p>
      )}
    </aside>
  )
}
