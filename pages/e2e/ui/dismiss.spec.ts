import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** How many `type` listeners the document holds now, read through DevTools. */
async function documentListeners(page: Page, type: string): Promise<number> {
  // Effects run after a paint: let one frame and the task after it pass before counting.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))))
  const cdp = await page.context().newCDPSession(page)
  try {
    const { result } = await cdp.send("Runtime.evaluate", { expression: "document" })
    if (!result.objectId) throw new Error("DevTools handed back no document object")
    const { listeners } = await cdp.send("DOMDebugger.getEventListeners", {
      objectId: result.objectId,
    })
    return listeners.filter((listener) => listener.type === type).length
  } finally {
    await cdp.detach()
  }
}

/**
 * A popup on `useDismiss` adds its document listener as it opens and drops it as it closes, and a
 * press outside it closes it. The press is a `mousedown` sent to `<body>` from script, so focus
 * stays where it is and no focus-out handler can be what closes the popup.
 */
function dismissSpec(
  name: string,
  open: (page: Page) => Promise<Locator>,
  alsoListensFor: readonly string[] = [],
  afterwards?: (page: Page) => Promise<void>,
): Spec {
  return {
    name:
      `${name}: an outside press closes it, and the document holds its listener only while it is open`,
    pageId: "ui",
    run: async (page) => {
      const types = ["mousedown", ...alsoListensFor]
      const counts = async () =>
        Object.fromEntries(
          await Promise.all(types.map(async (type) => [type, await documentListeners(page, type)])),
        )
      const closed = await counts()
      const expanded = await open(page)
      await expanded.and(page.locator(`[aria-expanded="true"]`)).waitFor()
      const opened = await counts()
      await page.evaluate(() =>
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
      )
      await expanded.and(page.locator(`[aria-expanded="false"]`)).waitFor()
      const after = await counts()
      for (const type of types) {
        if (opened[type] !== closed[type] + 1 || after[type] !== closed[type]) {
          throw new Error(
            `document ${type} listeners: ${closed[type]} closed, ${opened[type]} open, ` +
              `${after[type]} after the outside press`,
          )
        }
      }
      await afterwards?.(page)
    },
  }
}

/** One dismiss spec per popup that closes on an outside press through `useDismiss`. */
function dismissSpecs(): Spec[] {
  return [
    dismissSpec("Dropdown", async (page) => {
      const trigger = page.locator(`#demo-Dropdown button[aria-haspopup="menu"]`).first()
      await trigger.click()
      return trigger
    }),
    dismissSpec(
      "DateRangePicker",
      async (page) => {
        const trigger = page.locator(`#demo-DateRangePicker button[aria-controls]`).first()
        await trigger.click()
        return trigger
      },
      // Its Escape listener is on the document too, and only while open.
      ["keydown"],
    ),
    dismissSpec("TagInput", async (page) => {
      const input = page.locator("#guide-tag-input")
      await input.focus()
      return input
    }),
    dismissSpec(
      "Combobox",
      async (page) => {
        const field = page.locator("#guide-combobox-fetch")
        await field.click()
        await field.pressSequentially("B")
        return field
      },
      [],
      // A controlled query belongs to the caller: closing leaves it where it is.
      async (page) => {
        await page.locator(`#demo-Combobox [data-e2e="combobox-fetch"]`)
          .filter({ hasText: /query "B"$/ }).waitFor()
      },
    ),
  ]
}

export const specs: readonly Spec[] = [
  ...dismissSpecs(),
]
