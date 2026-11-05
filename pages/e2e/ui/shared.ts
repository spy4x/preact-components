import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"

/** The parts of the `UnsavedGuard` card a spec drives, with a change already typed in its field. */
export async function unsavedGuardWithAChange(page: Page) {
  const card = page.locator("#demo-UnsavedGuard")
  const draft = card.locator(`[data-e2e="unsaved-draft"]`)
  const dialog = page.getByRole("alertdialog", { name: "Leave without saving?" })
  const outcome = card.locator(`[data-e2e="unsaved-outcome"]`)
  await draft.fill("An unsaved change")
  await card.getByRole("checkbox", { name: "Unsaved changes", checked: true }).waitFor()
  return {
    card,
    draft,
    dialog,
    // By hook, as the specs find every dialog's footer buttons.
    stay: dialog.locator(`[data-e2e="confirm-dialog-cancel"]`),
    leave: dialog.locator(`[data-e2e="confirm-dialog-confirm"]`),
    lists: card.locator(`[data-e2e="unsaved-go-lists"]`),
    /** Waits for the card to report one outcome, word for word. */
    outcomeIs: (text: string) => outcome.getByText(`Outcome: ${text}`, { exact: true }).waitFor(),
    /** Waits for the card to have counted this many navigations started from code. */
    callsAre: (count: number) =>
      card.locator(`[data-e2e="unsaved-calls"]`)
        .getByText(`Navigations from code: ${count}`, { exact: true }).waitFor(),
    /** Waits for the focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
  }
}

/** Throws with each violation's rule and targets when axe finds any in the given areas. */
export async function axePasses(page: Page, selectors: readonly string[]): Promise<string> {
  let builder = new AxeBuilder({ page })
  for (const selector of selectors) builder = builder.include(selector)
  const { violations, passes } = await builder.analyze()
  if (violations.length > 0) {
    throw new Error(
      violations.map(({ id, nodes }) =>
        `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
      ).join(" | "),
    )
  }
  return `${passes.length} rules pass`
}

/** The palettes a focus ring has to hold 3:1 in. */
export const RING_PALETTES = ["light", "dark", "ink"] as const

/** The parts of the `FilterBar` card a spec drives. */
export function filterBarCard(page: Page) {
  const card = page.locator("#demo-FilterBar")
  const state = card.locator(`[data-e2e="filter-bar-state"]`)
  return {
    card,
    search: card.locator(`[data-e2e="filter-search"]`),
    tags: card.locator(`[data-e2e="filter-tags"]`),
    author: card.locator(`[data-e2e="filter-author"]`),
    sort: card.locator(`[data-e2e="filter-sort"]`),
    tagsMenu: page.getByRole("menu", { name: "Tags" }),
    /** Waits for the card's readout to include this text, word for word. */
    stateHas: (text: string) => state.filter({ hasText: text }).waitFor(),
    /** Waits for the focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
  }
}

/**
 * Throws when axe finds a violation inside the selected elements.
 *
 * @param page The page.
 * @param selector What to scan.
 */
export async function axeClean(page: Page, selector: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).include(selector).analyze()
  if (violations.length > 0) {
    throw new Error(
      violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target.join(" ")).join(", ")}`)
        .join(" | "),
    )
  }
}

/** What one read of the `KanbanBoard` demo sees. */
interface KanbanRead {
  /** Each column's card ids, in the order shown. */
  columns: Record<string, string[]>
  /** The column that shows the drop line, if any. */
  indicator: string | null
  live: string
  lastMove: string
  opened: string
  /** The board's sideways scroll, and the page's own, in pixels. */
  boardScroll: number
  pageScroll: number
}

/** The `KanbanBoard` demo's parts a spec drives, back at its first cards. */
export async function kanbanDemo(page: Page) {
  const card = page.locator("#demo-KanbanBoard")
  const board = card.locator("ul[aria-label]").first()
  await card.locator(`[data-e2e="kanban-reset"]`).click()
  await card.getByText("Last move through onMove: none yet", { exact: true }).waitFor()
  await board.evaluate((element) => element.scrollLeft = 0)
  await board.scrollIntoViewIfNeeded()
  const handle = (id: string) => card.locator(`[data-kanban-item="${id}"] [data-kanban-handle]`)
  return {
    card,
    board,
    handle,
    /** A column's drop-target list. */
    list: (column: string) => card.locator(`[data-kanban-column="${column}"] [data-kanban-list]`),
    /** The middle of an element, in viewport pixels. */
    middle: async (locator: Locator) => {
      const box = await locator.boundingBox()
      if (box === null) throw new Error("the element is not drawn")
      return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
    },
    /** Waits until the live region says this, word for word. */
    liveIs: (text: string) =>
      card.locator("[data-kanban-live]").getByText(text, { exact: true }).waitFor(),
    /** Waits until `onMove` has reported this move. */
    movedTo: (move: string) =>
      card.getByText(`Last move through onMove: ${move}`, { exact: true }).waitFor(),
    read: () =>
      card.evaluate((root): KanbanRead => {
        const columns: Record<string, string[]> = {}
        for (const column of root.querySelectorAll<HTMLElement>("[data-kanban-column]")) {
          columns[column.dataset.kanbanColumn ?? ""] = [
            ...column.querySelectorAll<HTMLElement>("[data-kanban-item]"),
          ].map((item) => item.dataset.kanbanItem ?? "")
        }
        const note = (hook: string) =>
          root.querySelector(`[data-e2e="${hook}"]`)?.textContent?.trim() ?? ""
        return {
          columns,
          indicator: root.querySelector("[data-kanban-indicator]")
            ?.closest<HTMLElement>("[data-kanban-column]")?.dataset.kanbanColumn ?? null,
          live: root.querySelector("[data-kanban-live]")?.textContent?.trim() ?? "",
          lastMove: note("kanban-last-move"),
          opened: note("kanban-opened"),
          boardScroll: root.querySelector("ul[aria-label]")?.scrollLeft ?? -1,
          pageScroll: document.scrollingElement?.scrollTop ?? -1,
        }
      }),
  }
}
