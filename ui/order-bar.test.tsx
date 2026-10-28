import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { OrderBar, type OrderBarAction } from "./order-bar.tsx"

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

  it("announces a status line in a live region that is in the page from the start", () => {
    expect(render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} />)).toContain(
      '<p role="status" class="text-sm font-medium empty:hidden"></p>',
    )
    const html = render(<OrderBar message={MESSAGE} actions={[TELEGRAM]} status="Sold out" />)
    expect(html).toContain('role="status" class="text-sm font-medium empty:hidden">Sold out</p>')
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
