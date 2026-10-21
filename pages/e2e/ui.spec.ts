/** Playwright specs for `ui/` components, on the guide's UI page. */
import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "./runner.ts"
import { scrollRegionSpec } from "./scroll-region.ts"

/** The parts of the `UnsavedGuard` card a spec drives, with a change already typed in its field. */
async function unsavedGuardWithAChange(page: Page) {
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

/**
 * Throws unless the dialog's buttons are exactly these, one of each name.
 *
 * @param dialog The open dialog.
 * @param names Every button's accessible name, in any order.
 */
async function buttonsAreNamed(dialog: Locator, names: readonly string[]): Promise<void> {
  const buttons = dialog.getByRole("button")
  await buttons.nth(names.length - 1).waitFor()
  const total = await buttons.count()
  if (total !== names.length) throw new Error(`${total} buttons, expected ${names.join(", ")}`)
  for (const name of names) {
    const named = await dialog.getByRole("button", { name, exact: true }).count()
    if (named !== 1) throw new Error(`${named} buttons are named "${name}", expected 1`)
  }
}

/** One required control of the Field card's order form, and how a spec fills it. */
interface RequiredControl {
  /** The control's name in the spec's own name. */
  name: string
  /** `id` of the element the browser focuses when it refuses the submit for this control. */
  focusId: string
  /** Gives the control a value. */
  fill: (form: Locator) => Promise<void>
}

const REQUIRED_CONTROLS: readonly RequiredControl[] = [
  {
    name: "MoneyInput",
    focusId: "guide-required-price",
    fill: (form) => form.locator("#guide-required-price").fill("12"),
  },
  {
    name: "TagInput",
    focusId: "guide-required-tags",
    // A comma ends the tag, so the text field is empty again while the field holds a chip.
    fill: async (form) => {
      await form.locator("#guide-required-tags").pressSequentially("work,")
      await form.getByRole("button", { name: "Remove tag work", exact: true }).waitFor()
    },
  },
  {
    name: "Combobox",
    focusId: "guide-required-city",
    fill: async (form) => {
      await form.locator("#guide-required-city").click()
      await form.getByRole("option", { name: "Lisbon", exact: true }).click()
    },
  },
  {
    name: "RadioGroup",
    focusId: "guide-required-plan-0",
    fill: (form) => form.getByRole("radio", { name: "Express", exact: true }).check(),
  },
]

/** A required `Field` around each control that enforces `required` in its own way. */
function requiredFieldSpecs(): Spec[] {
  const blocked = REQUIRED_CONTROLS.map((control): Spec => ({
    name:
      `Field required around ${control.name}: a submit with only that field empty is refused and focus goes to it, and the same submit goes through once it has a value`,
    pageId: "ui",
    run: async (page) => {
      const form = page.locator(`[data-e2e="required-form"]`)
      const submits = form.locator(`[data-e2e="required-submits"]`)
      const submit = form.locator(`[data-e2e="required-submit"]`)
      await form.locator(`[data-e2e="required-reset"]`).click()
      for (const other of REQUIRED_CONTROLS) {
        if (other !== control) await other.fill(form)
      }
      await submit.click()
      // The browser focuses the first control it refuses, and only an invalid one.
      await form.locator(`#${control.focusId}:invalid:focus`).waitFor()
      const refused = (await submits.textContent())?.trim()
      if (refused !== "submits: 0") throw new Error(`a refused submit left "${refused}"`)
      await control.fill(form)
      await submit.click()
      await submits.getByText("submits: 1", { exact: true }).waitFor()
    },
  }))
  /** The form of required fields, reset, with every control but `empty` filled. */
  const formWithOneEmpty = async (page: Page, empty: string) => {
    const form = page.locator(`[data-e2e="required-form"]`)
    await form.locator(`[data-e2e="required-reset"]`).click()
    for (const other of REQUIRED_CONTROLS) {
      if (other.name !== empty) await other.fill(form)
    }
    const control = form.locator(
      `#${REQUIRED_CONTROLS.find(({ name }) => name === empty)!.focusId}`,
    )
    /** The browser refused the submit at the control, and the count of submits is still `count`. */
    const refusedAt = async (count: number) => {
      await control.and(form.locator(":invalid:focus")).waitFor()
      const text = (await form.locator(`[data-e2e="required-submits"]`).textContent())?.trim()
      if (text !== `submits: ${count}`) throw new Error(`a refused submit left "${text}"`)
    }
    const submittedTimes = (count: number) =>
      form.locator(`[data-e2e="required-submits"]`)
        .getByText(`submits: ${count}`, { exact: true }).waitFor()
    return {
      form,
      control,
      refusedAt,
      submittedTimes,
      submit: form.locator(`[data-e2e="required-submit"]`),
      // A submit that takes focus nowhere, so the text typed in the control is still there when
      // the browser validates: a click on the button would blur the control first.
      submitInPlace: () => form.evaluate((node) => (node as HTMLFormElement).requestSubmit()),
    }
  }
  return [
    ...blocked,
    {
      name:
        "Field required around MoneyInput: Enter in a field that holds only spaces submits nothing",
      pageId: "ui",
      run: async (page) => {
        const { control, refusedAt, submittedTimes } = await formWithOneEmpty(page, "MoneyInput")
        await control.pressSequentially("   ")
        await control.press("Enter")
        await refusedAt(0)
        // A second submit proves the first one counted nothing, even if it was slow to show.
        await control.pressSequentially("12")
        await control.press("Enter")
        await submittedTimes(1)
      },
    },
    {
      name:
        "Field required around TagInput: text typed but not made a tag is refused, and so is a submit after the last tag is removed",
      pageId: "ui",
      run: async (page) => {
        const { form, control, refusedAt, submittedTimes, submit, submitInPlace } =
          await formWithOneEmpty(page, "TagInput")
        await control.pressSequentially("draft")
        await submitInPlace()
        await refusedAt(0)
        await control.press(",")
        const remove = form.getByRole("button", { name: "Remove tag draft", exact: true })
        await remove.waitFor()
        await submit.click()
        await submittedTimes(1)
        await remove.click()
        await remove.waitFor({ state: "detached" })
        await submit.click()
        await refusedAt(1)
      },
    },
    {
      name:
        "Field required around Combobox: a typed query that chose nothing is refused, and so is a submit after the selection is cleared",
      pageId: "ui",
      run: async (page) => {
        const { form, control, refusedAt, submittedTimes, submit, submitInPlace } =
          await formWithOneEmpty(page, "Combobox")
        await control.pressSequentially("Lis")
        await submitInPlace()
        await refusedAt(0)
        await form.getByRole("option", { name: "Lisbon", exact: true }).click()
        await submit.click()
        await submittedTimes(1)
        await form.getByRole("button", { name: "Clear selection", exact: true }).click()
        await submit.click()
        await refusedAt(1)
      },
    },
    {
      name:
        "Field around Combobox: an error under it marks the input invalid and describes it, and axe passes the form of required fields",
      pageId: "ui",
      run: async (page) => {
        const form = page.locator(`[data-e2e="required-form"]`)
        const city = form.locator("#guide-required-city")
        await city.click()
        await form.getByRole("option", { name: "Atlantis", exact: true }).click()
        await form.locator("#guide-required-city-error")
          .getByText("We do not ship to Atlantis", { exact: true }).waitFor()
        await city.and(
          page.locator(`[aria-invalid="true"][aria-describedby~="guide-required-city-error"]`),
        ).waitFor()
        const { violations } = await new AxeBuilder({ page })
          .include(`[data-e2e="required-form"]`).analyze()
        if (violations.length > 0) {
          throw new Error(violations.map((found) => `${found.id}: ${found.help}`).join("; "))
        }
      },
    },
  ]
}

/** `ConfirmDialog`'s three buttons, by the names a screen reader reads. */
function confirmDialogNameSpecs(): Spec[] {
  return [
    {
      name:
        "ConfirmDialog: the corner button is named Close or by closeLabel, no two buttons share a name, it cancels, and axe passes the dialog",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ConfirmDialog")
        const archive = page.getByRole("alertdialog", { name: "Archive invoice INV-0007?" })
        await card.getByRole("button", { name: "Archive invoice" }).click()
        await archive.waitFor()
        const { violations } = await new AxeBuilder({ page }).include("dialog[open]").analyze()
        if (violations.length > 0) {
          throw new Error(`axe on the open dialog: ${violations.map(({ id }) => id).join(", ")}`)
        }
        await buttonsAreNamed(archive, ["Close without archiving", "Cancel", "Archive"])
        await archive.getByRole("button", { name: "Close without archiving" }).click()
        await archive.waitFor({ state: "detached" })
        await card.getByText("Outcome: nothing confirmed yet", { exact: true }).waitFor()

        const leave = page.getByRole("alertdialog", { name: "Unsaved changes" })
        await card.getByRole("button", { name: "Leave page" }).click()
        await buttonsAreNamed(leave, ["Close", "Stay", "Discard"])
      },
    },
    {
      name:
        "UnsavedGuard: the dialog has one Stay button, and its corner button is named Close and stays",
      pageId: "ui",
      run: async (page) => {
        const { dialog, lists, outcomeIs, focusIsOn } = await unsavedGuardWithAChange(page)
        await lists.click()
        await buttonsAreNamed(dialog, ["Close", "Stay", "Leave"])
        await dialog.getByRole("button", { name: "Close", exact: true }).click()
        await dialog.waitFor({ state: "detached" })
        await focusIsOn(lists)
        await outcomeIs("nothing yet")
      },
    },
  ]
}

/** Where a coachmark spec pins the demo's target: CSS insets from the viewport's edges. */
interface CoachmarkCorner {
  name: string
  style: string
}

/** The least room, in pixels, a coachmark keeps from every edge of the viewport. */
const COACHMARK_MARGIN = 8

/** The `Coachmark` card's parts, in a window of the given size. */
async function coachmarkCard(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  const card = page.locator("#demo-Coachmark")
  const target = card.locator(`[data-e2e="coachmark-target"]`)
  const surface = card.locator("[data-coachmark-mode]")
  await card.scrollIntoViewIfNeeded()
  return {
    target,
    surface,
    toggle: card.locator(`[data-e2e="coachmark-toggle"]`),
    close: surface.getByRole("button", { name: "Close", exact: true }),
    /** Pins the target to the viewport with these insets. */
    pin: (style: string) =>
      target.evaluate(
        (element, insets) => element.setAttribute("style", `position: fixed; ${insets}`),
        style,
      ),
    /** Opens the coachmark on one side and waits until it is placed beside the target. */
    open: async (side: string) => {
      await card.locator(`[data-e2e="coachmark-placement"]`).selectOption(side)
      // Dispatched, not clicked: a pinned target may cover the button.
      await card.locator(`[data-e2e="coachmark-toggle"]`).dispatchEvent("click")
      await surface.and(page.locator(`:popover-open:not([data-coachmark-mode="sheet"])`)).waitFor()
    },
    /** Waits until the coachmark is closed. */
    closed: () => surface.and(page.locator(":popover-open")).waitFor({ state: "detached" }),
  }
}

/** Two boxes as text, for a failure message. */
async function describeBoxes(surface: Locator, target: Locator): Promise<string> {
  const text = (box: { x: number; y: number; width: number; height: number } | null) =>
    box === null ? "no box" : `x ${Math.round(box.x)} to ${Math.round(box.x + box.width)}, ` +
      `y ${Math.round(box.y)} to ${Math.round(box.y + box.height)}`
  return `coachmark ${text(await surface.boundingBox())}, target ${
    text(await target.boundingBox())
  }`
}

/**
 * A `Coachmark` beside a target pinned near an edge of the viewport, on each side in turn: the
 * whole surface is inside the viewport with a margin, it does not cover its target, and a real
 * click on × closes it. In every case here the asked side or the opposite one has room.
 *
 * @param width The viewport's width.
 * @param height The viewport's height.
 * @param corners Where the target is pinned, one case per corner and side.
 */
function coachmarkInViewportSpec(
  width: number,
  height: number,
  corners: readonly CoachmarkCorner[],
): Spec {
  return {
    name: `Coachmark: in a ${width}x${height} window, beside a target near the ` +
      `${corners.map((corner) => corner.name).join(", ")}, on every side, the whole coachmark ` +
      `is inside the window and off its target, and × can be clicked`,
    pageId: "ui",
    run: async (page) => {
      const { target, surface, close, pin, open, closed } = await coachmarkCard(page, width, height)
      const wrong: string[] = []
      const seen: string[] = []
      for (const corner of corners) {
        for (const side of ["right", "bottom", "left", "top"]) {
          const at = `${corner.name}, ${side}`
          await pin(corner.style)
          await open(side)
          // A trial click waits until the button has stopped moving and can take a click.
          const reachable = await close.click({ trial: true, timeout: 3000 }).then(
            () => true,
            () => false,
          )
          const box = await surface.boundingBox()
          const on = await target.boundingBox()
          if (box === null || on === null) throw new Error(`${at}: a box is missing`)
          const inside = box.x >= COACHMARK_MARGIN && box.y >= COACHMARK_MARGIN &&
            box.x + box.width <= width - COACHMARK_MARGIN &&
            box.y + box.height <= height - COACHMARK_MARGIN
          const covers = box.x < on.x + on.width && box.x + box.width > on.x &&
            box.y < on.y + on.height && box.y + box.height > on.y
          const where = `x ${Math.round(box.x)} to ${Math.round(box.x + box.width)}, ` +
            `y ${Math.round(box.y)} to ${Math.round(box.y + box.height)}`
          seen.push(`${at}: ${where}`)
          if (!inside) wrong.push(`${at}: outside the window, ${where}`)
          if (covers) wrong.push(`${at}: over its target, ${where}`)
          if (!reachable) wrong.push(`${at}: × cannot be clicked`)
          if (reachable) await close.click()
          else await page.keyboard.press("Escape")
          await closed()
        }
      }
      if (wrong.length > 0) throw new Error(wrong.join("; "))
      return seen.join("; ")
    },
  }
}

/** What {@link coachmarkSpecs}' scroll trace counts, one sample per drawn frame. */
interface ScrollTrace {
  /** Frames with the coachmark below its target, above it, and drawn as a sheet. */
  below: number
  above: number
  sheet: number
  /** Frames with the coachmark outside the window, or over its target while a side had room. */
  wrong: string[]
}

/**
 * The `Tour` card's parts, in a 1280x900 window unless told otherwise, with the tour started by
 * Enter on Start.
 */
async function startedTour(page: Page, width = 1280, height = 900) {
  await page.setViewportSize({ width, height })
  const card = page.locator("#demo-Tour")
  const step = card.locator("[data-coachmark-mode]")
  const start = card.locator(`[data-e2e="tour-start"]`)
  await start.press("Enter")
  await step.and(page.locator(":popover-open")).getByRole("heading", { name: "Search everything" })
    .waitFor()
  return {
    step,
    search: card.locator(`[data-e2e="tour-search"]`),
    newProject: card.locator(`[data-e2e="tour-new"]`),
    help: card.locator(`[data-e2e="tour-help"]`),
    helpCompact: card.locator(`[data-e2e="tour-help-compact"]`),
    next: step.getByRole("button", { name: "Next", exact: true }),
    skip: step.getByRole("button", { name: "Skip tour", exact: true }),
  }
}

/** `Coachmark` and `Tour`: where the step is drawn while the page, its target or its text change. */
function coachmarkSpecs(): Spec[] {
  return [
    coachmarkInViewportSpec(1280, 900, [
      { name: "top left", style: "top: 12px; left: 12px" },
      { name: "top right", style: "top: 12px; right: 12px" },
      { name: "bottom left", style: "bottom: 12px; left: 12px" },
      { name: "bottom right", style: "bottom: 12px; right: 12px" },
    ]),
    coachmarkInViewportSpec(700, 900, [{ name: "right edge", style: "top: 120px; right: 12px" }]),
    {
      name: "Coachmark: while the page scrolls its target out through the top edge, back and out " +
        "through the bottom edge, no frame shows the coachmark outside the window, off the centre " +
        "of its target, or over its target while a side has room",
      pageId: "ui",
      run: async (page) => {
        const { target, open } = await coachmarkCard(page, 1280, 900)
        await target.evaluate((element) =>
          element.scrollIntoView({ block: "center", behavior: "instant" })
        )
        await open("bottom")
        const trace = await page.evaluate((margin) =>
          new Promise<ScrollTrace>((resolve) => {
            const card = document.querySelector("#demo-Coachmark")!
            const surface = card.querySelector<HTMLElement>("[data-coachmark-mode]")!
            const target = card.querySelector(`[data-e2e="coachmark-target"]`)!
            // 30 px a frame: 900 px down, 1800 px up, 900 px down again.
            const steps = [...Array(30).fill(30), ...Array(60).fill(-30), ...Array(30).fill(30)]
            const trace: ScrollTrace = { below: 0, above: 0, sheet: 0, wrong: [] }
            let frame = 0
            const tick = () => {
              // A task after the frame's own callbacks: what this frame draws.
              setTimeout(() => {
                const box = surface.getBoundingClientRect()
                const on = target.getBoundingClientRect()
                const bottom = innerHeight - margin
                if (surface.dataset.coachmarkMode === "sheet") trace.sheet++
                else {
                  if (box.top >= on.bottom) trace.below++
                  if (box.bottom <= on.top) trace.above++
                  const outside = box.top < margin || box.bottom > bottom || box.left < margin ||
                    box.right > document.documentElement.clientWidth - margin
                  const room = on.top - margin - box.height >= margin ||
                    on.bottom + margin + box.height <= bottom
                  const covers = box.top < on.bottom && box.bottom > on.top
                  // The target is in the middle of the window, so nothing shifts the coachmark.
                  const aside = Math.abs(box.left + box.right - on.left - on.right) > 2
                  if (outside || aside || (covers && room)) {
                    const what = outside
                      ? "outside the window"
                      : aside
                      ? "off the centre of its target"
                      : "over its target"
                    trace.wrong.push(
                      `frame ${frame}: ${what}, coachmark x ${Math.round(box.left)} to ` +
                        `${Math.round(box.right)}, y ${Math.round(box.top)} to ` +
                        `${Math.round(box.bottom)}, target x ${Math.round(on.left)} to ` +
                        `${Math.round(on.right)}, y ${Math.round(on.top)} to ${
                          Math.round(on.bottom)
                        }`,
                    )
                  }
                }
                if (frame === steps.length) return resolve(trace)
                // Between frames, as a wheel does: the next frame is drawn after this scroll.
                scrollBy({ top: steps[frame++], behavior: "instant" })
                requestAnimationFrame(tick)
              }, 0)
            }
            requestAnimationFrame(tick)
          }), COACHMARK_MARGIN)
        await page.keyboard.press("Escape")
        const counts = `${trace.below} frames below the target, ${trace.above} above it, ` +
          `${trace.sheet} as a sheet`
        if (trace.wrong.length > 0) {
          throw new Error(`${trace.wrong.length} frames: ${trace.wrong.slice(0, 6).join("; ")}`)
        }
        if (trace.below === 0 || trace.above === 0 || trace.sheet === 0) {
          throw new Error(`the scroll did not show every case: ${counts}`)
        }
        return counts
      },
    },
    {
      name: "Coachmark: a target that moves from a corner to the middle of the window, with no " +
        "scroll and no resize, takes the coachmark with it",
      pageId: "ui",
      run: async (page) => {
        const { target, surface, pin, open } = await coachmarkCard(page, 1280, 900)
        await pin("top: 12px; left: 12px")
        await open("bottom")
        await pin("top: 400px; left: 600px")
        await page.waitForFunction((gap) => {
          const card = document.querySelector("#demo-Coachmark")!
          const box = card.querySelector("[data-coachmark-mode]")!.getBoundingClientRect()
          const on = card.querySelector(`[data-e2e="coachmark-target"]`)!.getBoundingClientRect()
          return on.top === 400 && Math.abs(box.top - on.bottom - gap) <= 1 &&
            Math.abs(box.left + box.width / 2 - on.left - on.width / 2) <= 1
        }, COACHMARK_MARGIN).catch(async () => {
          throw new Error(`not below its target: ${await describeBoxes(surface, target)}`)
        })
        return describeBoxes(surface, target)
      },
    },
    {
      name: "Coachmark: a coachmark that grows by 200 px beside a target in the bottom left " +
        "corner stays inside the window",
      pageId: "ui",
      run: async (page) => {
        const { target, surface, pin, open } = await coachmarkCard(page, 1280, 900)
        await pin("bottom: 12px; left: 12px")
        await open("right")
        const before = await surface.boundingBox()
        if (before === null) throw new Error("the coachmark has no box")
        await surface.locator(`[id$="-body"]`).evaluate((body) => {
          body.style.paddingBottom = "200px"
        })
        await page.waitForFunction(({ height, margin }) => {
          const box = document.querySelector("#demo-Coachmark [data-coachmark-mode]")!
            .getBoundingClientRect()
          return box.height >= height + 200 && box.top >= margin &&
            box.bottom <= innerHeight - margin
        }, { height: before.height, margin: COACHMARK_MARGIN }).catch(async () => {
          throw new Error(
            `${Math.round(before.height)} px tall before; after 200 px more: ` +
              await describeBoxes(surface, target),
          )
        })
        return describeBoxes(surface, target)
      },
    },
    {
      name: "Coachmark: a ref target gets the hint on its right; × closes it and focus goes " +
        "back to its opener",
      pageId: "ui",
      run: async (page) => {
        const { target, surface, toggle, close, closed } = await coachmarkCard(page, 1280, 800)
        await toggle.press("Enter")
        await surface.and(page.locator(`:popover-open:not([data-coachmark-mode="sheet"])`))
          .waitFor()
        await page.waitForFunction((gap) => {
          const card = document.querySelector("#demo-Coachmark")!
          const box = card.querySelector("[data-coachmark-mode]")!.getBoundingClientRect()
          const on = card.querySelector(`[data-e2e="coachmark-target"]`)!.getBoundingClientRect()
          return Math.abs(box.left - on.right - gap) <= 1
        }, COACHMARK_MARGIN).catch(async () => {
          throw new Error(`not on its right: ${await describeBoxes(surface, target)}`)
        })
        const where = await describeBoxes(surface, target)
        await close.press("Enter")
        await closed()
        await toggle.and(page.locator(":focus")).waitFor()
        return where
      },
    },
    {
      name: "Tour: Start opens the first step below its target, centred on it, with focus on " +
        "its heading",
      pageId: "ui",
      run: async (page) => {
        const { step, search, skip } = await startedTour(page)
        await step.and(page.locator(`:not([data-coachmark-mode="sheet"])`)).waitFor()
        await step.getByRole("heading", { name: "Search everything" }).and(page.locator(":focus"))
          .waitFor()
        await step.getByText("Step 1 of 4", { exact: true }).waitFor()
        await page.waitForFunction((gap) => {
          const card = document.querySelector("#demo-Tour")!
          const box = card.querySelector("[data-coachmark-mode]")!.getBoundingClientRect()
          const on = card.querySelector(`[data-e2e="tour-search"]`)!.getBoundingClientRect()
          return Math.abs(box.top - on.bottom - gap) <= 1 &&
            Math.abs(box.left + box.width / 2 - on.left - on.width / 2) <= 1
        }, COACHMARK_MARGIN).catch(async () => {
          throw new Error(`not below its target: ${await describeBoxes(step, search)}`)
        })
        const where = await describeBoxes(step, search)
        await skip.click()
        return where
      },
    },
    {
      name: "Tour: the step's target gets an outline and the step's text as a description " +
        "after the app's own, and keeps the app's anchor-name as it is",
      pageId: "ui",
      run: async (page) => {
        const { step, search, skip } = await startedTour(page)
        const bodyId = await step.locator(`[id$="-body"]`).getAttribute("id")
        const read = await search.evaluate((element) => ({
          describedBy: element.getAttribute("aria-describedby"),
          anchorName: element.style.getPropertyValue("anchor-name"),
          outline: `${getComputedStyle(element).outlineStyle} ${
            getComputedStyle(element).outlineWidth
          }`,
        }))
        const found = JSON.stringify(read)
        if (
          bodyId === null || read.describedBy !== `tour-search-hint ${bodyId}` ||
          read.anchorName !== "--demo-search" || read.outline !== "solid 2px"
        ) throw new Error(`${found}, the step's text is #${bodyId}`)
        await skip.click()
        return found
      },
    },
    {
      name: "Tour: on a scrolled page, Next from the first step draws the second step inside " +
        "the window, beside its target, and its Next takes a mouse click",
      pageId: "ui",
      run: async (page) => {
        const { step, newProject, next, skip } = await startedTour(page)
        const scrolled = await page.evaluate(() => Math.round(scrollY))
        if (scrolled < 900) throw new Error(`the page is scrolled by only ${scrolled} px`)
        await next.click()
        await step.getByRole("heading", { name: "Start a project" }).waitFor()
        const reachable = await next.click({ trial: true, timeout: 3000 }).then(
          () => true,
          () => false,
        )
        const where = `${await describeBoxes(step, newProject)}, page scrolled ${scrolled} px`
        const box = await step.boundingBox()
        const on = await newProject.boundingBox()
        if (box === null || on === null) throw new Error("a box is missing")
        const inside = box.x >= COACHMARK_MARGIN && box.y >= COACHMARK_MARGIN &&
          box.x + box.width <= 1280 - COACHMARK_MARGIN &&
          box.y + box.height <= 900 - COACHMARK_MARGIN
        const beside = box.x >= on.x + on.width || box.x + box.width <= on.x
        if (!inside || !beside || !reachable) {
          throw new Error(
            `inside the window ${inside}, beside its target ${beside}, Next can be clicked ` +
              `${reachable}: ${where}`,
          )
        }
        await next.click()
        await step.getByRole("heading", { name: "A step with no target" }).waitFor()
        await skip.click()
        return where
      },
    },
    ...[390, 700].map((width): Spec => ({
      name: `Tour: in a ${width} px wide window, a step whose selector matches a hidden and a ` +
        "visible control outlines the visible one and describes it",
      pageId: "ui",
      run: async (page) => {
        const { step, help, helpCompact, next, skip } = await startedTour(page, width, 800)
        for (const title of ["Start a project", "A step with no target", "Ask for help"]) {
          await next.click()
          await step.getByRole("heading", { name: title }).waitFor()
        }
        // The first match in the page is the wide screen's button, which is not drawn here.
        await help.waitFor({ state: "hidden" })
        const bodyId = await step.locator(`[id$="-body"]`).getAttribute("id")
        const outlined = page.locator(`[style*="outline"][aria-describedby="${bodyId}"]`)
        await helpCompact.and(outlined).waitFor().catch(async () => {
          const found = await page.locator("#demo-Tour [data-tour]").evaluateAll((elements) =>
            elements.map((element) =>
              `${element.getAttribute("data-e2e")}: outline "${
                (element as HTMLElement).style.outline
              }", described by ${element.getAttribute("aria-describedby")}`
            ).join("; ")
          )
          throw new Error(`the visible Help button is not the step's target: ${found}`)
        })
        // Below 640 px every step is a sheet; above it this one must sit beside its target.
        const mode = await step.getAttribute("data-coachmark-mode")
        if (width >= 640) {
          await step.and(page.locator(`:not([data-coachmark-mode="sheet"])`)).waitFor()
        }
        await step.getByRole("button", { name: "Go to Help", exact: true }).click()
        await helpCompact.and(page.locator(":focus")).waitFor()
        await skip.click()
        return `the step is drawn as ${mode}`
      },
    })),
    {
      name: "Tour: a step whose only shown match is under visibility: hidden outlines nothing, " +
        "offers no Go to and is a sheet",
      pageId: "ui",
      run: async (page) => {
        const { step, help, next, skip } = await startedTour(page)
        await help.evaluate((element) => element.style.visibility = "hidden")
        for (const title of ["Start a project", "A step with no target", "Ask for help"]) {
          await next.click()
          await step.getByRole("heading", { name: title }).waitFor()
        }
        await step.and(page.locator(`[data-coachmark-mode="sheet"]`)).waitFor()
        const read = await help.evaluate((element) => ({
          outline: element.style.outline,
          describedBy: element.getAttribute("aria-describedby"),
        }))
        const goTo = await step.getByRole("button", { name: /^Go to/ }).count()
        const found = `${JSON.stringify(read)}, Go to buttons ${goTo}`
        if (read.outline !== "" || read.describedBy !== null || goTo !== 0) throw new Error(found)
        await skip.click()
        return found
      },
    },
  ]
}

/** `OnboardingChecklist`: what an app reaches through its ports. */
const onboardingChecklistSpecs: readonly Spec[] = [
  {
    name: "OnboardingChecklist: headingRef points at the heading, so after Dismiss and Show " +
      "again the demo puts focus on Get started",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-OnboardingChecklist")
      await card.getByRole("button", { name: "Dismiss", exact: true }).press("Enter")
      const showAgain = card.locator(`[data-e2e="onboarding-show-again"]`)
      await showAgain.and(page.locator(":focus")).waitFor()
      await showAgain.press("Enter")
      await card.getByRole("heading", { name: "Get started", exact: true })
        .and(page.locator(":focus")).waitFor()
    },
  },
]

/** Throws with each violation's rule and targets when axe finds any in the given areas. */
async function axePasses(page: Page, selectors: readonly string[]): Promise<string> {
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

/** `tokens.css`'s `--color-canvas`: the light value on `:root`, the dark one on `.dark`. */
const CANVAS = { light: "oklch(0.967 0.003 264.542)", dark: "oklch(0.21 0.034 264.665)" }

/**
 * `ThemePreview`: native radios switch the frame's palette, and the page around it keeps its own.
 * Each spec runs on the guide in both of its own palettes, so a light frame on a dark page and a
 * dark frame on a light page are both drawn.
 */
function themePreviewSpecs(): Spec[] {
  const card = (page: Page) => page.locator("#demo-ThemePreview")
  const radio = (page: Page, name: string, checked: boolean) =>
    card(page).getByRole("group", { name: "Theme" }).getByRole("radio", { name, checked })
  const frame = (page: Page) => card(page).locator("[data-preview-frame]")
  /** The frame's canvas and colour scheme, and the card's own background around it. */
  const read = (page: Page) =>
    frame(page).evaluate((element) => ({
      frame: getComputedStyle(element).backgroundColor,
      scheme: getComputedStyle(element).colorScheme,
      page: getComputedStyle(element.closest("#demo-ThemePreview") ?? document.body)
        .backgroundColor,
    }))
  return (["light", "dark"] as const).flatMap((colorScheme): Spec[] => [
    {
      name:
        `ThemePreview on a ${colorScheme} page: starts dark, Tab reaches the checked radio and an arrow key turns only the frame light`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await radio(page, "Dark", true).waitFor()
        const before = await read(page)
        if (before.frame !== CANVAS.dark || before.scheme !== "dark") {
          throw new Error(`dark frame drew ${JSON.stringify(before)}`)
        }

        // Clicking the legend puts the start of Tab order there without focusing anything.
        await card(page).locator("legend").click()
        await page.keyboard.press("Tab")
        await radio(page, "Dark", true).and(page.locator(":focus")).waitFor()
        await page.keyboard.press("ArrowRight")
        await radio(page, "Light", true).and(page.locator(":focus")).waitFor()
        const after = await read(page)
        if (
          after.frame !== CANVAS.light || after.scheme !== "light" || after.page !== before.page
        ) {
          throw new Error(
            `light frame drew ${JSON.stringify(after)}, before ${JSON.stringify(before)}`,
          )
        }

        await page.keyboard.press("Tab")
        await frame(page).getByRole("button", { name: "Save" }).and(page.locator(":focus"))
          .waitFor()
        return `frame ${before.frame} → ${after.frame}; around it ${after.page} both times`
      },
    },
    {
      name:
        `ThemePreview on a ${colorScheme} page: dark: utilities and the preset's dark rules follow the frame, not the page`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        // Save's `dark:bg-accent-600` and the checkbox's `@variant dark { color-scheme: dark }`.
        const look = () =>
          frame(page).evaluate(async (element) => {
            // Button fades its colours; read them once the fade has ended.
            const save = element.querySelector("button")!
            await Promise.all(save.getAnimations().map((animation) => animation.finished))
            return {
              save: getComputedStyle(save).backgroundColor,
              checkbox: getComputedStyle(element.querySelector('input[type="checkbox"]')!)
                .colorScheme,
            }
          })
        await radio(page, "Dark", true).waitFor()
        const dark = await look()
        await card(page).locator("label", { hasText: "Light" }).click()
        await radio(page, "Light", true).waitFor()
        const light = await look()
        if (dark.checkbox !== "dark" || light.checkbox !== "light" || dark.save === light.save) {
          throw new Error(
            `dark frame ${JSON.stringify(dark)}, light frame ${JSON.stringify(light)}`,
          )
        }
        return `Save ${dark.save} in the dark frame, ${light.save} in the light one`
      },
    },
    ...(["Dark", "Light"] as const).map((theme): Spec => ({
      name:
        `ThemePreview on a ${colorScheme} page: axe finds no violation with ${theme} checked, text colour contrast included`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await radio(page, "Dark", true).waitFor()
        // The radio is visually hidden, so a visitor clicks its chip, the label.
        if (theme === "Light") await card(page).locator("label", { hasText: "Light" }).click()
        await radio(page, theme, true).waitFor()
        return await axePasses(page, ["#demo-ThemePreview"])
      },
    })),
  ])
}
/**
 * `RadioChips`: native radios drawn as chips. Arrow keys move the choice within one tab stop and
 * skip the disabled chip, the page's own `:has(#id:checked)` CSS follows the choice, the checked
 * chip shows the accent fill and the focus ring, and axe passes in both palettes.
 */
function radioChipsSpecs(): Spec[] {
  const card = (page: Page) => page.locator("#demo-RadioChips")
  return [
    {
      name:
        "RadioChips: arrow keys move the one checked chip within one tab stop, skip the disabled chip, page CSS follows it, and the chip shows the fill and the focus ring",
      pageId: "ui",
      run: async (page) => {
        const group = card(page).getByRole("group", { name: "Which tools the server offers" })
        const radio = (name: string, checked: boolean) =>
          group.getByRole("radio", { name, checked })
        const focused = page.locator(":focus")
        const deleteTool = card(page).locator(`[data-tool="delete"]`)
        await radio("All tools", true).waitFor()
        await deleteTool.waitFor({ state: "visible" })

        await radio("All tools", true).focus()
        await page.keyboard.press("ArrowRight")
        await radio("Read only", true).and(focused).waitFor()
        await radio("All tools", false).waitFor()
        await deleteTool.waitFor({ state: "hidden" })

        await page.keyboard.press("ArrowRight")
        await radio("All tools", true).and(focused).waitFor()
        await deleteTool.waitFor({ state: "visible" })

        // `has` is matched inside each label, so it takes a locator from the page, not the group.
        const chipOf = (name: string, checked: boolean) =>
          card(page).locator("label").filter({ has: page.getByRole("radio", { name, checked }) })
        const look = (name: string, checked: boolean) =>
          chipOf(name, checked).evaluate((label) => {
            const style = getComputedStyle(label)
            return { ring: style.boxShadow, fill: style.backgroundColor }
          })

        await page.keyboard.press("Tab")
        const left = await group.evaluate((element) => !element.contains(document.activeElement))
        if (!left) throw new Error("Tab stayed inside the group: more than one tab stop")
        const resting = await look("All tools", true)

        await page.keyboard.press("Shift+Tab")
        await radio("All tools", true).and(focused).waitFor()
        const focusedChip = await look("All tools", true)
        const unchecked = await look("Read only", false)
        if (focusedChip.ring === resting.ring || resting.fill === unchecked.fill) {
          throw new Error(
            `focused ${JSON.stringify(focusedChip)}, resting ${JSON.stringify(resting)}, ` +
              `unchecked ${JSON.stringify(unchecked)}`,
          )
        }
        return `checked fill ${resting.fill}, focus ring ${focusedChip.ring}`
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name:
        `RadioChips: axe finds no violation on the chips, text colour contrast included, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await card(page).getByRole("radio", { name: "All tools", checked: true }).waitFor()
        return await axePasses(page, ["#demo-RadioChips"])
      },
    })),
  ]
}

/**
 * `BrandMark`, `PageHero`, `FaqList`, `FeatureCard`, `Steps` and `WindowFrame`: the blocks of a
 * public page, which need no JavaScript.
 */
function marketingBlockSpecs(): Spec[] {
  const cards = [
    "#demo-BrandMark",
    "#demo-PageHero",
    "#demo-FaqList",
    "#demo-FeatureCard",
    "#demo-Steps",
    "#demo-WindowFrame",
  ] as const
  return [
    {
      name:
        "FaqList: a click on a question opens it, and opening another closes it, as one named group",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-FaqList")
        const first = card.locator("details").nth(0)
        const second = card.locator("details").nth(1)
        await first.locator("summary").click()
        await first.and(page.locator("details[open]")).waitFor()
        await second.locator("summary").click()
        await second.and(page.locator("details[open]")).waitFor()
        await first.and(page.locator("details:not([open])")).waitFor()
      },
    },
    {
      name: "WindowFrame: the terminal is dark on a light page",
      pageId: "ui",
      colorScheme: "light",
      run: async (page) => {
        const terminal = page.locator(`#demo-WindowFrame figure:has([role="group"]) > div`).first()
        await terminal.waitFor()
        const luminance = await terminal.evaluate((node) => {
          const canvas = document.createElement("canvas")
          canvas.width = canvas.height = 1
          const context = canvas.getContext("2d")!
          context.fillStyle = getComputedStyle(node).backgroundColor
          context.fillRect(0, 0, 1, 1)
          const [r, g, b] = context.getImageData(0, 0, 1, 1).data
          const channel = (value: number) => {
            const c = value / 255
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        })
        if (luminance > 0.05) throw new Error(`terminal background luminance ${luminance}`)
      },
    },
    scrollRegionSpec({
      what: "WindowFrame terminal",
      pageId: "ui",
      selector: `#demo-WindowFrame div[role="group"][tabindex="0"]`,
      name: "Install",
      key: "ArrowRight",
    }),
    ...(["light", "dark", "ink"] as const).map((palette): Spec => ({
      name: `BrandMark, PageHero, FaqList, FeatureCard, Steps and WindowFrame: axe finds no ` +
        `violation, their text's contrast included, ${palette}`,
      pageId: "ui",
      colorScheme: palette === "light" ? "light" : "dark",
      run: async (page) => {
        await page.locator(cards[0]).waitFor()
        if (palette === "ink") {
          // The guide bundles ink.css; it paints once `data-theme="ink"` joins `.dark` on <html>.
          await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
          await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
        }
        // The guide's dotted stage is a gradient, over which axe leaves every text's contrast
        // unmeasured. Flat, it measures the blocks' own text against the surface under them.
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        const mark = await new AxeBuilder({ page }).include(`[data-e2e="brand-mark"]`)
          .withRules(["color-contrast"]).analyze()
        if (mark.passes.length === 0 && mark.violations.length === 0) {
          throw new Error("axe did not measure the BrandMark's contrast")
        }
        return await axePasses(page, cards)
      },
    })),
  ]
}

/** The scrolling box of the guide's `ComparisonTable` card: 0 compares four products, 1 two. */
function comparisonScroller(page: Page, index: 0 | 1): Locator {
  return page.locator(`#demo-ComparisonTable [data-e2e="comparison-scroller"]`).nth(index)
}

/**
 * `ComparisonTable` on a 390 px phone (#881): a two-product table fits whole, a wider one shows a
 * shadow at its right edge until it is scrolled to the end, and its held column draws its edge.
 */
function comparisonTablePhoneSpecs(): Spec[] {
  return [
    {
      name: "ComparisonTable: at 390px a two-product table shows both product columns whole, " +
        "with nothing to scroll",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const box = comparisonScroller(page, 1)
        await box.scrollIntoViewIfNeeded()
        const fit = await box.evaluate((node) => {
          const right = node.getBoundingClientRect().right
          return {
            overflow: node.scrollWidth - node.clientWidth,
            past: [...node.querySelectorAll("thead th")].map((cell) =>
              Math.round(cell.getBoundingClientRect().right - right)
            ),
          }
        })
        if (fit.past.length !== 3) throw new Error(`${fit.past.length} column headers, expected 3`)
        if (fit.overflow > 0 || fit.past.some((past) => past > 0)) {
          throw new Error(
            `the box overflows by ${fit.overflow}px; headers end ${fit.past.join(", ")}px past it`,
          )
        }
        return `headers end ${fit.past.join(", ")}px from the box's right edge`
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name: `ComparisonTable: at 390px a table too wide to fit shows a shadow at its right edge ` +
        `until it is scrolled to the end, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const box = comparisonScroller(page, 0)
        await box.scrollIntoViewIfNeeded()
        // The values are hidden, so the strip shows only what the box paints behind the cells.
        const room = await box.evaluate((node) => {
          for (const value of node.querySelectorAll<HTMLElement>("td > *")) {
            value.style.visibility = "hidden"
          }
          return node.scrollWidth - node.clientWidth
        })
        if (room <= 0) throw new Error("the table fits, so the spec proves nothing")
        const strip = async () => {
          const outer = await box.boundingBox()
          const body = await box.locator("tbody").boundingBox()
          if (outer === null || body === null) throw new Error("the table has no box")
          return page.screenshot({
            animations: "disabled",
            clip: { x: outer.x + outer.width - 8, y: body.y + 4, width: 6, height: 24 },
          })
        }
        const atRest = await strip()
        const short = await box.evaluate((node) => {
          node.scrollLeft = node.scrollWidth
          return node.scrollWidth - node.clientWidth - node.scrollLeft
        })
        if (short > 1) throw new Error(`the box stopped ${short}px before its end`)
        const atEnd = await strip()
        if (atRest.equals(atEnd)) {
          throw new Error("the right edge looks the same with more to the right and at the end")
        }
      },
    })),
    ...(["light", "dark", "ink"] as const).map((palette): Spec => ({
      name: `ComparisonTable: the last product's header paints one colour to its right end, with ` +
        `no band cut out of it, ${palette}`,
      pageId: "ui",
      colorScheme: palette === "light" ? "light" : "dark",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        if (palette === "ink") {
          await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
          await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
        }
        // The two-product table fits, so no shadow is drawn and the header's ground is all there is.
        const header = comparisonScroller(page, 1).locator("thead th").last()
        await header.scrollIntoViewIfNeeded()
        await header.evaluate((cell) => (cell as HTMLElement).style.color = "transparent")
        const box = await header.boundingBox()
        if (box === null) throw new Error("the last product's header has no box")
        const strip = (x: number) =>
          page.screenshot({
            animations: "disabled",
            clip: { x, y: box.y + box.height / 2 - 4, width: 4, height: 8 },
          })
        const start = await strip(box.x + 2)
        const end = await strip(box.x + box.width - 8)
        if (!start.equals(end)) {
          throw new Error("the header's right end is painted another colour than its start")
        }
      },
    })),
    {
      name: "ComparisonTable: at 390px every cell of the held first column draws its right edge",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const edges = await comparisonScroller(page, 0).evaluate((node) =>
          [...node.querySelectorAll("tr > th:first-child")].map((cell) => {
            const style = getComputedStyle(cell)
            return `${style.borderRightStyle} ${style.borderRightWidth}`
          })
        )
        if (edges.length < 2 || edges.some((edge) => edge !== "solid 1px")) {
          throw new Error(`right edges: ${edges.join(", ")}`)
        }
      },
    },
  ]
}

/**
 * `ZoomableImages` opens the file an image names in `data-lightbox-src`, and an image without the
 * attribute still opens its own `src`: both pressed with a real click on the guide's card.
 */
const zoomableCropSpec: Spec = {
  name: "ZoomableImages: a crop with data-lightbox-src is named after its full file, and " +
    "pressing it opens that file and its alt, while a plain image still opens itself",
  pageId: "ui",
  run: async (page) => {
    const card = page.locator("#demo-ZoomableImages")
    const dialog = card.locator("dialog").and(page.locator(":modal"))
    const shown = dialog.locator("img")
    const crop = card.locator(`[data-e2e="lightbox-crop"]`)
    const plain = card.locator(`[data-e2e="lightbox-image"]`)
    const full = await crop.getAttribute("data-lightbox-src")
    const own = await plain.getAttribute("src")
    if (!full || !own) throw new Error("the card has no crop with a full file, or no plain image")

    await crop.and(page.getByRole("button", { name: "Zoom: A placeholder screen, in full" }))
      .waitFor()
    await crop.click()
    await shown.and(page.locator(`[alt="A placeholder screen, in full"]`)).waitFor()
    const opened = await shown.getAttribute("src")
    if (opened !== full) {
      throw new Error(`the crop opened ${opened?.slice(0, 60)}, not its full file`)
    }

    await page.keyboard.press("Escape")
    await dialog.waitFor({ state: "detached" })
    await plain.click()
    await shown.and(page.locator(`[alt="A placeholder image"]`)).waitFor()
    const plainOpened = await shown.getAttribute("src")
    if (plainOpened !== own) throw new Error("the plain image did not open its own src")
  },
}

/**
 * A highlighted danger `DropdownItem` keeps its text at 4.5:1, in each palette: the row under the
 * pointer, then the row with keyboard focus, each checked by axe's colour-contrast rule.
 */
function dangerItemContrastSpecs(): Spec[] {
  return (["light", "dark"] as const).map((colorScheme) => ({
    name: `DropdownItem danger in the ${colorScheme} palette: its text passes axe's contrast ` +
      "check while the row is hovered and while it has focus",
    pageId: "ui",
    colorScheme,
    run: async (page: Page) => {
      const item = page.locator(`[data-e2e="dropdown-item-danger"]`)
      const contrast = async (state: string) => {
        const { violations } = await new AxeBuilder({ page })
          .include(`[data-e2e="dropdown-item-danger"]`)
          .withRules(["color-contrast"])
          .analyze()
        if (violations.length > 0) {
          const nodes = violations.flatMap(({ nodes }) => nodes.map((node) => node.failureSummary))
          throw new Error(`${state}: ${nodes.join("; ")}`)
        }
      }
      await item.hover()
      await contrast("hovered")
      await page.mouse.move(0, 0)
      await item.focus()
      await item.and(page.locator(":focus")).waitFor()
      await contrast("focused")
    },
  }))
}

/** A field in the Modal card's form dialog that opens a popup, and how a spec opens it. */
interface PopupField {
  /** The component, in the spec's name. */
  name: string
  /** The popup, in the spec's name. */
  popup: string
  /** The control whose `aria-expanded` says whether the popup is open. */
  control: (dialog: Locator) => Locator
  /** Opens the popup from the keyboard, leaving focus inside the field. */
  open: (control: Locator) => Promise<void>
}

const popupFields: readonly PopupField[] = [
  {
    name: "Combobox",
    popup: "list",
    control: (dialog) => dialog.getByRole("combobox", { name: "City" }),
    open: async (control) => {
      await control.focus()
      await control.press("ArrowDown")
    },
  },
  {
    name: "TagInput",
    popup: "suggestion list",
    control: (dialog) => dialog.getByRole("combobox", { name: "Tags" }),
    open: async (control) => {
      await control.focus()
      await control.press("ArrowDown")
    },
  },
  {
    name: "DateRangePicker",
    popup: "panel",
    control: (dialog) => dialog.locator(`button[data-e2e="guide-modal-form-dates"]`),
    // A click, as a person opens it; the picker then moves focus into its panel.
    open: (control) => control.click(),
  },
]

/**
 * Inside a `Modal`, the first Escape closes only the field's popup and the dialog with its form
 * stays open; the second Escape closes the dialog. One spec per field of the Modal card's form
 * dialog, each pressing the real key.
 */
function escapeInsideModalSpecs(): Spec[] {
  return popupFields.map((field) => ({
    name: `${field.name} inside a Modal: the first Escape closes only its ${field.popup}, ` +
      "the second closes the dialog",
    pageId: "ui",
    run: async (page: Page) => {
      await page.locator(`#demo-Modal [data-e2e="modal-form-open"]`).click()
      const dialog = page.locator(`dialog[data-e2e="guide-modal-form"]`)
      await dialog.waitFor()
      const control = field.control(dialog)
      await field.open(control)
      await control.and(page.locator(`[aria-expanded="true"]`)).waitFor()

      await page.keyboard.press("Escape")
      await control.and(page.locator(`[aria-expanded="false"]`)).waitFor()
      if (!await dialog.evaluate((element) => element.matches(":modal"))) {
        throw new Error(`the first Escape closed the dialog along with the ${field.popup}`)
      }

      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "detached" })
    },
  }))
}

/**
 * Presses inside a field of an open dialog, releases on the backdrop, and throws when that closed
 * the dialog: the slipped mouse at the end of a text selection.
 *
 * @param page The page.
 * @param dialog The open `<dialog>`.
 * @param field Where the press begins.
 * @returns The backdrop point the press was released on, halfway between the viewport's left edge
 * and the panel's.
 */
async function dragToBackdrop(page: Page, dialog: Locator, field: Locator) {
  const box = await dialog.boundingBox()
  const start = await field.boundingBox()
  if (!box || !start) throw new Error("the dialog or its field has no box")
  if (box.x < 8) throw new Error(`the panel starts at x=${box.x}, leaving no backdrop`)
  const outside = { x: box.x / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x + 8, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(outside.x, outside.y, { steps: 5 })
  await page.mouse.up()
  const open = await dialog.evaluate((element) => element.matches(":modal"), undefined, {
    timeout: 1_000,
  }).catch(() => false)
  if (!open) {
    throw new Error("a press that began in the field and ended on the backdrop closed the dialog")
  }
  return outside
}

/**
 * What a person typed survives a slipped mouse, a failed submit and a Tab away (#853): a drag that
 * only ends on a `Modal`'s or a `CommandPalette`'s backdrop, an `EnhancedForm` that fails behind its `sending` slot, a
 * `Combobox` left with a query, and a `MoneyInput` whose amount changes from outside.
 */
function lostInputSpecs(): Spec[] {
  return [
    {
      name:
        "Modal: a drag from an input to the backdrop keeps the dialog open; a plain backdrop click closes it",
      pageId: "ui",
      run: async (page) => {
        await page.locator(`#demo-Modal [data-e2e="modal-form-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="guide-modal-form"]`)
        await dialog.waitFor()
        const tags = dialog.getByRole("combobox", { name: "Tags" })
        const outside = await dragToBackdrop(page, dialog, tags)
        await page.mouse.click(outside.x, outside.y)
        await dialog.waitFor({ state: "detached" })
      },
    },
    {
      name:
        "CommandPalette: a drag from its field to the backdrop keeps it open; a plain backdrop click closes it",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.locator(`#demo-CommandPalette [data-e2e="palette-local-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="palette-local"]`)
        await dialog.waitFor()
        const outside = await dragToBackdrop(page, dialog, dialog.getByRole("combobox"))
        await page.mouse.click(outside.x, outside.y)
        await dialog.waitFor({ state: "hidden" })
      },
    },
    {
      name: "EnhancedForm: a failed submit with a sending slot gives back the typed note, enabled",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator(`#demo-EnhancedForm [data-e2e="enhanced-form"]`)
        const note = card.locator("#guide-enhanced-form-note")
        await card.locator(`[data-e2e="enhanced-form-fail-toggle"]`).check()
        await note.fill("Typed before the failure")
        await card.getByRole("button", { name: "Submit", exact: true }).click()
        // The sending slot shows for 200 ms, too short to wait for reliably under load; the
        // fields it hides are what this reads back.
        await card.getByText("Something went wrong. Please try again.", { exact: true }).waitFor()
        await note.and(page.locator(":enabled")).waitFor()
        const kept = await note.inputValue()
        if (kept !== "Typed before the failure") throw new Error(`the note reads "${kept}"`)
      },
    },
    {
      name:
        "Combobox: Tab out with a typed query shows only the selected value and no empty message",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Combobox")
        const coin = card.locator("#guide-combobox-coin")
        await coin.click()
        await coin.pressSequentially("zzz")
        await card.getByText("No coin matches “zzz”").first().waitFor()
        await coin.press("Tab")
        await coin.and(page.locator(`[aria-expanded="false"]`)).waitFor()
        const shown = await coin.inputValue()
        if (shown !== "BTC") throw new Error(`the closed field reads "${shown}", not "BTC"`)
        const left = await card.getByText("No coin matches", { exact: false }).count()
        if (left > 0) throw new Error(`${left} elements still say "No coin matches" after Tab`)
      },
    },
    {
      name:
        "MoneyInput: an amount changed from outside while the field is not focused updates its text",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-MoneyInput")
        const price = card.locator("#guide-money-input")
        const before = await price.inputValue()
        if (before !== "19,99") throw new Error(`the field starts at "${before}", not "19,99"`)
        await card.locator(`[data-e2e="money-input-add-five"]`).click()
        await card.getByText("amount: 2499", { exact: true }).waitFor()
        const shown = await price.inputValue()
        if (shown !== "24,99") throw new Error(`the field reads "${shown}", not "24,99"`)
      },
    },
  ]
}

/** The ring a focused element draws, and the colours around it, read in the browser. */
interface DrawnRing {
  /** The element's computed `box-shadow`. */
  shadow: string
  /** What `--color-ring` resolves to beside the element. */
  ring: string
  /** What `--color-focus-offset` resolves to there: the band between the element and the ring. */
  offset: string
  /** The first opaque background behind the element: what the ring is drawn against outside. */
  behind: string
  /** Contrast of the ring against `offset`, and against `behind`. */
  againstOffset: number
  againstBehind: number
}

/**
 * Read the ring `ring-2 ring-focus ring-offset-2 ring-offset-focus` draws on an element, with its
 * contrast against both colours it touches. Colours are compared as the browser paints them,
 * through a one-pixel canvas, so an `oklch()` token is measured in sRGB as it is shown.
 */
function drawnRing(element: Element): DrawnRing {
  const resolve = (property: string, value: string) => {
    const probe = document.createElement("span")
    probe.style.setProperty(property, value)
    element.after(probe)
    const resolved = getComputedStyle(probe).getPropertyValue(property)
    probe.remove()
    return resolved
  }
  const luminance = (color: string) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d")!
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    const channel = (value: number) => {
      const c = value / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const contrast = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
  }
  let behind = "rgb(255, 255, 255)"
  for (let node = element.parentElement; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
      behind = color
      break
    }
  }
  const ring = resolve("color", "var(--color-ring)")
  const offset = resolve("color", "var(--color-focus-offset)")
  return {
    shadow: getComputedStyle(element).boxShadow,
    ring,
    offset,
    behind,
    againstOffset: contrast(ring, offset),
    againstBehind: contrast(ring, behind),
  }
}

/** A secondary `Button`'s edge and fill, and how far the stronger one stands off two grounds. */
interface DrawnEdge {
  border: string
  borderWidth: string
  fill: string
  behind: string
  surface: string
  /** The better of the border and the fill against the stage the button sits on. */
  onStage: number
  /** The same against `--color-surface`, the card a button often sits on in an app. */
  onSurface: number
}

/**
 * Read a button's edge and fill and measure the stronger of the two against what is behind it and
 * against `--color-surface`. A transparent or zero-width border counts as no border. Colours go
 * through a one-pixel canvas, so an `oklch()` token is measured in sRGB as it is shown.
 */
function drawnEdge(element: Element): DrawnEdge {
  const luminance = (color: string) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d")!
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    if (a === 0) return Number.NaN
    const channel = (value: number) => {
      const c = value / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const contrast = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    const value = (light + 0.05) / (dark + 0.05)
    return Number.isNaN(value) ? 1 : value
  }
  let behind = "rgb(255, 255, 255)"
  for (let node = element.parentElement; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
      behind = color
      break
    }
  }
  const probe = document.createElement("span")
  probe.style.color = "var(--color-surface)"
  element.after(probe)
  const surface = getComputedStyle(probe).color
  probe.remove()
  const style = getComputedStyle(element)
  const border = parseFloat(style.borderTopWidth) > 0 ? style.borderTopColor : "transparent"
  const fill = style.backgroundColor
  const best = (ground: string) => Math.max(contrast(border, ground), contrast(fill, ground))
  return {
    border,
    borderWidth: style.borderTopWidth,
    fill,
    behind,
    surface,
    onStage: best(behind),
    onSurface: best(surface),
  }
}

/**
 * Specs proving the guide's secondary `Button` shows where it ends, in the light, dark and ink
 * palettes: its border or its fill stands 3:1 or more off the stage behind it and off a card's
 * surface (WCAG 1.4.11, spy4x/seed#172). axe has no rule for a control's boundary, so the spec
 * measures it.
 *
 * @returns One spec per palette.
 */
function secondaryEdgeSpecs(): Spec[] {
  return RING_PALETTES.map((palette): Spec => ({
    name: `Button secondary: its edge stands 3:1 or more off the page and a card, ${palette}`,
    pageId: "ui",
    colorScheme: palette === "light" ? "light" : "dark",
    run: async (page) => {
      if (palette === "ink") {
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
        await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
      }
      const button = page.locator(`#demo-Button button[title="secondary md"]`)
      const drawn = await button.evaluate(drawnEdge)
      const evidence = `border ${drawn.borderWidth} ${drawn.border}, fill ${drawn.fill}: ` +
        `${drawn.onStage.toFixed(2)}:1 on ${drawn.behind}, ` +
        `${drawn.onSurface.toFixed(2)}:1 on ${drawn.surface}`
      if (drawn.onStage < 3 || drawn.onSurface < 3) throw new Error(`${evidence}; wanted 3:1`)
      return evidence
    },
  }))
}

/** One element reached with Tab whose focus ring the specs below measure. */
interface RingTarget {
  /** What it is, for the spec's name. */
  what: string
  /** The viewport's width in pixels. */
  width: number
  /** Puts the keyboard focus on the element with real key presses and returns it. */
  reach: (page: Page) => Promise<Locator>
}

/** The palettes a focus ring has to hold 3:1 in. */
const RING_PALETTES = ["light", "dark", "ink"] as const

/**
 * Specs proving an element a keyboard lands on draws the components' focus ring, 2px of
 * `--color-ring` set 2px off it, at 3:1 or more against the offset band and the page behind, in
 * the light, dark and ink palettes; and that it draws no ring before the focus arrives.
 *
 * @param target The element and how a keyboard reaches it.
 * @returns One spec per palette.
 */
function focusRingSpecs(target: RingTarget): Spec[] {
  return RING_PALETTES.map((palette): Spec => ({
    name: `${target.what}, reached with Tab, draws the components' 2px focus ring at 3:1 or ` +
      `more, ${palette}`,
    pageId: "ui",
    colorScheme: palette === "light" ? "light" : "dark",
    run: async (page) => {
      await page.setViewportSize({ width: target.width, height: 800 })
      if (palette === "ink") {
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
        await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
      }
      const element = await target.reach(page)
      const drawn = await element.evaluate(drawnRing)
      const ringShadow = `${drawn.ring} 0px 0px 0px 4px`
      const offsetShadow = `${drawn.offset} 0px 0px 0px 2px`
      if (!drawn.shadow.includes(ringShadow) || !drawn.shadow.includes(offsetShadow)) {
        throw new Error(
          `focused, it draws "${drawn.shadow}"; wanted ${offsetShadow}, ${ringShadow}`,
        )
      }
      if (drawn.againstOffset < 3 || drawn.againstBehind < 3) {
        throw new Error(
          `the ring ${drawn.ring} is ${drawn.againstOffset.toFixed(2)}:1 against ${drawn.offset} ` +
            `and ${drawn.againstBehind.toFixed(2)}:1 against ${drawn.behind}; wanted 3:1`,
        )
      }
      await page.keyboard.press("Shift+Tab")
      await element.and(page.locator(":focus")).waitFor({ state: "detached" })
      const blurred = await element.evaluate((node) => getComputedStyle(node).boxShadow)
      if (blurred.includes(ringShadow)) throw new Error(`unfocused, it still draws ${blurred}`)
      return `${drawn.againstOffset.toFixed(2)}:1 and ${drawn.againstBehind.toFixed(2)}:1`
    },
  }))
}

/** The `Tabs` card's open panel: one Tab from its active tab. */
async function reachTabPanel(page: Page): Promise<Locator> {
  const card = page.locator("#demo-Tabs")
  const panel = card.getByRole("tabpanel", { name: "Overview" })
  await card.getByRole("tab", { name: "Overview" }).focus()
  await page.keyboard.press("Tab")
  await panel.and(page.locator(":focus")).waitFor()
  return panel
}

/** The `Table` card's scroll area at 390px: Shift+Tab off it and Tab back on. */
async function reachTableScroller(page: Page): Promise<Locator> {
  const region = page.locator("#demo-Table").getByRole("region", {
    name: "February transactions",
    exact: true,
  })
  await region.focus()
  await page.keyboard.press("Shift+Tab")
  await region.and(page.locator(":focus")).waitFor({ state: "detached" })
  await page.keyboard.press("Tab")
  await region.and(page.locator(":focus")).waitFor()
  return region
}

/**
 * `Tabs` and `Table` at 390px: axe finds no violation in either card, and has evaluated
 * `scrollable-region-focusable` on the table's scroll area, which is too narrow for it there; then
 * `Table` at 1440px, where the table fits: the area is no Tab stop and has no role or name.
 */
function tabsAndTableKeyboardSpecs(): Spec[] {
  return [
    scrollRegionSpec({
      what: "Table at 390px",
      pageId: "ui",
      selector: `#demo-Table [role="region"]`,
      role: "region",
      name: "February transactions",
      key: "ArrowRight",
      width: 390,
    }),
    ...focusRingSpecs({ what: "A Tabs panel", width: 1440, reach: reachTabPanel }),
    ...focusRingSpecs({
      what: "Table's scroll area at 390px",
      width: 390,
      reach: reachTableScroller,
    }),
    {
      name: "Tabs and Table at 390px: axe finds no violation, and checks the table's scroll area " +
        "is reachable by keyboard",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 800 })
        await page.locator(`#demo-Table [role="region"]`).waitFor()
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        const { violations, passes } = await new AxeBuilder({ page })
          .include("#demo-Tabs").include("#demo-Table").analyze()
        if (violations.length > 0) {
          throw new Error(
            violations.map(({ id, nodes }) =>
              `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
            ).join(" | "),
          )
        }
        const scrollable = passes.find(({ id }) => id === "scrollable-region-focusable")
        if (!scrollable?.nodes.some((node) => node.target.join(" ").length > 0)) {
          throw new Error("axe did not evaluate scrollable-region-focusable: nothing scrolls")
        }
        return `${passes.length} rules pass, scrollable-region-focusable on ` +
          `${scrollable.nodes.length} element(s)`
      },
    },
    {
      name:
        "Table at 1440px, where it fits: its scroll area is no Tab stop and has no role or name",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1440, height: 800 })
        // The demo's own frame: the card's props table sits in a scrolling box of its own.
        const frame = page.locator(`#demo-Table div:has(> table [data-e2e="ui-guide-row"])`)
        await frame.and(page.locator(":not([tabindex]):not([role]):not([aria-labelledby])"))
          .waitFor()
        const room = await frame.evaluate((node) => node.scrollWidth - node.clientWidth)
        if (room > 0) {
          throw new Error(`the table overflows by ${room}px, so the spec proves nothing`)
        }
      },
    },
  ]
}

/** The parts of the `DemoVideo` card a spec drives, with its poster scrolled into view and loaded. */
async function demoVideoCard(page: Page) {
  const card = page.locator("#demo-DemoVideo")
  const link = card.getByRole("link", { name: "Play video: A test pattern", exact: true })
  await link.scrollIntoViewIfNeeded()
  await link.locator("img").evaluate((image) =>
    new Promise<void>((resolve, reject) => {
      const poster = image as HTMLImageElement
      if (poster.complete && poster.naturalWidth > 0) return resolve()
      poster.addEventListener("load", () => resolve(), { once: true })
      poster.addEventListener("error", () => reject(new Error("the poster did not load")), {
        once: true,
      })
    })
  )
  return {
    card,
    link,
    video: card.locator("video"),
    /** Every request for one of the clip's files that this page made, by resource timing. */
    clipRequests: () =>
      page.evaluate(() =>
        performance.getEntriesByType("resource").map((entry) => entry.name)
          .filter((name) => /\/video-demo\/clip\./.test(name))
      ),
    /**
     * Waits until the video has started playing on its own, or throws after ten seconds with what
     * it is doing instead.
     */
    playing: () =>
      card.locator("video").evaluate((element) =>
        new Promise<void>((resolve, reject) => {
          const video = element as HTMLVideoElement
          const timer = setTimeout(() =>
            reject(
              new Error(
                `not playing: paused ${video.paused}, readyState ${video.readyState}, ` +
                  `currentTime ${video.currentTime}, hidden ${document.hidden}`,
              ),
            ), 10_000)
          const done = () => {
            if (video.paused) return
            clearTimeout(timer)
            resolve()
          }
          video.addEventListener("play", done)
          done()
        })
      ),
  }
}

/**
 * The `DemoVideo` card: nothing of the clip loads before the press; a click or a key plays it in
 * the poster's box, muted, with controls; focus moves to it; reduced motion stops the loop; and
 * with JavaScript off the link opens the clip file.
 */
function demoVideoSpecs(): Spec[] {
  return [
    {
      name: "DemoVideo: no video element and no request for the clip before the press; a click " +
        "plays it inline, muted, with controls, in the poster's box",
      pageId: "ui",
      run: async (page) => {
        const requested: string[] = []
        page.on("request", (request) => {
          if (/\/video-demo\/clip\./.test(request.url())) requested.push(request.url())
        })
        const { card, link, video, clipRequests, playing } = await demoVideoCard(page)
        if (await card.locator("video, source").count() > 0) {
          throw new Error("a video element exists before the press")
        }
        const early = [...requested, ...await clipRequests()]
        if (early.length > 0) throw new Error(`requested before the press: ${early.join(", ")}`)
        const before = await link.boundingBox()

        await link.click()
        await video.and(page.locator("[controls][autoplay][playsinline]")).waitFor()
        await playing()
        const state = await video.evaluate((element) => {
          const played = element as HTMLVideoElement
          return { muted: played.muted, src: played.currentSrc }
        })
        if (!state.muted) throw new Error("the clip plays with sound")
        if (!/\/video-demo\/clip\.webm$/.test(state.src)) {
          throw new Error(`the clip plays ${state.src}, not the first source`)
        }
        if (!page.url().includes("#/")) throw new Error(`the click navigated to ${page.url()}`)
        const after = await video.locator("..").boundingBox()
        if (
          before === null || after === null ||
          Math.abs(before.width - after.width) > 0.5 || Math.abs(before.height - after.height) > 0.5
        ) {
          throw new Error(
            `the box moved from ${JSON.stringify(before)} to ${JSON.stringify(after)}`,
          )
        }
        return `${requested.length} clip request(s) after the press`
      },
    },
    {
      name:
        "DemoVideo: Tab reaches the play link, Enter starts the clip and focus lands on the video",
      pageId: "ui",
      run: async (page) => {
        const { link, video, playing } = await demoVideoCard(page)
        await link.focus()
        await page.keyboard.press("Shift+Tab")
        if (await link.evaluate((element) => element === document.activeElement)) {
          throw new Error("Shift+Tab left focus on the play link")
        }
        await page.keyboard.press("Tab")
        await link.and(page.locator(":focus")).waitFor()
        await page.keyboard.press("Enter")
        await video.and(page.locator(":focus")).waitFor()
        await playing()
      },
    },
    {
      name: "DemoVideo: keyboard focus on the play link draws a ring over the poster's edge",
      pageId: "ui",
      run: async (page) => {
        const { link } = await demoVideoCard(page)
        await page.mouse.move(0, 0)
        await link.focus()
        await page.keyboard.press("Shift+Tab")
        // A strip across the left edge, inside the box, where an inset ring is drawn. Scrolled to and
        // measured before each shot, since Shift+Tab and Tab may scroll the page.
        const edge = async () => {
          await link.scrollIntoViewIfNeeded()
          const box = await link.boundingBox()
          if (box === null) throw new Error("the play link has no box")
          return page.screenshot({
            animations: "disabled",
            clip: { x: box.x, y: box.y + box.height / 2 - 8, width: 4, height: 16 },
          })
        }
        const rest = await edge()
        await page.keyboard.press("Tab")
        await link.and(page.locator(":focus-visible")).waitFor()
        const focused = await edge()
        if (rest.equals(focused)) {
          throw new Error("the poster's edge looks the same focused and at rest")
        }
      },
    },
    {
      name: "DemoVideo: Space on the play link starts the clip without scrolling the page",
      pageId: "ui",
      run: async (page) => {
        const { link, video, playing } = await demoVideoCard(page)
        await link.focus()
        const scrolled = () => page.evaluate(() => globalThis.scrollY)
        const before = await scrolled()
        await page.keyboard.press(" ")
        await video.and(page.locator(":focus")).waitFor()
        await playing()
        const after = await scrolled()
        if (Math.abs(after - before) > 1) throw new Error(`the page scrolled ${after - before}px`)
      },
    },
    ...([false, true] as const).map((reduced): Spec => ({
      name: reduced
        ? "DemoVideo: under reduced motion the clip still plays on press, but does not loop"
        : "DemoVideo: with motion allowed the card's looping clip loops",
      pageId: "ui",
      run: async (page) => {
        if (reduced) await page.emulateMedia({ reducedMotion: "reduce" })
        const { link, video, playing } = await demoVideoCard(page)
        await link.click()
        await playing()
        const loops = await video.evaluate((element) => (element as HTMLVideoElement).loop)
        if (loops === reduced) throw new Error(`loop is ${loops}`)
      },
    })),
    {
      name: "DemoVideo: a clip whose file is missing shows the error and a link to the file in " +
        "the poster's box, with focus moved to the link",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-DemoVideo")
        const link = card.getByRole("link", { name: "Play video: A missing clip", exact: true })
        await link.scrollIntoViewIfNeeded()
        const before = await link.boundingBox()
        await link.focus()
        await page.keyboard.press("Enter")
        const status = card.getByRole("status").filter({ hasText: "The video didn't load." })
        const file = status.getByRole("link", { name: "Open the video file", exact: true })
        await file.and(page.locator(":focus")).waitFor()
        const href = await file.getAttribute("href")
        if (href !== "video-demo/missing.webm") throw new Error(`the file link goes to ${href}`)
        if (await card.locator("video").count() > 0) {
          throw new Error("the failed video is still shown")
        }
        const after = await status.locator("..").boundingBox()
        if (
          before === null || after === null ||
          Math.abs(before.width - after.width) > 0.5 || Math.abs(before.height - after.height) > 0.5
        ) {
          throw new Error(
            `the box moved from ${JSON.stringify(before)} to ${JSON.stringify(after)}`,
          )
        }
        const { violations } = await new AxeBuilder({ page }).include("#demo-DemoVideo").analyze()
        if (violations.length > 0) throw new Error(violations.map(({ id }) => id).join(", "))
      },
    },
    {
      name: "DemoVideo: with JavaScript off, the play link opens the clip file",
      pageId: "ui",
      run: async (page) => {
        const session = await page.context().newCDPSession(page)
        await session.send("Emulation.setScriptExecutionDisabled", { value: true })
        await page.reload()
        const link = page.locator("#demo-DemoVideo a[aria-label='Play video: A test pattern']")
        await link.scrollIntoViewIfNeeded()
        await Promise.all([page.waitForURL(/\/video-demo\/clip\.webm$/), link.click()])
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name: `DemoVideo in the ${colorScheme} palette: axe finds nothing on the card, before and ` +
        "after the press",
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const { link, video } = await demoVideoCard(page)
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        const scan = async (state: string) => {
          const { violations } = await new AxeBuilder({ page }).include("#demo-DemoVideo")
            .analyze()
          if (violations.length > 0) {
            throw new Error(`${state}: ${violations.map(({ id }) => id).join(", ")}`)
          }
        }
        await scan("before the press")
        await link.click()
        await video.waitFor()
        await scan("after the press")
      },
    })),
  ]
}

/** The parts of the `FilterBar` card a spec drives. */
function filterBarCard(page: Page) {
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
async function axeClean(page: Page, selector: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).include(selector).analyze()
  if (violations.length > 0) {
    throw new Error(
      violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target.join(" ")).join(", ")}`)
        .join(" | "),
    )
  }
}

/** FilterBar: each control's onChange, the menus' keys, the chips' focus, the phone layout, axe. */
function filterBarSpecs(): Spec[] {
  const axeSpec = (colorScheme: "light" | "dark"): Spec => ({
    name: `FilterBar: the bar and its open Tags menu pass axe, ${colorScheme}`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      const bar = filterBarCard(page)
      await bar.tags.click()
      await bar.tagsMenu.waitFor()
      await axeClean(page, `#demo-FilterBar [role="search"]`)
    },
  })
  return [
    {
      name: "FilterBar: search, a box in the Tags menu, a toggle and the sort each reach their " +
        "onChange, and a box leaves the menu open",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.search.fill("plan")
        await bar.stateHas("q: plan ·")

        await bar.tags.click()
        const plans = bar.tagsMenu.getByRole("menuitemcheckbox", { name: "Plans" })
        await plans.click()
        await bar.stateHas("tags: design, plans (any)")
        await plans.and(page.locator(`[aria-checked="true"]`)).waitFor()
        await bar.tagsMenu.waitFor()
        await page.keyboard.press("Escape")
        await bar.tagsMenu.waitFor({ state: "hidden" })
        await bar.tags.filter({ hasText: "Tags: 2" }).waitFor()

        await bar.card.getByRole("button", { name: "Created by me" }).click()
        await bar.stateHas("mine: on")

        await bar.sort.click()
        await page.getByRole("menuitemradio", { name: "Title (A–Z)" }).click()
        await bar.stateHas("sort: title")
        await page.getByRole("menu", { name: "Sort by" }).waitFor({ state: "hidden" })
      },
    },
    {
      name: "FilterBar: the arrow keys reach the mode switch and the boxes, Space checks a box " +
        "with the menu left open, and Escape hands focus back to the trigger",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.tags.focus()
        await page.keyboard.press("Enter")
        const any = bar.tagsMenu.getByRole("menuitemradio", { name: "Any of these tags" })
        await bar.focusIsOn(any)
        await page.keyboard.press("ArrowDown")
        const all = bar.tagsMenu.getByRole("menuitemradio", { name: "All of these tags" })
        await bar.focusIsOn(all)
        await page.keyboard.press("Enter")
        await bar.stateHas("(all)")
        await bar.focusIsOn(all)
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("ArrowDown")
        const plans = bar.tagsMenu.getByRole("menuitemcheckbox", { name: "Plans" })
        await bar.focusIsOn(plans)
        await page.keyboard.press(" ")
        await bar.stateHas("tags: design, plans (all)")
        await bar.focusIsOn(plans)
        await page.keyboard.press("Escape")
        await bar.focusIsOn(bar.tags)
      },
    },
    {
      name: "FilterBar: a chip's remove button takes one filter away and focuses the next chip; " +
        "Clear filters clears the rest and focuses the search field",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.author.click()
        await page.getByRole("menuitemradio", { name: "Maya Chen" }).click()
        await bar.stateHas("author: maya")

        await bar.card.getByRole("button", { name: "Remove the Design filter" }).click()
        await bar.stateHas("tags: (none)")
        await bar.stateHas("author: maya")
        await bar.focusIsOn(bar.card.getByRole("button", { name: "Remove the Maya Chen filter" }))

        await bar.search.fill("kept")
        await bar.card.getByRole("button", { name: "Clear filters" }).click()
        await bar.stateHas("author: (anyone)")
        await bar.stateHas("q: kept ·")
        await bar.focusIsOn(bar.search)
        const chips = await bar.card.getByRole("list", { name: "Active filters" }).count()
        if (chips !== 0) throw new Error("the chips row is still drawn after Clear filters")
      },
    },
    {
      name: "FilterBar: Clear search empties the field and hands it focus",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.search.fill("welcome")
        await bar.stateHas("q: welcome ·")
        await bar.card.getByRole("button", { name: "Clear search" }).click()
        await bar.stateHas("q: (empty) ·")
        await bar.focusIsOn(bar.search)
      },
    },
    {
      name: "FilterBar at 390 px: nothing overflows the page, the controls row scrolls on its " +
        "own, and a menu opens as a sheet along the bottom of the screen",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const bar = filterBarCard(page)
        await bar.search.scrollIntoViewIfNeeded()
        const row = bar.card.locator("[data-filter-controls]")
        const widths = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }))
        if (widths.page > widths.viewport) {
          throw new Error(`the page is ${widths.page} px wide in a ${widths.viewport} px viewport`)
        }
        const scrolls = await row.evaluate((el) => el.scrollWidth > el.clientWidth)
        if (!scrolls) throw new Error("the controls row does not overflow on its own at 390 px")

        await bar.tags.click()
        await bar.tagsMenu.waitFor()
        const box = await bar.tagsMenu.boundingBox()
        const height = await page.evaluate(() => globalThis.innerHeight)
        const flush = box !== null && box.x === 0 && box.width === widths.viewport &&
          Math.round(box.y + box.height) === height
        if (!flush) {
          throw new Error(`the menu is not a bottom sheet: ${JSON.stringify(box)}`)
        }
      },
    },
    axeSpec("light"),
    axeSpec("dark"),
  ]
}

export const specs: readonly Spec[] = [
  ...filterBarSpecs(),
  ...demoVideoSpecs(),
  ...dangerItemContrastSpecs(),
  ...secondaryEdgeSpecs(),
  ...escapeInsideModalSpecs(),
  ...lostInputSpecs(),
  zoomableCropSpec,
  ...comparisonTablePhoneSpecs(),
  {
    name: "ToggleField: a click on the label flips the switch and tells the caller, both ways",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-ToggleField")
      const label = card.locator("#guide-toggle-archived-label")
      const toggle = card.getByRole("switch", { name: "Show archived" })
      const report = card.locator(`[data-e2e="controlled-value"]`)

      await toggle.and(page.locator(`[aria-checked="false"]`)).waitFor()
      await label.click()
      await toggle.and(page.locator(`[aria-checked="true"]`)).waitFor()
      await report.filter({ hasText: "archived: on" }).waitFor()
      await label.click()
      await toggle.and(page.locator(`[aria-checked="false"]`)).waitFor()
      await report.filter({ hasText: "archived: off" }).waitFor()
    },
  },
  scrollRegionSpec({
    what: "CopyBlock with singleLine",
    pageId: "ui",
    selector: `#demo-CopyBlock code[aria-label]`,
    name: "Install command",
    key: "ArrowRight",
  }),
  {
    name: "CopyBlock with singleLine and text that fits: the text is no Tab stop and has no " +
      "role or name, until its box gets too narrow for it or its text gets too wide",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-CopyBlock")
      const text = card.locator(`[data-e2e="copy-block-fits"] code`)
      const plain = text.and(page.locator(":not([tabindex]):not([role]):not([aria-label])"))
      const scrolling = text.and(page.getByRole("group", { name: "Text to copy", exact: true }))
        .and(page.locator(`[tabindex="0"]`))
      // The server renders the Tab stop; it goes once the mounted block has measured its text.
      await plain.waitFor()

      // Back from the block's own copy button, the stop before it is not the text.
      const button = card.getByRole("button", { name: "Copy the short id" })
      await button.focus()
      await page.keyboard.press("Shift+Tab")
      await button.and(page.locator(":focus")).waitFor({ state: "hidden" })
      const stop = await page.locator(":focus").evaluate((node) => node.tagName)
      if (stop === "CODE") throw new Error("Shift+Tab from the copy button landed on the text")

      // A narrower box makes the same text overflow, and a wider one makes it fit again.
      await text.evaluate((node) => node.parentElement?.style.setProperty("width", "120px"))
      await scrolling.waitFor()
      await text.evaluate((node) => node.parentElement?.style.removeProperty("width"))
      await plain.waitFor()

      // Wider text in the same box overflows too: the text is watched, not only the box.
      const line = text.locator("span")
      await line.evaluate((node) => node.style.setProperty("letter-spacing", "3em"))
      await scrolling.waitFor()
      await line.evaluate((node) => node.style.removeProperty("letter-spacing"))
      await plain.waitFor()
      return `the stop before the copy button is a ${stop}`
    },
  },
  {
    name: "PageHeader's heading leaves room for the whole focus ring of a button in its heading " +
      "slot",
    pageId: "ui",
    run: async (page) => {
      const button = page.locator(`#demo-PageHeader [data-card-part="demo"]`)
        .getByRole("heading").getByRole("button", { name: "Packing list" })
      await button.focus()
      await button.and(page.locator(":focus")).waitFor()
      // The ring is measured as geometry, so this holds whether or not the browser draws
      // `:focus-visible` for a scripted focus: no box between the button and its header may hide
      // overflow while cutting into the button's box grown by the 4 px ring (#579).
      const clippers = await button.evaluate((control) => {
        const ring = 4
        const box = control.getBoundingClientRect()
        const header = control.closest("header")
        const found: string[] = []
        for (let at = control.parentElement; at && header?.contains(at); at = at.parentElement) {
          const style = getComputedStyle(at)
          if (style.overflowX === "visible" && style.overflowY === "visible") continue
          const edge = at.getBoundingClientRect()
          if (
            edge.left > box.left - ring || edge.top > box.top - ring ||
            edge.right < box.right + ring || edge.bottom < box.bottom + ring
          ) {
            found.push(`${at.tagName.toLowerCase()} overflow ${style.overflowX}/${style.overflowY}`)
          }
        }
        return header ? found : ["no header around the button"]
      })
      if (clippers.length > 0) throw new Error(`boxes that clip the ring: ${clippers.join(", ")}`)
      return "boxes that clip the ring: none"
    },
  },
  // Forms and accessibility (#116): refs, `required`, `aria-pressed`, reduced motion.
  refSpec("Textarea", "textarea"),
  refSpec("Select", "select"),
  refSpec("InputButton", "input"),
  refSpec("Card", "div.pc-card"),
  {
    name: "Field: a required field's control is required to the browser, and no other is",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-Field")
      // The demo's `Input` carries no `required` of its own: only its `Field` does.
      const email = card.locator("#guide-email")
      await email.and(page.locator(":required")).waitFor()
      await card.locator("#guide-name").and(page.locator(":optional")).waitFor()
      await email.fill("")
      if (!await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)) {
        throw new Error("the browser accepts the required field left empty")
      }
    },
  },
  {
    name: "OnOffButtons: a click and a key press move aria-pressed, inside a named group",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-OnOffButtons")
      const group = card.getByRole("group", { name: "ON / OFF", exact: true })
      const half = (name: string, pressed: boolean) =>
        group.getByRole("button", { name, exact: true, pressed })

      await half("ON", false).waitFor()
      await half("OFF", false).waitFor()
      await half("ON", false).click()
      await half("ON", true).waitFor()
      await half("OFF", false).waitFor()
      await half("OFF", false).press("Enter")
      await half("OFF", true).waitFor()
      await half("ON", false).waitFor()
      await half("ON", false).press("Space")
      await half("ON", true).waitFor()
      await half("OFF", false).waitFor()
      // The second pair shows the same value under the caller's own group name and labels.
      const named = card.getByRole("group", { name: "Rows to show", exact: true })
      await named.getByRole("button", { name: /^Active/, pressed: true }).waitFor()
      await named.getByRole("button", { name: /^Archived/, pressed: false }).waitFor()
    },
  },
  {
    name:
      "LoadingSpinner, LoadingSkeleton and a busy Button animate, and stop under reduced motion",
    pageId: "ui",
    run: async (page) => {
      await page.locator(`#demo-Button [data-e2e="busy-confirm"]`).click()
      const animated = {
        "LoadingSpinner": page.locator("#demo-LoadingSpinner .animate-spin"),
        "LoadingSkeleton": page.locator("#demo-LoadingSkeleton .animate-pulse"),
        "busy Button": page.locator(`#demo-Button [data-e2e="busy-confirm"] .animate-spin`),
      }
      for (const marks of Object.values(animated)) await marks.first().waitFor()

      const moving = await animationNames(animated)
      await page.emulateMedia({ reducedMotion: "reduce" })
      const reduced = await animationNames(animated)

      const expected = {
        "LoadingSpinner": "spin",
        "LoadingSkeleton": "pulse",
        "busy Button": "spin",
      }
      for (const [name, animation] of Object.entries(expected)) {
        if (moving[name].length === 0 || moving[name].some((found) => found !== animation)) {
          throw new Error(`${name} without reduced motion: animations [${moving[name]}]`)
        }
        if (reduced[name].some((found) => found !== "none")) {
          throw new Error(`${name} under reduced motion still runs [${reduced[name]}]`)
        }
      }
      return `stopped ${Object.values(reduced).flat().length} animated elements`
    },
  },
  {
    name:
      "UnsavedGuard: a button that navigates through the leave guard opens the dialog; Stay keeps the page and returns the focus to the button, Leave navigates",
    pageId: "ui",
    run: async (page) => {
      const { card, dialog, stay, leave, lists, outcomeIs, focusIsOn } =
        await unsavedGuardWithAChange(page)

      await lists.click()
      await dialog.waitFor()
      // The dialog alone: while it is open the page behind it is inert, and axe skips that.
      const { violations } = await new AxeBuilder({ page }).include("dialog[open]").analyze()
      if (violations.length > 0) {
        throw new Error(`axe on the open dialog: ${violations.map(({ id }) => id).join(", ")}`)
      }
      await stay.click()
      await dialog.waitFor({ state: "detached" })
      await focusIsOn(lists)
      await outcomeIs("nothing yet")

      await lists.click()
      await leave.click()
      await dialog.waitFor({ state: "detached" })
      await outcomeIs(`navigate("unsaved-demo/lists") from code`)
      // Leave dropped the change through `onDiscard`, so nothing is unsaved any more.
      await card.getByRole("checkbox", { name: "Unsaved changes", checked: false }).waitFor()
    },
  },
  {
    name:
      "UnsavedGuard: a key press that navigates through the leave guard opens the dialog; Stay returns the focus to the field, and a second key press replaces the first without a second dialog",
    pageId: "ui",
    run: async (page) => {
      const { draft, dialog, stay, leave, outcomeIs, callsAre, focusIsOn } =
        await unsavedGuardWithAChange(page)

      await draft.press("Alt+KeyL")
      await dialog.waitFor()
      await stay.click()
      await dialog.waitFor({ state: "detached" })
      await focusIsOn(draft)
      await outcomeIs("nothing yet")

      await draft.press("Alt+KeyL")
      await dialog.waitFor()
      await callsAre(2)
      // The focus is in the dialog now; the key reaches the card's handler from there.
      await page.keyboard.press("Alt+KeyU")
      await callsAre(3)
      const open = await page.locator("dialog[open]").count()
      if (open !== 1) throw new Error(`${open} dialogs are open after two navigations in a row`)
      await leave.click()
      await outcomeIs(`navigate("unsaved-demo/upcoming") from code`)
      await page.locator("dialog[open]").waitFor({ state: "detached" })
    },
  },
  {
    name:
      "UnsavedGuard without a leave guard: a click on an in-app link opens the dialog, and Leave navigates to the link's address although onDiscard removes the guard at once",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-UnsavedGuard")
      const state = card.locator(`[data-e2e="unsaved-alone-state"]`)
      const dialog = page.getByRole("alertdialog", { name: "Leave without saving?" })

      await card.locator(`[data-e2e="unsaved-alone-draft"]`).fill("An unsaved change")
      await state.getByText("Unsaved: yes. Outcome: nothing yet", { exact: true }).waitFor()
      await card.locator(`[data-e2e="unsaved-alone-link"]`).click()
      await dialog.waitFor()
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
      await state.getByText(/^Unsaved: no\. Outcome: navigate\("\/.*unsaved-demo\/notes\/4"\)$/)
        .waitFor()
      await dialog.waitFor({ state: "detached" })
    },
  },
  {
    name:
      "UnsavedGuard: with nothing unsaved, a button and a key press navigate through the leave guard at once, with no dialog",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-UnsavedGuard")
      const outcome = card.locator(`[data-e2e="unsaved-outcome"]`)
      const upcoming = card.locator(`[data-e2e="unsaved-go-upcoming"]`)

      await upcoming.click()
      await outcome.getByText(`navigate("unsaved-demo/upcoming") from code`).waitFor()
      await upcoming.press("Alt+KeyL")
      await outcome.getByText(`navigate("unsaved-demo/lists") from code`).waitFor()
      const open = await page.locator("dialog[open]").count()
      if (open !== 0) throw new Error(`${open} dialogs are open with nothing unsaved`)
    },
  },
  {
    name:
      "UnsavedGuard: a save that finishes while the dialog is open closes it and follows the link that was clicked, and then the navigation a button started",
    pageId: "ui",
    run: async (page) => {
      const { card, draft, dialog, lists, outcomeIs } = await unsavedGuardWithAChange(page)
      const saveLate = card.locator(`[data-e2e="unsaved-save-late"]`)
      const saved = card.getByRole("checkbox", { name: "Unsaved changes", checked: false })

      await saveLate.click()
      await card.locator(`[data-unsaved="owned"]`).click()
      // The question is asked first: the save has not finished, so nothing has navigated.
      await dialog.waitFor()
      await outcomeIs("nothing yet")
      await dialog.waitFor({ state: "detached" })
      await saved.waitFor()
      await card.locator(`[data-e2e="unsaved-outcome"]`)
        .getByText(/^Outcome: navigate\("\/.*unsaved-demo\/notes\/2"\)$/).waitFor()

      await draft.fill("Another unsaved change")
      await card.getByRole("checkbox", { name: "Unsaved changes", checked: true }).waitFor()
      await saveLate.click()
      await lists.click()
      await dialog.waitFor()
      await dialog.waitFor({ state: "detached" })
      await saved.waitFor()
      await outcomeIs(`navigate("unsaved-demo/lists") from code`)
    },
  },
  {
    name:
      "TagInput: a held Backspace clears the typed text and removes no tag, and the next fresh press removes the last tag",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-TagInput")
      const input = card.locator("#guide-tag-input")
      const tags = card.locator(`[data-e2e="controlled-value"]`)
      await tags.getByText("tags: work", { exact: true }).waitFor()
      await input.pressSequentially("ab")

      // A second `down` of a key that is already down is the keyboard's repeat: two of the six
      // clear the text, and the other four arrive in the empty field.
      for (let press = 0; press < 6; press++) await page.keyboard.down("Backspace")
      await page.keyboard.up("Backspace")
      const text = await input.inputValue()
      if (text !== "") throw new Error(`the field holds "${text}" after a held Backspace`)
      const kept = await tags.innerText()
      if (kept !== "tags: work") throw new Error(`a held Backspace left "${kept}"`)

      await page.keyboard.press("Backspace")
      await tags.getByText("tags: (none)", { exact: true }).waitFor()
    },
  },
  {
    name:
      "DropdownItem: the arrow keys reach an unchecked group of a switcher, Enter chooses it, " +
      "the check moves to it and the menu closes with focus on its trigger",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-DropdownItem")
      const trigger = card.locator(`[data-e2e="dropdown-checked-trigger"]`)
      const menu = card.getByRole("menu", { name: "Switch group", exact: true })
      const choice = (name: string, checked: boolean) =>
        menu.getByRole("menuitemradio", { name, exact: true, checked })
      const focused = page.locator(":focus")

      await trigger.click()
      await choice("Family", true).and(focused).waitFor()
      await choice("Work", false).waitFor()
      await page.keyboard.press("ArrowDown")
      await choice("Work", false).and(focused).waitFor()
      await page.keyboard.press("Enter")
      await card.locator(`[data-e2e="dropdown-checked-status"]`)
        .getByText("Group: Work", { exact: true }).waitFor()
      await trigger.and(page.locator(`[aria-expanded="false"]`)).and(focused).waitFor()

      await trigger.press("Enter")
      await choice("Work", true).waitFor()
      await choice("Family", false).waitFor()
      const marks = await menu.getByRole("menuitemradio").evaluateAll((items) =>
        items.map((item) => [
          item.textContent?.trim(),
          item.querySelector("svg") !== null,
          item.firstElementChild?.getBoundingClientRect().width,
        ])
      )
      const widths = new Set(marks.map(([, , width]) => width))
      const checks = marks.filter(([, hasCheck]) => hasCheck).map(([name]) => name)
      if (checks.join() !== "Work" || widths.size !== 1) {
        throw new Error(`items (name, check, slot width): ${JSON.stringify(marks)}`)
      }
      return `slot ${[...widths][0]} px on every item`
    },
  },
  ...(["light", "dark"] as const).map((colorScheme): Spec => ({
    name:
      `ToggleChips: axe finds no violation on the chips, text colour contrast included, ${colorScheme}`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const card = page.locator("#demo-ToggleChips")
      await card.getByRole("button", { name: "home", pressed: false }).waitFor()
      await card.getByRole("button", { name: "work", pressed: true }).waitFor()
      return await axePasses(page, ["#demo-ToggleChips"])
    },
  })),
  ...radioChipsSpecs(),
  ...themePreviewSpecs(),
  ...unsavedHistorySpecs(),
  ...quickAddSpecs(),
  ...confirmDialogNameSpecs(),
  ...removalSpecs(),
  ...focusHookSpecs(),
  ...requiredFieldSpecs(),
  ...toastrSpecs(),
  ...coachmarkSpecs(),
  ...onboardingChecklistSpecs,
  ...marketingBlockSpecs(),
  avatarOnHoveredRowSpec("light"),
  avatarOnHoveredRowSpec("dark"),
  ...remotePaletteSpecs(),
  ...tabsAndTableKeyboardSpecs(),
  ...feedbackComponentSpecs(),
  ...kanbanDragSpecs(),
  ...comboboxAndFormGapSpecs(),
  ...dismissSpecs(),
  ...smallFixSpecs(),
]

/**
 * An `Avatar` in a `Table` row keeps its circle while the pointer is on the row: the row's hover
 * fill and the avatar's own fill must differ, or the initials float on nothing.
 */
function avatarOnHoveredRowSpec(colorScheme: "light" | "dark"): Spec {
  return {
    name: `Avatar: on a hovered Table row the circle keeps a fill of its own (${colorScheme})`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const row = page.locator(`#demo-Table [data-e2e="ui-guide-row"]`).first()
      const avatar = row.locator(`span.rounded-full[aria-hidden="true"]`)
      await row.scrollIntoViewIfNeeded()
      await row.hover()
      await row.and(page.locator(":hover")).waitFor()
      const fills = await row.evaluate((element) => {
        const circle = element.querySelector(`span.rounded-full[aria-hidden="true"]`)
        if (!circle) throw new Error("the row holds no avatar")
        return {
          row: getComputedStyle(element).backgroundColor,
          avatar: getComputedStyle(circle).backgroundColor,
        }
      })
      await avatar.waitFor()
      if (fills.row === fills.avatar) {
        throw new Error(`the hovered row and the avatar are both ${fills.row}`)
      }
      return `row ${fills.row}, avatar ${fills.avatar}`
    },
  }
}

/** The parts of the host page's `UnsavedGuard` Back and Forward demo a spec drives. */
function unsavedHistoryDemo(page: Page) {
  const demo = page.locator(`[data-e2e="unsaved-history"]`)
  const draft = demo.locator(`[data-e2e="unsaved-history-draft"]`)
  const dialog = page.getByRole("alertdialog", { name: "Leave without saving?" })
  /** Waits for the router to show one view at that view's address. */
  const viewIs = async (view: "list" | "edit" | "preview") => {
    await demo.locator(`[data-e2e="unsaved-history-view"][data-view="${view}"]`).waitFor()
    await page.waitForURL((url) => (url.searchParams.get("unsaved-note") ?? "list") === view)
  }
  /** Follows the demo's link to a view, which adds a history entry. */
  const open = async (view: "edit" | "preview") => {
    await demo.locator(`[data-e2e="unsaved-history-to-${view}"]`).click()
    await viewIs(view)
  }
  /** Types a change into the editor and waits for the guard to know of it. */
  const type = async () => {
    await draft.fill("An unsaved change")
    await demo.getByText("Unsaved: yes", { exact: true }).waitFor()
  }
  return {
    draft,
    dialog,
    stay: dialog.locator(`[data-e2e="confirm-dialog-cancel"]`),
    leave: dialog.locator(`[data-e2e="confirm-dialog-confirm"]`),
    viewIs,
    open,
    /** Opens the editor with the preview one step ahead of it, then types a change. */
    dirtyEditorWithAPageAhead: async () => {
      await open("edit")
      await open("preview")
      // Nothing is typed yet, so this Back is not held; it leaves the preview ahead.
      await page.goBack()
      await viewIs("edit")
      await type()
    },
    type,
    /**
     * Waits for the editor to be the view at its own address and history state, with the typed text
     * still in the same field: a router that had followed the step would have drawn a new, empty
     * one.
     */
    editorIsKept: async () => {
      await dialog.waitFor({ state: "detached" })
      await viewIs("edit")
      await demo.getByText("Unsaved: yes", { exact: true }).waitFor()
      const text = await draft.inputValue()
      if (text !== "An unsaved change") throw new Error(`the field holds "${text}" after Stay`)
      const state = await page.evaluate(() => JSON.stringify(history.state))
      if (state !== `{"view":"edit"}`) throw new Error(`the entry's state is ${state} after Stay`)
    },
    /** Fails when the page shows any number of dialogs but this one. */
    dialogsAre: async (count: number) => {
      const open = await page.locator("dialog[open]").count()
      if (open !== count) throw new Error(`${open} dialogs are open, not ${count}`)
    },
  }
}

/**
 * `UnsavedGuard` against the browser's Back and Forward buttons, on the host page's demo, whose
 * views a wouter router draws from the address.
 */
function unsavedHistorySpecs(): Spec[] {
  return [
    {
      name:
        "UnsavedGuard: Back with a change asks; Stay keeps the editor, its address and the typed text, and Leave arrives where Back was going",
      pageId: "ui",
      run: async (page) => {
        const { dialog, stay, leave, open, type, viewIs, editorIsKept } = unsavedHistoryDemo(page)
        await open("edit")
        await type()

        await page.goBack()
        await dialog.waitFor()
        await stay.click()
        await editorIsKept()

        await page.goBack()
        await dialog.waitFor()
        await leave.click()
        await viewIs("list")
        await dialog.waitFor({ state: "detached" })
      },
    },
    {
      name: "UnsavedGuard: Forward with a change asks, and Leave arrives where Forward was going",
      pageId: "ui",
      run: async (page) => {
        const { dialog, leave, viewIs, dirtyEditorWithAPageAhead } = unsavedHistoryDemo(page)
        await dirtyEditorWithAPageAhead()

        await page.goForward()
        await dialog.waitFor()
        await viewIs("edit")
        await leave.click()
        await viewIs("preview")
        await dialog.waitFor({ state: "detached" })
      },
    },
    {
      name:
        "UnsavedGuard: Stay after Forward keeps the editor, its address and the typed text, as a new entry on top of the page Forward went to",
      pageId: "ui",
      run: async (page) => {
        const { dialog, stay, leave, viewIs, editorIsKept, dirtyEditorWithAPageAhead } =
          unsavedHistoryDemo(page)
        await dirtyEditorWithAPageAhead()

        await page.goForward()
        await dialog.waitFor()
        await stay.click()
        await editorIsKept()

        // The preview is one step back now, not one step ahead.
        await page.goBack()
        await dialog.waitFor()
        await leave.click()
        await viewIs("preview")
      },
    },
    {
      name: "UnsavedGuard: Back with nothing unsaved leaves at once, with no dialog",
      pageId: "ui",
      run: async (page) => {
        const { open, viewIs, dialogsAre } = unsavedHistoryDemo(page)
        await open("edit")
        await page.goBack()
        await viewIs("list")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard: a step back over three entries at once asks, and Leave arrives at the entry the person chose",
      pageId: "ui",
      run: async (page) => {
        const { dialog, leave, open, type, viewIs } = unsavedHistoryDemo(page)
        await open("edit")
        await open("preview")
        await open("edit")
        await type()

        await page.evaluate(() => history.go(-3))
        await dialog.waitFor()
        await viewIs("edit")
        await leave.click()
        await viewIs("list")
      },
    },
    {
      name:
        "UnsavedGuard: a second Back while the question is open is held too, in the one dialog, and Leave arrives where Back was going",
      pageId: "ui",
      run: async (page) => {
        const { dialog, leave, open, type, viewIs, dialogsAre } = unsavedHistoryDemo(page)
        await open("edit")
        await open("preview")
        await open("edit")
        await type()

        await page.goBack()
        await dialog.waitFor()
        await page.goBack()
        await viewIs("edit")
        await dialogsAre(1)
        await leave.click()
        await viewIs("preview")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard: with a change, the app's own replaceState and pushState open no dialog and are not undone, and Stay after Back keeps the replaced address",
      pageId: "ui",
      run: async (page) => {
        const { open, type, viewIs, dialogsAre, dialog, stay, editorIsKept } = unsavedHistoryDemo(
          page,
        )
        const filterIs = (expected: string | null) => {
          const filter = new URL(page.url()).searchParams.get("filter")
          if (filter !== expected) throw new Error(`the address has filter=${filter}`)
        }
        await open("edit")
        await type()
        // The app changes the query of the form's own page, as a filter beside the form does.
        await page.evaluate(() => {
          const url = new URL(location.href)
          url.searchParams.set("filter", "a")
          history.replaceState(history.state, "", url)
        })
        await viewIs("edit")
        await dialogsAre(0)
        filterIs("a")
        // The address the guard puts back is the replaced one, not the one it first saw.
        await page.goBack()
        await dialog.waitFor()
        await stay.click()
        await editorIsKept()
        filterIs("a")
        // The app navigates away from code without the guard, as it does after a save.
        await page.evaluate(() => {
          const url = new URL(location.href)
          url.searchParams.set("unsaved-note", "preview")
          history.pushState({ view: "preview" }, "", url)
        })
        await viewIs("preview")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard: two forms with changes that share a leave guard put one entry back, and Leave arrives where Back was going",
      pageId: "ui",
      run: async (page) => {
        const { open, type, viewIs, dialog, leave, dialogsAre } = unsavedHistoryDemo(page)
        await open("edit")
        // The second form first: the "Unsaved" line `type` waits for is drawn after both guards'
        // effects.
        await page.locator(`[data-e2e="unsaved-history-tags"]`).fill("An unsaved tag")
        await type()
        await page.goBack()
        await dialog.waitFor()
        await dialogsAre(1)
        await leave.click()
        await viewIs("list")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard in a browser without the Navigation API: a link with a change still asks, and Back is not held",
      pageId: "ui",
      run: async (page) => {
        const { open, type, viewIs, dialogsAre, dialog, stay, editorIsKept } = unsavedHistoryDemo(
          page,
        )
        await page.evaluate(() =>
          Object.defineProperty(globalThis, "navigation", { value: undefined })
        )
        await open("edit")
        await type()
        // The rest of the guard works as before: a link out of the form is still held.
        await page.locator(`[data-e2e="unsaved-history-to-preview"]`).click()
        await dialog.waitFor()
        await stay.click()
        await editorIsKept()
        await page.goBack()
        await viewIs("list")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard: a save that finishes while the dialog asks about Back closes it and arrives where Back was going",
      pageId: "ui",
      run: async (page) => {
        const { dialog, open, type, viewIs, dialogsAre } = unsavedHistoryDemo(page)
        await open("edit")
        await type()
        await page.locator(`[data-e2e="unsaved-history-save-late"]`).click()

        await page.goBack()
        // The question is asked first: the save has not finished, so the editor is still the view.
        await dialog.waitFor()
        await viewIs("edit")
        await viewIs("list")
        await dialogsAre(0)
      },
    },
  ]
}

/** The parts of the `ErrorState` card's removal demo a spec drives. */
function removalDemo(page: Page) {
  const demo = page.locator(`#demo-ErrorState [data-e2e="removal-demo"]`)
  const dialog = page.locator(`[data-e2e="removal-dialog"]`)
  const error = dialog.locator(`[data-e2e="removal-error"]`)
  const open = (name: string) => demo.getByRole("button", { name: `Remove ${name}`, exact: true })
  return {
    dialog,
    error,
    open,
    reset: demo.locator(`[data-e2e="removal-reset"]`),
    keep: dialog.locator(`[data-e2e="confirm-dialog-cancel"]`),
    /** The button that takes Grace off the list with no removal running. */
    leave: demo.locator(`[data-e2e="removal-leave"]`),
    /** The button that ends a request left running by "Take the row at once". */
    end: demo.locator(`[data-e2e="removal-end"]`),
    /** Ticks one of the demo's checkboxes. */
    tick: (name: string) => demo.getByRole("checkbox", { name }).check(),
    /** Picks what each row starts with. */
    startRowsWith: (name: string) => demo.getByRole("radio", { name }).check(),
    /**
     * Waits for the demo's last line to read this. The demo writes it from an effect that runs
     * after the hook's, so once it shows, the hook has done all it does for that state.
     */
    settledIs: (text: string) =>
      demo.locator(`[data-e2e="removal-settled"]`).getByText(text, { exact: true }).waitFor(),
    /** Waits for the focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
    /** Opens a row's dialog and confirms the removal. */
    confirm: async (name: string) => {
      await open(name).click()
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
    },
    /** Waits for the dialog to be gone with its row, and for the focus to be on one element. */
    removedWithFocusOn: async (target: Locator) => {
      await dialog.waitFor({ state: "detached" })
      await target.and(page.locator(":focus")).waitFor()
    },
  }
}

/** The parts of the `EnhancedForm` card's focus demo a spec drives. */
function focusDemo(page: Page) {
  const demo = page.locator(`#demo-EnhancedForm [data-e2e="focus-demo"]`)
  const line = demo.locator(`[data-e2e="focus-demo-line"]`)
  return {
    email: demo.locator(`[data-e2e="focus-demo-email"]`),
    submit: demo.locator(`[data-e2e="focus-demo-submit"]`),
    startOver: demo.locator(`[data-e2e="focus-demo-start-over"]`),
    line,
    /**
     * Waits for the demo's last line to carry this state in `data-settled`. The demo writes it from
     * an effect declared after both hooks, so once it shows, the hooks have done all they do for it.
     */
    settledIs: (text: string) =>
      demo.locator(`[data-e2e="focus-demo-settled"][data-settled="${text}"]`).waitFor(),
    /** Waits for the focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
    /** Throws when the step's line holds the focus. */
    lineIsNotFocused: async (when: string) => {
      if (await line.evaluate((element) => element === document.activeElement)) {
        throw new Error(`the step's line took focus ${when}`)
      }
    },
  }
}

/** `useFocusOnError` and `useFocusOnChange`, on the `EnhancedForm` card's two-step form. */
function focusHookSpecs(): Spec[] {
  return [
    {
      name:
        "useFocusOnError: each new error puts focus on the field, though the submit button held it",
      pageId: "ui",
      run: async (page) => {
        const { email, submit, settledIs, focusIsOn } = focusDemo(page)
        await submit.click()
        await settledIs("step ask · submits 1")
        await focusIsOn(email)
        await email.fill("not an address")
        await submit.click()
        await settledIs("step ask · submits 2")
        await focusIsOn(email)
      },
    },
    {
      name: "useFocusOnError: the same error again moves nothing, so focus stays on the button",
      pageId: "ui",
      run: async (page) => {
        const { email, submit, settledIs, focusIsOn } = focusDemo(page)
        await submit.click()
        await settledIs("step ask · submits 1")
        await focusIsOn(email)
        await submit.click()
        await settledIs("step ask · submits 2")
        await focusIsOn(submit)
      },
    },
    {
      name:
        "useFocusOnChange: mounting moves nothing, a new step puts focus on its line, and the step it mounted with moves nothing",
      pageId: "ui",
      run: async (page) => {
        const { email, submit, startOver, line, settledIs, focusIsOn, lineIsNotFocused } =
          focusDemo(page)
        await settledIs("step ask · submits 0")
        await lineIsNotFocused("on mount")
        await email.fill("ada@example.com")
        await submit.click()
        await settledIs("step sent · submits 1")
        await focusIsOn(line.filter({ hasText: "a link is on its way to ada@example.com" }))
        await startOver.click()
        await settledIs("step ask · submits 0")
        await focusIsOn(startOver)
      },
    },
  ]
}

/** `ErrorState` with `focusOnAppear`, `useFreshError` and `useFocusAfterRemoval`, on one list. */
function removalSpecs(): Spec[] {
  return [
    {
      name:
        "ErrorState with focusOnAppear: a refusal that appears in the dialog that asked takes focus, and axe passes the dialog",
      pageId: "ui",
      run: async (page) => {
        const { error, tick, confirm } = removalDemo(page)
        await tick("Refuse the next removal")
        await confirm("Ada")
        await error.filter({ hasText: "Ada could not be removed." }).and(page.locator(":focus"))
          .waitFor()
        const { violations } = await new AxeBuilder({ page }).include("dialog[open]").analyze()
        if (violations.length > 0) {
          throw new Error(`axe on the open dialog: ${violations.map(({ id }) => id).join(", ")}`)
        }
      },
    },
    {
      name: "ErrorState with focusOnAppear: a second refusal with another text takes focus again",
      pageId: "ui",
      run: async (page) => {
        const { dialog, error, tick, confirm, focusIsOn } = removalDemo(page)
        const again = dialog.locator(`[data-e2e="confirm-dialog-confirm"]`)
        await tick("Refuse the next removal")
        await confirm("Ada")
        await focusIsOn(error.filter({ hasText: "Ada could not be removed." }))
        // The first refusal stays on the page while the second attempt runs, so the alert never
        // disappears: only its text changes.
        await again.click()
        await focusIsOn(error.filter({ hasText: "Ada still could not be removed." }))
      },
    },
    {
      name:
        "useFreshError: a dialog opened again does not show the last refusal, and shows the next one although its text is the same",
      pageId: "ui",
      run: async (page) => {
        const { dialog, error, open, keep, tick, confirm } = removalDemo(page)
        await tick("Refuse the next removal")
        await confirm("Ada")
        await error.waitFor()
        await keep.click()
        await dialog.waitFor({ state: "detached" })

        await open("Ada").click()
        await dialog.waitFor()
        // The dialog and its error come from one render, so an error that is shown is there now.
        if (await error.count() !== 0) throw new Error("the dialog opened on the last refusal")

        await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
        await error.filter({ hasText: "Ada could not be removed." }).waitFor()
      },
    },
    {
      name:
        "useFocusAfterRemoval: a removed row hands focus to the row that took its place, the last row to the one before it, and the only row to the fallback",
      pageId: "ui",
      run: async (page) => {
        const { open, reset, confirm, removedWithFocusOn } = removalDemo(page)
        await confirm("Grace")
        await removedWithFocusOn(open("Linus"))
        await confirm("Linus")
        await removedWithFocusOn(open("Ada"))
        await confirm("Ada")
        await removedWithFocusOn(reset)
      },
    },
    {
      name:
        "useFocusAfterRemoval with earlier off: the last of several rows hands focus to the fallback, past the rows before it",
      pageId: "ui",
      run: async (page) => {
        const { reset, tick, confirm, removedWithFocusOn } = removalDemo(page)
        await tick("Skip earlier rows")
        await confirm("Linus")
        await removedWithFocusOn(reset)
      },
    },
    {
      name:
        "useFocusAfterRemoval: a row taken off the list while its request still runs hands focus on at once, and the end of the request moves nothing more",
      pageId: "ui",
      run: async (page) => {
        const { open, end, tick, confirm, removedWithFocusOn, settledIs, focusIsOn } = removalDemo(
          page,
        )
        await tick("Take the row at once")
        await confirm("Grace")
        await removedWithFocusOn(open("Linus"))
        await settledIs("on the list: Ada, Linus · removing Grace")
        // The person moves on: the click puts focus on this button, and there it must stay.
        await end.click()
        await settledIs("on the list: Ada, Linus · removing nobody")
        await focusIsOn(end)
      },
    },
    {
      name:
        "useFocusAfterRemoval: a row that leaves by itself, after its removal was refused, moves nothing",
      pageId: "ui",
      run: async (page) => {
        const { dialog, error, keep, leave, tick, confirm, settledIs, focusIsOn } = removalDemo(
          page,
        )
        await tick("Refuse the next removal")
        await confirm("Grace")
        await error.waitFor()
        await keep.click()
        await dialog.waitFor({ state: "detached" })
        await leave.click()
        await settledIs("on the list: Ada, Linus · removing nobody")
        await focusIsOn(leave)
      },
    },
    {
      name:
        "useFocusAfterRemoval with a target: the control the caller picks takes focus, not the link the row starts with",
      pageId: "ui",
      run: async (page) => {
        const { open, startRowsWith, confirm, removedWithFocusOn } = removalDemo(page)
        await startRowsWith("A link")
        await confirm("Grace")
        await removedWithFocusOn(open("Linus"))
      },
    },
    {
      name:
        "useFocusAfterRemoval: a hidden field at the start of a row is passed over for the row's button",
      pageId: "ui",
      run: async (page) => {
        const { open, startRowsWith, confirm, removedWithFocusOn } = removalDemo(page)
        await startRowsWith("A hidden field")
        await confirm("Grace")
        await removedWithFocusOn(open("Linus"))
      },
    },
    {
      name:
        "useFocusAfterRemoval: a row whose control does not take focus is passed over for another row, and for the fallback when no row is left",
      pageId: "ui",
      run: async (page) => {
        const { open, reset, startRowsWith, confirm, removedWithFocusOn } = removalDemo(page)
        // Linus's row starts with a button that is not shown, which the default target picks.
        await startRowsWith("A button that is not shown")
        await confirm("Grace")
        await removedWithFocusOn(open("Ada"))
        await confirm("Ada")
        await removedWithFocusOn(reset)
      },
    },
  ]
}

/**
 * A spec proving one component hands its `ref` the native element: the card's "Focus via ref"
 * button calls `.focus()` through the ref, and focus must land on the marked element, which must be
 * the element the component draws.
 *
 * @param name The component, which is also its card's name.
 * @param element A selector the focused element must match.
 */
function refSpec(name: string, element: string): Spec {
  return {
    name: `${name}: a ref reaches the native element, so "Focus via ref" focuses it`,
    pageId: "ui",
    run: async (page) => {
      const card = page.locator(`#demo-${name}`)
      const target = card.locator(`${element}[data-e2e="ref-target"]`)
      await target.waitFor()
      if (await target.evaluate((node) => node === document.activeElement)) {
        throw new Error("the target had focus before the button was pressed")
      }
      await card.locator(`[data-e2e="ref-focus"]`).click()
      await target.and(page.locator(":focus")).waitFor()
    },
  }
}

/**
 * Read the computed `animation-name` of every element each locator matches.
 *
 * @param groups The elements to read, by a name for the report.
 * @returns The names found, per group, in document order.
 */
async function animationNames(
  groups: Record<string, Locator>,
): Promise<Record<string, string[]>> {
  const found: Record<string, string[]> = {}
  for (const [name, marks] of Object.entries(groups)) {
    found[name] = await marks.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).animationName)
    )
  }
  return found
}

/** The parts of the first `QuickAdd` on its guide card, and the line that lists what it added. */
function quickAdd(page: Page) {
  const card = page.locator("#demo-QuickAdd")
  const part = (name: string) => card.locator(`[data-e2e="quick-add${name}"]`)
  return {
    card,
    form: part(""),
    input: part("-input"),
    submit: part("-submit"),
    chips: part("-chips"),
    live: part("-live"),
    /** The message a person sees, which assistive technology must be able to read too. */
    notice: card.locator(`[data-e2e="quick-add"] p[id$="-notice"]:not([aria-hidden])`),
    added: part("-added"),
    busy: part("-busy"),
  }
}

/** Throws unless the element's text is exactly `text` now; for a state already waited for. */
async function textIs(locator: Locator, text: string): Promise<void> {
  const found = await locator.textContent()
  if (found !== text) throw new Error(`expected "${text}", found "${found}"`)
}

/**
 * Records every text the live region holds from now on, so an announcement cannot come and go
 * unseen. Empty text is left out: a screen reader has nothing to say for it.
 *
 * @returns A function that reads what was recorded so far, in order.
 */
async function recordSpoken(page: Page, live: Locator): Promise<() => Promise<string[]>> {
  await live.evaluate((region) => {
    const spoken: string[] = []
    Object.assign(globalThis, { quickAddSpoken: spoken })
    new MutationObserver(() => {
      if (region.textContent) spoken.push(region.textContent)
    }).observe(region, { childList: true, characterData: true, subtree: true })
  })
  return () =>
    page.evaluate(() => (globalThis as unknown as { quickAddSpoken: string[] }).quickAddSpoken)
}

/** `QuickAdd` with badges and the empty-title message showing has no axe violation. */
function quickAddAxe(colorScheme: "light" | "dark"): Spec {
  return {
    name:
      `QuickAdd: axe finds no violation with badges and the empty-title message showing, ${colorScheme}`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const { input, submit, chips, notice } = quickAdd(page)
      await input.fill("#work 2099-01-05 !high")
      await submit.click()
      await chips.locator("li").nth(2).waitFor()
      await notice.waitFor()
      const { violations, passes } = await new AxeBuilder({ page })
        .include(`#demo-QuickAdd [data-e2e="quick-add"]`)
        .include(`#demo-QuickAdd [data-e2e="quick-add-clock"]`)
        .include(`#demo-QuickAdd [data-e2e="quick-add-worded"]`)
        .analyze()
      if (violations.length > 0) {
        throw new Error(
          violations.map(({ id, nodes }) =>
            `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
          ).join(" | "),
        )
      }
      return `${passes.length} rules pass`
    },
  }
}

/** The `QuickAdd` specs: typing, the timed announcement, refused sends, busy, the clock, axe. */
function quickAddSpecs(): Spec[] {
  return [
    {
      name:
        "QuickAdd: a tag typed letter by letter is announced once, whole, after the typing stops",
      pageId: "ui",
      run: async (page) => {
        const { input, chips, live } = quickAdd(page)
        const spoken = await recordSpoken(page, live)
        // A person's pace: slower than a frame, so each letter is drawn, and well inside the pause.
        await input.pressSequentially("a #work", { delay: 100 })
        await chips.locator("li").filter({ hasText: /^Tag work$/ }).waitFor()
        await live.filter({ hasText: /^Tag work$/ }).waitFor()
        const heard = await spoken()
        if (heard.join("|") !== "Tag work") {
          throw new Error(`the live region held, in order: ${JSON.stringify(heard)}`)
        }
        return "heard: Tag work"
      },
    },
    {
      name:
        "QuickAdd: the button adds the title, tag, due and priority, empties the field and moves focus into it",
      pageId: "ui",
      run: async (page) => {
        const { card, input, submit, chips, live, added } = quickAdd(page)
        await input.fill("Call Anna #work 2099-01-05 3pm !high")
        const named = card.getByRole("list", { name: "Recognised in your line", exact: true })
        for (const badge of ["Tag work", "Due Mon 5 Jan 15:00", "High priority"]) {
          await named.locator("li").filter({ hasText: new RegExp(`^${badge}$`) }).waitFor()
        }
        await live.filter({ hasText: /^Tag work, Due Mon 5 Jan 15:00, High priority$/ }).waitFor()
        await submit.click()
        await added.filter({ hasText: "added 1:" }).waitFor()
        await textIs(
          added,
          `added 1: {"title":"Call Anna","tags":["work"],"contexts":[],` +
            `"due":{"date":"2099-01-05","time":"15:00"},"priority":1}`,
        )
        await input.and(page.locator(":focus:placeholder-shown")).waitFor()
        await chips.waitFor({ state: "detached" })
        await live.filter({ hasText: /^$/ }).waitFor()
      },
    },
    {
      name:
        "QuickAdd: a line of only tokens sent with the button adds nothing, and its message is shown, spoken once and tied to the invalid, focused field until the next key",
      pageId: "ui",
      run: async (page) => {
        const { input, submit, live, notice, added } = quickAdd(page)
        const spoken = await recordSpoken(page, live)
        await input.fill("#work !high")
        await live.filter({ hasText: /^Tag work, High priority$/ }).waitFor()
        await input.and(page.locator(":not([aria-invalid])")).waitFor()
        await submit.click()
        await notice.filter({ hasText: /^Add a title first$/ }).waitFor()
        await live.filter({ hasText: /^Add a title first$/ }).waitFor()
        await input.and(page.locator(`:focus[aria-invalid="true"]`)).waitFor()
        // The message comes first in the field's description, before the hint.
        const described = await input.evaluate((field) => {
          const [first] = (field.getAttribute("aria-describedby") ?? "").split(" ")
          return field.ownerDocument.getElementById(first)?.textContent ?? `nothing at "${first}"`
        })
        if (described !== "Add a title first") {
          throw new Error(`the field is described first by: ${described}`)
        }
        if (await input.inputValue() !== "#work !high") throw new Error("the typed line was lost")
        await input.pressSequentially(" x")
        await notice.waitFor({ state: "detached" })
        await input.and(page.locator(":not([aria-invalid])")).waitFor()
        await live.filter({ hasText: /^$/ }).waitFor()
        await textIs(added, "added 0: ")
        const heard = await spoken()
        if (heard.join("|") !== "Tag work, High priority|Add a title first") {
          throw new Error(`the live region held, in order: ${JSON.stringify(heard)}`)
        }
      },
    },
    {
      name: "QuickAdd: a blank line sent with the button says nothing and moves focus to the field",
      pageId: "ui",
      run: async (page) => {
        const { input, submit, notice, added } = quickAdd(page)
        await input.fill("   ")
        await submit.click()
        await input.and(page.locator(":focus")).waitFor()
        if (await notice.count() !== 0) throw new Error("a blank line showed a message")
        await textIs(added, "added 0: ")
      },
    },
    {
      name:
        "QuickAdd: while busy the field takes no typing and neither Enter nor a scripted submit adds; afterwards Enter adds the kept text",
      pageId: "ui",
      run: async (page) => {
        const { form, input, added, busy } = quickAdd(page)
        await input.fill("Second")
        await busy.click()
        await input.and(page.locator("[readonly]")).waitFor()
        await input.focus()
        await input.pressSequentially("x")
        await input.press("Enter")
        // The button is off, so Enter never reaches the handler; a script's submit does.
        await form.evaluate((element: HTMLFormElement) => element.requestSubmit())
        // A send that got through would have emptied the field and listed the item by now.
        await busy.click()
        await input.and(page.locator(":not([readonly])")).waitFor()
        if (await input.inputValue() !== "Second") throw new Error("the text changed while busy")
        await textIs(added, "added 0: ")
        await input.press("Enter")
        await added.filter({ hasText: `added 1: {"title":"Second"` }).waitFor()
      },
    },
    {
      name:
        "QuickAdd: at 01:00 in the given zone, a day ahead of UTC, 'tomorrow' is that zone's tomorrow in the badge and in what is added",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-QuickAdd")
        const part = (name: string) => card.locator(`[data-e2e="quick-add-clock${name}"]`)
        await part("-input").fill("Water the plants tomorrow 3pm")
        await part("-chips").locator("li").filter({ hasText: /^Due Tomorrow 15:00$/ }).waitFor()
        await part("-input").press("Enter")
        await part("-added").filter({ hasText: "plants" }).waitFor()
        await textIs(part("-added"), "added: Water the plants, due 2026-03-09")
      },
    },
    quickAddAxe("light"),
    quickAddAxe("dark"),
  ]
}

const TOAST_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const

/** The `Toastr` card at a window 800 px tall and as wide as asked, with its stack and its picker. */
async function toastrCard(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  const card = page.locator("#demo-Toastr")
  const stack = page.locator(`[data-e2e="guide-toastr"]`)
  const toast = stack.locator(`[data-e2e="guide-toast-info"]`)
  return {
    stack,
    toast,
    dismiss: toast.getByRole("button", { name: "Dismiss" }),
    /** Pushes the card's info toast and waits until its slide has ended, so its box is final. */
    push: async () => {
      await card.locator(`[data-e2e="toast-info"]`).click()
      await toast.waitFor()
      await toast.evaluate((element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished))
      )
    },
    /**
     * Pushes the card's info toast and reads its horizontal `translate` the moment it is in the
     * document, which is where its slide starts: negative from the left, positive from the right,
     * 0 with no slide.
     */
    pushAndReadStart: async (): Promise<number> => {
      // The observer is in place before the click: this call returns once it watches the stack.
      const start = await stack.evaluateHandle((element) => ({
        translate: new Promise<string>((done) => {
          new MutationObserver((records, observer) => {
            const added = records.flatMap((record) => [...record.addedNodes])
              .find((node) => node instanceof HTMLElement)
            if (!added) return
            observer.disconnect()
            done(getComputedStyle(added as HTMLElement).translate)
          }).observe(element, { childList: true })
        }),
      }))
      await card.locator(`[data-e2e="toast-info"]`).click()
      return parseFloat((await start.evaluate((held) => held.translate)).split(" ")[0]) || 0
    },
    /** Empties the stack. A dispatched click, as for the picker below. */
    clear: async () => {
      await card.locator(`[data-e2e="toast-clear"]`).dispatchEvent("click")
      await toast.waitFor({ state: "detached" })
    },
    /** Puts the stack in a corner. A dispatched click: a toast may lie over the radio by now. */
    moveTo: async (corner: typeof TOAST_CORNERS[number]) => {
      await card.locator(`input[name="guide-toastr-corner"][value="${corner}"]`)
        .dispatchEvent("click")
      // An empty stack has no height, so it is attached and never "visible".
      await stack.and(page.locator(":not(.static)")).waitFor({ state: "attached" })
    },
    /** The window's width without the page's own scrollbar, which a desktop browser draws. */
    innerWidth: () => page.evaluate(() => document.documentElement.clientWidth),
  }
}

/** A locator's box, or an error naming what had none. */
async function boxOf(locator: Locator, what: string) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${what} has no box`)
  return box
}

/** A spec that a toast's slide starts on its corner's side at the given window width. */
function toastSlideSpec(width: number): Spec {
  return {
    name:
      `Toastr: at ${width} px wide a toast slides in from the left in a left corner and from the right in a right one`,
    pageId: "ui",
    run: async (page) => {
      const { moveTo, pushAndReadStart, clear } = await toastrCard(page, width)
      const starts: string[] = []
      for (const corner of TOAST_CORNERS) {
        await moveTo(corner)
        const x = await pushAndReadStart()
        if (corner.endsWith("left") ? x >= 0 : x <= 0) {
          throw new Error(`${corner}: the slide starts at translate x ${x}px`)
        }
        starts.push(`${corner} ${x}px`)
        await clear()
      }
      return starts.join(", ")
    },
  }
}

/**
 * `Toastr` on a phone and from `sm` up: where the stack sits in each corner, which side a toast
 * slides in from, and how large the dismiss button is.
 */
function toastrSpecs(): Spec[] {
  return [
    ...([320, 414] as const).map((width): Spec => ({
      name:
        `Toastr: at ${width} px wide, in each of the four corners, a toast is inside the window, 16 px from the left, the right and the corner's top or bottom edge`,
      pageId: "ui",
      run: async (page) => {
        const { toast, push, moveTo, innerWidth } = await toastrCard(page, width)
        await push()
        const inner = await innerWidth()
        for (const corner of TOAST_CORNERS) {
          await moveTo(corner)
          const box = await boxOf(toast, `the toast in ${corner}`)
          const [left, right] = [box.x, inner - box.x - box.width]
          const edge = corner.startsWith("top") ? box.y : 800 - box.y - box.height
          if ([left, right, edge].some((gap) => Math.abs(gap - 16) > 0.5)) {
            throw new Error(
              `${corner}: ${left}px to the left, ${right}px to the right, ${edge}px from its edge`,
            )
          }
        }
      },
    })),
    {
      name:
        "Toastr: at 320 px wide the dismiss button is at least 44 px each way inside its toast, and Enter on it closes the toast",
      pageId: "ui",
      run: async (page) => {
        const { toast, dismiss, push, moveTo } = await toastrCard(page, 320)
        await push()
        await moveTo("top-right")
        const frame = await boxOf(toast, "the toast")
        const box = await boxOf(dismiss, "the dismiss button")
        if (box.width < 44 || box.height < 44) {
          throw new Error(`the dismiss button is ${box.width} × ${box.height} px`)
        }
        if (
          box.x < frame.x || box.y < frame.y || box.x + box.width > frame.x + frame.width + 0.5 ||
          box.y + box.height > frame.y + frame.height + 0.5
        ) {
          throw new Error(
            `the button leaves its toast: ${JSON.stringify(box)} in ${JSON.stringify(frame)}`,
          )
        }
        await dismiss.focus()
        await page.keyboard.press("Enter")
        await toast.waitFor({ state: "detached" })
        return `${box.width} × ${box.height} px`
      },
    },
    ...([[640, 320], [1440, 384]] as const).map(([width, stackWidth]): Spec => ({
      name:
        `Toastr: at ${width} px wide the stack is ${stackWidth} px wide, 32 px from both edges of its corner, and the dismiss button is at least 36 px each way`,
      pageId: "ui",
      run: async (page) => {
        const { stack, dismiss, push, moveTo, innerWidth } = await toastrCard(page, width)
        await push()
        const inner = await innerWidth()
        for (const corner of TOAST_CORNERS) {
          await moveTo(corner)
          const box = await boxOf(stack, `the stack in ${corner}`)
          const side = corner.endsWith("left") ? box.x : inner - box.x - box.width
          const edge = corner.startsWith("top") ? box.y : 800 - box.y - box.height
          if (
            Math.abs(box.width - stackWidth) > 0.5 || Math.abs(side - 32) > 0.5 ||
            Math.abs(edge - 32) > 0.5
          ) {
            throw new Error(
              `${corner}: ${box.width}px wide, ${side}px and ${edge}px from its edges`,
            )
          }
        }
        const button = await boxOf(dismiss, "the dismiss button")
        if (button.width < 36 || button.height < 36) {
          throw new Error(`the dismiss button is ${button.width} × ${button.height} px`)
        }
      },
    })),
    {
      name:
        "Toastr: the dismiss button adds no height: at 414 and 1440 px a toast is as tall as its text plus 16 px above and below",
      pageId: "ui",
      run: async (page) => {
        const heights: string[] = []
        // At 414 px the title and a one-line body are 40 px, less than the 44 px button.
        for (const width of [414, 1440]) {
          const { toast, push, moveTo, clear } = await toastrCard(page, width)
          await push()
          await moveTo("top-right")
          const box = await boxOf(toast, "the toast")
          const first = await boxOf(toast.locator("p").first(), "the toast's first line")
          const last = await boxOf(toast.locator("p").last(), "the toast's last line")
          const text = last.y + last.height - first.y
          if (Math.abs(box.height - text - 32) > 0.5) {
            throw new Error(
              `at ${width} px the toast is ${box.height}px tall around ${text}px of text`,
            )
          }
          heights.push(`${width}: ${box.height}px around ${text}px`)
          await clear()
        }
        return heights.join(", ")
      },
    },
    {
      name:
        "Toastr: a caller's own offsets place the stack from 640 px up: the mini-app's toast sits 17 px from the bottom and the right of its frame, and its empty stack has no height",
      pageId: "overview",
      run: async (page) => {
        const frame = page.locator(`[data-e2e="mini-app"]`)
        const stack = frame.locator(`[data-e2e="mini-app-toasts"]`)
        const toast = stack.locator(`[role="status"]`)
        const gaps: string[] = []
        for (const width of [640, 768, 1440]) {
          await page.setViewportSize({ width, height: 800 })
          const empty = await stack.evaluate((element) => element.getBoundingClientRect().height)
          if (empty !== 0) throw new Error(`at ${width} px the empty stack is ${empty}px tall`)
          await frame.locator(`[data-e2e="mini-app-toast"]`).click()
          await toast.waitFor()
          await toast.evaluate((element) =>
            Promise.all(element.getAnimations().map((animation) => animation.finished))
          )
          const outer = await boxOf(frame, "the mini-app's frame")
          const box = await boxOf(toast, "the mini-app's toast")
          const bottom = outer.y + outer.height - box.y - box.height
          const right = outer.x + outer.width - box.x - box.width
          if (Math.abs(bottom - 17) > 1 || Math.abs(right - 17) > 1) {
            throw new Error(
              `at ${width} px the toast is ${bottom}px from the bottom and ${right}px from the right`,
            )
          }
          gaps.push(`${width}: ${bottom}px, ${right}px`)
          await toast.getByRole("button", { name: "Dismiss" }).click()
          await toast.waitFor({ state: "detached" })
        }
        return gaps.join("; ")
      },
    },
    toastSlideSpec(320),
    toastSlideSpec(1440),
    {
      name: "Toastr: with reduced motion requested, a toast does not slide in, left or right",
      pageId: "ui",
      run: async (page) => {
        await page.emulateMedia({ reducedMotion: "reduce" })
        const { moveTo, pushAndReadStart, clear } = await toastrCard(page, 1440)
        for (const corner of ["top-left", "top-right"] as const) {
          await moveTo(corner)
          const x = await pushAndReadStart()
          if (x !== 0) throw new Error(`${corner}: the toast starts at translate x ${x}px`)
          await clear()
        }
      },
    },
  ]
}

/**
 * The remote `CommandPalette` on its card, opened, once its answer for the empty query is listed.
 * Its pretend server answers a one-letter query in 900 ms, a longer one in 100 ms, and fails
 * "boom"; the card counts the searches started and answered, and shows what was picked.
 *
 * @param page The guide's UI page.
 * @param width The window's width.
 */
async function openRemotePalette(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 800 })
  const card = page.locator("#demo-CommandPalette")
  const dialog = page.locator(`[data-e2e="palette-remote"]`)
  const field = dialog.getByRole("combobox")
  const list = dialog.getByRole("listbox")
  const status = dialog.locator(`[data-e2e="palette-remote-status"]`)
  const counter = (name: string) => card.locator(`[data-e2e="palette-remote-${name}"]`)
  // Attached, not visible: an empty list has no height.
  const idle = list.and(page.locator(":not([aria-busy])"))
  /** Waits until the listed results are exactly these labels, in this order. */
  const resultsAre = (labels: readonly string[]) =>
    page.waitForFunction(
      (wanted) =>
        [...document.querySelectorAll(`[data-e2e="palette-remote"] [role="option"]`)]
          .map((option) => option.querySelector("span span")?.textContent ?? "")
          .join("|") === wanted,
      labels.join("|"),
    )
  /** Waits until the group headings are exactly these, each as "heading:number of rows". */
  const headingsAre = (headings: readonly string[]) =>
    page.waitForFunction(
      (wanted) =>
        [...document.querySelectorAll(`[data-e2e="palette-remote"] [role="group"]`)]
          .map((group) =>
            `${document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent}:${
              group.querySelectorAll(`[role="option"]`).length
            }`
          )
          .join("|") === wanted,
      headings.join("|"),
    )
  await card.locator(`[data-e2e="palette-remote-open"]`).click()
  await field.and(page.locator(":focus")).waitFor()
  await resultsAre(["Apple", "Apricot", "Banana", "Blackberry", "Cherry", "Grape", "Papaya"])
  await idle.waitFor({ state: "attached" })
  return {
    dialog,
    field,
    status,
    idle,
    resultsAre,
    headingsAre,
    /** Waits until the card's counter `name` ("searches", "answered") reads exactly `value`. */
    counterIs: (name: string, value: string) =>
      counter(name).filter({ hasText: new RegExp(`^${value}$`) }).waitFor(),
    /** Reads the card's counter `name`. */
    counter: async (name: string) => await counter(name).textContent() ?? "",
    /** Waits until the status line says `text` where a sighted reader sees it. */
    shows: (text: string) =>
      status.and(page.locator(":not(.sr-only)")).filter({ hasText: text }).waitFor(),
  }
}

/** Specs for the remote data mode of `CommandPalette`, and its rows on a phone. */
function remotePaletteSpecs(): Spec[] {
  return [
    {
      name: "CommandPalette remote: a newer query aborts the stale search's signal, and the " +
        "stale answer changes nothing when it lands after the fresh one",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const started = Number(await palette.counter("searches"))
        await page.keyboard.type("a")
        // "a" must really start before "p" makes it stale; a debounced query never starts.
        await palette.counterIs("searches", String(started + 1))
        await page.keyboard.type("p")
        await palette.resultsAre(["Apple", "Apricot", "Grape", "Papaya"])
        await palette.counterIs("aborted", "“a”")
        // Every search has answered, the slow, stale one for "a" included.
        await palette.counterIs("answered", String(started + 2))
        await palette.resultsAre(["Apple", "Apricot", "Grape", "Papaya"])
        await palette.headingsAre(["Fruit with A:2", "Fruit with G:1", "Fruit with P:1"])
        await palette.idle.waitFor({ state: "attached" })
      },
    },
    {
      name: "CommandPalette remote: while the next search runs the last results stay listed, " +
        "neither moving nor fading, and only after 300 ms does Searching… show beside the field",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        // Every change to the dialog, timed, from the keystroke to the answer.
        const log = await palette.dialog.evaluateHandle((dialog) => {
          const entries: {
            at: number
            busy: boolean
            searching: boolean
            opacity: number
            rows: number
            status: string
          }[] = []
          new MutationObserver(() => {
            const list = dialog.querySelector(`[role="listbox"]`)
            entries.push({
              at: performance.now(),
              busy: list?.getAttribute("aria-busy") === "true",
              searching: dialog.querySelector(`[data-e2e="palette-remote-searching"]`)
                ?.checkVisibility() ?? false,
              opacity: Math.min(
                ...[...dialog.querySelectorAll(`[role="option"]`)]
                  .map((option) => {
                    let opacity = 1
                    for (let node: Element | null = option; node; node = node.parentElement) {
                      opacity *= Number(getComputedStyle(node).opacity)
                    }
                    return opacity
                  }),
                1,
              ),
              rows: dialog.querySelectorAll(`[role="option"]`).length,
              status: dialog.querySelector(`[role="status"]`)?.textContent ?? "",
            })
          }).observe(dialog, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          })
          return entries
        })
        await page.keyboard.type("a")
        await palette.status.filter({ hasText: "Searching…" }).waitFor({ state: "attached" })
        await palette.idle.waitFor({ state: "attached" })
        const entries = await log.jsonValue()
        const busy = entries.findIndex((entry) => entry.busy)
        const slow = entries.findIndex((entry) => entry.status === "Searching…")
        const answered = entries.findIndex((entry, index) => index > busy && !entry.busy)
        if (busy < 0 || slow < 0 || answered < 0) {
          throw new Error(`busy at ${busy}, Searching… at ${slow}, answered at ${answered}`)
        }
        const first = entries[busy]
        if (first.rows !== 7 || first.status !== "" || first.searching) {
          throw new Error(
            `as the search starts: ${first.rows} rows, status "${first.status}", Searching… ` +
              `shown ${first.searching}`,
          )
        }
        const waited = entries[slow].at - first.at
        // A timer never fires early; the 10 ms are rendering's slack between the two records.
        if (waited < 290) throw new Error(`Searching… came ${Math.round(waited)} ms in`)
        if (entries[slow].rows !== 7 || !entries[slow].searching) {
          throw new Error(
            `with Searching… announced: ${entries[slow].rows} rows, shown beside the field ` +
              `${entries[slow].searching}`,
          )
        }
        const faded = entries.slice(busy, answered).find((entry) => entry.opacity < 1)
        if (faded) throw new Error(`a row faded to opacity ${faded.opacity} while "a" loaded`)
        const blank = entries.slice(busy, answered).find((entry) => entry.rows !== 7)
        if (blank) throw new Error(`the list fell to ${blank.rows} rows while "a" loaded`)
        return `Searching… after ${Math.round(waited)} ms, with the 7 rows kept as they were`
      },
    },
    ...(["light", "dark"] as const).flatMap((colorScheme) =>
      [390, 1280].map((width): Spec => ({
        name: `CommandPalette remote at ${width} px in the ${colorScheme} palette: while a slow ` +
          "search runs over the last results, axe finds no violation in the dialog, colour " +
          "contrast included",
        pageId: "ui",
        colorScheme,
        run: async (page) => {
          const dark = await page.evaluate(() =>
            document.documentElement.classList.contains("dark")
          )
          if (dark !== (colorScheme === "dark")) {
            throw new Error(`the page is drawn ${dark ? "dark" : "light"}, not ${colorScheme}`)
          }
          const palette = await openRemotePalette(page, width)
          // "slow" answers in twenty seconds: the kept rows and Searching… stay for the whole scan.
          await palette.field.fill("slow")
          await palette.dialog.locator(`[data-e2e="palette-remote-searching"]`).waitFor()
          // From `sm` up the seven rows overflow the list's 384 px, so the scan meets a list that
          // scrolls: axe's `scrollable-region-focusable` has a scroll box to judge.
          const scrolls = await palette.dialog.getByRole("listbox").evaluate((list) =>
            list.scrollHeight > list.clientHeight
          )
          if (width >= 640 && !scrolls) throw new Error("the results list does not scroll")
          // Every rule runs, colour contrast included.
          const { violations, passes } = await new AxeBuilder({ page })
            .include(`[data-e2e="palette-remote"]`)
            .analyze()
          if (violations.length > 0) {
            throw new Error(
              violations.map(({ id, nodes }) =>
                `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
              ).join(" | "),
            )
          }
          const result = `${passes.length} rules pass`
          await palette.dialog.locator(`[data-e2e="palette-remote-searching"]`).waitFor()
          return result
        },
      }))
    ),
    {
      name: "CommandPalette remote: Enter while a search runs waits for its answer and picks its " +
        "first result, not the highlighted row of the previous query",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const picked = page.locator(`[data-e2e="palette-remote-picked"]`)
        await page.keyboard.type("b")
        await page.keyboard.press("Enter")
        // "b" answers 1.1 s after the keystroke: the palette is still open and nothing is picked.
        const midLoad = await page.evaluate(() => ({
          open: document.querySelector<HTMLDialogElement>(`[data-e2e="palette-remote"]`)?.open,
          picked: document.querySelector(`[data-e2e="palette-remote-picked"]`)?.textContent,
        }))
        if (!midLoad.open || midLoad.picked !== "nothing yet") {
          throw new Error(`right after Enter: open ${midLoad.open}, picked "${midLoad.picked}"`)
        }
        await picked.filter({ hasText: /^Banana$/ }).waitFor()
        await palette.dialog.waitFor({ state: "hidden" })
      },
    },
    {
      name: "CommandPalette remote: typing again after an Enter that waits for a search drops " +
        "that Enter, so the new answer is listed, not picked",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const picked = page.locator(`[data-e2e="palette-remote-picked"]`)
        await page.keyboard.type("b")
        await page.keyboard.press("Enter")
        await page.keyboard.type("l")
        await palette.resultsAre(["Blackberry"])
        await palette.idle.waitFor({ state: "attached" })
        await palette.field.and(page.locator(":focus")).waitFor()
        const now = await picked.textContent()
        if (now !== "nothing yet") throw new Error(`the answer for "bl" picked "${now}"`)
      },
    },
    {
      name: "CommandPalette remote: closing the palette drops an Enter that waits for a search, " +
        "so opening it again picks nothing",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const picked = page.locator(`[data-e2e="palette-remote-picked"]`)
        await page.keyboard.type("b")
        await page.keyboard.press("Enter")
        await page.keyboard.press("Escape")
        await palette.dialog.waitFor({ state: "hidden" })
        await page.locator(`[data-e2e="palette-remote-open"]`).click()
        await palette.resultsAre([
          "Apple",
          "Apricot",
          "Banana",
          "Blackberry",
          "Cherry",
          "Grape",
          "Papaya",
        ])
        await palette.idle.waitFor({ state: "attached" })
        const open = await palette.dialog.isVisible()
        const now = await picked.textContent()
        if (!open || now !== "nothing yet") {
          throw new Error(`after reopening: open ${open}, picked "${now}"`)
        }
      },
    },
    {
      name: "CommandPalette remote: a rejected search shows the error, and a query nothing " +
        "matches says so",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        await palette.field.fill("boom")
        await palette.shows("The search failed. Try again.")
        await palette.resultsAre([])
        await palette.field.fill("zz")
        await palette.shows("Nothing matches.")
        await palette.idle.waitFor({ state: "attached" })
      },
    },
    {
      name: "CommandPalette at 1280 px: End scrolls the listbox itself, the results' scroll box, " +
        "to the last row while focus stays in the field",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page)
        const list = palette.dialog.getByRole("listbox")
        /** Whether the last row is highlighted and lies inside the list's box, which scrolls. */
        const read = () =>
          list.evaluate((box) => {
            const id = document.querySelector(`[data-e2e="palette-remote"] [role="combobox"]`)
              ?.getAttribute("aria-activedescendant")
            const option = document.getElementById(id ?? "")
            const row = option?.getBoundingClientRect()
            const edge = box.getBoundingClientRect()
            return {
              last: option !== null &&
                option === [...box.querySelectorAll(`[role="option"]`)].at(-1),
              top: box.scrollTop,
              scrolls: box.scrollHeight > box.clientHeight,
              shown: row !== undefined && row.top >= edge.top && row.bottom <= edge.bottom,
            }
          })
        await palette.field.press("End")
        await page.waitForFunction(() => {
          const box = document.querySelector(`[data-e2e="palette-remote"] [role="listbox"]`)
          return box !== null && box.scrollTop > 0
        })
        const end = await read()
        if (!end.last || !end.scrolls || !end.shown) {
          throw new Error(
            `after End: last row highlighted ${end.last}, list scrolls ${end.scrolls}, ` +
              `highlighted row shown ${end.shown}`,
          )
        }
        await palette.field.and(page.locator(":focus")).waitFor()
        return `End scrolled the list to ${Math.round(end.top)} px`
      },
    },
    {
      name: "CommandPalette at 390 px: the close button is a 44 px square, and the field is a " +
        "text combobox, so the browser draws no clear button of its own beside it",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page, 390)
        const close = await palette.dialog.locator(`[data-e2e="palette-remote-close"]`)
          .boundingBox()
        if (close === null || Math.round(close.width) !== 44 || Math.round(close.height) !== 44) {
          throw new Error(`the close button is ${close?.width}×${close?.height} px`)
        }
        const field = await palette.field.evaluate((input) => ({
          type: (input as HTMLInputElement).type,
          inputMode: (input as HTMLInputElement).inputMode,
          enterKeyHint: (input as HTMLInputElement).enterKeyHint,
        }))
        if (
          field.type !== "text" || field.inputMode !== "search" || field.enterKeyHint !== "search"
        ) {
          throw new Error(
            `the field is type ${field.type}, inputmode ${field.inputMode}, enterkeyhint ` +
              field.enterKeyHint,
          )
        }
        await palette.dialog.getByRole("combobox", { name: "Search" }).waitFor()
        return `close button ${close.width}×${close.height} px; field type ${field.type}`
      },
    },
    {
      name: "CommandPalette at 390 px: every result row is at least 44 px tall, a long label " +
        "stops at two lines and a long detail at one",
      pageId: "ui",
      run: async (page) => {
        const palette = await openRemotePalette(page, 390)
        // Short names with no detail, and the long one with its long detail.
        await palette.field.fill("e")
        await palette.dialog.getByRole("option").filter({ hasText: "Dragon fruit" }).waitFor()
        await palette.idle.waitFor({ state: "attached" })
        const read = await palette.dialog.evaluate((dialog) => {
          const lines = (element: Element | null) => {
            if (!(element instanceof HTMLElement)) return { lines: 0, clipped: false }
            const height = element.getBoundingClientRect().height
            return {
              lines: Math.round(height / parseFloat(getComputedStyle(element).lineHeight)),
              clipped: element.scrollHeight > element.clientHeight + 1,
            }
          }
          const rows = [...dialog.querySelectorAll(`[role="option"]`)]
          const long = rows.find((row) => row.textContent?.startsWith("Dragon fruit"))
          const texts = long?.querySelectorAll("span span")
          return {
            heights: rows.map((row) => row.getBoundingClientRect().height),
            label: lines(texts?.[0] ?? null),
            detail: lines(texts?.[1] ?? null),
          }
        })
        const short = read.heights.filter((height) => height < 44)
        if (read.heights.length < 2 || short.length > 0) {
          throw new Error(`row heights ${read.heights.join(", ")}`)
        }
        if (read.label.lines !== 2 || !read.label.clipped) {
          throw new Error(`label: ${read.label.lines} lines, clipped ${read.label.clipped}`)
        }
        if (read.detail.lines !== 1 || !read.detail.clipped) {
          throw new Error(`detail: ${read.detail.lines} lines, clipped ${read.detail.clipped}`)
        }
        return `row heights ${read.heights.map(Math.round).join(", ")} px`
      },
    },
    {
      name:
        "CommandPalette: Escape gives focus back to the trigger, or, with the trigger hidden, " +
        "to the element that had focus before it opened, and leaves none in the closed dialog",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        const card = page.locator("#demo-CommandPalette")
        const trigger = card.locator(`[data-e2e="palette-local-open"]`)
        const other = card.locator(`[data-e2e="palette-remote-open"]`)
        const dialog = page.locator(`dialog[data-e2e="palette-local"]`)
        const field = dialog.getByRole("combobox")
        const closeWithEscape = async () => {
          await field.and(page.locator(":focus")).waitFor()
          await page.keyboard.press("Escape")
          await dialog.waitFor({ state: "hidden" })
        }

        await trigger.click()
        await closeWithEscape()
        await trigger.and(page.locator(":focus")).waitFor()

        // An app that opens the palette from controls of its own hides the trigger and clicks it,
        // here from a key of its own. Ctrl+F8: Ctrl+K would also open the guide's own search.
        await trigger.evaluate((button) => {
          const hidden = button as HTMLElement
          hidden.style.display = "none"
          document.addEventListener("keydown", (event) => {
            if (event.key !== "F8" || !event.ctrlKey) return
            event.preventDefault()
            hidden.click()
          })
        })
        await other.focus()
        await page.keyboard.press("Control+F8")
        await closeWithEscape()
        await other.and(page.locator(":focus")).waitFor()

        await other.evaluate((button) => (button as HTMLElement).blur())
        await page.keyboard.press("Control+F8")
        await closeWithEscape()
        const focused = await page.evaluate(() => {
          const active = document.activeElement
          return active === document.body ? "body" : active?.outerHTML.slice(0, 80) ?? "none"
        })
        if (focused !== "body") {
          throw new Error(`focus after Escape with nothing before: ${focused}`)
        }
      },
    },
  ]
}

/** The bubble's horizontal edges and the viewport's width, for a `Tooltip` inside `selector`. */
function bubbleEdges(page: Page, selector: string) {
  return page.locator(`${selector} [role="tooltip"] > span`).evaluate((bubble) => {
    const box = bubble.getBoundingClientRect()
    return { left: box.left, right: box.right, width: document.documentElement.clientWidth }
  })
}

/**
 * `Tooltip`, `Progress`, `ZoomableImages` and `ErrorBoundary` give the feedback they promise
 * (#854): a hint stays on screen, a hint and a bar have their names, every image container zooms,
 * and the error screen goes away after a reload port that does not reload. The `focusable={false}`
 * spec replaces `groupTriggerNameCheck` from `pages/checks/ui.ts`, which read the hint off the
 * group.
 */
function feedbackComponentSpecs(): Spec[] {
  return [
    {
      name: "Tooltip: a long hint on a trigger at the left edge of a 390 px screen stays inside it",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 800 })
        const live = `#demo-Tooltip [data-e2e="tooltip-live"]`
        const trigger = page.locator(`${live} button`)
        // Pinned to the left edge of the screen, as a trigger in an app's first column would be.
        await trigger.evaluate((element) =>
          element.setAttribute("style", "position: fixed; left: 0; top: 200px")
        )
        const before = await bubbleEdges(page, live)
        await trigger.focus()
        try {
          await page.waitForFunction(
            (selector) => {
              const bubble = document.querySelector(`${selector} [role="tooltip"] > span`)
              const box = bubble?.getBoundingClientRect()
              const width = document.documentElement.clientWidth
              return box !== undefined && box.left >= 0 && box.right <= width
            },
            live,
            { timeout: 3_000 },
          )
        } catch {
          const after = await bubbleEdges(page, live)
          throw new Error(
            `the bubble spans ${after.left}…${after.right} px in a ${after.width} px viewport`,
          )
        }
        const after = await bubbleEdges(page, live)
        if (before.left >= 0) {
          throw new Error(`the pinned hint starts at ${before.left} px, so nothing needed clamping`)
        }
        return `bubble ${Math.round(before.left)}…${Math.round(before.right)} px moved to ` +
          `${Math.round(after.left)}…${Math.round(after.right)} px of ${after.width}`
      },
    },
    {
      name: "Tooltip: with focusable={false}, the focused control is described by the hint",
      pageId: "ui",
      run: async (page) => {
        const control = page.locator(`#demo-Tooltip [data-e2e="tooltip-group-control"]`)
        await control.focus()
        await control.and(page.locator(":focus")).waitFor()
        await control.and(page.locator("[aria-describedby]")).waitFor()
        const cdp = await page.context().newCDPSession(page)
        try {
          const { root } = await cdp.send("DOM.getDocument", { depth: 0 })
          const { nodeId } = await cdp.send("DOM.querySelector", {
            nodeId: root.nodeId,
            selector: `#demo-Tooltip [data-e2e="tooltip-group-control"]`,
          })
          const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
            nodeId,
            fetchRelatives: false,
          })
          const description = nodes[0]?.description?.value
          if (description !== "Keeps its own tab stop") {
            throw new Error(`the focused button's description is ${JSON.stringify(description)}`)
          }
          // The group around it keeps the name and adds no tab stop of its own.
          const group = await control.evaluate((button) => {
            const wrapper = button.closest('[role="group"]')
            return {
              name: wrapper?.getAttribute("aria-label") ?? null,
              tabindex: wrapper?.hasAttribute("tabindex") ?? true,
              buttons: wrapper?.querySelectorAll("button").length ?? 0,
            }
          })
          if (group.name !== "Archive the invoice" || group.tabindex || group.buttons !== 1) {
            throw new Error(`the group around the control: ${JSON.stringify(group)}`)
          }
          return `description "${description}", inside a group named "${group.name}"`
        } finally {
          await cdp.detach()
        }
      },
    },
    {
      name: "Progress: a bar with ariaLabel and no caption passes axe's aria-progressbar-name",
      pageId: "ui",
      run: async (page) => {
        // The one bar in the card with no caption to point at.
        const selector = `#demo-Progress [role="progressbar"]:not([aria-labelledby])`
        await page.locator(selector).waitFor()
        const { violations, passes } = await new AxeBuilder({ page })
          .include(selector)
          .withRules(["aria-progressbar-name"])
          .analyze()
        if (violations.length > 0) {
          throw new Error(violations.map(({ id, nodes }) => `${id} on ${nodes.length}`).join(", "))
        }
        if (passes.flatMap(({ nodes }) => nodes).length !== 1) {
          throw new Error("axe did not check the uncaptioned bar")
        }
      },
    },
    {
      name: "ZoomableImages: a second [data-lightbox] container zooms, and a parent re-render " +
        "leaves the focused image focused and its marks untouched",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ZoomableImages")
        const image = card.locator(`[data-e2e="lightbox-second-image"]`)
        const moves = card.locator(`[data-e2e="lightbox-focus-moves"]`)
        await image.and(page.locator(`[role="button"][tabindex="0"]`)).waitFor()
        await image.evaluate((element) => {
          const seen: string[] = []
          ;(globalThis as { __imageMutations?: string[] }).__imageMutations = seen
          new MutationObserver((records) => {
            for (const record of records) seen.push(record.attributeName ?? "")
          }).observe(element, {
            attributes: true,
            attributeFilter: ["role", "tabindex", "aria-label", "data-lightbox-zoom"],
          })
        })
        const movesBefore = Number(await moves.textContent())
        await image.focus()
        await moves.filter({ hasText: String(movesBefore + 1) }).waitFor()
        // The re-render's effects run after a frame; give them two before reading.
        await page.evaluate(() =>
          new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
        )
        const after = await image.evaluate((element) => ({
          focused: document.activeElement === element,
          mutations: (globalThis as { __imageMutations?: string[] }).__imageMutations ?? [],
        }))
        if (!after.focused || after.mutations.length > 0) {
          throw new Error(
            `focused ${after.focused}; attributes rewritten: [${after.mutations.join(", ")}]`,
          )
        }

        await page.keyboard.press("Enter")
        const dialog = page.locator("dialog:modal")
        await dialog.getByText("A placeholder image in the second container").first().waitFor()
        await card.locator(`[data-e2e="lightbox-opened"]`).filter({ hasText: "1" }).waitFor()
        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "detached" })
        await image.and(page.locator(":focus")).waitFor()
      },
    },
    {
      name: "ErrorBoundary: an onReload that does not reload brings the children back",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ErrorBoundary")
        const view = card.locator(`[data-e2e="error-boundary-break"]`)
        const alert = card.getByRole("alert")
        await view.click()
        await alert.waitFor()
        await alert.getByRole("button", { name: "Reload the page" }).click()
        await view.waitFor()
        await alert.waitFor({ state: "detached" })
        await card.locator(`[data-e2e="error-boundary-reloads"]`).filter({ hasText: "1" }).waitFor()
      },
    },
  ]
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
async function kanbanDemo(page: Page) {
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
        await kanban.liveIs("Put back Write the release notes in To do, position 1 of 3.")
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

/**
 * A controlled `Combobox` keeps its query when it closes (#874), and every `EnhancedForm` demo keeps
 * a gap between its last field and its submit button.
 */
function comboboxAndFormGapSpecs(): Spec[] {
  return [
    {
      name:
        "Combobox: blurring a controlled search field leaves its query alone and fetches nothing",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Combobox")
        const field = card.locator("#guide-combobox-fetch")
        const note = card.locator(`[data-e2e="combobox-fetch"]`)
        await field.click()
        await field.pressSequentially("B")
        await note.filter({ hasText: /^\d+ options · nothing selected · query "B"$/ }).waitFor()
        await field.press("Tab")
        await field.and(page.locator(`[aria-expanded="false"]`)).waitFor()
        // `onQueryChange` would be called inside the blur handler, so the render that closes the
        // list is the one that would show the call: no later read can see more.
        const calls = await countedCalls(card)
        if (calls !== 1) {
          throw new Error(`${calls} onQueryChange calls after one keystroke and a blur`)
        }
        const closed = (await note.textContent())?.replace(/\s+/g, " ").trim()
        if (closed?.includes("fetching") || !closed?.endsWith(`query "B"`)) {
          throw new Error(`after the blur the card reads "${closed}"`)
        }
      },
    },
    {
      name:
        "Combobox: the clear button calls a controlled caller's onQueryChange once, open or closed",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Combobox")
        const field = card.locator("#guide-combobox-fetch")
        // The field's own clear button, beside the input: every field on the card has one.
        const clear = field.locator("xpath=..").getByRole("button", { name: "Clear selection" })
        const note = card.locator(`[data-e2e="combobox-fetch"]`)
        const cleared = async (expected: number, how: string) => {
          await note.filter({ hasText: /· nothing selected$/ }).waitFor()
          const calls = await countedCalls(card)
          if (calls !== expected) throw new Error(`${calls} calls after clearing ${how}`)
        }

        await field.click()
        await field.pressSequentially("B")
        await note.filter({ hasText: `query "B"` }).waitFor()
        await clear.click()
        await cleared(2, "the open field")

        await field.click()
        await field.pressSequentially("B")
        await note.filter({ hasText: `query "B"` }).waitFor()
        await field.press("Tab")
        await field.and(page.locator(`[aria-expanded="false"]`)).waitFor()
        await clear.click()
        await cleared(4, "the closed field")
      },
    },
    // The `EnhancedForm` demos whose submit row sits under a field, by their `data-e2e` hook.
    ...["enhanced-form", "contact-form", "controlled-form", "focus-demo"].map((hook): Spec => ({
      name: `EnhancedForm demo "${hook}": a gap separates the last field from the submit button`,
      pageId: "ui",
      run: async (page) => {
        const form = page.locator(`[data-e2e="${hook}"] form`).first()
        const gap = await form.evaluate((element) => {
          const row = element.querySelector(`button[type="submit"]`)?.parentElement
          let above = row?.previousElementSibling ?? null
          // The honeypot is positioned out of the flow; the gap is to the field a person sees.
          while (above !== null && getComputedStyle(above).position === "absolute") {
            above = above.previousElementSibling
          }
          if (row === undefined || row === null || above === null) return null
          return row.getBoundingClientRect().top - above.getBoundingClientRect().bottom
        })
        if (gap === null) throw new Error("no submit row with a field above it")
        if (gap < 12) throw new Error(`${gap} px between the last field and the submit row`)
        return `${gap} px`
      },
    })),
  ]
}

/**
 * How many times the Combobox card's fetching field has called `onQueryChange`, read off the
 * `data-query-calls` attribute of its wrapper.
 *
 * @param card The Combobox card.
 */
async function countedCalls(card: Locator): Promise<number> {
  const text = await card.locator(`[data-e2e="combobox-fetch-card"]`)
    .getAttribute("data-query-calls") ?? ""
  const calls = Number(text === "" ? Number.NaN : text)
  if (Number.isNaN(calls)) throw new Error(`the card reports no call count: "${text}"`)
  return calls
}

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

/** Avatar's early failure, CommandPalette's pointer rule, Badge's port and Modal's backdrop record. */
function smallFixSpecs(): Spec[] {
  return [
    {
      name: "Avatar: an image that failed before the bundle ran shows the initials",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Avatar")
        await card.locator(`span[role="img"][aria-label="Alan Turing"]`)
          .getByText("AT", { exact: true }).waitFor()
        const images = await card.locator(`img[alt="Alan Turing"]`).count()
        if (images !== 0) throw new Error(`the broken image is still drawn (${images})`)
      },
    },
    {
      name: "CommandPalette: the pointer over a result leaves the highlight where the keys put it",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.locator(`#demo-CommandPalette [data-e2e="palette-local-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="palette-local"]`)
        const options = dialog.getByRole("option")
        await options.nth(1).waitFor()
        await options.nth(0).and(page.locator(`[aria-selected="true"]`)).waitFor()
        await options.nth(1).hover()
        // Effects and handlers have run by the next frame.
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)))
        const selected = await options.evaluateAll((rows) =>
          rows.map((row) => row.getAttribute("aria-selected"))
        )
        if (selected[0] !== "true" || selected[1] !== "false") {
          throw new Error(`aria-selected after a hover: ${JSON.stringify(selected.slice(0, 2))}`)
        }
        await page.keyboard.press("ArrowDown")
        await options.nth(1).and(page.locator(`[aria-selected="true"]`)).waitFor()
      },
    },
    {
      name: "Badge: a plain click on a linked badge with navigate calls it and stays on the page",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Badge")
        const before = page.url()
        await card.getByRole("link", { name: "system page" }).click()
        await card.locator(`[data-e2e="badge-navigated"]`)
          .getByText("navigate(#/system)", { exact: true }).waitFor()
        if (page.url() !== before) throw new Error(`the page moved to ${page.url()}`)
      },
    },
    {
      name:
        "Modal: a scripted click after a backdrop press that never became a click keeps it open",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.locator(`#demo-Modal [data-e2e="modal-form-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="guide-modal-form"]`)
        const open = page.locator(`dialog[data-e2e="guide-modal-form"]:modal`)
        await open.waitFor()
        await dialog.evaluate((element) => {
          // A press on the backdrop, in its top-left corner, that no click follows.
          element.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5 }),
          )
          ;(element as HTMLElement).click()
        })
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)))
        if (await open.count() !== 1) throw new Error("the scripted click closed the dialog")
        await page.mouse.click(5, 5)
        await open.waitFor({ state: "detached" })
      },
    },
  ]
}
