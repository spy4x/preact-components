import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  pointerToCorner,
  poll,
} from "../harness.ts"
import { COPY_BUTTON_CHECKMARK } from "./shared.ts"

/** `IconXMark`'s path, which `CopyButton` swaps in for its own glyph after a failed copy. */
const COPY_BUTTON_CROSS = "M6 18 18 6M6 6l12 12"

/** What {@link copyButtonStatusChecks} reads off one `CopyButton` at one moment. */
interface CopyButtonReading {
  /** The glyph's path: the first `<path>` in the button's `<svg>`. */
  icon: string | null
  /** The button's visible text. */
  text: string | null
  /** The polite live region right after the button. */
  region: string | null
}

/** One failure colour's contrast against what it is drawn on, in one palette. */
interface CopyFailureContrast {
  /** The titled button's "Couldn't copy" text on the button's own fill. */
  label: number
  /** The icon-only button's cross on what shows through its transparent box. */
  cross: number
  labelColor: string
}

/** One change of a `CopyButton` live region's text, as a `MutationObserver` in the page saw it. */
interface CopyRegionChange {
  /** Which tagged button the region belongs to. */
  which: string
  /** The region's text after the change. */
  text: string
  /** `performance.now()` when the observer saw it. */
  at: number
}

/**
 * How long a region showed `message` the last time it did: from the change that put the message
 * there to the next change that emptied the region, in milliseconds; `null` when either is missing.
 */
function shownFor(log: readonly CopyRegionChange[], which: string, message: string): number | null {
  const own = log.filter((change) => change.which === which)
  const start = own.findLastIndex((change) => change.text === message)
  if (start === -1) return null
  const end = own.slice(start + 1).find((change) => change.text === "")
  return end ? Math.round(end.at - own[start].at) : null
}

/** The shortest and longest a 1500ms confirmation may be seen for, timer and observer lag included. */
const COPY_WINDOW_MS = { min: 1_000, max: 2_200 } as const

/**
 * `CopyButton` awaits its copy: a clipboard that rejects shows a cross and "Couldn't copy", both on
 * the button and in its live region, and a clipboard that resolves shows the checkmark and
 * "Copied". Either confirmation clears on its own after `copiedForMs`, 1500ms by default, which a
 * `MutationObserver` on each live region times. The failure's red text and cross are measured in
 * light and dark while they show. Two checks cover a second press: the always-failing demo button
 * pressed twice 1s apart empties its region in between and keeps the failure a full window past
 * the second press; and a slow copy that fails after a later press has worked does not overwrite
 * that press's "Copied".
 *
 * `navigator.clipboard.writeText` is replaced in the page, and `document.execCommand` too, because
 * the library falls back to `execCommand("copy")` when the clipboard API rejects: without that
 * second patch, headless Chromium's fallback copy succeeds and the failure never shows. Both are
 * put back at the end.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function copyButtonStatusChecks(devtools: Devtools): Promise<void> {
  const found = await devtools.evaluate<boolean>(`(() => {
    const card = document.querySelector("#demo-CopyButton")
    const buttons = [...(card?.querySelectorAll("button") ?? [])]
    const icon = buttons.find((button) => button.getAttribute("aria-label") === "Copy")
    const titled = buttons.find((button) => button.textContent.trim() === "Copy number")
    const fails = buttons.find((button) => button.textContent.trim() === "Copy, then fail")
    if (!icon || !titled || !fails) return false
    icon.dataset.checkCopy = "icon"
    titled.dataset.checkCopy = "titled"
    fails.dataset.checkCopy = "fails"
    globalThis.__copyRegionLog = []
    globalThis.__copyRegionObservers = [icon, titled, fails].map((button) => {
      const region = button.nextElementSibling
      // One callback can carry several changes. A text change's record holds the text before it,
      // so each record's new text is the next record's old one, and the last is what shows now.
      const observer = new MutationObserver((records) => {
        const at = performance.now()
        records.forEach((record, index) => {
          const next = records[index + 1]
          globalThis.__copyRegionLog.push({
            which: button.dataset.checkCopy,
            text: next?.type === "characterData" ? next.oldValue : region.textContent,
            at,
          })
        })
      })
      observer.observe(region, {
        childList: true,
        characterData: true,
        characterDataOldValue: true,
        subtree: true,
      })
      return observer
    })
    globalThis.__copyButtonOriginals = {
      writeText: navigator.clipboard?.writeText,
      execCommand: document.execCommand,
    }
    return true
  })()`)
  check(
    "the CopyButton card has an icon-only button, a titled one and an always-failing one to drive",
    found,
    found
      ? ""
      : 'no [aria-label="Copy"], "Copy number" or "Copy, then fail" button in #demo-CopyButton',
  )
  if (!found) return

  const setClipboard = (works: boolean) =>
    devtools.evaluate<null>(`(() => {
      globalThis.__copyButtonCopied = []
      const writeText = (text) => {
        globalThis.__copyButtonCopied.push(text)
        return ${works} ? Promise.resolve() : Promise.reject(new DOMException("denied", "NotAllowedError"))
      }
      try {
        navigator.clipboard.writeText = writeText
      } catch {
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
      }
      document.execCommand = () => ${works}
      return null
    })()`)
  const read = (which: string) =>
    devtools.evaluate<CopyButtonReading>(`(() => {
      const button = document.querySelector('[data-check-copy="${which}"]')
      return {
        icon: button?.querySelector("svg path")?.getAttribute("d") ?? null,
        text: button?.textContent.trim() ?? null,
        region: button?.nextElementSibling?.getAttribute("role") === "status"
          ? button.nextElementSibling.textContent
          : null,
      }
    })()`)
  const click = async (which: string) => {
    await centreInView(devtools, `document.querySelector('[data-check-copy="${which}"]')`)
    const spot = await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
      const box = document.querySelector('[data-check-copy="${which}"]')?.getBoundingClientRect()
      return box ? { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) } : null
    })()`)
    if (spot === null) return
    for (const type of ["mousePressed", "mouseReleased"]) {
      await devtools.send("Input.dispatchMouseEvent", {
        type,
        x: spot.x,
        y: spot.y,
        button: "left",
        buttons: type === "mousePressed" ? 1 : 0,
        clickCount: 1,
      })
    }
  }
  const regionLog = () => devtools.evaluate<CopyRegionChange[]>(`globalThis.__copyRegionLog`)
  const inWindow = (ms: number | null) =>
    ms !== null && ms >= COPY_WINDOW_MS.min && ms <= COPY_WINDOW_MS.max
  const atRest = async (which: string, text: string | null) => {
    const reading = await read(which)
    return reading.region === "" && reading.icon !== COPY_BUTTON_CROSS &&
      reading.icon !== COPY_BUTTON_CHECKMARK && (text === null || reading.text === text)
  }

  try {
    // A failing clipboard: both buttons, so the cross and the label can be measured together.
    await setClipboard(false)
    await click("icon")
    await click("titled")
    await pointerToCorner(devtools)
    await poll(async () => (await read("titled")).region === "Couldn't copy", 1_000)
    const contrast = await devtools.evaluate<
      { light: CopyFailureContrast; dark: CopyFailureContrast } | null
    >(`(async () => {
      ${CONTRAST_HELPERS}
      const root = document.documentElement
      const wasDark = root.classList.contains("dark")
      const titled = document.querySelector('[data-check-copy="titled"]')
      const icon = document.querySelector('[data-check-copy="icon"]')
      const label = titled.querySelector("span.text-danger")
      const cross = icon.querySelector("svg")
      if (!label || !cross) return null
      const settle = () => Promise.all(
        [titled, icon, label, cross].flatMap((element) =>
          element.getAnimations().map((animation) => animation.finished.catch(() => {}))
        ),
      )
      const measure = () => ({
        label: seenRatio(label),
        cross: seenRatio(cross),
        labelColor: getComputedStyle(label).color,
      })
      try {
        root.classList.remove("dark")
        await settle()
        const light = measure()
        root.classList.add("dark")
        await settle()
        const dark = measure()
        return { light, dark }
      } finally {
        root.classList.toggle("dark", wasDark)
      }
    })()`)
    const iconFailed = await read("icon")
    const titledFailed = await read("titled")
    const failedCopied = await devtools.evaluate<string[]>(`globalThis.__copyButtonCopied`)

    check(
      "a CopyButton whose clipboard rejects shows a cross and announces the failure, not a copy",
      iconFailed.icon === COPY_BUTTON_CROSS && iconFailed.region === "Couldn't copy" &&
        titledFailed.icon === COPY_BUTTON_CROSS && titledFailed.region === "Couldn't copy" &&
        titledFailed.text === "Couldn't copy" && failedCopied.length === 2,
      `icon-only ${JSON.stringify(iconFailed)}, titled ${JSON.stringify(titledFailed)}, ` +
        `clipboard asked for ${JSON.stringify(failedCopied)}`,
    )

    const lowest = contrast === null ? 0 : Math.min(contrast.light.label, contrast.dark.label)
    const lowestCross = contrast === null ? 0 : Math.min(contrast.light.cross, contrast.dark.cross)
    check(
      "a failed CopyButton's red label reaches 4.5:1 and its red cross 3:1, in light and in dark",
      lowest >= 4.5 && lowestCross >= 3,
      contrast === null
        ? "the failed buttons had no red label or cross to measure"
        : `label ${contrast.light.label.toFixed(2)}:1 light (${contrast.light.labelColor}), ` +
          `${contrast.dark.label.toFixed(2)}:1 dark (${contrast.dark.labelColor}); cross ` +
          `${contrast.light.cross.toFixed(2)}:1 light, ${contrast.dark.cross.toFixed(2)}:1 dark`,
    )

    const failureCleared = await poll(
      async () => (await atRest("icon", null)) && (await atRest("titled", "Copy number")),
      3_000,
    )
    const failureShown = shownFor(await regionLog(), "titled", "Couldn't copy")
    check(
      "a CopyButton's failure state clears on its own after about 1.5s",
      failureCleared && inWindow(failureShown),
      `failure shown for ${failureShown}ms (allowed ${COPY_WINDOW_MS.min}–${COPY_WINDOW_MS.max}); ` +
        `3s later: icon-only ${JSON.stringify(await read("icon"))}, titled ` +
        `${JSON.stringify(await read("titled"))}`,
    )

    // A working clipboard.
    await setClipboard(true)
    await click("titled")
    await pointerToCorner(devtools)
    await poll(async () => (await read("titled")).region === "Copied", 1_000)
    const titledCopied = await read("titled")
    const copied = await devtools.evaluate<string[]>(`globalThis.__copyButtonCopied`)
    check(
      "a CopyButton whose clipboard resolves shows the checkmark and Copied, and copies its text",
      titledCopied.icon === COPY_BUTTON_CHECKMARK && titledCopied.text === "Copied" &&
        titledCopied.region === "Copied" && copied.length === 1 && copied[0] === "INV-0007",
      `titled ${JSON.stringify(titledCopied)}, clipboard got ${JSON.stringify(copied)}`,
    )
    const copiedCleared = await poll(async () => await atRest("titled", "Copy number"), 3_000)
    const copiedShown = shownFor(await regionLog(), "titled", "Copied")
    check(
      "a CopyButton's confirmation clears on its own after about 1.5s",
      copiedCleared && inWindow(copiedShown),
      `"Copied" shown for ${copiedShown}ms (allowed ${COPY_WINDOW_MS.min}–` +
        `${COPY_WINDOW_MS.max}); 3s later: ${JSON.stringify(await read("titled"))}`,
    )

    // A second press, 1s after the first, on the button whose port always fails.
    await devtools.evaluate<null>(`(globalThis.__copyRegionLog.length = 0, null)`)
    await click("fails")
    const firstPress = Date.now()
    await poll(async () => (await read("fails")).region === "Couldn't copy", 1_000)
    // A deliberate pause, not a poll: the second press has to land 1s after the first, and no state
    // on the page marks that moment.
    await new Promise((done) => setTimeout(done, Math.max(0, firstPress + 1_000 - Date.now())))
    await click("fails")
    await pointerToCorner(devtools)
    await poll(async () => await atRest("fails", null), 3_500)
    const secondLog = (await regionLog()).filter((change) => change.which === "fails")
    const texts = secondLog.map((change) => change.text)
    const firstFailure = secondLog.find((change) => change.text === "Couldn't copy")
    const lastEmpty = secondLog.findLast((change) => change.text === "")
    const failureLasted = firstFailure && lastEmpty
      ? Math.round(lastEmpty.at - firstFailure.at)
      : null
    check(
      "a second press empties the live region before announcing again, and restarts the window",
      texts.join("|") === "Couldn't copy||Couldn't copy|" && failureLasted !== null &&
        failureLasted >= 1_800,
      `region texts ${JSON.stringify(texts)}; failure shown from the first announcement until ` +
        `${failureLasted}ms later (needs 1800ms or more)`,
    )

    // A slow copy that fails after a later press has worked.
    await devtools.evaluate<null>(`(() => {
      const writeText = () => new Promise((_resolve, reject) => {
        globalThis.__copySlowReject = reject
      })
      navigator.clipboard.writeText = writeText
      document.execCommand = () => false
      return null
    })()`)
    await click("titled")
    await devtools.evaluate<null>(`(() => {
      navigator.clipboard.writeText = () => Promise.resolve()
      return null
    })()`)
    await click("titled")
    await pointerToCorner(devtools)
    const secondCopied = await poll(async () => (await read("titled")).region === "Copied", 1_000)
    const rejected = await devtools.evaluate<boolean>(`(async () => {
      if (!globalThis.__copySlowReject) return false
      globalThis.__copySlowReject(new DOMException("denied", "NotAllowedError"))
      // A fixed wait, not a poll: it proves the late failure replaces nothing, and an absence has
      // no state to poll for.
      await new Promise((done) => setTimeout(done, 150))
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      return true
    })()`)
    const afterSlow = await read("titled")
    check(
      "a slow copy that fails after a later press worked does not replace that press's Copied",
      secondCopied && rejected && afterSlow.region === "Copied" && afterSlow.text === "Copied" &&
        afterSlow.icon === COPY_BUTTON_CHECKMARK,
      !secondCopied
        ? "the second press never showed Copied"
        : !rejected
        ? "the first press's clipboard write was never held open"
        : `after the first write failed: ${JSON.stringify(afterSlow)}`,
    )
    await poll(async () => await atRest("titled", "Copy number"), 3_000)
  } finally {
    await devtools.evaluate<null>(`(() => {
      const originals = globalThis.__copyButtonOriginals
      if (originals?.writeText) navigator.clipboard.writeText = originals.writeText
      if (originals?.execCommand) document.execCommand = originals.execCommand
      for (const observer of globalThis.__copyRegionObservers ?? []) observer.disconnect()
      for (const button of document.querySelectorAll("[data-check-copy]")) {
        delete button.dataset.checkCopy
      }
      return null
    })()`)
  }
}
