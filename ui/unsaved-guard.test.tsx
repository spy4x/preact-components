import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { guardedHref, type UnsavedClick, UnsavedGuard, type UnsavedLink } from "./unsaved-guard.tsx"

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

describe("UnsavedGuard", () => {
  it("renders nothing on the server, dirty or not", () => {
    for (const when of [false, true]) {
      expect(render(<UnsavedGuard when={when} navigate={() => {}} owns={() => true} />)).toBe("")
    }
  })
})
