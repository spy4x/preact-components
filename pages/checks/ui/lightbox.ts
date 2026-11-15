import { check, type Devtools, poll } from "../harness.ts"
import { aimAt, type Box, clickAt, holdsFor } from "./shared.ts"

/** The standalone `Lightbox` card's fourth button, and the dialog it tries to open. */
const LIGHTBOX_EMPTY_CARD = '#demo-Lightbox [data-e2e="lightbox-empty"]'

const LIGHTBOX_EMPTY_BUTTON = '#demo-Lightbox [data-e2e="lightbox-empty-open"]'

/**
 * `Lightbox` refuses to call `showModal()` when every image it was given has no description —
 * `canOpen`'s `total > 0` half. No unit test can reach this: a closed dialog and one refused open
 * for having nothing to show render identical server HTML (`open && current && …` is `false`
 * either way, since `current` is already `null` when `total` is `0`), so only a real
 * `dialog.matches(":modal")` reading, after a real click, can tell the two apart.
 *
 * `holdsFor` is the shape this needs, not `poll`: there is no state to wait *for* here, since
 * correct behaviour is that nothing ever changes, and polling for `:modal` becoming `true` would
 * time out and read as "closed" either way. What `holdsFor` alone cannot tell apart — found in
 * review — is "`canOpen` correctly refused" from "the button did nothing at all": both leave
 * `:modal` `false` forever. `data-requested` on the card's wrapper, flipped by the demo's own
 * `onClick`, is the missing half: asserting it became `true` is what makes a no-op button fail this
 * check instead of passing it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function lightboxRefusesEmptyCheck(devtools: Devtools): Promise<void> {
  const readModal = () =>
    devtools.evaluate<boolean>(
      `document.querySelector('${LIGHTBOX_EMPTY_CARD} dialog')?.matches(":modal") === true`,
    )
  // The card's own record of whether the button was pressed, read off the wrapper rather than
  // inferred from the dialog: a check that only ever reads "never became :modal" cannot tell
  // `canOpen` correctly refusing apart from the button silently doing nothing, and a demo whose
  // onClick was replaced with a no-op stayed green under the version of this check that only read
  // `:modal` — found in review.
  const readRequested = () =>
    devtools.evaluate<boolean>(
      `document.querySelector('${LIGHTBOX_EMPTY_CARD}')?.getAttribute("data-requested") === "true"`,
    )

  const before = await readModal()
  const requestedBefore = await readRequested()
  const clicked = await devtools.evaluate<boolean>(`(() => {
    const button = document.querySelector('${LIGHTBOX_EMPTY_BUTTON}')
    if (button) button.click()
    return Boolean(button)
  })()`)
  await poll(readRequested, 3_000)
  const requestedAfter = await readRequested()
  const stayedClosed = await holdsFor(async () => !(await readModal()), 1_000)

  check(
    "Lightbox refuses to open when every image it was given lacks a description",
    clicked && !before && !requestedBefore && requestedAfter && stayedClosed.held,
    !clicked
      ? "the card has no lightbox-empty-open button to press"
      : !requestedAfter
      ? "the button was pressed but the card never recorded the request, so this proves nothing " +
        "about canOpen"
      : stayedClosed.held
      ? `pressed the button that opens a lightbox with one undescribed image (requested: ` +
        `${requestedBefore} → ${requestedAfter}); the dialog never became :modal in ` +
        `${stayedClosed.elapsedMs}ms`
      : `the dialog became :modal ${stayedClosed.elapsedMs}ms after the press, though the one ` +
        `image it was given has no description`,
  )

  // Teardown, unconditional: a broken canOpen would leave this dialog in the top layer, which
  // would take Modal's own checks down with it — Modal runs last in this file precisely because it
  // cannot tolerate that.
  await devtools.evaluate<null>(`(() => {
    const dialog = document.querySelector('${LIGHTBOX_EMPTY_CARD} dialog')
    if (dialog && dialog.open) dialog.close()
    return null
  })()`)
}

/** The standalone `Lightbox` card's default dialog, and its `controls="below"` one. */
const LIGHTBOX_DEFAULT_DIALOG = "#demo-Lightbox dialog"

const LIGHTBOX_BELOW = '#demo-Lightbox [data-e2e="lightbox-below"]'

const LIGHTBOX_BELOW_DIALOG = `${LIGHTBOX_BELOW} dialog`

const LIGHTBOX_BELOW_BUTTON = '#demo-Lightbox [data-e2e="lightbox-below-open"]'

/** One reading of a lightbox dialog: what it shows, and where its parts sit. */
interface LightboxLayout {
  /** Whether the dialog is genuinely `:modal`; every other field is empty when it is not. */
  open: boolean
  alt: string
  /** The URL the browser chose to load, which tells a `<picture>`'s WebP source from its fallback. */
  currentSrc: string
  /** Whether the image has finished loading, and its intrinsic height then. */
  loaded: boolean
  naturalHeight: number
  image: Box | null
  close: Box | null
  previous: Box | null
  next: Box | null
  /** The box around previous, counter and next, in the row layout; `null` in the overlay one. */
  row: Box | null
  /** Whether `elementFromPoint` at the image's own centre reads the image, not a control. */
  imageOnTop: boolean
  viewportWidth: number
  viewportHeight: number
}

/** Read {@link LightboxLayout} off the dialog `selector` names, in one round trip. */
function readLightboxLayout(devtools: Devtools, selector: string): Promise<LightboxLayout> {
  return devtools.evaluate<LightboxLayout>(`(() => {
    const dialog = document.querySelector('${selector}')
    const modal = Boolean(dialog) && dialog.matches(":modal")
    const box = (element) => {
      if (!element) return null
      const r = element.getBoundingClientRect()
      return {
        top: Math.round(r.top),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
      }
    }
    const img = modal ? dialog.querySelector("img") : null
    const previous = modal ? dialog.querySelector('button[aria-label="Previous image"]') : null
    const next = modal ? dialog.querySelector('button[aria-label="Next image"]') : null
    const row = previous && previous.parentElement === next?.parentElement &&
        getComputedStyle(previous).position === "static"
      ? previous.parentElement
      : null
    let imageOnTop = false
    if (img) {
      const r = img.getBoundingClientRect()
      imageOnTop = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === img
    }
    return {
      open: modal,
      alt: img ? img.getAttribute("alt") : "",
      currentSrc: img ? img.currentSrc : "",
      loaded: img ? img.complete && img.naturalHeight > 0 : false,
      naturalHeight: img ? img.naturalHeight : 0,
      image: box(img),
      close: modal ? box(dialog.querySelector('button[aria-label="Close"]')) : null,
      previous: box(previous),
      next: box(next),
      row: box(row),
      imageOnTop,
      // The layout viewport, without a classic scrollbar: the box a fixed, full-size dialog fills.
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
    }
  })()`)
}

/** Whether `inner` lies wholly inside the viewport `layout` was read in. */
function insideViewport(inner: Box | null, layout: LightboxLayout): boolean {
  return inner !== null && inner.top >= 0 && inner.left >= 0 &&
    inner.bottom <= layout.viewportHeight && inner.right <= layout.viewportWidth
}

/** Whether two boxes overlap. */
function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/**
 * One finger, pressed at `from` and lifted `dx`/`dy` away, through the browser's own touch input.
 *
 * @param devtools The connected session.
 * @param from Where the finger goes down, in viewport pixels.
 * @param dx Horizontal travel; negative is leftward.
 * @param dy Vertical travel; negative is upward.
 */
async function swipe(
  devtools: Devtools,
  from: { x: number; y: number },
  dx: number,
  dy: number,
): Promise<void> {
  await devtools.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] })
  for (const step of [0.25, 0.5, 0.75, 1]) {
    await devtools.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: Math.round(from.x + dx * step), y: Math.round(from.y + dy * step) }],
    })
  }
  await devtools.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}

/** Close the dialog `selector` names if it is open, whatever state a check left it in. */
async function closeDialog(devtools: Devtools, selector: string): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    const dialog = document.querySelector('${selector}')
    if (dialog && dialog.open) dialog.close()
    return null
  })()`)
}

/**
 * The options #508 added to `Lightbox`, in the browser: the default dialog keeps its controls
 * `1rem` from the edges; with `controls="below"` a 780×1688 image fits a 1440×900 window with the
 * counter and previous/next in a row under it, and a real click on that row's next button moves on;
 * an image with `webpSrc` loads the WebP source; a sideways swipe pages while a short or vertical
 * one does not; and on a phone turned sideways with a 47px safe-area inset, the close button
 * clears it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function lightboxOptionsChecks(devtools: Devtools): Promise<void> {
  try {
    await devtools.evaluate<null>(
      `(document.querySelector('#demo-Lightbox button').click(), null)`,
    )
    await poll(
      async () => (await readLightboxLayout(devtools, LIGHTBOX_DEFAULT_DIALOG)).open,
      3_000,
    )
    const overlay = await readLightboxLayout(devtools, LIGHTBOX_DEFAULT_DIALOG)
    const overlayOffsets = overlay.close && overlay.previous && overlay.next
      ? {
        closeTop: overlay.close.top,
        closeRight: overlay.viewportWidth - overlay.close.right,
        previousLeft: overlay.previous.left,
        nextRight: overlay.viewportWidth - overlay.next.right,
      }
      : null
    check(
      "the default Lightbox keeps close, previous and next 16px from the edges, over the image",
      overlay.open && overlayOffsets !== null && overlay.row === null &&
        Object.values(overlayOffsets).every((offset) => offset === 16),
      overlay.open
        ? `offsets ${JSON.stringify(overlayOffsets)}, row layout: ${overlay.row !== null}`
        : "the default dialog never opened",
    )
    await closeDialog(devtools, LIGHTBOX_DEFAULT_DIALOG)

    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await devtools.evaluate<null>(
      `(document.querySelector('${LIGHTBOX_BELOW_BUTTON}').click(), null)`,
    )
    await poll(
      async () => (await readLightboxLayout(devtools, LIGHTBOX_BELOW_DIALOG)).loaded,
      3_000,
    )
    const tall = await readLightboxLayout(devtools, LIGHTBOX_BELOW_DIALOG)
    const tallFits = tall.image !== null && tall.row !== null && tall.close !== null &&
      tall.naturalHeight === 1688 && insideViewport(tall.image, tall) &&
      insideViewport(tall.row, tall) && tall.row.top >= tall.image.bottom &&
      !overlaps(tall.close, tall.image) && tall.imageOnTop
    check(
      `with controls="below", a 780×1688 image fits a 1440×900 window and the counter, previous ` +
        `and next sit in one row under it`,
      tall.open && tallFits,
      tall.open
        ? `natural height ${tall.naturalHeight}; image ${JSON.stringify(tall.image)}; row ` +
          `${JSON.stringify(tall.row)}; close ${JSON.stringify(tall.close)}; image uncovered at ` +
          `its centre: ${tall.imageOnTop}; viewport ${tall.viewportWidth}×${tall.viewportHeight}`
        : "the controls-below dialog never opened",
    )

    await devtools.evaluate<null>(`(() => {
      globalThis.__verifyBelowNext =
        document.querySelector('${LIGHTBOX_BELOW_DIALOG} button[aria-label="Next image"]')
      return null
    })()`)
    const nextAim = await aimAt(devtools, "globalThis.__verifyBelowNext")
    const nextLanding = nextAim.onTarget
      ? await clickAt(devtools, nextAim, "globalThis.__verifyBelowNext")
      : null
    await poll(async () => {
      const now = await readLightboxLayout(devtools, LIGHTBOX_BELOW_DIALOG)
      return now.alt !== tall.alt && now.loaded
    }, 3_000)
    const webp = await readLightboxLayout(devtools, LIGHTBOX_BELOW_DIALOG)
    check(
      "a real click on the row's next button moves on, to the image whose WebP source the browser loads",
      tall.open && nextAim.onTarget && webp.alt === "A teal rectangle, sent as WebP" &&
        webp.currentSrc.startsWith("data:image/webp"),
      nextAim.onTarget
        ? `"${tall.alt}" → click → "${webp.alt}", loaded ${webp.currentSrc.slice(0, 22)}…`
        : `no press was sent: the point landed on ${nextLanding?.tag ?? nextAim.tag}`,
    )

    const centre = webp.image
      ? {
        x: Math.round((webp.image.left + webp.image.right) / 2),
        y: Math.round((webp.image.top + webp.image.bottom) / 2),
      }
      : { x: 720, y: 450 }
    const altNow = () =>
      readLightboxLayout(devtools, LIGHTBOX_BELOW_DIALOG).then((layout) => layout.alt)

    await swipe(devtools, centre, -30, 0)
    const afterShort = await holdsFor(async () => (await altNow()) === webp.alt, 500)
    await swipe(devtools, centre, -80, 160)
    const afterVertical = await holdsFor(async () => (await altNow()) === webp.alt, 500)
    check(
      "a 30px sideways swipe and a mostly vertical drag both leave the image where it was",
      webp.open && afterShort.held && afterVertical.held,
      `short swipe held: ${afterShort.held}; vertical drag held: ${afterVertical.held}; now ` +
        `"${await altNow()}"`,
    )

    await swipe(devtools, centre, -120, 10)
    await poll(async () => (await altNow()) !== webp.alt, 3_000)
    const afterLeftward = await altNow()
    await swipe(devtools, centre, 120, -10)
    await poll(async () => (await altNow()) !== afterLeftward, 3_000)
    const afterRightward = await altNow()
    check(
      "a leftward swipe shows the next image and a rightward swipe the previous one",
      webp.open && afterLeftward === "An orange rectangle" && afterRightward === webp.alt,
      `"${webp.alt}" → leftward → "${afterLeftward}" → rightward → "${afterRightward}"`,
    )

    // Two fingers dragged sideways together, as a pinch or a two-finger pan does. Run after the
    // one-finger swipes on purpose: afterwards Chromium's emulated touch list still reports one
    // finger down, so a one-finger swipe sent later would do nothing either way.
    const beforePinch = await altNow()
    await devtools.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: centre.x, y: centre.y, id: 1 }, { x: centre.x, y: centre.y + 60, id: 2 }],
    })
    for (const step of [0.25, 0.5, 0.75, 1]) {
      const x = Math.round(centre.x - 150 * step)
      await devtools.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: centre.y, id: 1 }, { x, y: centre.y + 60, id: 2 }],
      })
    }
    await devtools.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    const afterPinch = await holdsFor(async () => (await altNow()) === beforePinch, 500)
    check(
      "a two-finger sideways drag leaves the image where it was",
      webp.open && beforePinch !== "" && afterPinch.held,
      `"${beforePinch}" → two fingers 150px leftward → held: ${afterPinch.held}, now ` +
        `"${await altNow()}"`,
    )

    // A phone turned sideways: the notch's 47px on either side, the home indicator's 21px below.
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 844,
      height: 390,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await devtools.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 0, left: 47, right: 47, bottom: 21 },
    })
    await devtools.evaluate<null>(
      `new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null))))`,
    )
    const notched = await readLightboxLayout(devtools, LIGHTBOX_BELOW_DIALOG)
    const clearance = notched.close && notched.image && notched.row
      ? {
        closeRight: notched.viewportWidth - notched.close.right,
        closeTop: notched.close.top,
        imageLeft: notched.image.left,
        rowBottom: notched.viewportHeight - notched.row.bottom,
      }
      : null
    check(
      "on a phone turned sideways, the close button clears a 47px safe-area inset",
      notched.open && clearance !== null && clearance.closeRight >= 47 &&
        clearance.closeTop >= 16 && clearance.imageLeft >= 47 && clearance.rowBottom >= 21 &&
        insideViewport(notched.image, notched),
      `clearances ${JSON.stringify(clearance)} in ${notched.viewportWidth}×` +
        `${notched.viewportHeight}`,
    )
  } finally {
    await devtools.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    })
    await devtools.send("Emulation.clearDeviceMetricsOverride")
    await closeDialog(devtools, LIGHTBOX_BELOW_DIALOG)
    await closeDialog(devtools, LIGHTBOX_DEFAULT_DIALOG)
  }
}
