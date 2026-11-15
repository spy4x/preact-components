import {
  centreInView,
  check,
  type Devtools,
  openGuidePage,
  pointerToCorner,
  poll,
  pressKey,
} from "../harness.ts"
import { clickAtPoint, elementCenter } from "./shared-forms.ts"

const UNSAVED = "#demo-UnsavedGuard"

/** What the probe on one demo link saw of the last click that reached it. */
interface UnsavedProbe {
  /** `true` when the click reached the link itself: the guard did not stop it. */
  reached: boolean
  /** `defaultPrevented` as the link saw it: `true` when something before it cancelled the click. */
  prevented: boolean
}

/** The demo, read in one round trip. */
interface UnsavedReading {
  dialog: { open: boolean; title: string; buttons: string[] }
  outcome: string
  dirty: boolean
  probe: UnsavedProbe | null
}

/**
 * Put a probe on every demo link. It records whether a click reached the link and whether it was
 * already cancelled when it did, then cancels it, so no check really navigates (the pattern in
 * `pages/README.md`, "Writing a browser check", moved from the document to the link, because the
 * guard stops a click it holds back from reaching the document's own listeners).
 */
const UNSAVED_PROBE_INSTALL = `(() => {
  globalThis.__unsavedProbe = {}
  globalThis.__unsavedProbeRemovers = []
  for (const link of document.querySelectorAll('${UNSAVED} [data-unsaved]')) {
    const listener = (event) => {
      globalThis.__unsavedProbe[link.dataset.unsaved] = {
        reached: true,
        prevented: event.defaultPrevented,
      }
      event.preventDefault()
    }
    link.addEventListener("click", listener)
    globalThis.__unsavedProbeRemovers.push(() => link.removeEventListener("click", listener))
  }
  return true
})()`

const UNSAVED_PROBE_REMOVE = `(() => {
  for (const remove of globalThis.__unsavedProbeRemovers ?? []) remove()
  delete globalThis.__unsavedProbe
  delete globalThis.__unsavedProbeRemovers
  return true
})()`

/** Read the dialog, the outcome line, the dirty toggle and one link's probe. */
function unsavedRead(devtools: Devtools, kind: string): Promise<UnsavedReading> {
  return devtools.evaluate<UnsavedReading>(`(() => {
    const dialog = [...document.querySelectorAll("dialog[open]")]
      .find((each) => each.textContent.includes("Leave without saving?"))
    return {
      dialog: {
        open: Boolean(dialog),
        title: dialog?.querySelector("h2, h3, [id]")?.textContent.trim() ?? "",
        buttons: dialog
          ? [...dialog.querySelectorAll(".pc-modal-footer button, footer button")]
            .map((button) => button.textContent.trim())
          : [],
      },
      outcome: document.querySelector('${UNSAVED} [data-e2e="unsaved-outcome"]')?.textContent ?? "",
      dirty: document.querySelector('${UNSAVED} [data-e2e="unsaved-dirty"]')?.checked ?? false,
      probe: globalThis.__unsavedProbe?.["${kind}"] ?? null,
    }
  })()`)
}

/** Set the demo's dirty toggle, then wait for the guard's effect to run. */
async function unsavedSetDirty(devtools: Devtools, dirty: boolean): Promise<void> {
  await devtools.evaluate(`(async () => {
    const box = document.querySelector('${UNSAVED} [data-e2e="unsaved-dirty"]')
    if (box.checked !== ${dirty}) box.click()
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    return box.checked
  })()`)
}

/**
 * Whether a `beforeunload` event dispatched now comes back cancelled, which is how the browser
 * learns to ask before the tab closes.
 */
function unsavedBeforeUnloadCancelled(devtools: Devtools): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const event = new Event("beforeunload", { cancelable: true })
    dispatchEvent(event)
    return event.defaultPrevented
  })()`)
}

/** A real mouse click on a demo link, with the given modifier bits (`2` is Ctrl). */
async function unsavedClick(devtools: Devtools, kind: string, modifiers = 0): Promise<string> {
  await devtools.evaluate(
    `(globalThis.__unsavedProbe && delete globalThis.__unsavedProbe["${kind}"], true)`,
  )
  const aim = await elementCenter(devtools, `${UNSAVED} [data-unsaved="${kind}"]`)
  if (!aim.ok) return aim.reason
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: aim.x,
      y: aim.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
      modifiers,
    })
  }
  return ""
}

/**
 * Two frames and a short pause: long enough for a dialog the click would open to be open.
 *
 * A fixed wait, not a poll: every caller proves that no dialog opened, and an absence has no
 * state to poll for. A check that expects the dialog polls for it instead.
 */
function unsavedSettle(devtools: Devtools): Promise<unknown> {
  return devtools.evaluate(`new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => done(true), 150))))`)
}

/** Click a dialog button by its text, with a real mouse click at its centre. */
async function unsavedDialogButton(devtools: Devtools, text: string): Promise<boolean> {
  const point = await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
    const dialog = [...document.querySelectorAll("dialog[open]")]
      .find((each) => each.textContent.includes("Leave without saving?"))
    const button = [...(dialog?.querySelectorAll("button") ?? [])]
      .find((each) => each.textContent.trim() === "${text}")
    if (!button) return null
    const rect = button.getBoundingClientRect()
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
  })()`)
  if (!point) return false
  await clickAtPoint(devtools, point)
  return true
}

/**
 * `UnsavedGuard`, driven with real clicks and key presses on its catalogue card: a clean page lets
 * every link through and the tab close; a dirty one asks through `beforeunload`, holds back an
 * owned link with the dialog, stays on Stay and navigates on Leave; and every link kind it must
 * leave alone reaches the link uncancelled.
 */
export async function unsavedGuardChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "ui")
  await centreInView(devtools, `document.querySelector('${UNSAVED}')`)
  await pointerToCorner(devtools)
  await devtools.evaluate(UNSAVED_PROBE_INSTALL)
  try {
    await unsavedSetDirty(devtools, false)
    const cleanUnload = await unsavedBeforeUnloadCancelled(devtools)
    const cleanMiss = await unsavedClick(devtools, "owned")
    await unsavedSettle(devtools)
    const clean = await unsavedRead(devtools, "owned")
    check(
      "a clean UnsavedGuard lets an owned link through and the tab close without asking",
      cleanMiss === "" && !cleanUnload && clean.probe?.reached === true &&
        clean.probe.prevented === false && !clean.dialog.open,
      `${cleanMiss}beforeunload cancelled ${cleanUnload}, probe ${JSON.stringify(clean.probe)}, ` +
        `dialog ${clean.dialog.open}`,
    )

    await unsavedSetDirty(devtools, true)
    const dirtyUnload = await unsavedBeforeUnloadCancelled(devtools)
    check(
      "a dirty UnsavedGuard cancels beforeunload, so the browser asks before the tab closes",
      dirtyUnload,
      `beforeunload cancelled ${dirtyUnload}`,
    )

    const before = (await unsavedRead(devtools, "owned")).outcome
    const heldMiss = await unsavedClick(devtools, "owned")
    await poll(async () => (await unsavedRead(devtools, "owned")).dialog.open, 2_000)
    const held = await unsavedRead(devtools, "owned")
    const stayed = await unsavedDialogButton(devtools, "Stay")
    await poll(async () => !(await unsavedRead(devtools, "owned")).dialog.open, 2_000)
    const afterStay = await unsavedRead(devtools, "owned")
    check(
      "a dirty UnsavedGuard holds an owned link back with its dialog, and Stay closes it without navigating",
      heldMiss === "" && held.dialog.open && held.probe === null &&
        held.dialog.buttons.join() === "Stay,Leave" && stayed && !afterStay.dialog.open &&
        afterStay.outcome === before && afterStay.dirty,
      `${heldMiss}open ${held.dialog.open}, probe ${JSON.stringify(held.probe)}, buttons ` +
        `${held.dialog.buttons.join("/")}; after Stay: open ${afterStay.dialog.open}, ` +
        `"${afterStay.outcome}", dirty ${afterStay.dirty}`,
    )

    // Enter on a focused link fires the same click, so the keyboard path is held back too.
    await devtools.evaluate(`document.querySelector('${UNSAVED} [data-unsaved="owned"]').focus()`)
    await pressKey(devtools, "Enter")
    await poll(async () => (await unsavedRead(devtools, "owned")).dialog.open, 2_000)
    const byKey = await unsavedRead(devtools, "owned")
    const expected = await devtools.evaluate<string>(`(() => {
      const url = new URL(document.querySelector('${UNSAVED} [data-unsaved="owned"]').href)
      return 'navigate("' + url.pathname + url.search + url.hash + '")'
    })()`)
    const left = await unsavedDialogButton(devtools, "Leave")
    await poll(async () => !(await unsavedRead(devtools, "owned")).dialog.open, 2_000)
    const afterLeave = await unsavedRead(devtools, "owned")
    const afterLeaveUnload = await unsavedBeforeUnloadCancelled(devtools)
    check(
      "Enter on an owned link opens the UnsavedGuard dialog, and Leave discards and calls navigate with the link's path",
      byKey.dialog.open && left && !afterLeave.dialog.open &&
        afterLeave.outcome.includes(expected) && !afterLeave.dirty && !afterLeaveUnload,
      `open ${byKey.dialog.open}; after Leave: open ${afterLeave.dialog.open}, ` +
        `"${afterLeave.outcome}" (expected ${expected}), dirty ${afterLeave.dirty}, ` +
        `beforeunload cancelled ${afterLeaveUnload}`,
    )

    await unsavedSetDirty(devtools, true)
    const skipped: string[] = []
    const kinds: [string, string, number][] = [
      ["allowed", "a link marked data-unsaved-ok", 0],
      ["target", "a target=_blank link", 0],
      ["download", "a download link", 0],
      ["not-owned", "a same-origin link owns rejects", 0],
      ["other-origin", "a link to another origin", 0],
      ["hash", "a link to a fragment of this page", 0],
      ["owned", "a Ctrl-click on an owned link", 2],
    ]
    for (const [kind, name, modifiers] of kinds) {
      const miss = await unsavedClick(devtools, kind, modifiers)
      await unsavedSettle(devtools)
      const reading = await unsavedRead(devtools, kind)
      const ok = miss === "" && reading.probe?.reached === true &&
        reading.probe.prevented === false && !reading.dialog.open
      if (!ok) {
        skipped.push(
          `${name}: ${miss}probe ${JSON.stringify(reading.probe)}, dialog ${reading.dialog.open}`,
        )
        if (reading.dialog.open) await unsavedDialogButton(devtools, "Stay")
      }
    }
    check(
      "a dirty UnsavedGuard leaves every link kind it must not hold back to the browser, uncancelled",
      skipped.length === 0,
      skipped.length === 0
        ? `${kinds.length} kinds reached their link uncancelled`
        : skipped.join("; "),
    )

    // `href="#"` on a page the router owns: `new URL("…#").hash` is "", so only the "#" in the
    // address tells it is a jump within the page. The probe on the link is the link's own handler.
    const emptyMiss = await unsavedClick(devtools, "empty-hash")
    await unsavedSettle(devtools)
    const empty = await unsavedRead(devtools, "empty-hash")
    if (empty.dialog.open) await unsavedDialogButton(devtools, "Stay")
    check(
      'a dirty UnsavedGuard leaves an href="#" link on its own page alone, and the link\'s own handler runs',
      emptyMiss === "" && empty.probe?.reached === true && empty.probe.prevented === false &&
        !empty.dialog.open && empty.dirty,
      `${emptyMiss}probe ${JSON.stringify(empty.probe)}, dialog ${empty.dialog.open}, ` +
        `dirty ${empty.dirty}`,
    )

    // A held-back address is forgotten when the changes go away some other way (a save), so the
    // dialog does not come back on its own the next time the form turns dirty.
    const resetMiss = await unsavedClick(devtools, "owned")
    await poll(async () => (await unsavedRead(devtools, "owned")).dialog.open, 2_000)
    const heldAgain = await unsavedRead(devtools, "owned")
    await unsavedSetDirty(devtools, false)
    await unsavedSetDirty(devtools, true)
    await unsavedSettle(devtools)
    const redirtied = await unsavedRead(devtools, "owned")
    if (redirtied.dialog.open) await unsavedDialogButton(devtools, "Stay")
    check(
      "an UnsavedGuard turned clean while its dialog is open does not reopen it when dirty again",
      resetMiss === "" && heldAgain.dialog.open && redirtied.dirty && !redirtied.dialog.open,
      `${resetMiss}open before ${heldAgain.dialog.open}; clean then dirty again: dirty ` +
        `${redirtied.dirty}, open ${redirtied.dialog.open}`,
    )

    // A click another handler cancelled first is not the guard's: it neither opens the dialog nor
    // stops the click.
    await devtools.evaluate(`(() => {
      addEventListener("click", (event) => event.preventDefault(), { capture: true, once: true })
      return true
    })()`)
    const cancelledMiss = await unsavedClick(devtools, "owned")
    await unsavedSettle(devtools)
    const cancelled = await unsavedRead(devtools, "owned")
    check(
      "a dirty UnsavedGuard leaves an owned link alone when a window capture listener already cancelled the click",
      cancelledMiss === "" && cancelled.probe?.reached === true && !cancelled.dialog.open,
      `${cancelledMiss}probe ${JSON.stringify(cancelled.probe)}, dialog ${cancelled.dialog.open}`,
    )
  } finally {
    await unsavedSetDirty(devtools, false).catch(() => {})
    await devtools.evaluate(UNSAVED_PROBE_REMOVE).catch(() => {})
  }
}
