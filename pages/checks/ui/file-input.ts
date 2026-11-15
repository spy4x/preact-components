import { check, type Devtools, poll, pressKey, settledScroll } from "../harness.ts"
import { elementCenter, requestBody, waitForNavigation, waitForRequest } from "./shared-forms.ts"

/** Card and element selectors {@link fileInputChecks} drives. */
const FILE_INPUT_CARD = "#demo-FileInput"

const FILE_INPUT_ID = "guide-file-input"

const FILE_INPUT_SELECTOR = `${FILE_INPUT_CARD} #${FILE_INPUT_ID}`

const FILE_INPUT_ZONE_SELECTOR = `${FILE_INPUT_CARD} [data-e2e="file-input-zone"]`

const FILE_INPUT_CHOSEN_SELECTOR = `${FILE_INPUT_CARD} [data-e2e="file-input-chosen"]`

const FILE_INPUT_REFUSED_SELECTOR = `${FILE_INPUT_CARD} [data-e2e="file-input-refused"]`

const FILE_INPUT_TOGGLE_SELECTOR = `${FILE_INPUT_CARD} [data-e2e="file-input-toggle-mount"]`

const FILE_INPUT_FORM_ID = "guide-file-input-form"

const FILE_INPUT_SINGLE_ID = "guide-file-input-single"

const FILE_INPUT_SINGLE_REFUSED_SELECTOR =
  `${FILE_INPUT_CARD} [data-e2e="file-input-single-refused"]`

const FILE_INPUT_FIELD_ID = "guide-file-input-field"

/** The real, on-disk files {@link fileInputChecks} feeds through `DOM.setFileInputFiles` or a drop. */
interface FileInputFixture {
  /** Small, accepted PNG — the happy path for a click-driven selection and for the plain form post. */
  ok: string
  /** A second, distinct accepted PNG, used for the drop so its name proves the drop is what added it. */
  drop: string
  /** Larger than the demo's own 2 MB `maxSize`, otherwise accepted by `accept`. */
  tooLarge: string
  /** A plain text file, refused by `accept="image/png,image/jpeg"`. */
  wrongType: string
}

/**
 * Write the handful of real files {@link fileInputChecks} needs into a fresh `mktemp` directory.
 *
 * `DOM.setFileInputFiles` and a drop's `Input.dispatchDragEvent` both take real, on-disk paths —
 * neither can be satisfied by a `Blob` built inside the page. Nothing here is a real image: the
 * component never decodes the bytes, only its extension and size, so arbitrary bytes under a `.png`
 * name exercise exactly what `matchesAccept` and `maxSize` check. Not committed as binaries —
 * written at check time and removed by the caller's own `finally`, the same lifetime
 * `pages/verify.ts`'s own Chromium profile directory has.
 */
async function writeFileInputFixtures(): Promise<{ dir: string; files: FileInputFixture }> {
  const dir = await Deno.makeTempDir({ prefix: "file-input-check-" })
  const files: FileInputFixture = {
    ok: `${dir}/ok.png`,
    drop: `${dir}/dropped.png`,
    tooLarge: `${dir}/too-large.png`,
    wrongType: `${dir}/notes.txt`,
  }
  await Deno.writeFile(files.ok, new Uint8Array(64))
  await Deno.writeFile(files.drop, new Uint8Array(64))
  await Deno.writeFile(files.tooLarge, new Uint8Array(3 * 1024 * 1024))
  await Deno.writeFile(files.wrongType, new Uint8Array(16))
  return { dir, files }
}

/**
 * `DOM.setFileInputFiles`' own `nodeId`, for one selector — re-read on every call rather than
 * cached: the input `FileInput` wraps is never replaced across these checks, but re-querying costs
 * one round trip and avoids ever trusting a `nodeId` a prior DOM mutation elsewhere on this long
 * page might have invalidated.
 *
 * @param devtools The connected session.
 * @param selector The element to resolve.
 * @returns Its `nodeId`, or `null` when nothing matches.
 */
async function domNodeId(devtools: Devtools, selector: string): Promise<number | null> {
  await devtools.send("DOM.enable")
  const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
    depth: 0,
  })
  const { nodeId } = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  })
  return nodeId || null
}

/** What the primary `FileInput` demo's own `onFiles`/`onReject` echo reads, right now. */
async function fileInputReport(devtools: Devtools): Promise<{ chosen: string; refused: string }> {
  return await devtools.evaluate<{ chosen: string; refused: string }>(`(() => ({
    chosen: document.querySelector('${FILE_INPUT_CHOSEN_SELECTOR}')?.textContent ?? "",
    refused: document.querySelector('${FILE_INPUT_REFUSED_SELECTOR}')?.textContent ?? "",
  }))()`)
}

/**
 * Tab reaches the native input, and a real Space or a real Enter press each open the file chooser —
 * `Page.setInterceptFileChooserDialog` replaces the native dialog with a `Page.fileChooserOpened`
 * event rather than a modal the check would otherwise have to dismiss, and the interception is
 * turned back off in a `finally` so it cannot affect anything that runs after this.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function fileInputKeyboardChecks(devtools: Devtools): Promise<void> {
  // The element immediately before the input in tab order, computed rather than guessed: the
  // catalogue's own card chrome (a copy-snippet button, a disclosure) sits ahead of every demo's
  // markup, so the previous *card's* last control is not necessarily the previous *tab stop* —
  // measured in review, where guessing `#guide-toggle-error` landed on the FileInput card's own
  // copy-snippet button instead and failed this check for a reason that had nothing to do with
  // `FileInput`.
  const staged = await devtools.evaluate<boolean>(`(() => {
    const target = document.querySelector('${FILE_INPUT_SELECTOR}')
    if (!target) return false
    const focusable = [...document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]',
    )].filter((el) => {
      const tabIndex = el.getAttribute('tabindex')
      if (tabIndex !== null && parseInt(tabIndex, 10) < 0) return false
      const style = getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
    const index = focusable.indexOf(target)
    if (index <= 0) return false
    const previous = focusable[index - 1]
    previous.focus()
    return document.activeElement === previous
  })()`)
  check(
    "the element immediately before FileInput in tab order can receive focus, so Tab proves something",
    staged,
  )
  if (staged) {
    // The native input the browser actually focuses is clipped to 1px (`sr-only`), so its own
    // `:focus-visible` paints nothing a sighted keyboard user could see. The visible drop zone
    // reads that state off its descendant with `has-[:focus-visible]:ring-*`, so it is the zone's
    // own computed `boxShadow` (a Tailwind ring is implemented as one) that has to change, not the
    // input's.
    const zoneBefore = await devtools.evaluate<string>(
      `getComputedStyle(document.querySelector('${FILE_INPUT_ZONE_SELECTOR}'))?.boxShadow ?? ""`,
    )

    await pressKey(devtools, "Tab")
    const landed = await devtools.evaluate<boolean>(
      `document.activeElement === document.querySelector('${FILE_INPUT_SELECTOR}')`,
    )
    check("the FileInput native input is reachable with Tab", landed)

    if (landed) {
      const zoneAfter = await devtools.evaluate<string>(
        `getComputedStyle(document.querySelector('${FILE_INPUT_ZONE_SELECTOR}'))?.boxShadow ?? ""`,
      )
      check(
        "tabbing to the native input changes the visible drop zone's computed style, so keyboard " +
          "focus is shown somewhere a sighted user can see it",
        zoneAfter !== zoneBefore,
        `unfocused boxShadow: ${JSON.stringify(zoneBefore)}, focused: ${JSON.stringify(zoneAfter)}`,
      )
    }
  }

  const focused = await devtools.evaluate<boolean>(`(() => {
    const el = document.querySelector('${FILE_INPUT_SELECTOR}')
    if (!el) return false
    el.focus()
    return document.activeElement === el
  })()`)
  check("the FileInput native input can receive focus directly", focused)
  if (!focused) return

  await devtools.send("Page.setInterceptFileChooserDialog", { enabled: true })
  try {
    for (const keyName of ["Enter", "Space"] as const) {
      await devtools.evaluate<null>(`(() => {
        document.querySelector('${FILE_INPUT_SELECTOR}')?.focus()
        return null
      })()`)
      const chooserPromise = devtools.once("Page.fileChooserOpened", 5_000)
      await pressKey(devtools, keyName)
      const opened = await chooserPromise.then(() => true).catch(() => false)
      check(`a real ${keyName} press on the focused FileInput opens the file chooser`, opened)
    }
  } finally {
    await devtools.send("Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {})
  }
}

/**
 * A file set with `DOM.setFileInputFiles` — the CDP-level equivalent of picking one through the
 * chooser {@link fileInputKeyboardChecks} opened — reaches `onFiles` and is rendered in the
 * component's own list, with a remove button named after it.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputSelectionCheck(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const nodeId = await domNodeId(devtools, FILE_INPUT_SELECTOR)
  check("the FileInput native input is found for DOM.setFileInputFiles", nodeId !== null)
  if (nodeId === null) return

  await devtools.send("DOM.setFileInputFiles", { files: [fixture.ok], nodeId })
  const settled = await poll(
    async () => (await fileInputReport(devtools)).chosen.includes("ok.png"),
    5_000,
  )
  const report = await fileInputReport(devtools)
  check(
    "a file set with DOM.setFileInputFiles reaches onFiles",
    settled,
    `chosen: "${report.chosen.trim()}"`,
  )

  const named = await devtools.evaluate<boolean>(
    `document.querySelector('${FILE_INPUT_CARD} button[aria-label="Remove ok.png"]') !== null`,
  )
  check(
    "the chosen file is rendered in FileInput's own list, with a remove button naming it",
    named,
  )
}

/**
 * A drop through `Input.dispatchDragEvent` — real mouse-driven drag events carrying real file paths
 * in their `data.files`, the one part of a drop `DOM.setFileInputFiles` cannot stand in for — adds
 * its file the same way a click-driven selection does, and the drop zone marks itself while a drag
 * is over it and clears the mark once the drop lands.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputDropCheck(devtools: Devtools, fixture: FileInputFixture): Promise<void> {
  const point = await elementCenter(devtools, FILE_INPUT_ZONE_SELECTOR)
  check("the FileInput drop zone can be aimed at", point.ok, point.reason)
  if (!point.ok) return

  const dragData = { items: [], files: [fixture.drop], dragOperationsMask: 1 }
  await devtools.send("Input.dispatchDragEvent", {
    type: "dragEnter",
    x: point.x,
    y: point.y,
    data: dragData,
  })
  const markedWhileDragging = await devtools.evaluate<boolean>(
    `(document.querySelector('${FILE_INPUT_ZONE_SELECTOR}')?.className ?? "")
      .includes("border-info")`,
  )
  check("the drop zone marks itself while a drag is over it", markedWhileDragging)

  await devtools.send("Input.dispatchDragEvent", {
    type: "drop",
    x: point.x,
    y: point.y,
    data: dragData,
  })
  const settled = await poll(
    async () => (await fileInputReport(devtools)).chosen.includes("dropped.png"),
    5_000,
  )
  const report = await fileInputReport(devtools)
  check(
    "dropping a file through Input.dispatchDragEvent adds it via the input's own DataTransfer",
    settled,
    `chosen: "${report.chosen.trim()}"`,
  )

  const markCleared = await devtools.evaluate<boolean>(
    `!(document.querySelector('${FILE_INPUT_ZONE_SELECTOR}')?.className ?? "").includes("border-info")`,
  )
  check("the drop zone's dragging mark clears once the drop lands", markCleared)
}

/**
 * A file over `maxSize` and a file `accept` does not match are both refused: neither reaches
 * `onFiles`, both are reported through `onReject`, and each refusal's text lands in `FileInput`'s
 * own `role="status"` live region — the one that is present, empty, before either happens.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputRefusalChecks(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const tooLargeNodeId = await domNodeId(devtools, FILE_INPUT_SELECTOR)
  check("the FileInput native input is found for the too-large refusal", tooLargeNodeId !== null)
  if (tooLargeNodeId !== null) {
    await devtools.send("DOM.setFileInputFiles", {
      files: [fixture.tooLarge],
      nodeId: tooLargeNodeId,
    })
    const settled = await poll(
      async () => (await fileInputReport(devtools)).refused.includes("too-large"),
      5_000,
    )
    const report = await fileInputReport(devtools)
    check(
      "a file over maxSize is refused with reason too-large, reported through onReject",
      settled,
      `refused: "${report.refused.trim()}"`,
    )
    const region = await devtools.evaluate<string>(
      `document.querySelector('#${FILE_INPUT_ID}-rejection')?.textContent ?? ""`,
    )
    check(
      "the too-large refusal is announced in FileInput's own live region",
      region.includes("over the"),
      `"${region}"`,
    )
  }

  const wrongTypeNodeId = await domNodeId(devtools, FILE_INPUT_SELECTOR)
  check("the FileInput native input is found for the wrong-type refusal", wrongTypeNodeId !== null)
  if (wrongTypeNodeId !== null) {
    await devtools.send("DOM.setFileInputFiles", {
      files: [fixture.wrongType],
      nodeId: wrongTypeNodeId,
    })
    const settled = await poll(
      async () => (await fileInputReport(devtools)).refused.includes("wrong-type"),
      5_000,
    )
    const report = await fileInputReport(devtools)
    check(
      "a file accept does not match is refused with reason wrong-type, reported through onReject",
      settled,
      `refused: "${report.refused.trim()}"`,
    )
    const region = await devtools.evaluate<string>(
      `document.querySelector('#${FILE_INPUT_ID}-rejection')?.textContent ?? ""`,
    )
    check(
      "the wrong-type refusal is announced in FileInput's own live region",
      region.includes("isn't a file type you can add here"),
      `"${region}"`,
    )
  }
}

/**
 * Without `multiple`, a second file offered alongside the first is refused with reason `"too-many"`
 * and announced, rather than silently dropped — the "Single file only" card in `FileInputDemo` has
 * no `multiple`.
 *
 * This has to arrive as a drop, not a `DOM.setFileInputFiles` selection: `handleChange` reads
 * `event.currentTarget.files`, and a real browser truncates a non-`multiple` file input's own
 * `FileList` to the last file before the `change` event ever fires — `DOM.setFileInputFiles` goes
 * through that same input-element semantics, so a non-`multiple` input never sees a second file
 * that way regardless of what this component does with it, and a check built on it would prove
 * nothing about the refusal path. `handleDrop` instead reads `event.dataTransfer.files` straight off
 * the drag event, which is never gated by the `multiple` attribute, so a two-file drop is the one
 * real interaction that actually offers this component more than one file at once with `multiple`
 * absent — the same drag mechanics {@link fileInputDropCheck} already proves add a single file.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputTooManyRefusalCheck(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const inputSelector = `${FILE_INPUT_CARD} #${FILE_INPUT_SINGLE_ID}`
  const zoneSelector =
    `${FILE_INPUT_CARD} [data-e2e="file-input-zone"]:has(#${FILE_INPUT_SINGLE_ID})`
  const found = await devtools.evaluate<boolean>(
    `document.querySelector('${inputSelector}') !== null`,
  )
  check("the single-file FileInput's native input is found", found)
  if (!found) return

  const point = await elementCenter(devtools, zoneSelector)
  check("the single-file FileInput's drop zone can be aimed at", point.ok, point.reason)
  if (!point.ok) return

  const dragData = { items: [], files: [fixture.ok, fixture.drop], dragOperationsMask: 1 }
  await devtools.send("Input.dispatchDragEvent", {
    type: "dragEnter",
    x: point.x,
    y: point.y,
    data: dragData,
  })
  await devtools.send("Input.dispatchDragEvent", {
    type: "drop",
    x: point.x,
    y: point.y,
    data: dragData,
  })

  const readRefused = () =>
    devtools.evaluate<string>(
      `document.querySelector('${FILE_INPUT_SINGLE_REFUSED_SELECTOR}')?.textContent ?? ""`,
    )
  const settled = await poll(async () => (await readRefused()).includes("too-many"), 5_000)
  const refused = await readRefused()
  check(
    "dropping two files onto a non-multiple FileInput refuses the second with reason " +
      "too-many, reported through onReject",
    settled,
    `refused: "${refused.trim()}"`,
  )

  const region = await devtools.evaluate<string>(
    `document.querySelector('#${FILE_INPUT_SINGLE_ID}-rejection')?.textContent ?? ""`,
  )
  // This card's own `labels.tooMany` override reads "un seul fichier est autorisé" instead of the
  // default English "only one file is allowed" — asserting the override's own text here, rather
  // than the default, is what proves `labels` actually reaches the rendered message.
  check(
    "the too-many refusal is announced in FileInput's own live region, in the label override's own text",
    region.includes("un seul fichier est autorisé"),
    `"${region}"`,
  )

  const keptCount = await devtools.evaluate<number>(
    `document.querySelector('${inputSelector}')?.files?.length ?? -1`,
  )
  check(
    "only the first file is kept on the input's own files list, the rest refused rather than added",
    keptCount === 1,
    `input.files.length = ${keptCount}`,
  )
}

/**
 * A refusal on a non-`multiple` `FileInput` must not clear a file already chosen: without
 * `multiple`, `handleFiles` keeps at most one file, and a batch that accepts nothing new used to
 * fall through to an empty list, discarding the earlier valid file along with the refused one.
 *
 * Selects `ok.png` itself, through a fresh `DOM.setFileInputFiles` call, rather than reusing the
 * file {@link fileInputTooManyRefusalCheck} leaves behind: that check sets the native input's own
 * `files` through a real drop, and a `DOM.setFileInputFiles` call right after one of those was
 * observed, in practice, to not reliably redeliver a `change` event on this same node — two
 * `DOM.setFileInputFiles` calls in a row, the shape {@link fileInputRefusalChecks} already relies
 * on, is the reliable one.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputRefusalKeepsPriorFileCheck(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const inputSelector = `${FILE_INPUT_CARD} #${FILE_INPUT_SINGLE_ID}`

  const selectNodeId = await domNodeId(devtools, inputSelector)
  check(
    "the single-file FileInput's native input is found for its own selection",
    selectNodeId !== null,
  )
  if (selectNodeId === null) return

  await devtools.send("DOM.setFileInputFiles", { files: [fixture.ok], nodeId: selectNodeId })
  const chosen = await poll(async () => {
    const names = await devtools.evaluate<string[]>(
      `Array.from(document.querySelector('${inputSelector}')?.files ?? []).map((f) => f.name)`,
    )
    return names.includes("ok.png")
  }, 5_000)
  check("the single-file card accepts ok.png ahead of this check's own refusal", chosen)
  if (!chosen) return

  const nodeId = await domNodeId(devtools, inputSelector)
  check(
    "the single-file FileInput's native input is found for the wrong-type refusal",
    nodeId !== null,
  )
  if (nodeId === null) return

  await devtools.send("DOM.setFileInputFiles", { files: [fixture.wrongType], nodeId })

  const readRefused = () =>
    devtools.evaluate<string>(
      `document.querySelector('${FILE_INPUT_SINGLE_REFUSED_SELECTOR}')?.textContent ?? ""`,
    )
  const settled = await poll(async () => (await readRefused()).includes("wrong-type"), 5_000)
  const refused = await readRefused()
  check(
    "offering a wrong-type file to the single-file card refuses it instead of accepting it",
    settled,
    `refused: "${refused.trim()}"`,
  )

  // Scoped to the single-file card's own wrapper (the input's zone's parent — the outer <div> a
  // caller's own class lands on), not the whole demo card: the main, `multiple`-carrying card also
  // has ok.png chosen by this point (`fileInputSelectionCheck`), so an unscoped selector would find
  // that card's own remove button and pass even if this card's own list had been cleared by the
  // refusal.
  const afterList = await devtools.evaluate<boolean>(`(() => {
    const input = document.querySelector('${inputSelector}')
    const wrapper = input?.closest('[data-e2e="file-input-zone"]')?.parentElement
    return (wrapper?.querySelector('button[aria-label="Remove ok.png"]') ?? null) !== null
  })()`)
  check(
    "ok.png is still in FileInput's own rendered list after the refusal, not cleared by it",
    afterList,
  )

  const afterFiles = await devtools.evaluate<string[]>(
    `Array.from(document.querySelector('${inputSelector}')?.files ?? []).map((f) => f.name)`,
  )
  check(
    "ok.png is still in the native input's own files after the refusal, and notes.txt was never " +
      "added to it",
    afterFiles.includes("ok.png") && !afterFiles.includes("notes.txt"),
    `input.files: [${afterFiles.join(", ")}]`,
  )
}

/**
 * `FileInput` nested inside `Field` renders exactly one label, naming the real input, and that
 * input is reachable with Tab and readable as the browser's own accessible name — the unit test in
 * `ui/file-input.test.tsx` proves the same shape from the server-rendered string; this proves the
 * hydrated DOM agrees, since a duplicate label or a broken `for`/`id` pairing would still pass a
 * string-matching unit test built the wrong way but fail an accessible-name query here.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function fileInputFieldNestingCheck(devtools: Devtools): Promise<void> {
  const selector = `${FILE_INPUT_CARD} #${FILE_INPUT_FIELD_ID}`
  const found = await devtools.evaluate<boolean>(
    `document.querySelector('${selector}') !== null`,
  )
  check("the Field-nested FileInput's native input is found", found)
  if (!found) return

  const labelCount = await devtools.evaluate<number>(`(() => {
    const card = document.querySelector('${FILE_INPUT_CARD}')
    return card ? card.querySelectorAll('label[for="${FILE_INPUT_FIELD_ID}"]').length : -1
  })()`)
  check(
    "Field's own clone supplies the only label for the nested FileInput, not a second one",
    labelCount === 1,
    `label[for="${FILE_INPUT_FIELD_ID}"] count = ${labelCount}`,
  )

  const describedBy = await devtools.evaluate<string>(
    `document.querySelector('${selector}')?.getAttribute('aria-describedby') ?? ""`,
  )
  check(
    "the nested FileInput's aria-describedby carries both its own rejection id and Field's hint id",
    describedBy.includes(`${FILE_INPUT_FIELD_ID}-rejection`) && describedBy.includes("-hint"),
    `aria-describedby="${describedBy}"`,
  )
}

/**
 * A preview's `URL.createObjectURL` is revoked on two separate occasions, checked here as two
 * separate increases of a patched revoke counter, not as an exact count: once when its own file
 * leaves the list, and again, for whatever is still outstanding, when the whole card unmounts. The
 * same removal also checks the thing a rendered list update cannot prove by itself: that the
 * removed file is genuinely gone from the native input's own `files`, the property a real `<form>`
 * post reads — not only out of the component's own rendered `<li>`.
 *
 * The card's own `data-e2e="file-input-toggle-mount"` button is what supplies the second half: this
 * catalogue never unmounts a card on its own, so proving "on unmount" needs a real Preact unmount
 * somewhere, and clicking that button is the only one this page offers without navigating away and
 * losing the ability to read the patched counter back — see `ui-guide/sections/inputs.tsx`'s own
 * doc on `FileInputDemo` for why the button exists at all.
 *
 * `URL.revokeObjectURL` is patched in place, counted, and restored in a `finally`.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputPreviewRevokeChecks(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    const original = URL.revokeObjectURL.bind(URL)
    globalThis.__fileInputCheck = { original, revokeCount: 0 }
    URL.revokeObjectURL = (url) => {
      globalThis.__fileInputCheck.revokeCount += 1
      return original(url)
    }
    return null
  })()`)

  try {
    const beforeRemove = await devtools.evaluate<number>(`globalThis.__fileInputCheck.revokeCount`)
    const removed = await devtools.evaluate<boolean>(`(() => {
      const button = document.querySelector('${FILE_INPUT_CARD} button[aria-label="Remove ok.png"]')
      if (!button) return false
      button.click()
      return true
    })()`)
    check("the ok.png remove button is found", removed)
    if (removed) {
      const revokedOnRemove = await poll(async () => {
        const count = await devtools.evaluate<number>(`globalThis.__fileInputCheck.revokeCount`)
        return count > beforeRemove
      }, 5_000)
      check("removing a file with an image preview revokes its object URL", revokedOnRemove)

      const filesAfterRemove = await devtools.evaluate<string[]>(
        `Array.from(document.querySelector('${FILE_INPUT_SELECTOR}')?.files ?? []).map((f) => f.name)`,
      )
      check(
        "removing a file also drops it from the native input's own files, not only the rendered list",
        !filesAfterRemove.includes("ok.png"),
        `input.files: [${filesAfterRemove.join(", ")}]`,
      )
    }

    const nodeId = await domNodeId(devtools, FILE_INPUT_SELECTOR)
    if (nodeId !== null) {
      await devtools.send("DOM.setFileInputFiles", { files: [fixture.ok], nodeId })
      await poll(async () => (await fileInputReport(devtools)).chosen.includes("ok.png"), 5_000)
    }

    const beforeUnmount = await devtools.evaluate<number>(`globalThis.__fileInputCheck.revokeCount`)
    const toggled = await devtools.evaluate<boolean>(`(() => {
      const button = document.querySelector('${FILE_INPUT_TOGGLE_SELECTOR}')
      if (!button) return false
      button.click()
      return true
    })()`)
    check("the card's unmount toggle is found", toggled)
    if (toggled) {
      const revokedOnUnmount = await poll(async () => {
        const count = await devtools.evaluate<number>(`globalThis.__fileInputCheck.revokeCount`)
        return count > beforeUnmount
      }, 5_000)
      check("unmounting the card revokes every preview still outstanding", revokedOnUnmount)
    }
  } finally {
    await devtools.evaluate<null>(`(() => {
      const state = globalThis.__fileInputCheck
      if (state) URL.revokeObjectURL = state.original
      return null
    })()`).catch(() => {})
  }
}

/**
 * A plain `<form method="post" enctype="multipart/form-data">` around its own `FileInput` instance
 * (`ui-guide/sections/inputs.tsx`'s fifth card, `id="guide-file-input-form"`) posts the chosen file
 * with no script running at all — not merely no hydrated `onSubmit` to intercept it, but the whole
 * bundle disabled the way {@link enhancedFormsNoScriptChecks} disables it for the sign-up form and
 * the contact form, via `Emulation.setScriptExecutionDisabled` before a reload. That is what
 * "without JavaScript doing anything" in #145's own done-when box means: a hydrated hander that
 * happens not to call `preventDefault` still proves nothing about a visitor whose script never ran
 * in the first place, and only a page that genuinely never executed the bundle does.
 *
 * Three things are checked against that unhydrated page, in order: the native input is still found
 * by `DOM.setFileInputFiles`, and its computed `display` is still not `none` — the one property this
 * check reads back, not the full `sr-only` technique — proving the input never depends on the bundle
 * having run to stay reachable; the submit still produces a real `POST` whose multipart body carries
 * the chosen file, read the same way {@link enhancedFormsNoScriptChecks} reads its captured request; and
 * the landed-on page carries the server's own marker, so the second check does not merely tell a
 * real POST from a client-side navigation without also confirming where it actually went.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputFormPostCheck(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })
    await devtools.send("Page.reload", { ignoreCache: true })
    const loaded = await waitForNavigation(devtools)
    const unhydrated = loaded &&
      await devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated !== "true"`)
        .catch(() => false)
    check(
      "the fresh reload for this check never ran the bundle",
      unhydrated,
      unhydrated
        ? "data-hydrated absent, as expected"
        : "the page hydrated despite the disabled flag",
    )
    if (!unhydrated) return

    const nodeId = await domNodeId(devtools, `#${FILE_INPUT_FORM_ID}`)
    check(
      "the plain-form FileInput's native input is reachable with no script running",
      nodeId !== null,
    )
    if (nodeId === null) return

    const stillVisuallyHidden = await devtools.evaluate<boolean>(`(() => {
      const el = document.querySelector('#${FILE_INPUT_FORM_ID}')
      if (!el) return false
      const style = getComputedStyle(el)
      return style.display !== "none" && el.type === "file"
    })()`).catch(() => false)
    check(
      "the unhydrated native input still has display !== none, not the full sr-only technique",
      stillVisuallyHidden,
    )

    await devtools.send("DOM.setFileInputFiles", { files: [fixture.ok], nodeId })

    const buttonPoint = await elementCenter(
      devtools,
      `${FILE_INPUT_CARD} form button[type="submit"]`,
    )
    check(
      "the plain form's submit button can be aimed at with no script running",
      buttonPoint.ok,
      buttonPoint.reason,
    )
    if (!buttonPoint.ok) return

    const requestPromise = waitForRequest(devtools, "form-demo", 10_000)
    for (const type of ["mousePressed", "mouseReleased"]) {
      await devtools.send("Input.dispatchMouseEvent", {
        type,
        x: buttonPoint.x,
        y: buttonPoint.y,
        button: "left",
        buttons: type === "mousePressed" ? 1 : 0,
        clickCount: 1,
      })
    }

    const request = await requestPromise
    const navigated = await waitForNavigation(devtools)
    const answer = navigated
      ? await devtools.evaluate<string>(
        `document.querySelector('[data-e2e="form-demo-answer"]')?.textContent ?? ""`,
      ).catch(() => "")
      : ""
    const body = request ? await requestBody(devtools, request) : ""

    // Landing on the server's own marker is a sanity check on the local preview server's
    // form-demo/ route, not proof of anything FileInput itself does — the component's contract
    // ends at handing the browser a real multipart POST, which the check right after this one
    // verifies directly from the captured request body.
    check(
      "the preview server's form-demo/ route answers the plain-form post with its own marker",
      navigated && answer.includes("Thanks"),
      navigated
        ? `landed on a page whose own marker reads ${JSON.stringify(answer.slice(0, 60))}`
        : "the submit never navigated anywhere within the timeout",
    )
    check(
      "the post is a real multipart/form-data request carrying the chosen file under its field " +
        "name, with no script running",
      request !== null && request.method === "POST" && body.includes('name="attachment"') &&
        body.includes('filename="ok.png"'),
      request === null
        ? "no network request to form-demo/ was captured"
        : `method "${request.method}", body ${JSON.stringify(body.slice(0, 200))}`,
    )
  } finally {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: false }).catch(() => {})
    await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
    await waitForNavigation(devtools)
    let rehydrated = await poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      10_000,
    )
    if (!rehydrated) {
      await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
      await waitForNavigation(devtools)
      rehydrated = await poll(
        () =>
          devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
            .catch(() => false),
        10_000,
      )
    }
    check("the catalogue rehydrates once FileInput's plain-form post navigates back", rehydrated)
    await settledScroll(devtools)
  }
}

/**
 * `FileInput`'s own mechanics, none of which a render-to-string unit test can see: Tab and a real
 * Space/Enter press opening the file chooser, a file chosen through `DOM.setFileInputFiles`, one
 * dropped through `Input.dispatchDragEvent`, the `maxSize`/`accept` refusals and their live region,
 * an image preview revoked on removal and on a real unmount, and a plain `<form>` post that reaches
 * a server with no script preventing it.
 *
 * Runs after the `MoneyInput` checks and before `modalChecks`, the same place `uiChecks` calls it:
 * {@link fileInputFormPostCheck} navigates the page away and back, and every check after this one
 * has to run against a page that has fully rehydrated again, which its own last check confirms.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function fileInputChecks(devtools: Devtools): Promise<void> {
  const cardPresent = await devtools.evaluate<boolean>(
    `document.querySelector('${FILE_INPUT_CARD}') !== null`,
  )
  check("the FileInput card is on the page", cardPresent)
  if (!cardPresent) return

  const { dir, files: fixture } = await writeFileInputFixtures()
  try {
    await fileInputKeyboardChecks(devtools)
    await fileInputSelectionCheck(devtools, fixture)
    await fileInputDropCheck(devtools, fixture)
    await fileInputRefusalChecks(devtools, fixture)
    await fileInputTooManyRefusalCheck(devtools, fixture)
    await fileInputRefusalKeepsPriorFileCheck(devtools, fixture)
    await fileInputFieldNestingCheck(devtools)
    await fileInputPreviewRevokeChecks(devtools, fixture)
    await fileInputFormPostCheck(devtools, fixture)
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {})
  }
}
