import { countedScrollLock, pageScrollLocked, type ScrollLockPage } from "./scroll-lock.ts"
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"

/**
 * A page that records each lock and release. `locked` answers only for a lock the app holds, so a
 * second write by the counter shows up in `events` instead of being hidden by the guard.
 */
function stubPage(lockedByApp = false) {
  const events: string[] = []
  let ours = false
  const page: ScrollLockPage = {
    locked: () => lockedByApp,
    lock: () => {
      events.push("lock")
      ours = true
      return {
        release: () => {
          events.push("release")
          ours = false
        },
      }
    },
  }
  return { page, events, isLocked: () => lockedByApp || ours }
}

describe("countedScrollLock", () => {
  it("locks on the first holder and restores on the last, whatever order they release in", () => {
    // A palette whose onSelect opens a Modal: palette locks, Modal locks, palette releases first.
    const { page, events, isLocked } = stubPage()
    const acquire = countedScrollLock(page)

    const palette = acquire()
    const modal = acquire()
    palette.release()

    expect(isLocked()).toBe(true)
    expect(events).toEqual(["lock"])

    modal.release()

    expect(isLocked()).toBe(false)
    expect(events).toEqual(["lock", "release"])
  })

  it("writes nothing for a second holder, so a nested overlay keeps the first one's padding", () => {
    const { page, events } = stubPage()
    const acquire = countedScrollLock(page)

    acquire()
    acquire()

    expect(events).toEqual(["lock"])
  })

  it("counts a holder released twice only once", () => {
    const { page, isLocked } = stubPage()
    const acquire = countedScrollLock(page)

    const first = acquire()
    acquire()
    first.release()
    first.release()

    expect(isLocked()).toBe(true)
  })

  it("leaves a page something else locked untouched, while held and after release", () => {
    const { page, events } = stubPage(true)
    const acquire = countedScrollLock(page)

    acquire().release()

    expect(events).toEqual([])
  })

  it("locks again for a holder that comes after the last one released", () => {
    const { page, events, isLocked } = stubPage()
    const acquire = countedScrollLock(page)

    acquire().release()
    acquire()

    expect(isLocked()).toBe(true)
    expect(events).toEqual(["lock", "release", "lock"])
  })
})

describe("pageScrollLocked", () => {
  it("reads an unlocked page as unlocked", () => {
    expect(pageScrollLocked({ html: "visible", body: "visible" })).toBe(false)
  })

  it("reads a lock on body as locked while html leaves overflow to the body", () => {
    expect(pageScrollLocked({ html: "visible", body: "hidden" })).toBe(true)
    expect(pageScrollLocked({ html: "visible", body: "clip" })).toBe(true)
  })

  it("reads a lock on html as locked over a body that does not scroll", () => {
    expect(pageScrollLocked({ html: "hidden", body: "visible" })).toBe(true)
    expect(pageScrollLocked({ html: "clip", body: "hidden" })).toBe(true)
  })

  it("reads html { overflow-y: hidden } over a body that scrolls as unlocked", () => {
    expect(pageScrollLocked({ html: "hidden", body: "auto" })).toBe(false)
    expect(pageScrollLocked({ html: "hidden", body: "scroll" })).toBe(false)
  })

  it("reads body { overflow: hidden } under an html that scrolls as unlocked", () => {
    expect(pageScrollLocked({ html: "auto", body: "hidden" })).toBe(false)
    expect(pageScrollLocked({ html: "scroll", body: "hidden" })).toBe(false)
  })
})
