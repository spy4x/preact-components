import type { Spec } from "../runner.ts"

/** `IconXMark`'s path, which `CopyButton` swaps in for its own glyph after a failed copy. */
const CROSS = "M6 18 18 6M6 6l12 12"

/** One `CopyButton` as it looked when its live region first said "Couldn't copy". */
interface FailedReading {
  /** The glyph's path: the first `<path>` in the button's `<svg>`. */
  icon: string | null
  /** The button's visible text. */
  text: string
  /** The polite live region right after the button. */
  region: string
}

/** What the page recorded: each button's reading, and every text the clipboard was asked for. */
interface FailedRecord {
  icon?: FailedReading
  titled?: FailedReading
  copied: string[]
}

export const specs: readonly Spec[] = [
  {
    name: "CopyButton: a CopyButton whose clipboard rejects shows a cross and announces the " +
      "failure, not a copy",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-CopyButton")
      const icon = card.getByRole("button", { name: "Copy", exact: true })
      const titled = card.getByRole("button", { name: "Copy number", exact: true })
      await titled.scrollIntoViewIfNeeded()
      // The failure shows for 1.5 s and then clears, which a loaded host can let pass between two
      // reads from here. So the page records each button the moment its region announces the
      // failure: the glyph, the label and the region change in the same render.
      await card.evaluate((root) => {
        const record: FailedRecord = { copied: [] }
        Object.assign(globalThis, { copyButtonFailed: record })
        const writeText = (text: string) => {
          record.copied.push(text)
          return Promise.reject(new DOMException("denied", "NotAllowedError"))
        }
        try {
          Object.assign(navigator.clipboard, { writeText })
        } catch {
          Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
          })
        }
        // The library falls back to `execCommand("copy")`, which succeeds in headless Chromium.
        document.execCommand = () => false
        const buttons = [...root.querySelectorAll("button")]
        const watch = (which: "icon" | "titled", button: Element | undefined) => {
          const region = button?.nextElementSibling
          if (!button || region?.getAttribute("role") !== "status") return
          new MutationObserver(() => {
            if (record[which] || region.textContent !== "Couldn't copy") return
            record[which] = {
              icon: button.querySelector("svg path")?.getAttribute("d") ?? null,
              text: button.textContent?.trim() ?? "",
              region: region.textContent,
            }
          }).observe(region, { childList: true, characterData: true, subtree: true })
        }
        watch("icon", buttons.find((button) => button.getAttribute("aria-label") === "Copy"))
        watch("titled", buttons.find((button) => button.textContent?.trim() === "Copy number"))
      })
      await icon.click()
      await titled.click()
      const recorded = () =>
        page.evaluate(() =>
          (globalThis as unknown as { copyButtonFailed: FailedRecord })
            .copyButtonFailed
        )
      const both = await page.waitForFunction(() => {
        const record = (globalThis as unknown as { copyButtonFailed: FailedRecord })
          .copyButtonFailed
        return record.icon !== undefined && record.titled !== undefined
      }).then(() => true, () => false)
      const seen = await recorded()
      const failed = (reading: FailedReading | undefined, text: string | null) =>
        reading?.icon === CROSS && reading.region === "Couldn't copy" &&
        (text === null || reading.text === text)
      if (
        !both || !failed(seen.icon, null) || !failed(seen.titled, "Couldn't copy") ||
        seen.copied.length !== 2
      ) {
        throw new Error(
          `icon-only ${JSON.stringify(seen.icon ?? "never announced the failure")}, titled ` +
            `${JSON.stringify(seen.titled ?? "never announced the failure")}, clipboard asked ` +
            `for ${JSON.stringify(seen.copied)}`,
        )
      }
      return `both showed the cross and announced "Couldn't copy"; clipboard asked for ` +
        JSON.stringify(seen.copied)
    },
  },
]
