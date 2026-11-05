import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { kanbanDemo } from "./shared.ts"

/** A phone: 390 px wide, touch emulated, so `(hover: none)` holds and touches are real input. */
async function asPhone(page: Page) {
  const session = await page.context().newCDPSession(page)
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
  await page.setViewportSize({ width: 390, height: 844 })
  if (!(await page.evaluate(() => matchMedia("(hover: none)").matches))) {
    throw new Error("touch emulation did not make the screen (hover: none)")
  }
  /** One finger through the browser's own touch input: down, moves, up. */
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
    })
  return { touch }
}

/** Wait two animation frames, so the page has handled the input sent before. */
async function twoFrames(page: Page) {
  await page.evaluate(() =>
    new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  )
}

/**
 * `KanbanBoard` moved by real pointer input: a finger on a phone, which native drag and drop did
 * not serve (#858), and a mouse, whose two checks moved here from `checks/ui.ts` with the port to
 * pointer events. The keyboard path keeps its checks there.
 */
function kanbanDragSpecs(): Spec[] {
  return [
    {
      name:
        "KanbanBoard at 390 px on a touch screen: a finger held on a card lifts it, carries it to " +
        "the board's edge, which scrolls the next column into view, and drops it there, while the " +
        "page stays still",
      pageId: "ui",
      run: async (page) => {
        const { touch } = await asPhone(page)
        const kanban = await kanbanDemo(page)
        const before = await kanban.read()
        const from = await kanban.middle(kanban.handle("notes"))
        const board = await kanban.board.boundingBox()
        if (board === null) throw new Error("the board is not drawn")
        /** Moves the finger in steps, two frames apart, so the page sees every move. */
        const slide = async (start: { x: number; y: number }, end: { x: number; y: number }) => {
          const steps = 8
          for (let step = 1; step <= steps; step++) {
            await touch(
              "touchMove",
              Math.round(start.x + ((end.x - start.x) * step) / steps),
              Math.round(start.y + ((end.y - start.y) * step) / steps),
            )
            await twoFrames(page)
          }
        }

        await touch("touchStart", from.x, from.y)
        // The finger rests: the card lifts on its own, with no move at all.
        await kanban.liveIs("Picked up Write the release notes. To do, position 1 of 3.")
        // At 390 px only a sliver of Doing shows; held near the board's right edge, the board
        // scrolls sideways until Doing is in view.
        const edge = { x: Math.round(board.x + board.width - 12), y: from.y }
        await slide(from, edge)
        await page.waitForFunction((left) => {
          const doing = document.querySelector("#demo-KanbanBoard [data-kanban-column='doing']")
          return (doing?.getBoundingClientRect().left ?? Infinity) <= left
        }, board.x + 120)
        // Then over Doing, below the middle of its one card: the card lands second.
        const export_ = await kanban.handle("export").boundingBox()
        if (export_ === null) throw new Error("the Doing card is not drawn")
        const to = {
          x: Math.round(Math.max(export_.x + 24, board.x + 64)),
          y: Math.round(export_.y + export_.height * 0.75),
        }
        await slide(edge, to)
        const over = await kanban.read()
        await touch("touchEnd")
        await twoFrames(page)
        const after = await kanban.read()

        if (after.lastMove !== "Last move through onMove: notes to doing at 1") {
          throw new Error(
            `after the release: ${after.lastMove}, live "${after.live}"; before it: drop line in ` +
              `${over.indicator}, live "${over.live}"`,
          )
        }
        await kanban.liveIs("Dropped Write the release notes in Doing, position 2 of 2.")
        if (over.indicator !== "doing") {
          throw new Error(`before the release the drop line is in ${over.indicator}`)
        }
        if (JSON.stringify(after.columns.doing) !== `["export","notes"]`) {
          throw new Error(`Doing shows ${JSON.stringify(after.columns.doing)}`)
        }
        if (after.pageScroll !== before.pageScroll) {
          throw new Error(`the page scrolled from ${before.pageScroll} to ${after.pageScroll}`)
        }
        if (after.opened !== "Last card opened through onOpen: none yet") {
          throw new Error(`the drag also opened the card: ${after.opened}`)
        }
        return `${after.lastMove}; the board scrolled ${after.boardScroll} px under the drag`
      },
    },
    {
      name:
        "KanbanBoard at 390 px on a touch screen: a finger that swipes a card at once scrolls the " +
        "board sideways and drags nothing",
      pageId: "ui",
      run: async (page) => {
        const { touch } = await asPhone(page)
        const kanban = await kanbanDemo(page)
        const from = await kanban.middle(kanban.handle("icons"))
        // The first move goes out with the touch itself, not a round trip later: on a loaded
        // machine that round trip alone can outlast the hold, which is not what a swipe is.
        await Promise.all([
          touch("touchStart", from.x, from.y),
          touch("touchMove", from.x - 20, from.y),
        ])
        for (let step = 2; step <= 8; step++) {
          await touch("touchMove", from.x - step * 20, from.y)
          await twoFrames(page)
        }
        await touch("touchEnd")
        await page.waitForFunction(() =>
          (document.querySelector("#demo-KanbanBoard ul[aria-label]")?.scrollLeft ?? 0) > 0
        )
        const after = await kanban.read()
        if (after.live !== "" || after.lastMove !== "Last move through onMove: none yet") {
          throw new Error(`the swipe dragged: live "${after.live}", ${after.lastMove}`)
        }
        return `the board scrolled to ${after.boardScroll} px`
      },
    },
    {
      name:
        "KanbanBoard: a mouse drag shows the drop line in the empty Done column and moves the card " +
        "there through onMove",
      pageId: "ui",
      run: async (page) => {
        const kanban = await kanbanDemo(page)
        // The board scrolls to its end first, as a reader would scroll it to see Done.
        await kanban.board.evaluate((element) => element.scrollLeft = element.scrollWidth)
        const from = await kanban.middle(kanban.handle("login"))
        const to = await kanban.middle(kanban.list("done"))
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move(to.x, to.y, { steps: 10 })
        await kanban.card.locator(`[data-kanban-column="done"] [data-kanban-indicator]`).waitFor()
        await page.mouse.up()
        await kanban.movedTo("login to done at 0")
        await kanban.liveIs("Dropped Sign in with a passkey in Done, position 1 of 1.")
        const after = await kanban.read()
        if (JSON.stringify(after.columns.done) !== `["login"]` || after.columns.review.length) {
          throw new Error(`columns ${JSON.stringify(after.columns)}`)
        }
        if (after.indicator !== null) throw new Error(`a drop line is left in ${after.indicator}`)
        if (after.opened !== "Last card opened through onOpen: none yet") {
          throw new Error(`the drag also opened the card: ${after.opened}`)
        }
      },
    },
    {
      name:
        "KanbanBoard: a card held by mouse at the board's right edge scrolls the board to its " +
        "last column and stops there, the scroll area keeping its size",
      pageId: "ui",
      run: async (page) => {
        const kanban = await kanbanDemo(page)
        const rest = await kanban.board.evaluate((element) => ({
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }))
        if (rest.scrollWidth <= rest.clientWidth) throw new Error("the board does not scroll")
        const board = await kanban.board.boundingBox()
        if (board === null) throw new Error("the board is not drawn")
        const from = await kanban.middle(kanban.handle("notes"))
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move(Math.round(board.x + board.width - 8), from.y, { steps: 10 })
        // The board's real end: its last column fully shown.
        await page.waitForFunction(
          (end) => {
            const element = document.querySelector("#demo-KanbanBoard ul[aria-label]")
            return element !== null && element.scrollLeft >= end - 1
          },
          rest.scrollWidth - rest.clientWidth,
        )
        // Held there a while longer: a board that made room for the card would keep growing.
        for (let frame = 0; frame < 10; frame++) await twoFrames(page)
        const held = await kanban.board.evaluate((element) => ({
          scrollWidth: element.scrollWidth,
          scrollLeft: element.scrollLeft,
        }))
        await page.mouse.up()
        if (held.scrollWidth !== rest.scrollWidth) {
          throw new Error(
            `the scroll area grew from ${rest.scrollWidth} to ${held.scrollWidth} px while held`,
          )
        }
        return `scroll area ${held.scrollWidth} px, stopped at ${held.scrollLeft} px`
      },
    },
    {
      name:
        "KanbanBoard: a card dragged by mouse past the board's right edge and below the board " +
        "stays wholly drawn under the pointer, clipped by nothing, and released there goes back",
      pageId: "ui",
      run: async (page) => {
        const kanban = await kanbanDemo(page)
        const board = await kanban.board.boundingBox()
        if (board === null) throw new Error("the board is not drawn")
        const from = await kanban.middle(kanban.handle("notes"))
        const viewport = page.viewportSize()
        if (viewport === null) throw new Error("no viewport")
        const copy = kanban.card.locator("[data-kanban-dragging]")
        /**
         * How many of nine points spread over the drawn card the browser's own hit test finds on
         * it, and its box. The hit test respects clipping, so a clipped part finds something else.
         * The card ignores the pointer, so it is made to take it for the test and then put back.
         */
        const shown = () =>
          copy.evaluate((element) => {
            const card = element as HTMLElement
            const box = card.getBoundingClientRect()
            card.style.pointerEvents = "auto"
            let hits = 0
            for (const fx of [0.05, 0.5, 0.95]) {
              for (const fy of [0.1, 0.5, 0.9]) {
                const hit = document.elementFromPoint(
                  box.left + box.width * fx,
                  box.top + box.height * fy,
                )
                if (hit !== null && card.contains(hit)) hits++
              }
            }
            card.style.pointerEvents = ""
            return {
              fraction: hits / 9,
              box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
            }
          })
        // Outside the board on both counts, but clear of the zones that scroll the board or page.
        const points = [
          { what: "past the right edge", x: Math.round(board.x + board.width + 40), y: from.y },
          {
            what: "below the board",
            x: from.x,
            y: Math.round(Math.min(board.y + board.height + 60, viewport.height - 80)),
          },
        ]
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        const seen: string[] = []
        try {
          for (const point of points) {
            if (point.y <= board.y + board.height && point.x <= board.x + board.width) {
              throw new Error(`the point ${point.what} is on the board`)
            }
            await page.mouse.move(point.x, point.y, { steps: 8 })
            await copy.waitFor()
            await twoFrames(page)
            const { fraction, box } = await shown()
            const under = box.left <= point.x && point.x <= box.right && box.top <= point.y &&
              point.y <= box.bottom
            if (fraction < 1 || !under) {
              throw new Error(
                `${point.what}: ${Math.round(fraction * 9)} of 9 points on the card hit it, at ` +
                  `${JSON.stringify(box)}, pointer at ${point.x}, ${point.y}`,
              )
            }
            seen.push(`${point.what}: whole`)
          }
        } finally {
          await page.mouse.up()
        }
        await kanban.liveIs("Write the release notes is back in To do, position 1 of 3.")
        return seen.join("; ")
      },
    },
    {
      name:
        "KanbanBoard: a mouse drag released where the card started moves nothing and does not " +
        "open the card, though the release lands on it",
      pageId: "ui",
      run: async (page) => {
        const kanban = await kanbanDemo(page)
        const from = await kanban.middle(kanban.handle("notes"))
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move(from.x + 30, from.y + 10, { steps: 4 })
        await kanban.liveIs("Picked up Write the release notes. To do, position 1 of 3.")
        await page.mouse.move(from.x, from.y, { steps: 4 })
        await page.mouse.up()
        await kanban.liveIs("Dropped Write the release notes in To do, position 1 of 3.")
        await twoFrames(page)
        const after = await kanban.read()
        if (after.lastMove !== "Last move through onMove: none yet") {
          throw new Error(`a drop in place reported a move: ${after.lastMove}`)
        }
        if (after.opened !== "Last card opened through onOpen: none yet") {
          throw new Error(`the drag also opened the card: ${after.opened}`)
        }
      },
    },
    {
      name:
        "KanbanBoard: a mouse drag of the first card to below the second one's middle reports " +
        "index 1 in its own column and keeps focus on it",
      pageId: "ui",
      run: async (page) => {
        const kanban = await kanbanDemo(page)
        const from = await kanban.middle(kanban.handle("notes"))
        const second = await kanban.handle("icons").boundingBox()
        if (second === null) throw new Error("the second card is not drawn")
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move(from.x, Math.round(second.y + second.height * 0.75), { steps: 8 })
        await page.mouse.up()
        await kanban.movedTo("notes to todo at 1")
        await kanban.handle("notes").and(page.locator(":focus")).waitFor()
        const after = await kanban.read()
        if (JSON.stringify(after.columns.todo) !== `["icons","notes","search"]`) {
          throw new Error(`To do shows ${JSON.stringify(after.columns.todo)}`)
        }
        if (after.opened !== "Last card opened through onOpen: none yet") {
          throw new Error(`the drag also opened the card: ${after.opened}`)
        }
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...kanbanDragSpecs(),
]
