import {
  centreInView,
  check,
  type Devtools,
  openGuidePage,
  poll,
  pressKey,
  settledScroll,
} from "../harness.ts"
import { type Chord, clickSelector, NARROW_WIDTH, pressChord } from "./shared.ts"
import {
  composeThenCommit,
  compositionDetail,
  heldThenFiltered,
  narrowedEachTime,
  pressImeKey,
  RECORD_IME_KEYS,
  TAKE_IME_KEYS,
  typeEachCharacter,
  typingDetail,
} from "./shared-typing.ts"

/** What one read of a `CommandPalette` sees, by its `dataE2E` name. */
interface PaletteState {
  open: boolean
  focusInField: boolean
  onTrigger: boolean
  query: string
  /** Each option's label, in list order. */
  results: string[]
  /** Each group as `heading:count`, in list order. */
  groups: string[]
  /** The label of the option `aria-activedescendant` points at, or `""`. */
  active: string
  /** The status line's text, and whether it is shown rather than visually hidden. */
  status: string
  statusShown: boolean
  /** `aria-busy` on the list. */
  busy: boolean
}

/** The {@link PaletteState} of the palette named `name`, read in one round trip. */
function paletteState(name: string): string {
  return `(() => {
    const dialog = document.querySelector('[data-e2e="${name}"]')
    const field = dialog?.querySelector('[role="combobox"]')
    const label = (option) => option?.querySelector("span span")?.textContent ?? ""
    const activeId = field?.getAttribute("aria-activedescendant")
    const status = dialog?.querySelector('[role="status"]')
    return {
      open: dialog?.open === true,
      focusInField: field != null && document.activeElement === field,
      onTrigger: document.activeElement === document.querySelector('[data-e2e="${name}-open"]'),
      query: field?.value ?? "",
      results: [...(dialog?.querySelectorAll('[role="option"]') ?? [])].map(label),
      groups: [...(dialog?.querySelectorAll('[role="group"]') ?? [])].map((group) =>
        (document.getElementById(group.getAttribute("aria-labelledby"))?.textContent ?? "?") +
        ":" + group.querySelectorAll('[role="option"]').length),
      active: activeId ? label(document.getElementById(activeId)) : "",
      status: status?.textContent ?? "",
      statusShown: status != null && !status.classList.contains("sr-only"),
      busy: dialog?.querySelector('[role="listbox"]')?.getAttribute("aria-busy") === "true",
    }
  })()`
}

/**
 * `CommandPalette` on its card. The local palette: a click opens it with its options under their
 * group headings, typing filters them with accents folded, its own hotkey (mod+P) opens it from a
 * text field, Escape then closes it onto its trigger rather than the field, and the arrows, Home,
 * End and Enter move and pick.
 * The remote palette's specs are in `pages/e2e/ui.spec.ts`. The guide's own search, the same
 * component, keeps the highlight in view, locks the page's scroll, and fills the screen at a phone's
 * width.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function commandPaletteChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "ui")
  const LOCAL = "palette-local"
  const REMOTE = "palette-remote"
  const read = (name: string) => devtools.evaluate<PaletteState>(paletteState(name))
  const until = (name: string, expression: string, timeoutMs = 3_000) =>
    poll(
      () =>
        devtools.evaluate<boolean>(
          `(() => { const state = ${paletteState(name)}; return ${expression} })()`,
        ),
      timeoutMs,
    )
  const text = (selector: string) =>
    devtools.evaluate<string>(
      `document.querySelector(${JSON.stringify(selector)})?.textContent ?? "?"`,
    )
  const closeIfOpen = (name: string) =>
    devtools.evaluate<null>(
      `(document.querySelector('[data-e2e="${name}"]')?.open && ` +
        `document.querySelector('[data-e2e="${name}"]').close(), null)`,
    )
  const trigger = (name: string) => `[data-e2e="${name}-open"]`

  const present = await devtools.evaluate<boolean>(
    `document.querySelector('#demo-CommandPalette ${trigger(LOCAL)}') !== null && ` +
      `document.querySelector('#demo-CommandPalette ${trigger(REMOTE)}') !== null`,
  )
  check("the CommandPalette card is on the page, with its two palettes", present)
  if (!present) return
  await centreInView(devtools, `document.querySelector('${trigger(LOCAL)}')`)

  // A click opens it; typing filters, with case and accents folded.
  const clicked = await clickSelector(devtools, trigger(LOCAL))
  const opened = await until(LOCAL, "state.focusInField")
  const all = await read(LOCAL)
  await devtools.send("Input.insertText", { text: "creme" })
  await until(LOCAL, `state.results.join() === "Crème brûlée"`)
  const filtered = await read(LOCAL)
  check(
    "a click opens the CommandPalette with its options under their group headings, and typing filters them",
    clicked && opened && all.groups.join() === "Actions:2,Pages:4" &&
      all.results[0] === "New invoice" && filtered.results.join() === "Crème brûlée",
    `clicked ${clicked}, focus in the field ${opened}; groups ${all.groups.join(", ")}, first ` +
      `"${all.results[0]}"; "creme" → ${filtered.results.join(", ")}`,
  )

  // A click opened it, so the browser itself puts focus back on the trigger when it closes. The
  // Escape check below opens it from a text field instead, where only the palette moves focus there.
  await pressKey(devtools, "Escape")
  const escapedClick = await until(LOCAL, "!state.open")
  await closeIfOpen(LOCAL)

  // Its own hotkey from inside a text field: a chord is never typed text.
  const apple = await devtools.evaluate<boolean>(
    `/mac|iphone|ipad|ipod/i.test(navigator.userAgentData?.platform || navigator.platform || "")`,
  )
  const modP: Chord = { key: "p", code: "KeyP", keyCode: 80, modifiers: apple ? 4 : 2 }
  const field = `document.querySelector('#demo-ShortcutsDialog [data-e2e="shortcuts-field"]')`
  const focused = await devtools.evaluate<boolean>(
    `(${field}?.focus(), document.activeElement === ${field})`,
  )
  await pressChord(devtools, modP)
  const byHotkey = await until(LOCAL, "state.focusInField")
  const fresh = await read(LOCAL)
  check(
    `${
      apple ? "⌘P" : "Ctrl+P"
    }, the card's own hotkey, opens the CommandPalette from a text field with an empty query`,
    focused && byHotkey && fresh.query === "" && fresh.results.length === 6,
    `focus in a text field ${focused}; opened ${byHotkey}, query "${fresh.query}", ` +
      `${fresh.results.length} results`,
  )

  await pressKey(devtools, "Escape")
  const escaped = await until(LOCAL, "!state.open && state.onTrigger")
  const inField = await devtools.evaluate<boolean>(`document.activeElement === ${field}`)
  await closeIfOpen(LOCAL)
  check(
    "Escape closes the CommandPalette with focus on its trigger, not back in the text field a hotkey opened it from",
    escapedClick && escaped && !inField,
    `closed by Escape after a click ${escapedClick}; after the hotkey: closed onto the trigger ` +
      `${escaped}, focus in the text field ${inField}`,
  )

  await pressChord(devtools, modP)
  const reopened = await until(LOCAL, "state.focusInField")
  const moves: string[] = [(await read(LOCAL)).active]
  for (const key of ["ArrowDown", "End", "Home", "ArrowUp"] as const) {
    await pressKey(devtools, key)
    moves.push((await read(LOCAL)).active)
  }
  await pressKey(devtools, "Enter")
  const picked = await until(LOCAL, "!state.open")
  const pickedText = await text(`[data-e2e="palette-local-picked"]`)
  await closeIfOpen(LOCAL)
  check(
    "ArrowDown, End, Home and ArrowUp move the CommandPalette's highlight, and Enter picks it and closes the palette",
    reopened && moves.join() === "New invoice,Export to CSV,Settings,New invoice,Settings" &&
      picked && pickedText === "Settings",
    `reopened ${reopened}; highlight ${moves.join(" → ")}; Enter closed it ${picked}, ` +
      `onSelect got "${pickedText}"`,
  )

  // The guide's header search, the same component with 12 results for "e": more than its list
  // shows at once.
  const GUIDE = "ui-guide-search"
  const guideClicked = await clickSelector(devtools, trigger(GUIDE))
  const guideOpened = await until(GUIDE, "state.focusInField")
  await devtools.send("Input.insertText", { text: "e" })
  const many = await until(GUIDE, "state.results.length === 12")
  await pressKey(devtools, "End")
  const inView = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        const field = document.querySelector('[data-e2e="${GUIDE}"] [role="combobox"]')
        const option = document.getElementById(field.getAttribute("aria-activedescendant"))
        const list = document.querySelector('[data-e2e="${GUIDE}"] [role="listbox"]').parentElement
        const row = option.getBoundingClientRect()
        const box = list.getBoundingClientRect()
        return option === [...list.querySelectorAll('[role="option"]')].at(-1) &&
          row.top >= box.top && row.bottom <= box.bottom
      })()`),
    2_000,
  )
  check(
    "End in the guide's search scrolls the last result into the list's visible area",
    guideClicked && guideOpened && many && inView,
    `opened ${guideOpened}; 12 results for "e" ${many}; last result in view ${inView}`,
  )

  // The page behind does not scroll under the wheel while the palette is open, as behind Modal.
  // Focus returning to an earlier trigger may still be scrolling the page smoothly, so it settles
  // first and the wheel is measured from where it stopped.
  await settledScroll(devtools)
  const scrollBefore = await devtools.evaluate<number>("scrollY")
  const locked = await devtools.evaluate<string>(
    "getComputedStyle(document.scrollingElement).overflowY",
  )
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: 8,
    y: 700,
    deltaX: 0,
    // Towards the top when there is room, so a page already at its end can still move.
    deltaY: scrollBefore > 1_000 ? -600 : 600,
  })
  await new Promise((done) => setTimeout(done, 600))
  const scrollWhileOpen = await devtools.evaluate<number>("scrollY")
  await pressKey(devtools, "Escape")
  const guideClosed = await until(GUIDE, "!state.open")
  await closeIfOpen(GUIDE)
  const released = await devtools.evaluate<string>(
    "getComputedStyle(document.scrollingElement).overflowY",
  )
  check(
    "the page behind an open CommandPalette does not scroll, and scrolls again once it closes",
    locked === "hidden" && scrollWhileOpen === scrollBefore && guideClosed &&
      released !== "hidden",
    `overflow while open ${locked}; scrollY ${scrollBefore} → ${scrollWhileOpen} after a wheel ` +
      `over the backdrop; closed ${guideClosed}, overflow after ${released}`,
  )

  // A page an open Modal has already locked: the body carries `overflow: hidden` and the padding
  // that stands in for the scrollbar. Set the same two styles by hand, as Modal's lock does, and
  // the palette must leave both alone while it opens and after it closes.
  await devtools.evaluate<null>(
    `(document.body.style.overflow = "hidden", document.body.style.paddingRight = "15px", null)`,
  )
  const padding = () => devtools.evaluate<string>("document.body.style.paddingRight")
  let nested = { opened: false, whileOpen: "", afterClose: "", overflowAfter: "" }
  try {
    const nestedClicked = await clickSelector(devtools, trigger(GUIDE))
    const nestedOpened = nestedClicked && await until(GUIDE, "state.focusInField")
    const whileOpen = await padding()
    await pressKey(devtools, "Escape")
    await until(GUIDE, "!state.open")
    await closeIfOpen(GUIDE)
    nested = {
      opened: nestedOpened,
      whileOpen,
      afterClose: await padding(),
      overflowAfter: await devtools.evaluate<string>("document.body.style.overflow"),
    }
  } finally {
    await devtools.evaluate<null>(
      `(document.body.style.overflow = "", document.body.style.paddingRight = "", null)`,
    )
  }
  check(
    "a CommandPalette opened over a page another lock already holds leaves that lock's padding alone",
    nested.opened && nested.whileOpen === "15px" && nested.afterClose === "15px" &&
      nested.overflowAfter === "hidden",
    `opened ${nested.opened}; body padding while open ${nested.whileOpen}, after close ` +
      `${nested.afterClose}; overflow after close ${nested.overflowAfter}`,
  )

  await commandPaletteClassLockChecks(devtools, {
    open: async () =>
      await clickSelector(devtools, trigger(GUIDE)) && await until(GUIDE, "state.focusInField"),
    close: async () => {
      await pressKey(devtools, "Escape")
      const closed = await until(GUIDE, "!state.open")
      await closeIfOpen(GUIDE)
      return closed
    },
  })

  // At a phone's width the guide's header search, the same component, is an icon and a full sheet.
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: NARROW_WIDTH,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  })
  try {
    const icon = await devtools.evaluate<{ text: boolean; hint: boolean }>(`(() => {
      const button = document.querySelector('${trigger(GUIDE)}')
      return {
        text: button?.querySelector("span")?.checkVisibility() ?? true,
        hint: button?.querySelector("kbd")?.checkVisibility() ?? true,
      }
    })()`)
    const phoneClicked = await clickSelector(devtools, trigger(GUIDE))
    const phoneOpened = await until(GUIDE, "state.focusInField")
    const box = await devtools.evaluate<
      { left: number; top: number; width: number; height: number; vw: number; vh: number }
    >(`(() => {
      const box = document.querySelector('[data-e2e="${GUIDE}"]').getBoundingClientRect()
      return { left: box.left, top: box.top, width: box.width, height: box.height,
        vw: document.documentElement.clientWidth, vh: innerHeight }
    })()`)
    await clickSelector(devtools, `[data-e2e="${GUIDE}-close"]`)
    const phoneClosed = await until(GUIDE, "!state.open")
    await closeIfOpen(GUIDE)
    check(
      `at ${NARROW_WIDTH}px the CommandPalette's trigger is an icon and its dialog fills the screen`,
      !icon.text && !icon.hint && phoneClicked && phoneOpened && box.left === 0 && box.top === 0 &&
        box.width === box.vw && box.height === box.vh && phoneClosed,
      `trigger text shown ${icon.text}, hint shown ${icon.hint}; opened ${phoneOpened}; dialog ` +
        `${box.width}×${box.height} at (${box.left}, ${box.top}) in ${box.vw}×${box.vh}; ` +
        `closed by its button ${phoneClosed}`,
    )
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
}

/** Opens and closes one `CommandPalette`, each answering whether it got there. */
interface PaletteDriver {
  /** Click the trigger; `true` once focus is in the palette's field. */
  open: () => Promise<boolean>
  /** Press Escape; `true` once the dialog is closed. */
  close: () => Promise<boolean>
}

/** The page's scroll lock as the palette leaves it, read at one moment. */
interface PageLockReading {
  /** The scrolling element's inline `overflow`: what the palette wrote there. */
  inlineScrollerOverflow: string
  /** The body's inline `overflow`: what the palette wrote there. */
  inlineOverflow: string
  /** The body's inline `padding-right`: the padding the palette wrote. */
  inlinePadding: string
  /** The scrolling element's computed `overflow-y`. */
  scrollerOverflow: string
  /** The body's computed `overflow-y`. */
  bodyOverflow: string
  /** The body's computed `padding-right`. */
  padding: string
}

/** The class an app's own dialog would put on the body or on `html` to lock the page (#633). */
const APP_LOCK_CLASS = "app-scroll-lock"

/**
 * An app that locks the page with a CSS class keeps its lock through a `CommandPalette` (#633).
 *
 * The class sets `overflow: hidden`, and the body gets the 15px padding that stands in for the
 * scrollbar, as an app's own dialog would. It is put on the body in one run and on `html` in
 * another, since an app may lock either. While it is on, the palette must write no inline style of
 * its own: writing one zeroes the padding, so the page moves. Without the class the palette locks
 * the page while open and unlocks it after close.
 */
async function commandPaletteClassLockChecks(
  devtools: Devtools,
  palette: PaletteDriver,
): Promise<void> {
  const reading = () =>
    devtools.evaluate<PageLockReading>(`(() => {
      const body = getComputedStyle(document.body)
      return {
        inlineScrollerOverflow: document.scrollingElement.style.overflow,
        inlineOverflow: document.body.style.overflow,
        inlinePadding: document.body.style.paddingRight,
        scrollerOverflow: getComputedStyle(document.scrollingElement).overflowY,
        bodyOverflow: body.overflowY,
        padding: body.paddingRight,
      }
    })()`)
  const show = (read?: PageLockReading) =>
    read === undefined ? "no reading" : `inline overflow "${read.inlineScrollerOverflow}"/` +
      `"${read.inlineOverflow}" padding "${read.inlinePadding}", computed overflow ` +
      `${read.scrollerOverflow}/${read.bodyOverflow} padding ${read.padding}`

  for (const holder of ["body", "html"] as const) {
    const element = holder === "body" ? "document.body" : "document.documentElement"
    await devtools.evaluate<null>(`(() => {
      const style = document.createElement("style")
      style.id = "${APP_LOCK_CLASS}-style"
      style.textContent = ".${APP_LOCK_CLASS} { overflow: hidden } " +
        "body.${APP_LOCK_CLASS}, html.${APP_LOCK_CLASS} > body { padding-right: 15px }"
      document.head.append(style)
      ${element}.classList.add("${APP_LOCK_CLASS}")
      return null
    })()`)
    let classed: {
      opened: boolean
      closed: boolean
      open?: PageLockReading
      after?: PageLockReading
    } = { opened: false, closed: false }
    try {
      const opened = await palette.open()
      const open = await reading()
      const closed = await palette.close()
      classed = { opened, closed, open, after: await reading() }
    } finally {
      await devtools.evaluate<null>(`(() => {
        ${element}.classList.remove("${APP_LOCK_CLASS}")
        document.getElementById("${APP_LOCK_CLASS}-style")?.remove()
        return null
      })()`)
    }
    const locked = (read: PageLockReading) =>
      holder === "body" ? read.bodyOverflow === "hidden" : read.scrollerOverflow === "hidden"
    const untouched = (read?: PageLockReading) =>
      read !== undefined && read.inlineScrollerOverflow === "" && read.inlineOverflow === "" &&
      read.inlinePadding === "" && locked(read) && read.padding === "15px"
    check(
      `a CommandPalette opened over a page an app locks with a class on ${holder} writes no style ` +
        "of its own, so the lock keeps its padding while open and after close",
      classed.opened && classed.closed && untouched(classed.open) && untouched(classed.after),
      `opened ${classed.opened}, closed ${classed.closed}; while open: ${show(classed.open)}; ` +
        `after close: ${show(classed.after)}`,
    )
  }

  const opened = await palette.open()
  const open = await reading()
  const closed = await palette.close()
  const after = await reading()
  check(
    "without the class a CommandPalette locks the page while open and unlocks it after close",
    opened && closed && open.scrollerOverflow === "hidden" && after.scrollerOverflow !== "hidden" &&
      after.bodyOverflow !== "hidden" && after.inlinePadding === "",
    `opened ${opened}, closed ${closed}; while open: ${show(open)}; after close: ${show(after)}`,
  )
}

/**
 * The remote `CommandPalette` asks its `search` nothing while an input method composes, and asks
 * once, for the finished word, when the composition ends (#643).
 *
 * The card counts the searches it started. Opening starts one for the empty query; once that has
 * answered, the composition builds "a" then "ap", and the count must stay put for longer than the
 * 200 ms debounce after the last step. The commit must then start exactly one search, whose answer
 * is the fruits holding "ap", and no second one may follow it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function compositionRemotePaletteCheck(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "ui")
  const REMOTE = "palette-remote"
  const dialog = `document.querySelector('[data-e2e="${REMOTE}"]')`
  const field = `(${dialog}?.querySelector('[role="combobox"]') ?? null)`
  const results = () =>
    devtools.evaluate<string[]>(
      `[...(${dialog}?.querySelectorAll('[role="option"]') ?? [])]
        .map((option) => option.querySelector("span span")?.textContent ?? "")`,
    )
  const searches = () =>
    devtools.evaluate<number>(
      `Number(document.querySelector('[data-e2e="palette-remote-searches"]')?.textContent ?? -1)`,
    )
  const trigger = `[data-e2e="${REMOTE}-open"]`
  const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

  await centreInView(devtools, `document.querySelector('${trigger}')`)
  const clicked = await clickSelector(devtools, trigger)
  const opened = await poll(
    () => devtools.evaluate<boolean>(`document.activeElement === ${field}`),
    3_000,
  )
  await poll(async () => (await results()).length === 7, 3_000)
  const base = await searches()
  for (const text of ["a", "ap"]) {
    await devtools.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    })
    await wait(150)
  }
  // Past the debounce: a search a step had asked for would have started by now.
  await wait(500)
  const composing = await searches()
  const shownWhileComposing = await results()
  await devtools.send("Input.insertText", { text: "ap" })
  await poll(async () => (await results()).join() === "Apple,Apricot,Grape,Papaya", 3_000)
  // And past it again: a second search for the same word would have started by now.
  await wait(500)
  const after = await searches()
  const answered = await results()
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${dialog}?.open !== true`), 3_000)
  await devtools.evaluate<null>(`(${dialog}?.open && ${dialog}.close(), null)`)
  check(
    "the remote CommandPalette starts no search while an input method composes, and exactly one for the finished word",
    clicked && opened && base > 0 && composing === base && shownWhileComposing.length === 7 &&
      after === base + 1 && answered.join() === "Apple,Apricot,Grape,Papaya",
    `opened ${clicked && opened}; searches ${base} before, ${composing} while composing ` +
      `(${shownWhileComposing.length} results shown), ${after} after the commit; results ` +
      `${answered.join(", ")}`,
  )
}

/**
 * The local `CommandPalette`: an input method's steps leave its results as they were, the finished
 * word filters them once, plain typing still filters on every keystroke, and the Enter and Escape
 * that end a composition neither pick nor close (#643).
 *
 * The composition builds "s" then "se". Plain typing then retypes "s" and "e" as two keystrokes
 * into an emptied field. The Enter and Escape are real presses with keyCode 229, as Safari sends
 * the ones that confirm or cancel a word; the palette must stay open with nothing picked, and a
 * plain Enter afterwards must still pick.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function compositionCommandPaletteChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "ui")
  const LOCAL = "palette-local"
  const dialog = `document.querySelector('[data-e2e="${LOCAL}"]')`
  const field = `(${dialog}?.querySelector('[role="combobox"]') ?? null)`
  const results = `[...(${dialog}?.querySelectorAll('[role="option"]') ?? [])]
    .map((option) => option.querySelector("span span")?.textContent ?? "")`
  const picked = () =>
    devtools.evaluate<string>(
      `document.querySelector('[data-e2e="${LOCAL}-picked"]')?.textContent ?? "?"`,
    )
  const isOpen = () => devtools.evaluate<boolean>(`${dialog}?.open === true`)
  const trigger = `[data-e2e="${LOCAL}-open"]`

  await centreInView(devtools, `document.querySelector('${trigger}')`)
  const clicked = await clickSelector(devtools, trigger)
  const opened = await poll(
    () => devtools.evaluate<boolean>(`document.activeElement === ${field}`),
    3_000,
  )
  const steps = ["s", "se"]
  const composed = await composeThenCommit(
    devtools,
    field,
    `${dialog}?.querySelector('[role="listbox"]') ?? null`,
    results,
    steps,
  )
  check(
    "an input method's steps leave the CommandPalette results unchanged, and the finished word filters them",
    clicked && opened && heldThenFiltered(composed, steps, ["Settings"]),
    `clicked ${clicked}, focus in the field ${opened}; ${compositionDetail(composed)}`,
  )

  // Picking closes the palette before it reports the option, so staying open is the proof that the
  // input method's keys picked nothing; the plain Enter must then pick the highlighted result. The
  // highlight is read after them: Chromium still clears a search field on an Escape with keyCode
  // 229 sent through the protocol, and the results widen with it.
  const highlight = () =>
    devtools.evaluate<string>(
      `document.getElementById(${field}?.getAttribute("aria-activedescendant") ?? "")
        ?.querySelector("span span")?.textContent ?? ""`,
    )
  await devtools.evaluate<null>(RECORD_IME_KEYS)
  await pressImeKey(devtools, "Enter")
  await pressImeKey(devtools, "Escape")
  // A fixed wait: it proves the presses change nothing, and an absence has no state to poll for.
  await new Promise((done) => setTimeout(done, 200))
  const keys = await devtools.evaluate<string>(TAKE_IME_KEYS)
  const stillOpen = await isOpen()
  const highlighted = await highlight()
  await pressKey(devtools, "Enter")
  const closed = await poll(async () => !(await isOpen()), 3_000)
  const chosen = await picked()
  check(
    "the Enter and Escape that end a composition neither pick from nor close the CommandPalette, and a plain Enter still picks",
    keys === "Enter 229 false, Escape 229 false" && stillOpen && highlighted !== "" && closed &&
      chosen === highlighted,
    `the page saw [${keys}]; open after it ${stillOpen}; a plain Enter closed it ${closed} and ` +
      `picked "${chosen}" (highlight "${highlighted}")`,
  )

  const reclicked = await clickSelector(devtools, trigger)
  const reopened = await poll(
    () => devtools.evaluate<boolean>(`document.activeElement === ${field}`),
    3_000,
  )
  const all = await devtools.evaluate<string[]>(results)
  const typed = await typeEachCharacter(devtools, results, "se")
  check(
    "plain typing still filters the CommandPalette results on every keystroke",
    reclicked && reopened && narrowedEachTime(all, typed),
    `reopened ${reclicked && reopened}; ${typingDetail("se", all, typed)}`,
  )
  await pressKey(devtools, "Escape")
  await poll(async () => !(await isOpen()), 3_000)
  await devtools.evaluate<null>(`(${dialog}?.open && ${dialog}.close(), null)`)
}
