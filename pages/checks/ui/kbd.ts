import { check, type Devtools, poll, pressKey, readAxNodes } from "../harness.ts"
import { SHORTCUTS_STATE } from "./shared.ts"

/**
 * The name Chromium computes from the content of the element `source` finds, read off a clone of it
 * placed in a `<button>` beside it. A `<kbd>` has no role that takes a name from its content, so the
 * button stands in for what a screen reader reads when it meets the keys inside a link, a button or
 * a row: the text of each key, glyphs left out, joined the way the layout joins it. The clone keeps
 * its classes, so it is laid out like the original; the button sits beside the source, so it is
 * inside an open dialog when the source is, and is removed before this returns.
 *
 * @param source A page expression that evaluates to the element, or to `null`.
 * @returns The computed name, or `null` when `source` found nothing.
 */
async function nameFromContent(devtools: Devtools, source: string): Promise<string | null> {
  const placed = await devtools.evaluate<boolean>(`(() => {
    const source = ${source}
    if (!source) return false
    const probe = document.createElement("button")
    probe.id = "kbd-name-probe"
    probe.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none"
    probe.append(source.cloneNode(true))
    source.parentElement.append(probe)
    return true
  })()`)
  if (!placed) return null
  try {
    const [node] = await readAxNodes(devtools, "#kbd-name-probe")
    return node?.name ?? null
  } finally {
    await devtools.evaluate<null>(`(document.getElementById("kbd-name-probe")?.remove(), null)`)
  }
}

/**
 * A sequence `Kbd` draws is read as its presses with "then" between them, in a real browser: in
 * both platform columns of the `Kbd` card, and in the `ShortcutsDialog` card's open dialog. The name is
 * what Chromium computes from the rendered keys, so it fails when a press or the word is missing
 * from what assistive technology is given, such as a word hidden from it or a dialog row that
 * draws only the first press.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function kbdSequenceNameChecks(devtools: Devtools): Promise<void> {
  // The card's grid row: the `keys` code, then the `apple={false}` cell, then the `apple` cell.
  const cardKbd = (column: number) =>
    `(() => {
    let cell = [...document.querySelectorAll("#demo-Kbd code")].find((c) => c.textContent === "g t")
    for (let k = 0; k < ${column}; k++) cell = cell?.nextElementSibling
    return cell?.querySelector("kbd") ?? null
  })()`
  const words = await nameFromContent(devtools, cardKbd(1))
  const glyphs = await nameFromContent(devtools, cardKbd(2))
  check(
    "Kbd reads the sequence g t as G then T in both platform columns of its card",
    words === "G then T" && glyphs === "G then T",
    `apple={false} read ${JSON.stringify(words)}, apple read ${JSON.stringify(glyphs)}`,
  )

  const button = `document.querySelector('#demo-ShortcutsDialog [data-e2e="shortcuts-open"]')`
  await devtools.evaluate<null>(`(${button}?.click(), null)`)
  const opened = await poll(() => devtools.evaluate<boolean>(`${SHORTCUTS_STATE}.modal`), 3_000)
  const row = `[...document.querySelectorAll("#demo-ShortcutsDialog dialog dt")]` +
    `.find((term) => term.textContent === "A two-key sequence, listed only")` +
    `?.nextElementSibling?.querySelector("kbd") ?? null`
  const listed = opened ? await nameFromContent(devtools, row) : null
  check(
    "ShortcutsDialog lists the sequence g t, read as G then T",
    listed === "G then T",
    `dialog ${opened ? "open" : "never opened"}, read ${JSON.stringify(listed)}`,
  )
  if (opened) {
    await pressKey(devtools, "Escape")
    await poll(() => devtools.evaluate<boolean>(`!${SHORTCUTS_STATE}.modal`), 3_000)
  }
}
