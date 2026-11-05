import { centreInView, check, type Devtools, openGuidePage, poll, pressKey } from "../harness.ts"
import { COPY_BUTTON_CHECKMARK } from "./shared.ts"

/**
 * `CopyBlock` copies its command on a real click and on a real Enter press, and announces the copy.
 *
 * Both are behind `ui/copy-button.tsx`'s click handler and its own `copied`-state timer, neither
 * reachable from a string render. The icon swap (the button's own SVG `d` attribute flipping to
 * {@link COPY_BUTTON_CHECKMARK}) proves the button reacted, but not what reached the clipboard — an
 * earlier version of this check stopped there, so `textToCopy=""` would still have swapped the icon
 * and passed. `navigator.clipboard.writeText` is patched in the page for that reason, the same way
 * `pages/checks/ui-guide.ts`'s copy-block check does it: every write is recorded, reset before each
 * half of this check, and required to equal the box's own `<code>` text — not the "Usage" snippet's
 * `<pre><code>`, a second `<code>` the same card carries for the JSX source, which is why the
 * button's own container is queried rather than the card as a whole. `CopyButton` itself has no
 * check of its own anywhere in this file; `CopyBlock` is what first puts a real trigger for it in
 * the catalogue.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function copyBlockChecks(devtools: Devtools): Promise<void> {
  // The control, not the card: the card holds three blocks and is taller than a short window, so
  // centring the card can leave the first block's control above the top edge.
  await centreInView(
    devtools,
    `document.querySelector('#demo-CopyBlock button[aria-label="Copy command"]')`,
  )

  await devtools.evaluate<null>(`(() => {
    const writeText = (text) => {
      globalThis.__copyBlockCopied = text
      return Promise.resolve()
    }
    try {
      navigator.clipboard.writeText = writeText
    } catch {
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    }
    return null
  })()`)

  const iconPath = () =>
    `(document.querySelector('#demo-CopyBlock button[aria-label="Copy command"] svg path')` +
    `?.getAttribute("d") ?? null)`
  const regionText = () =>
    `(document.querySelector('#demo-CopyBlock button[aria-label="Copy command"]')` +
    `?.parentElement.querySelector('[role="status"]')?.textContent ?? null)`
  const commandText = () =>
    `(document.querySelector('#demo-CopyBlock button[aria-label="Copy command"]')` +
    `?.parentElement.querySelector("code")?.textContent ?? null)`

  const beforeClick = await devtools.evaluate<string | null>(iconPath())
  const spot = await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
    const button = document.querySelector('#demo-CopyBlock button[aria-label="Copy command"]')
    if (!button) return null
    const box = button.getBoundingClientRect()
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
  })()`)

  await devtools.evaluate<null>(`(globalThis.__copyBlockCopied = undefined, null)`)
  if (spot !== null) {
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
  await poll(
    async () => (await devtools.evaluate<string | null>(iconPath())) === COPY_BUTTON_CHECKMARK,
    2_000,
  )
  const afterClick = await devtools.evaluate<string | null>(iconPath())
  const command = await devtools.evaluate<string | null>(commandText())
  const clickCopied = await devtools.evaluate<string | undefined>(`globalThis.__copyBlockCopied`)
  const announced = await devtools.evaluate<string | null>(regionText())

  check(
    "a real click on CopyBlock's copy control swaps its icon to the checkmark and copies its command",
    spot !== null && beforeClick !== COPY_BUTTON_CHECKMARK &&
      afterClick === COPY_BUTTON_CHECKMARK &&
      clickCopied === command,
    spot === null
      ? 'the CopyBlock card has no [aria-label="Copy command"] control to click'
      : beforeClick === COPY_BUTTON_CHECKMARK
      ? "the icon was already the checkmark before anything was clicked, so this proves nothing"
      : `clicked at (${spot.x}, ${spot.y}): icon path ${JSON.stringify(beforeClick)} → ` +
        `${JSON.stringify(afterClick)}, clipboard ${JSON.stringify(clickCopied)} vs command ` +
        `${JSON.stringify(command)}`,
  )

  // Wait for the confirmation timer (1500ms default) to clear before pressing Enter, so the second
  // half of this check starts from the same rest state as the first.
  await poll(
    async () => (await devtools.evaluate<string | null>(iconPath())) !== COPY_BUTTON_CHECKMARK,
    3_000,
  )
  const cleared = await poll(
    async () => (await devtools.evaluate<string | null>(regionText())) === "",
    1_000,
  )
  check(
    "CopyBlock announces a copy in its live region, then empties it so the next copy is heard",
    announced === "Command copied" && cleared,
    `region right after the click: ${JSON.stringify(announced)}; emptied once the copied state ` +
      `ended: ${cleared}`,
  )

  await devtools.evaluate<null>(
    `(document.querySelector('#demo-CopyBlock button[aria-label="Copy command"]')?.focus(), null)`,
  )
  const focused = await devtools.evaluate<boolean>(
    `document.activeElement === document.querySelector('#demo-CopyBlock button[aria-label="Copy command"]')`,
  )
  const beforeEnter = await devtools.evaluate<string | null>(iconPath())
  await devtools.evaluate<null>(`(globalThis.__copyBlockCopied = undefined, null)`)
  await pressKey(devtools, "Enter")
  await poll(
    async () => (await devtools.evaluate<string | null>(iconPath())) === COPY_BUTTON_CHECKMARK,
    2_000,
  )
  const afterEnter = await devtools.evaluate<string | null>(iconPath())
  const enterCopied = await devtools.evaluate<string | undefined>(`globalThis.__copyBlockCopied`)

  check(
    "a real Enter press on the focused copy control also swaps its icon to the checkmark and copies its command",
    focused && beforeEnter !== COPY_BUTTON_CHECKMARK && afterEnter === COPY_BUTTON_CHECKMARK &&
      enterCopied === command,
    !focused
      ? "the copy control never took focus, so a key press here proves nothing"
      : beforeEnter === COPY_BUTTON_CHECKMARK
      ? "the icon was already the checkmark before Enter was pressed, so this proves nothing"
      : `focused, then a real Enter press: icon path ${JSON.stringify(beforeEnter)} → ` +
        `${JSON.stringify(afterEnter)}, clipboard ${JSON.stringify(enterCopied)} vs command ` +
        `${JSON.stringify(command)}`,
  )

  await devtools.evaluate<null>(
    `(document.querySelector('#demo-CopyBlock button[aria-label="Copy command"]')?.blur(), null)`,
  )
}

/** The widths #353 names: a phone, a small laptop, and a desktop. */
const COPY_BLOCK_WIDTHS = [375, 1024, 1440] as const

/** What {@link copyBlockNeverClipsCheck} reads off one `CopyBlock` at one width. */
interface CopyBlockFit {
  /** Whether the block was found at all. */
  found: boolean
  /** The `<code>`'s own text. */
  text: string
  /** How far the text runs past the `<code>`'s own box, in pixels; above 0 is clipped. */
  overflow: number
  /** How far the block's right edge runs past the viewport, in pixels; above 0 is off-screen. */
  pastViewport: number
  /** The page's own sideways overflow, in pixels; above 0 means the page scrolls sideways. */
  pageOverflow: number
}

/**
 * Read one block's fit: whether its text fits inside the `<code>` and the block inside the window.
 *
 * @param devtools The connected session.
 * @param button Selector of the block's copy control; the block is the control's parent.
 */
async function copyBlockFit(devtools: Devtools, button: string): Promise<CopyBlockFit> {
  return await devtools.evaluate<CopyBlockFit>(`(() => {
    const block = document.querySelector('${button}')?.parentElement
    const code = block?.querySelector("code")
    if (!block || !code) {
      return { found: false, text: "", overflow: 0, pastViewport: 0, pageOverflow: 0 }
    }
    const root = document.documentElement
    return {
      found: true,
      text: code.textContent,
      overflow: code.scrollWidth - code.clientWidth,
      pastViewport: Math.ceil(block.getBoundingClientRect().right - root.clientWidth),
      pageOverflow: root.scrollWidth - root.clientWidth,
    }
  })()`)
}

/**
 * The overview's install command, and the `CopyBlock` card's wrapping block, are fully readable at
 * 375, 1024 and 1440 px (#353): all of the text is in the `<code>` without running past its box,
 * the block ends inside the window, and the page does not scroll sideways. `InstallBox`, which
 * this replaced, cut its command off at 1024 and 375 px.
 *
 * A wrapping block has nothing to scroll, so any overflow of its `<code>` is text a reader cannot
 * reach. The viewport is reset in a `finally`, and the check ends back on the ui page, where every
 * later check in this file expects to be.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function copyBlockNeverClipsCheck(devtools: Devtools): Promise<void> {
  const targets = [
    {
      page: "overview",
      label: "the overview's install command",
      button: '[data-guide-page="overview"] button[aria-label="Copy the install command"]',
      expected: "deno add jsr:@spy4x/preact-ui",
    },
    {
      page: "ui",
      label: "the CopyBlock card's wrapping block",
      button: '#demo-CopyBlock button[aria-label="Copy command"]',
      expected: "deno add jsr:@spy4x/preact-ui jsr:@spy4x/preact-icons jsr:@spy4x/preact-theme",
    },
  ] as const

  try {
    for (const target of targets) {
      await openGuidePage(devtools, target.page)
      for (const width of COPY_BLOCK_WIDTHS) {
        await devtools.send("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        })
        // Two frames: one for the resize to lay out, one for anything it scheduled.
        const frame = `new Promise((done) => requestAnimationFrame(done))`
        await devtools.evaluate<null>(`${frame}.then(() => ${frame}).then(() => null)`)
        const fit = await copyBlockFit(devtools, target.button)
        check(
          `${target.label} is fully readable at ${width}px`,
          fit.found && fit.text === target.expected && fit.overflow <= 0 &&
            fit.pastViewport <= 0 && fit.pageOverflow <= 0,
          fit.found
            ? `text ${JSON.stringify(fit.text)}; text past its box ${fit.overflow}px; block past ` +
              `the window ${fit.pastViewport}px; page sideways overflow ${fit.pageOverflow}px`
            : `no block with a ${target.button} control on the ${target.page} page`,
        )
      }
    }
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
    await openGuidePage(devtools, "ui")
  }
}
