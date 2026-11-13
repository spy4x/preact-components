import type { Locator, Page } from "playwright-core"
import { Buffer } from "node:buffer"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/** One file for a file chooser, `size` bytes of zeros. */
function chosenFile(name: string, mimeType: string, size = 16) {
  return { name, mimeType, buffer: Buffer.alloc(size) }
}

/** Clicks `button`, which must open the browser's file chooser, and chooses `files` there. */
async function chooseThrough(
  page: Page,
  button: Locator,
  files: ReturnType<typeof chosenFile>[],
): Promise<void> {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), button.click()])
  await chooser.setFiles(files)
}

/**
 * `FileInput`'s button appearance and `AttachmentList`: the button that opens the chooser and keeps
 * no list, and the list of a record's files it feeds.
 */
function fileSpecs(): Spec[] {
  const list = (page: Page) => page.locator("#demo-AttachmentList")
  const last = (page: Page, text: string) =>
    list(page).locator(`[data-e2e="attachments-last"]`).filter({ hasText: `Last action: ${text}` })
      .waitFor()
  const focused = (page: Page, target: Locator) => target.and(page.locator(":focus")).waitFor()
  /**
   * Pauses the page's clock, so the demo's 600 ms Retry check ends only when the spec moves the
   * clock: on a loaded host the spec could otherwise miss the checking state. Installed in the
   * open page, no reload: the demo and Preact look their timers up when they set them.
   */
  const pauseClock = async (page: Page) => {
    await page.clock.install()
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000))
  }
  return [
    {
      name:
        "FileInput button: one choice reaches onFiles (accepted) and onReject (refused), and no list is drawn",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-FileInput")
        const button = card.getByRole("button", { name: "Attach files", exact: true })
        await chooseThrough(page, button, [
          chosenFile("a.png", "image/png"),
          chosenFile("big.pdf", "application/pdf", 3 * 1024 * 1024),
          chosenFile("clip.gif", "image/gif"),
        ])
        await card.locator(`[data-e2e="file-input-button-chosen"]`)
          .filter({ hasText: /^last choice: a\.png$/ }).waitFor()
        await card.locator(`[data-e2e="file-input-button-refused"]`)
          .filter({ hasText: /^refused: big\.pdf \(too-large\), clip\.gif \(wrong-type\)$/ })
          .waitFor()
        const listed = await card.getByRole("button", { name: "Remove a.png" }).count()
        if (listed !== 0) throw new Error("the button appearance drew a list of chosen files")
      },
    },
    {
      name:
        "AttachmentList: Attach files adds every choice and empties its input, so the same file can come again",
      pageId: "ui",
      run: async (page) => {
        const button = list(page).getByRole("button", { name: "Attach files", exact: true })
        await chooseThrough(page, button, [chosenFile("notes.pdf", "application/pdf")])
        await last(page, "attached notes.pdf")
        // A real chooser fires no `change` for the file the input already holds; Playwright's
        // `setFiles` fires one anyway, so the emptied input is what this reads.
        const held = await page.locator("#guide-attachments-attach-input")
          .evaluate((input: HTMLInputElement) => `${input.files?.length ?? 0}:${input.value}`)
        if (held !== "0:") {
          throw new Error(`the input still holds a file after the choice (${held})`)
        }
        await chooseThrough(page, button, [chosenFile("notes.pdf", "application/pdf")])
        await list(page).getByRole("button", { name: "Remove notes.pdf" }).nth(1).waitFor()
        await list(page).getByText("9 of 10").waitFor()
      },
    },
    {
      name:
        "AttachmentList: Tab reaches a row's open button then its menu, each with a visible focus ring",
      pageId: "ui",
      run: async (page) => {
        const attach = list(page).getByRole("button", { name: "Attach files", exact: true })
        const open = list(page).getByRole("button", { name: "Open tickets.png" })
        const menu = list(page).getByRole("button", { name: "Actions for tickets.png" })
        await attach.focus()
        await page.keyboard.press("Tab")
        await focused(page, open)
        const ring = await open.evaluate((element) => getComputedStyle(element).boxShadow)
        if (ring === "none") throw new Error("the open button shows no focus ring")
        await page.keyboard.press("Tab")
        await focused(page, menu)
        const menuRing = await menu.evaluate((element) => getComputedStyle(element).boxShadow)
        if (menuRing === "none") throw new Error("the row's menu shows no focus ring")
      },
    },
    {
      name:
        "AttachmentList: a ready image opens in the lightbox, Right pages to the next image, Escape returns focus",
      pageId: "ui",
      run: async (page) => {
        const open = list(page).getByRole("button", { name: "Open tickets.png" })
        await open.click()
        const dialog = page.locator("dialog[open]")
        await dialog.getByText("tickets.png", { exact: true }).waitFor()
        await dialog.getByText("1 of 2", { exact: true }).waitFor()
        await page.keyboard.press("ArrowRight")
        await dialog.getByText("beach.jpg", { exact: true }).waitFor()
        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "detached" })
        await focused(page, open)
      },
    },
    {
      name: "AttachmentList: a thumbnail that fails to load gives way to the file icon",
      pageId: "ui",
      run: async (page) => {
        const row = list(page).locator(`[data-e2e="attachment-row"]`, { hasText: "tickets.png" })
        const thumbnail = row.locator("img")
        // The thumbnail loads lazily: off screen, a new source is not even tried.
        await thumbnail.scrollIntoViewIfNeeded()
        // An image that cannot be decoded fails in the browser itself, with no request to answer.
        await thumbnail.evaluate((img: HTMLImageElement) => {
          img.src = "data:image/png;base64,AA=="
        })
        await thumbnail.waitFor({ state: "detached" })
        await row.locator("span.size-10 > svg").waitFor()
      },
    },
    {
      name: "AttachmentList: Download in a ready row's menu calls onDownload with that file",
      pageId: "ui",
      run: async (page) => {
        await list(page).getByRole("button", { name: "Actions for beach.jpg" }).click()
        await page.getByRole("menuitem", { name: "Download" }).click()
        await last(page, "downloaded beach.jpg")
      },
    },
    {
      name:
        "AttachmentList: removing a ready file from its menu moves focus to the next row's action",
      pageId: "ui",
      run: async (page) => {
        await list(page).getByRole("button", { name: "Actions for tickets.png" }).click()
        await page.getByRole("menuitem", { name: "Remove" }).click()
        await last(page, "removed tickets.png")
        await list(page).getByRole("button", { name: "Open tickets.png" })
          .waitFor({ state: "detached" })
        await focused(
          page,
          list(page).getByRole("button", {
            name: "Actions for booking-confirmation-hotel-ribeira-porto-three-nights.pdf",
          }),
        )
      },
    },
    {
      name: "AttachmentList: Retry on a failed file shows it checking, then ready with its size",
      pageId: "ui",
      run: async (page) => {
        await pauseClock(page)
        const row = list(page).locator(`[data-e2e="attachment-row"]`, { hasText: "scan.pdf" })
        await row.getByText("Upload failed.").waitFor()
        await row.getByRole("button", { name: "Retry scan.pdf", exact: true }).click()
        await row.getByText("Checking…").waitFor()
        await row.getByRole("progressbar", { name: "Checking scan.pdf" }).waitFor()
        await page.clock.runFor(600)
        await row.getByText("PDF · 640 KB").waitFor()
        await row.getByRole("button", { name: "Actions for scan.pdf" }).waitFor()
      },
    },
    {
      name:
        "AttachmentList: Retry from the keyboard keeps focus in its row while checking and after it is ready",
      pageId: "ui",
      run: async (page) => {
        await pauseClock(page)
        const row = list(page).locator(`[data-e2e="attachment-row"]`, { hasText: "scan.pdf" })
        const focusInRow = () =>
          row.evaluate((element) =>
            element.contains(document.activeElement) && document.activeElement !== document.body
          )
        await list(page).getByRole("button", { name: "Remove receipt.pdf" }).focus()
        await page.keyboard.press("Tab")
        await focused(page, row.getByRole("button", { name: "Retry scan.pdf", exact: true }))
        await page.keyboard.press("Enter")
        await row.getByText("Checking…").waitFor()
        if (!await focusInRow()) throw new Error("focus left the row while it was checking")
        await page.clock.runFor(600)
        await row.getByText("PDF · 640 KB").waitFor()
        // Preact runs effects after a frame or a 35 ms timer, and the paused clock holds both.
        await page.clock.runFor(100)
        await focused(page, row.getByRole("button", { name: "Download scan.pdf" }))
      },
    },
    ...(["light", "dark"] as const).map((palette): Spec => ({
      name:
        `FileInput's button and AttachmentList: axe finds no violation, their text's contrast included, ${palette}`,
      pageId: "ui",
      colorScheme: palette,
      run: async (page) => {
        await list(page).waitFor()
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        // The button alone of the FileInput card: its disabled zone is a known contrast finding
        // that `ui-guide.spec.ts` already counts.
        return await axePasses(page, ["#demo-AttachmentList", "#guide-file-input-button"])
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...fileSpecs(),
]
