import { check, type Devtools, openGuidePage } from "../harness.ts"

/** The widths the `PageHeader` card is measured at: a phone, and a desktop. */
const PAGE_HEADER_WIDTHS = [375, 1440] as const

/** What {@link pageHeaderLayoutChecks} reads off the `PageHeader` card's long-titled header. */
interface PageHeaderLayout {
  /** Whether the header was found at all. */
  found: boolean
  /** The title text's full width past its truncating box, in pixels; above 0 means it is cut. */
  titleOverflow: number
  /** The `h1`'s height in lines of its own line height; 1 is one line. */
  titleLines: number
  /** Whether the actions sit on the title's row: their box and the title's overlap vertically. */
  actionsOnTitleRow: boolean
  /** Whether the actions start right of the title's box. */
  actionsRightOfTitle: boolean
  /** How far the header's right edge runs past the viewport, in pixels; above 0 is off-screen. */
  pastViewport: number
  /** Width × height of the back arrow, the primary action and the menu trigger, in pixels. */
  targets: string[]
  /** The smallest side among those three, in pixels. */
  smallestTarget: number
  /** The primary action's label width, in pixels: 1 or less while it is screen-reader-only. */
  labelWidth: number
}

/**
 * Read the long-titled header of the `PageHeader` card at the current width.
 *
 * @param devtools The connected session.
 */
async function pageHeaderLayout(devtools: Devtools): Promise<PageHeaderLayout> {
  return await devtools.evaluate<PageHeaderLayout>(`(() => {
    const h1 = document.querySelector('#demo-PageHeader [data-e2e="page-header-long-title"]')
    const header = h1?.closest("header")
    const actions = header?.lastElementChild
    if (!h1 || !header || !actions || actions.contains(h1)) {
      return { found: false, titleOverflow: 0, titleLines: 0, actionsOnTitleRow: false,
        actionsRightOfTitle: false, pastViewport: 0, targets: [], smallestTarget: 0, labelWidth: 0 }
    }
    const title = h1.getBoundingClientRect()
    const row = actions.getBoundingClientRect()
    const controls = [
      header.querySelector('[data-e2e="page-back"]'),
      actions.querySelector("button:not([aria-haspopup])"),
      actions.querySelector('button[aria-haspopup="menu"]'),
    ]
    const boxes = controls.map((control) => control?.getBoundingClientRect())
    const label = actions.querySelector("button:not([aria-haspopup]) span")
    return {
      found: true,
      // The plain title truncates in its own span, so the h1 never clips a heading slot's ring.
      titleOverflow: (h1.querySelector(".truncate") ?? h1).scrollWidth -
        (h1.querySelector(".truncate") ?? h1).clientWidth,
      titleLines: Math.round(title.height / parseFloat(getComputedStyle(h1).lineHeight)),
      actionsOnTitleRow: row.top < title.bottom && row.bottom > title.top,
      actionsRightOfTitle: row.left >= title.right,
      pastViewport: Math.ceil(header.getBoundingClientRect().right - document.documentElement.clientWidth),
      targets: boxes.map((box) => box ? Math.round(box.width) + "x" + Math.round(box.height) : "missing"),
      smallestTarget: Math.min(...boxes.map((box) => box ? Math.min(box.width, box.height) : 0)),
      labelWidth: label ? label.getBoundingClientRect().width : -1,
    }
  })()`)
}

/**
 * The `PageHeader` card's long title at 375 and 1440 px (#579): the title is cut short on one line,
 * and the primary action with the More actions menu stay on its row, right of it, inside the
 * window, rather than wrapping under it. At 375 px every control of the header is a 44 px touch
 * target and the primary action shows its icon alone; at 1440 px its label is visible.
 *
 * The viewport is reset in a `finally`, and the check ends back on the ui page, where every later
 * check in this file expects to be.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function pageHeaderLayoutChecks(devtools: Devtools): Promise<void> {
  try {
    await openGuidePage(devtools, "ui")
    for (const width of PAGE_HEADER_WIDTHS) {
      await devtools.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      // Two frames: one for the resize to lay out, one for anything it scheduled.
      const frame = `new Promise((done) => requestAnimationFrame(done))`
      await devtools.evaluate<null>(`${frame}.then(() => ${frame}).then(() => null)`)
      const layout = await pageHeaderLayout(devtools)
      const detail = layout.found
        ? `title cut by ${layout.titleOverflow}px over ${layout.titleLines} line(s); actions on ` +
          `its row ${layout.actionsOnTitleRow}, right of it ${layout.actionsRightOfTitle}; header ` +
          `past the window ${layout.pastViewport}px; targets ${layout.targets.join(", ")}; ` +
          `label ${layout.labelWidth}px wide`
        : "no long-titled header in the PageHeader card"
      check(
        `PageHeader keeps a long title to one cut-short line with its actions beside it at ${width}px`,
        layout.found && layout.titleOverflow > 0 && layout.titleLines === 1 &&
          layout.actionsOnTitleRow && layout.actionsRightOfTitle && layout.pastViewport <= 0,
        detail,
      )
      if (width === 375) {
        check(
          "PageHeader's back arrow, primary action and menu are 44 px touch targets at 375px",
          layout.found && layout.smallestTarget >= 44,
          detail,
        )
        check(
          "PageAction shows its icon alone at 375px",
          layout.found && layout.labelWidth >= 0 && layout.labelWidth <= 1,
          detail,
        )
      } else {
        check(
          `PageAction shows its label beside the icon at ${width}px`,
          layout.found && layout.labelWidth > 1,
          detail,
        )
      }
    }
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
    await openGuidePage(devtools, "ui")
  }
}

/**
 * The accessible name of every visible link and button on the cards of `PageHeader`,
 * `PageAction` and `MoreMenu`, at 375 px, where the primary actions show only their icon.
 *
 * Only each card's demo is read, not the card's own copy button. The names are asked of Chromium
 * through `Accessibility.getPartialAXTree`, as {@link triggerNameCheck} does, and compared with the
 * full expected list in document order, so a control that goes missing fails as surely as one that
 * goes unnamed.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function pageHeaderNameCheck(devtools: Devtools): Promise<void> {
  const expected = [
    "Back to lists",
    "New task",
    "More actions",
    "Edit Packing list",
    "List actions",
    "New task",
    "Export",
    "Actions for Ada Lovelace",
  ]
  const mark = "data-verify-page-header-name"
  const names: string[] = []
  try {
    await openGuidePage(devtools, "ui")
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    const frame = `new Promise((done) => requestAnimationFrame(done))`
    await devtools.evaluate<null>(`${frame}.then(() => ${frame}).then(() => null)`)
    // Only what is laid out: a closed menu's items are in the markup but not on screen.
    await devtools.evaluate<number>(`[...document.querySelectorAll(
      ["PageHeader", "PageAction", "MoreMenu"]
        .map((name) => "#demo-" + name + ' [data-card-part="demo"] :is(a, button)').join(", ")
    )].filter((control) => control.getClientRects().length > 0)
      .map((control) => control.setAttribute("${mark}", "")).length`)
    await devtools.send("DOM.enable")
    await devtools.send("Accessibility.enable")
    const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
      depth: 1,
    })
    const { nodeIds } = await devtools.send<{ nodeIds: number[] }>("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: `[${mark}]`,
    })
    for (const nodeId of nodeIds) {
      const { nodes } = await devtools.send<{ nodes: Array<{ name?: { value?: string } }> }>(
        "Accessibility.getPartialAXTree",
        { nodeId, fetchRelatives: false },
      )
      names.push((nodes[0]?.name?.value ?? "").trim())
    }
  } finally {
    await devtools.evaluate<null>(
      `(document.querySelectorAll("[${mark}]").forEach((c) => c.removeAttribute("${mark}")), null)`,
    )
    await devtools.send("Emulation.clearDeviceMetricsOverride")
    await openGuidePage(devtools, "ui")
  }
  check(
    "every link and button of the PageHeader, PageAction and MoreMenu cards is named at 375px",
    JSON.stringify(names) === JSON.stringify(expected),
    `Chromium names ${JSON.stringify(names)}; expected ${JSON.stringify(expected)}`,
  )
}
