import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { JSX } from "preact"
import { render } from "preact-render-to-string"
import { followLinkClick, isPlainClick, Link, type LinkClickEvent } from "./link.tsx"
import { onAppPage, pageAt } from "./testdata/page-at.ts"

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
  onAppPage()

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

  it("leaves a plain click on a link to another origin to the browser", () => {
    const port = recorder()
    const others = [
      "https://example.org/docs",
      "//example.org/docs",
      "http://app.example.com/docs",
      "https://app.example.com:8443/docs",
      "https://sub.app.example.com/docs",
    ]

    for (const href of others) {
      const event = click()
      expect(followLinkClick(event, { href, ...port })).toBe(false)
      expect(event.cancelled).toBe(false)
    }
    expect(port.calls).toEqual([])
  })

  it("leaves mailto: and tel: links to the browser", () => {
    const port = recorder()

    expect(followLinkClick(click(), { href: "mailto:ada@example.com", ...port })).toBe(false)
    expect(followLinkClick(click(), { href: "tel:+15555550100", ...port })).toBe(false)
    expect(port.calls).toEqual([])
  })

  it("leaves an address that does not parse to the browser", () => {
    const port = recorder()
    const event = click()

    expect(followLinkClick(event, { href: "https://[", ...port })).toBe(false)
    expect(event.cancelled).toBe(false)
    expect(port.calls).toEqual([])
  })

  it("takes over relative and absolute links to this page's own origin", () => {
    const port = recorder()
    const own = ["/reports", "reports", "?tab=2", "#top", "https://app.example.com/reports"]

    for (const href of own) expect(followLinkClick(click(), { href, ...port })).toBe(true)
    expect(port.calls).toEqual(own)
  })

  it("resolves a relative link against the document's base address", () => {
    const restore = pageAt("https://app.example.com/home", "https://cdn.example.org/")
    try {
      const port = recorder()
      const event = click()

      expect(followLinkClick(event, { href: "/reports", ...port })).toBe(false)
      expect(event.cancelled).toBe(false)
      expect(port.calls).toEqual([])
    } finally {
      restore()
    }
  })

  it("leaves a mailto: link to the browser on a page served from a file", () => {
    const restore = pageAt("file:///srv/app/index.html")
    try {
      const port = recorder()

      expect(followLinkClick(click(), { href: "mailto:ada@example.com", ...port })).toBe(false)
      expect(followLinkClick(click(), { href: "page.html", ...port })).toBe(true)
      expect(port.calls).toEqual(["page.html"])
    } finally {
      restore()
    }
  })

  it("leaves every click to the browser, without throwing, where there is no page location", () => {
    const restore = pageAt(null)
    try {
      const port = recorder()
      const event = click()

      expect(followLinkClick(event, { href: "/reports", ...port })).toBe(false)
      expect(event.cancelled).toBe(false)
      expect(port.calls).toEqual([])
    } finally {
      restore()
    }
  })
})

/** Press `Link`'s own anchor with `event`, the way the browser calls its click handler. */
function pressAnchor(link: JSX.Element, event: LinkClickEvent): void {
  const onClick = link.props.onClick as (event: LinkClickEvent) => void
  onClick(event)
}

describe("Link", () => {
  onAppPage()

  it("leaves a plain click on a link to another origin to the browser", () => {
    const port = recorder()
    const event = click()

    pressAnchor(Link({ href: "https://example.org/docs", navigate: port.navigate }), event)

    expect(event.cancelled).toBe(false)
    expect(port.calls).toEqual([])
  })

  it("leaves a plain click to the browser when its target opens another browsing context", () => {
    const port = recorder()
    const event = click()

    pressAnchor(Link({ href: "/a", target: "_blank", navigate: port.navigate }), event)

    expect(event.cancelled).toBe(false)
    expect(port.calls).toEqual([])
  })

  it("leaves a plain click on a download link to the browser", () => {
    const port = recorder()
    const event = click()

    pressAnchor(Link({ href: "/a.csv", download: "", navigate: port.navigate }), event)

    expect(event.cancelled).toBe(false)
    expect(port.calls).toEqual([])
  })

  it("runs the caller's onClick first, so its preventDefault keeps navigate out", () => {
    const port = recorder()
    const event = click()
    const link = Link({
      href: "/a",
      navigate: port.navigate,
      onClick: (clicked) => clicked.preventDefault(),
    })

    pressAnchor(link, event)

    expect(event.cancelled).toBe(true)
    expect(port.calls).toEqual([])
  })

  it("routes a plain click through navigate from its own anchor", () => {
    const port = recorder()
    const event = click()

    pressAnchor(Link({ href: "/a", navigate: port.navigate }), event)

    expect(event.cancelled).toBe(true)
    expect(port.calls).toEqual(["/a"])
  })

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
