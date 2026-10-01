import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { followLinkClick, isPlainClick, Link, type LinkClickEvent } from "./link.tsx"

/** A click as the anchor receives it, with no modifier, unless `overrides` says otherwise. */
function click(overrides: Partial<LinkClickEvent> = {}): LinkClickEvent & { cancelled: boolean } {
  const event = {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    cancelled: false,
    preventDefault() {
      event.cancelled = true
      event.defaultPrevented = true
    },
    ...overrides,
  }
  return event
}

/** A `navigate` port that records every href it was called with. */
function recorder(): { navigate: (href: string) => void; calls: string[] } {
  const calls: string[] = []
  return { navigate: (href) => calls.push(href), calls }
}

describe("isPlainClick", () => {
  it("counts the primary button with no modifier", () => {
    expect(isPlainClick(click())).toBe(true)
  })

  for (const key of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
    it(`leaves a click with ${key} to the browser`, () => {
      expect(isPlainClick(click({ [key]: true }))).toBe(false)
    })
  }

  it("leaves a middle click to the browser", () => {
    expect(isPlainClick(click({ button: 1 }))).toBe(false)
  })
})

describe("followLinkClick", () => {
  it("cancels a plain click and calls navigate with the href", () => {
    const port = recorder()
    const event = click()

    expect(followLinkClick(event, { href: "/reports", navigate: port.navigate })).toBe(true)
    expect(event.cancelled).toBe(true)
    expect(port.calls).toEqual(["/reports"])
  })

  it("leaves a plain click to the browser when no navigate is given", () => {
    const event = click()

    expect(followLinkClick(event, { href: "/reports" })).toBe(false)
    expect(event.cancelled).toBe(false)
  })

  it("leaves a click something earlier cancelled alone", () => {
    const port = recorder()

    expect(followLinkClick(click({ defaultPrevented: true }), { href: "/a", ...port })).toBe(false)
    expect(port.calls).toEqual([])
  })

  for (const key of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
    it(`leaves a click with ${key} to the browser and does not navigate`, () => {
      const port = recorder()
      const event = click({ [key]: true })

      expect(followLinkClick(event, { href: "/a", ...port })).toBe(false)
      expect(event.cancelled).toBe(false)
      expect(port.calls).toEqual([])
    })
  }

  it("leaves a link that opens in another browsing context to the browser", () => {
    const port = recorder()
    const event = click()

    expect(followLinkClick(event, { href: "/a", target: "_blank", ...port })).toBe(false)
    expect(event.cancelled).toBe(false)
    expect(port.calls).toEqual([])
  })

  it("takes over a link whose target is the same browsing context, in any case", () => {
    const port = recorder()

    expect(followLinkClick(click(), { href: "/a", target: "_SELF", ...port })).toBe(true)
    expect(followLinkClick(click(), { href: "/b", target: "", ...port })).toBe(true)
    expect(port.calls).toEqual(["/a", "/b"])
  })

  it("leaves a download link to the browser, even with an empty file name", () => {
    const port = recorder()

    expect(followLinkClick(click(), { href: "/a.csv", download: "", ...port })).toBe(false)
    expect(followLinkClick(click(), { href: "/a.csv", download: true, ...port })).toBe(false)
    expect(followLinkClick(click(), { href: "/a.csv", download: false, ...port })).toBe(true)
    expect(port.calls).toEqual(["/a.csv"])
  })
})

describe("Link", () => {
  it("renders a real anchor with its href, class and other attributes", () => {
    const html = render(
      <Link href="/reports" class="underline" rel="nofollow" data-e2e="reports" navigate={() => {}}>
        Reports
      </Link>,
    )

    expect(html).toBe(
      `<a rel="nofollow" data-e2e="reports" href="/reports" class="underline">Reports</a>`,
    )
  })

  it("renders target and download when given", () => {
    const html = render(<Link href="/a.csv" target="_blank" download="a.csv">CSV</Link>)

    expect(html).toContain(`target="_blank"`)
    expect(html).toContain(`download="a.csv"`)
  })
})
