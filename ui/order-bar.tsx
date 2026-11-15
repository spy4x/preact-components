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

/** The parts of the page {@link bindScrollRoom} reads and changes: `window` passes as one. */
export interface ScrollRoomPage {
  document: {
    documentElement: { style: { scrollPaddingBottom: string } }
    addEventListener(type: "focusin", listener: (event: Event) => void): void
    removeEventListener(type: "focusin", listener: (event: Event) => void): void
  }
  innerHeight: number
  matchMedia(query: string): { matches: boolean }
  scrollBy(options: ScrollToOptions): void
}

/**
 * Keeps the controls of an {@link OrderBar}'s form out from under the bar while it is stuck to the
 * bottom of a phone's screen.
 *
 * It acts only on focus that lands in `scope` (the bar's form, or the element around the bar) and
 * only while the bar's bottom is at the bottom of the screen, so the rest of the page scrolls as it
 * always did. Then it sets the page's `scroll-padding-bottom` to the bar's height, so the next
 * control Tab reaches stops above the bar. Chromium does not scroll for a focused control that is
 * already partly on screen, so the control under the bar is also scrolled up by the part the bar
 * covers. A control drawn on its `<label>`, such as a chip's hidden radio, is measured by the
 * label. Focus anywhere else, and the returned unbind, put the page's own padding back.
 *
 * @param bar The bar.
 * @param scope The element whose controls the bar must not cover.
 * @param page The page, `window` in a browser.
 * @returns A function that removes the listener and restores the page's padding.
 */
export function bindScrollRoom(bar: Element, scope: Element, page: ScrollRoomPage): () => void {
  const style = page.document.documentElement.style
  const own = style.scrollPaddingBottom
  const restore = () => {
    style.scrollPaddingBottom = own
  }
  const focused = (event: Event) => {
    const target = event.target as Element | null
    const box = bar.getBoundingClientRect()
    const stuck = Math.round(box.bottom) >= page.innerHeight && box.top < page.innerHeight
    if (
      target === null || !scope.contains(target) || bar.contains(target) || !stuck ||
      !page.matchMedia(PHONE).matches
    ) return restore()
    style.scrollPaddingBottom = `${Math.ceil(box.height)}px`
    const control = (target.closest("label") ?? target).getBoundingClientRect()
    // 8 px more than the bar covers, so the control's focus ring clears the bar too.
    const covered = control.bottom - box.top + FOCUS_ROOM
    if (covered > FOCUS_ROOM && control.top < page.innerHeight) page.scrollBy({ top: covered })
  }
  page.document.addEventListener("focusin", focused)
  return () => {
    page.document.removeEventListener("focusin", focused)
    restore()
  }
}

/** Binds {@link bindScrollRoom} to the bar's form, or to the element around the bar. */
function useScrollRoomFor(bar: { current: HTMLElement | null }, form?: string): void {
  useEffect(() => {
    const element = bar.current
    if (element === null) return
    const scope = (form ? document.getElementById(form) : element.closest("form")) ??
      element.parentElement
    return scope === null ? undefined : bindScrollRoom(element, scope, window)
  }, [form])
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
 * On a phone, once scripts run, it scrolls a control of its form that Tab reaches out from under
 * the bar while the bar is stuck, see {@link bindScrollRoom}. Without scripts the page sets
 * `scroll-padding-bottom` itself.
 *
 * @param props The message, the actions and options, see {@link OrderBarProps}.
 */
export function OrderBar(
  { message, actions, secondary, status, note, form, labels, class: className }: OrderBarProps,
): JSX.Element {
  const words = useLabels("OrderBar", ORDER_BAR_LABELS, labels)
  const bar = useRef<HTMLElement>(null)
  useScrollRoomFor(bar, form)
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
