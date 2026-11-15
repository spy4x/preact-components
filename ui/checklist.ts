/**
 * Where `enhanceChecklist` keeps the ticks: the two `Storage` members it calls, so a page passes
 * `localStorage` as it is and a test passes a fake.
 */
export interface ChecklistStorage {
  /** The stored value under `key`, or `null` when there is none. */
  getItem(key: string): string | null
  /** Stores `value` under `key`. */
  setItem(key: string, value: string): void
}

/** Ticked and total boxes of one group: the whole list, or one section of it. */
export interface ChecklistCount {
  /** Boxes ticked. */
  checked: number
  /** Boxes in the group. */
  total: number
}

/** What `enhanceChecklist` reports to `onChange`. */
export interface ChecklistState extends ChecklistCount {
  /** The counts of each section, by the value of its `data-checklist-section` attribute. */
  bySection: Record<string, ChecklistCount>
  /** `false` when the last read or write of the storage threw, so ticks will not survive a reload. */
  storageOk: boolean
}

/** Options of {@link enhanceChecklist}. */
export interface ChecklistOptions {
  /** The storage key, the same on every page and in every language that shows this list. */
  key: string
  /**
   * Where the ticks live, or a function returning it: pass `() => localStorage`, since reading
   * `localStorage` itself throws where a browser blocks site data. Called inside the same guard.
   */
  storage: ChecklistStorage | (() => ChecklistStorage)
  /** Called once on start and after every change, from a click, `clear`, `restore` or another tab. */
  onChange?: (state: ChecklistState) => void
}

/** What {@link enhanceChecklist} returns: call it to unwire the list. */
export interface ChecklistControl {
  /** Removes the listeners. Later changes are no longer saved, and `clear` and `restore` do nothing. */
  (): void
  /** Unticks every box and saves that. Returns the ids that were ticked, for an Undo. */
  clear(): string[]
  /** Ticks exactly the boxes with these ids and saves that, such as the ids `clear` returned. */
  restore(ids: Iterable<string>): void
}

/**
 * Wire the checkboxes a server rendered inside `root` into a checklist whose ticks survive a reload:
 * restore the ticks from storage, save them on every change and follow another tab's changes
 * through the `storage` event. It never draws or reorders anything, so each box keeps its native
 * role, label and keyboard handling.
 *
 * Each `<input type="checkbox">` with an `id` is an item; the id is what is stored, as ids
 * separated by spaces, so keep ids stable and never rename one. A stored id the page no longer has
 * is ignored and dropped on the next save. Items count per section by the
 * `data-checklist-section` attribute of their closest ancestor that has one. Every storage read and
 * write is wrapped, so blocked storage leaves a working list that forgets on reload, reported as
 * `storageOk: false`.
 *
 * ```ts
 * const list = enhanceChecklist(document.querySelector("#checklist")!, {
 *   key: "site.launch-checklist.v1",
 *   storage: () => localStorage,
 *   onChange: ({ checked, total }) => summary.textContent = `${checked} of ${total}`,
 * })
 * const cleared = list.clear() // Clear; `list.restore(cleared)` is its Undo
 * ```
 *
 * @param root The element holding the list. One delegated "change" listener is put on it.
 * @param options The storage key, the storage and the `onChange` callback.
 * @returns A function that unwires the list, with `clear` and `restore` on it.
 */
export function enhanceChecklist(
  root: ParentNode & EventTarget,
  options: ChecklistOptions,
): ChecklistControl {
  const { key, onChange } = options
  const boxes = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"][id]')]
  const sections = boxes.map((box) =>
    box.closest("[data-checklist-section]")?.getAttribute("data-checklist-section") ?? undefined
  )
  const port = options.storage
  let storage: ChecklistStorage | undefined
  let storageOk = true
  let wired = true

  /** Runs one storage call, and records whether it threw. */
  const attempt = <T>(call: (storage: ChecklistStorage) => T): T | undefined => {
    try {
      storage ??= typeof port === "function" ? port() : port
      const result = call(storage)
      storageOk = true
      return result
    } catch {
      storageOk = false
    }
  }

  const report = () => {
    const state: ChecklistState = { checked: 0, total: boxes.length, bySection: {}, storageOk }
    boxes.forEach((box, index) => {
      const section = sections[index]
      const group = section === undefined
        ? undefined
        : state.bySection[section] ??= { checked: 0, total: 0 }
      if (group) group.total++
      if (!box.checked) return
      state.checked++
      if (group) group.checked++
    })
    onChange?.(state)
  }

  const save = () => {
    const ids = boxes.filter((box) => box.checked).map((box) => box.id)
    attempt((storage) => storage.setItem(key, ids.join(" ")))
  }

  /** Ticks exactly the stored ids. Leaves the boxes as they are when storage cannot be read. */
  const load = () => {
    const stored = attempt((storage) => storage.getItem(key))
    if (stored === undefined) return
    const ids = new Set((stored ?? "").split(" "))
    for (const box of boxes) box.checked = ids.has(box.id)
  }

  const onBoxChange = (event: Event) => {
    if (!boxes.includes(event.target as HTMLInputElement)) return
    save()
    report()
  }

  const onStorage = (event: Event) => {
    const changed = (event as StorageEvent).key
    // A `null` key means another tab cleared the whole storage.
    if (changed !== key && changed !== null) return
    load()
    report()
  }

  load()
  root.addEventListener("change", onBoxChange)
  globalThis.addEventListener?.("storage", onStorage)
  report()

  const unwire = () => {
    wired = false
    root.removeEventListener("change", onBoxChange)
    globalThis.removeEventListener?.("storage", onStorage)
  }
  const set = (ids: Set<string>) => {
    if (!wired) return
    for (const box of boxes) box.checked = ids.has(box.id)
    save()
    report()
  }
  return Object.assign(unwire, {
    clear: () => {
      const ticked = boxes.filter((box) => box.checked).map((box) => box.id)
      set(new Set())
      return wired ? ticked : []
    },
    restore: (ids: Iterable<string>) => set(new Set(ids)),
  })
}
