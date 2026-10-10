import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  createLeaveGuard,
  guardedHref,
  type UnsavedClick,
  UnsavedGuard,
  type UnsavedLink,
} from "./unsaved-guard.tsx"

const here = { href: "https://app.example/notes/7?tab=body" }
const plain: UnsavedClick = {
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
}
/** The app's router owns `/notes/…` and `/groups/…`, not `/api/…` or the server's pages. */
const owns = (url: URL) => /^\/(notes|groups)(\/|$)/.test(url.pathname)
const link = (overrides: Partial<UnsavedLink> = {}): UnsavedLink => ({
  href: "https://app.example/groups/3?sort=name#top",
  target: null,
  download: false,
  allowed: false,
  ...overrides,
})

describe("guardedHref", () => {
  it("holds back a plain main-button click on an in-app link, as path, query and hash", () => {
    expect(guardedHref(plain, link(), here, owns)).toBe("/groups/3?sort=name#top")
  })

  it("holds back a link to this same page with no fragment, which would reload the route", () => {
    expect(guardedHref(plain, link({ href: "https://app.example/notes/7?tab=body" }), here, owns))
      .toBe("/notes/7?tab=body")
  })

  it("holds back a link with target _self, in any case", () => {
    for (const target of ["_self", "_SELF", ""]) {
      expect(guardedHref(plain, link({ target }), here, owns)).toBe("/groups/3?sort=name#top")
    }
  })

  it("leaves a click a handler already cancelled", () => {
    expect(guardedHref({ ...plain, defaultPrevented: true }, link(), here, owns)).toBeNull()
  })

  it("leaves a click with any button but the main one", () => {
    for (const button of [1, 2]) {
      expect(guardedHref({ ...plain, button }, link(), here, owns)).toBeNull()
    }
  })

  it("leaves a click with any modifier key", () => {
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      expect(guardedHref({ ...plain, [key]: true }, link(), here, owns)).toBeNull()
    }
  })

  it("leaves a link that opens in another tab or frame", () => {
    for (const target of ["_blank", "_parent", "preview"]) {
      expect(guardedHref(plain, link({ target }), here, owns)).toBeNull()
    }
  })

  it("leaves a download link", () => {
    expect(guardedHref(plain, link({ download: true }), here, owns)).toBeNull()
  })

  it("leaves a link marked data-unsaved-ok", () => {
    expect(guardedHref(plain, link({ allowed: true }), here, owns)).toBeNull()
  })

  it("leaves a link to another origin, even on a path the router owns", () => {
    expect(guardedHref(plain, link({ href: "https://other.example/groups/3" }), here, owns))
      .toBeNull()
  })

  it("leaves a same-origin link the router does not own", () => {
    expect(guardedHref(plain, link({ href: "https://app.example/api/export" }), here, owns))
      .toBeNull()
  })

  it("leaves a link that only moves to a fragment of this page", () => {
    expect(
      guardedHref(
        plain,
        link({ href: "https://app.example/notes/7?tab=body#history" }),
        here,
        owns,
      ),
    )
      .toBeNull()
  })

  it('leaves an empty fragment link, href="#", on this page', () => {
    expect(guardedHref(plain, link({ href: "#" }), here, owns)).toBeNull()
    expect(
      guardedHref(plain, link({ href: "https://app.example/notes/7?tab=body#" }), here, owns),
    ).toBeNull()
  })

  it("holds back a fragment link to another query of the same path", () => {
    expect(
      guardedHref(
        plain,
        link({ href: "https://app.example/notes/7?tab=meta#history" }),
        here,
        owns,
      ),
    )
      .toBe("/notes/7?tab=meta#history")
  })

  it("asks owns about the resolved address", () => {
    const seen: string[] = []
    guardedHref(plain, link({ href: "/groups/3" }), here, (url) => {
      seen.push(url.href)
      return true
    })
    expect(seen).toEqual(["https://app.example/groups/3"])
  })
})

describe("createLeaveGuard", () => {
  /** A guard, the navigations that ran, and a `go` that records its name. */
  const setup = () => {
    const ran: string[] = []
    return { guard: createLeaveGuard(), ran, go: (name: string) => () => ran.push(name) }
  }

  it("navigates at once and asks nothing while nobody holds it", () => {
    const { guard, ran, go } = setup()
    const editor = {}
    guard.navigate(go("lists"))
    expect(ran).toEqual(["lists"])
    expect(guard.asks(editor)).toBe(false)
  })

  it("holds a navigation back and asks while it is held", () => {
    const { guard, ran, go } = setup()
    const editor = {}
    guard.hold(editor)
    guard.navigate(go("lists"))
    expect(ran).toEqual([])
    expect(guard.asks(editor)).toBe(true)
  })

  it("runs the navigation once on leave and stops asking", () => {
    const { guard, ran, go } = setup()
    const editor = {}
    guard.hold(editor)
    guard.navigate(go("lists"))
    guard.leave()
    guard.leave()
    expect(ran).toEqual(["lists"])
    expect(guard.asks(editor)).toBe(false)
  })

  it("drops the navigation on stay, so a later leave runs nothing", () => {
    const { guard, ran, go } = setup()
    const editor = {}
    guard.hold(editor)
    guard.navigate(go("lists"))
    guard.stay()
    expect(guard.asks(editor)).toBe(false)
    guard.leave()
    expect(ran).toEqual([])
  })

  it("keeps one question for two navigations in a row, and leave runs only the newest", () => {
    const { guard, ran, go } = setup()
    const editor = {}
    guard.hold(editor)
    guard.navigate(go("today"))
    guard.navigate(go("lists"))
    expect(guard.asks(editor)).toBe(true)
    guard.leave()
    expect(ran).toEqual(["lists"])
    expect(guard.asks(editor)).toBe(false)
  })

  it("navigates at once again after the holder lets go", () => {
    const { guard, ran, go } = setup()
    const release = guard.hold({})
    release()
    guard.navigate(go("lists"))
    expect(ran).toEqual(["lists"])
  })

  it("drops a waiting navigation when the last holder lets go", () => {
    const { guard, ran, go } = setup()
    const editor = {}
    const release = guard.hold(editor)
    guard.navigate(go("lists"))
    release()
    expect(guard.asks(editor)).toBe(false)
    guard.leave()
    expect(ran).toEqual([])
  })

  it("asks through the earliest holder only, then through the next when that one lets go", () => {
    const { guard, ran, go } = setup()
    const first = {}
    const second = {}
    const releaseFirst = guard.hold(first)
    guard.hold(second)
    guard.navigate(go("lists"))
    expect([guard.asks(first), guard.asks(second)]).toEqual([true, false])
    releaseFirst()
    expect([guard.asks(first), guard.asks(second)]).toEqual([false, true])
    expect(ran).toEqual([])
  })

  it("ignores a second call of the same release, so another holder keeps holding", () => {
    const { guard, ran, go } = setup()
    const first = {}
    const releaseFirst = guard.hold(first)
    releaseFirst()
    guard.hold(first)
    releaseFirst()
    guard.navigate(go("lists"))
    expect(ran).toEqual([])
  })
})

describe("UnsavedGuard", () => {
  it("renders nothing on the server, dirty or not", () => {
    for (const when of [false, true]) {
      expect(render(<UnsavedGuard when={when} navigate={() => {}} owns={() => true} />)).toBe("")
    }
  })

  it("renders nothing on the server with a leave guard that already holds a navigation", () => {
    const guard = createLeaveGuard()
    guard.hold({})
    guard.navigate(() => {})
    expect(
      render(<UnsavedGuard when navigate={() => {}} owns={() => true} leaveGuard={guard} />),
    ).toBe("")
  })
})
