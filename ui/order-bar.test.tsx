import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { bindScrollRoom, OrderBar, type OrderBarAction, type ScrollRoomPage } from "./order-bar.tsx"

const TELEGRAM: OrderBarAction = {
  label: "Order on Telegram",
  shortLabel: "Telegram",
  href: "https://t.me/shop?text=Hi",
}
const ZALO: OrderBarAction = {
  label: "Order on Zalo",
  shortLabel: "Zalo",
  name: "via",
  value: "zalo",
}
const ADD: OrderBarAction = {
  label: "Add to list",
  icon: <svg data-icon="plus" />,
  name: "add",
  value: "1",
}
const MESSAGE = "Hi, I'd like to order:\n• Zip jacket, Brown, M"

/** The opening tags of the bar's links and buttons, in order. */
function controls(html: string): string[] {
  return html.match(/<(a|button) [^>]*>/g) ?? []
}

describe("OrderBar", () => {
  it("shows the message as selectable text in a bubble, before the actions", () => {
    const html = render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} />)
    expect(html).toMatch(/^<aside aria-label="Order" class="sticky bottom-0 /)
    expect(html).toMatch(
      /<figcaption[^>]*>Your message<\/figcaption><blockquote class="[^"]*whitespace-pre-line[^"]*"[^>]*>Hi, I'd like to order:\n• Zip jacket, Brown, M<\/blockquote>/,
    )
    expect(html.indexOf("<blockquote")).toBeLessThan(html.indexOf("<a "))
  })

  it("fills only the first action with the accent and outlines the second", () => {
    const html = render(<OrderBar message={MESSAGE} actions={[TELEGRAM, ZALO]} secondary={ADD} />)
    const [first, second, third] = controls(html)
    expect(html.match(/bg-accent-900/g)?.length).toBe(1)
    expect(first).toContain("bg-accent-900")
    expect(second).toContain("border-control")
    expect(third).toContain("bg-transparent")
  })

  it("links to a chat, or submits the form so the server can redirect to one", () => {
    const html = render(
      <OrderBar message={MESSAGE} actions={[TELEGRAM, ZALO]} secondary={ADD} form="order" />,
    )
    const [link, zalo, add] = controls(html)
    expect(link).toMatch(/^<a href="https:\/\/t.me\/shop\?text=Hi"/)
    expect(zalo).toMatch(/^<button type="submit" form="order" name="via" value="zalo"/)
    expect(add).toMatch(/^<button type="submit" form="order" name="add" value="1"/)
    expect(html).not.toContain("<script")
  })

  it("shows short words on a phone and keeps the full words as the accessible name", () => {
    const html = render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} />)
    expect(html).toContain(
      '<span aria-hidden="true" class="lg:hidden">Telegram</span><span class="max-lg:sr-only">Order on Telegram</span>',
    )
    const plain = render(<OrderBar message={MESSAGE} actions={[{ label: "Ask" }]} />)
    expect(plain).toMatch(/<button[^>]*><span>Ask<\/span><\/button>/)
  })

  it("draws the secondary action as its icon alone on a phone, a 44 px square named by its words", () => {
    const html = render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} secondary={ADD} />)
    const add = controls(html)[1]
    expect(add).toContain("min-h-11 justify-center min-w-11")
    expect(html).toContain(
      '<svg data-icon="plus"></svg><span class="max-lg:sr-only">Add to list</span>',
    )
  })

  it("announces a status line in a live region that is in the page, and the accessibility tree, from the start", () => {
    expect(render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} />)).toContain(
      '<p role="status" class="text-sm font-medium empty:sr-only"></p>',
    )
    const html = render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} status="Sold out" />)
    expect(html).toContain('role="status" class="text-sm font-medium empty:sr-only">Sold out</p>')
  })

  it("shows a short note under the actions, outside the live region, only when given", () => {
    const note = "Same-day delivery in Da Nang if you order before 16:00"
    const html = render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} note={note} />)
    expect(html).toMatch(
      /<\/a><\/div><p class="text-sm text-muted text-pretty" data-e2e="order-bar-note">Same-day delivery in Da Nang if you order before 16:00<\/p><\/aside>$/,
    )
    expect(render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} />)).not.toContain(
      "order-bar-note",
    )
  })

  it("takes its words", () => {
    const html = render(
      <OrderBar
        message={MESSAGE}
        actions={[TELEGRAM]}
        labels={{ region: "Đặt hàng", message: "Tin nhắn của bạn" }}
      />,
    )
    expect(html).toContain('aria-label="Đặt hàng"')
    expect(html).toContain(">Tin nhắn của bạn</figcaption>")
  })
})

describe("bindScrollRoom", () => {
  /** A box with only what the binder measures. */
  function box(top: number, bottom: number, inside: object[] = []) {
    const element = {
      getBoundingClientRect: () => ({ top, bottom, height: bottom - top }),
      contains: (other: object) => other === element || inside.includes(other),
      closest: () => null,
    }
    return element as unknown as Element
  }

  /** A 390x667 phone page that records its focus listeners and its scrolls. */
  function phonePage(phone = true) {
    const listeners = new Set<(event: Event) => void>()
    const scrolls: number[] = []
    const page: ScrollRoomPage = {
      document: {
        documentElement: { style: { scrollPaddingBottom: "56px" } },
        addEventListener: (_type, listener) => listeners.add(listener),
        removeEventListener: (_type, listener) => listeners.delete(listener),
      },
      innerHeight: 667,
      matchMedia: () => ({ matches: phone }),
      scrollBy: ({ top }) => scrolls.push(top ?? 0),
    }
    const focus = (target: Element) =>
      listeners.forEach((listen) => listen({ target } as unknown as Event))
    return { page, listeners, scrolls, focus }
  }

  const chip = box(446, 490)
  const outside = box(446, 490)
  const stuck = box(458, 667)
  const form = box(0, 900, [chip])

  it("scrolls a control of the bar's form out from under the bar stuck to the bottom", () => {
    const { page, scrolls, focus } = phonePage()
    bindScrollRoom(stuck, form, page)

    focus(chip)

    // The chip's bottom at 490 is 32 px below the bar's top at 458, plus 8 px for its focus ring.
    expect(scrolls).toEqual([40])
    expect(page.document.documentElement.style.scrollPaddingBottom).toBe("209px")
  })

  it("leaves focus outside the bar's form alone, so the rest of the page scrolls as before", () => {
    const { page, scrolls, focus } = phonePage()
    bindScrollRoom(stuck, form, page)

    focus(outside)

    expect(scrolls).toEqual([])
    expect(page.document.documentElement.style.scrollPaddingBottom).toBe("56px")
  })

  it("leaves the page alone while the bar is not stuck to the bottom of the screen", () => {
    const { page, scrolls, focus } = phonePage()
    bindScrollRoom(box(300, 509), form, page)

    focus(chip)

    expect(scrolls).toEqual([])
    expect(page.document.documentElement.style.scrollPaddingBottom).toBe("56px")
  })

  it("leaves the page alone on a desktop, where the bar is a panel beside the photos", () => {
    const { page, scrolls, focus } = phonePage(false)
    bindScrollRoom(stuck, form, page)

    focus(chip)

    expect(scrolls).toEqual([])
  })

  it("on unbind removes its focus listener and puts the page's own padding back", () => {
    const { page, listeners, scrolls, focus } = phonePage()
    const unbind = bindScrollRoom(stuck, form, page)
    focus(chip)

    unbind()
    focus(chip)

    expect(listeners.size).toBe(0)
    expect(scrolls).toEqual([40])
    expect(page.document.documentElement.style.scrollPaddingBottom).toBe("56px")
  })
})
