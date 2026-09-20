import { check, type Devtools } from "./harness.ts"

/**
 * `ui-guide/`'s browser checks: every card's usage-snippet copy control, clicked for real.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function uiGuideChecks(devtools: Devtools): Promise<void> {
  // #30: every usage block's own copy control, clicked for real, has to put that block's text on the
  // clipboard. `navigator.clipboard` is stubbed in the page rather than read back, because reading
  // it needs a permission this run does not grant; the stub is what the page's own copy path calls.
  const copyBlocks = await devtools.evaluate<{
    patched: boolean
    cards: number
    unlabelled: string[]
    unconverted: string[]
    missing: string[]
    feedback: boolean
  }>(`(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 0))
    const copied = []
    const writeText = (text) => {
      copied.push(text)
      return Promise.resolve()
    }
    try {
      navigator.clipboard.writeText = writeText
    } catch {
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    }

    const cards = [...document.querySelectorAll('article[id^="demo-"]')]
    const missing = []
    const unconverted = []
    const unlabelled = []
    let feedback = false

    for (const [index, card] of cards.entries()) {
      const block = card.querySelector('[data-e2e="usage"]')
      const button = block?.querySelector("button")
      if (!block || !button) {
        missing.push(card.id)
        continue
      }
      if (!(button.getAttribute("aria-label") ?? "").startsWith("Copy the ")) {
        unlabelled.push(card.id)
      }

      const before = button.innerHTML
      copied.length = 0
      button.click()
      await settle()
      if (index === 0) feedback = button.innerHTML !== before
      if (copied[0] !== block.querySelector("pre code").textContent) unconverted.push(card.id)
    }

    return {
      patched: navigator.clipboard.writeText === writeText,
      cards: cards.length,
      unlabelled,
      unconverted,
      missing,
      feedback,
    }
  })()`)
  check(
    "every usage block copies its own text, through a labelled control",
    copyBlocks.patched && copyBlocks.cards > 30 && copyBlocks.missing.length === 0 &&
      copyBlocks.unlabelled.length === 0 && copyBlocks.unconverted.length === 0,
    `${copyBlocks.cards} blocks, ${copyBlocks.missing.length} without a control, ` +
      `${copyBlocks.unconverted.length} copied the wrong text, ` +
      `${copyBlocks.unlabelled.length} unlabelled`,
  )
  check(
    "the copy control confirms the copy",
    copyBlocks.feedback,
    "the glyph changed after the click",
  )
}
