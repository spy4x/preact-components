import { check, type Devtools, openGuidePage } from "../harness.ts"

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
