import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type ChecklistState, type ChecklistStorage, enhanceChecklist } from "./checklist.ts"

const KEY = "test.checklist.v1"

/** A storage that keeps values in a map, or throws on every call when `blocked`. */
function fakeStorage(initial?: string) {
  const values = new Map<string, string>(initial === undefined ? [] : [[KEY, initial]])
  const storage = {
    blocked: false,
    values,
    getItem(key: string) {
      if (storage.blocked) throw new Error("SecurityError")
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      if (storage.blocked) throw new Error("QuotaExceededError")
      values.set(key, value)
    },
  }
  return storage satisfies ChecklistStorage
}

/**
 * A server-rendered list as the few DOM members the enhancer reads: a root that is an event
 * target and answers the checkbox query, and checkboxes that know their section.
 */
function checklist(items: Record<string, string[]>) {
  const root = new EventTarget() as EventTarget & ParentNode & { boxes: HTMLInputElement[] }
  root.boxes = Object.entries(items).flatMap(([section, ids]) =>
    ids.map((id) =>
      ({
        id,
        checked: false,
        closest: (selector: string) =>
          selector === "[data-checklist-section]"
            ? { getAttribute: (name: string) => name === "data-checklist-section" ? section : null }
            : null,
      }) as unknown as HTMLInputElement
    )
  )
  const query = (selector: string) => selector === 'input[type="checkbox"][id]' ? root.boxes : []
  root.querySelectorAll = query as unknown as ParentNode["querySelectorAll"]
  const box = (id: string) => root.boxes.find((box) => box.id === id)!
  /** Ticks or unticks a box the way a click does: the state, then a bubbling `change` event. */
  const click = (id: string) => {
    box(id).checked = !box(id).checked
    const event = new Event("change")
    Object.defineProperty(event, "target", { value: box(id) })
    root.dispatchEvent(event)
  }
  return { root, box, click }
}

/** A `storage` event as another tab's write fires it in this one. */
function storageEvent(key: string | null) {
  const event = new Event("storage")
  Object.defineProperty(event, "key", { value: key })
  globalThis.dispatchEvent(event)
}

const ITEMS = { security: ["security-2fa", "security-backups"], legal: ["legal-terms"] }

describe("enhanceChecklist", () => {
  it("restores the stored ticks and reports the counts on start", () => {
    const list = checklist(ITEMS)
    const states: ChecklistState[] = []
    const undo = enhanceChecklist(list.root, {
      key: KEY,
      storage: fakeStorage("security-2fa legal-terms"),
      onChange: (state) => void states.push(state),
    })

    expect(list.box("security-2fa").checked).toBe(true)
    expect(list.box("security-backups").checked).toBe(false)
    expect(states).toEqual([{
      checked: 2,
      total: 3,
      bySection: { security: { checked: 1, total: 2 }, legal: { checked: 1, total: 1 } },
      storageOk: true,
    }])
    undo()
  })

  it("saves the ticked ids on every change", () => {
    const list = checklist(ITEMS)
    const storage = fakeStorage()
    const states: ChecklistState[] = []
    const undo = enhanceChecklist(list.root, {
      key: KEY,
      storage,
      onChange: (state) => void states.push(state),
    })

    list.click("security-backups")
    expect(storage.values.get(KEY)).toBe("security-backups")
    list.click("legal-terms")
    expect(storage.values.get(KEY)).toBe("security-backups legal-terms")
    expect(states.at(-1)?.checked).toBe(2)
    undo()
  })

  it("ignores a stored id the page no longer has", () => {
    const list = checklist(ITEMS)
    const storage = fakeStorage("security-removed legal-terms")
    const states: ChecklistState[] = []
    const undo = enhanceChecklist(list.root, {
      key: KEY,
      storage,
      onChange: (state) => void states.push(state),
    })

    expect(states[0].checked).toBe(1)
    expect(states[0].bySection.security).toEqual({ checked: 0, total: 2 })
    list.click("security-2fa")
    expect(storage.values.get(KEY)).toBe("security-2fa legal-terms")
    undo()
  })

  it("keeps the list working and reports storageOk false when storage throws", () => {
    const list = checklist(ITEMS)
    const storage = fakeStorage()
    storage.blocked = true
    const states: ChecklistState[] = []
    const undo = enhanceChecklist(list.root, {
      key: KEY,
      storage,
      onChange: (state) => void states.push(state),
    })

    expect(states[0].storageOk).toBe(false)
    list.click("legal-terms")
    expect(list.box("legal-terms").checked).toBe(true)
    expect(states.at(-1)).toMatchObject({ checked: 1, storageOk: false })
    undo()
  })

  it("reports storageOk false when reaching the storage itself throws", () => {
    const list = checklist(ITEMS)
    const states: ChecklistState[] = []
    const undo = enhanceChecklist(list.root, {
      key: KEY,
      storage: () => {
        throw new Error("SecurityError")
      },
      onChange: (state) => void states.push(state),
    })

    list.click("legal-terms")
    expect(states.map((state) => state.storageOk)).toEqual([false, false])
    expect(states.at(-1)?.checked).toBe(1)
    undo()
  })

  it("follows ticks another tab saved, from the storage event", () => {
    const list = checklist(ITEMS)
    const storage = fakeStorage("security-2fa")
    const states: ChecklistState[] = []
    const undo = enhanceChecklist(list.root, {
      key: KEY,
      storage,
      onChange: (state) => void states.push(state),
    })

    storage.values.set(KEY, "legal-terms")
    storageEvent("another.key")
    expect(list.box("security-2fa").checked).toBe(true)

    storageEvent(KEY)
    expect(list.box("security-2fa").checked).toBe(false)
    expect(list.box("legal-terms").checked).toBe(true)
    expect(states.at(-1)?.checked).toBe(1)
    undo()
  })

  it("clears every tick and restores them for an undo", () => {
    const list = checklist(ITEMS)
    const storage = fakeStorage("security-2fa legal-terms")
    const states: ChecklistState[] = []
    const control = enhanceChecklist(list.root, {
      key: KEY,
      storage,
      onChange: (state) => void states.push(state),
    })

    const cleared = control.clear()
    expect(cleared).toEqual(["security-2fa", "legal-terms"])
    expect(list.box("security-2fa").checked).toBe(false)
    expect(storage.values.get(KEY)).toBe("")
    expect(states.at(-1)?.checked).toBe(0)

    control.restore(cleared)
    expect(list.box("security-2fa").checked).toBe(true)
    expect(list.box("legal-terms").checked).toBe(true)
    expect(storage.values.get(KEY)).toBe("security-2fa legal-terms")
    expect(states.at(-1)?.checked).toBe(2)
    control()
  })

  it("stops saving and following other tabs once unwired", () => {
    const list = checklist(ITEMS)
    const storage = fakeStorage()
    const states: ChecklistState[] = []
    const unwire = enhanceChecklist(list.root, {
      key: KEY,
      storage,
      onChange: (state) => void states.push(state),
    })

    unwire()
    list.click("security-2fa")
    storage.values.set(KEY, "legal-terms")
    storageEvent(KEY)
    unwire.clear()

    expect(storage.values.get(KEY)).toBe("legal-terms")
    expect(list.box("legal-terms").checked).toBe(false)
    expect(list.box("security-2fa").checked).toBe(true)
    expect(states.length).toBe(1)
  })
})
