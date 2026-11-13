import { stripNavigationClasses } from "@spy4x/preact-ui/image-gallery"
import { centreInView, check, type Devtools, pointerToCorner, poll, pressKey } from "../harness.ts"
import { aimAt, clickAt } from "./shared.ts"
import { clickAtPoint, elementCenter } from "./shared-forms.ts"

/** The card `ImageGallery`'s and the shared `Lightbox`'s checks drive. */
const GALLERY_CARD = "#demo-ImageGallery"

const GALLERY_DIALOG = `${GALLERY_CARD} dialog`

/** Whether the gallery's lightbox is open, what it shows, and where focus and the live text sit. */
interface GalleryLightboxState {
  /** Whether the dialog is really in the top layer, not merely present and closed. */
  open: boolean
  /** `alt` of the image currently shown, or `""` when none is. */
  imageAlt: string
  /** The always-present live region's text, trimmed. */
  liveText: string
  /** Whether that region is the very element parked on `globalThis` before anything opened. */
  liveSameNode: boolean
  /** Whether the focused element is the thumbnail parked on `globalThis`. */
  focusedIsThumb: boolean
  /** What is focused, for a failure message. */
  focusedLabel: string
}

/** Read {@link GalleryLightboxState} in one round trip. */
function readGalleryState(devtools: Devtools): Promise<GalleryLightboxState> {
  return devtools.evaluate<GalleryLightboxState>(`(() => {
    const dialog = document.querySelector('${GALLERY_DIALOG}')
    const modal = Boolean(dialog) && dialog.matches(":modal")
    const img = modal ? dialog.querySelector("img") : null
    const live = dialog ? dialog.querySelector('[role="status"]') : null
    const active = document.activeElement
    return {
      open: modal,
      // Read only while the dialog is genuinely modal: the <img> is a child of Lightbox's own
      // { open && current && … } branch, which is gated on the *prop* the caller passed, not on
      // dialog.matches(":modal") — so with showModal() itself broken, this element still exists
      // and still carries a real alt, and a check that read it unconditionally would not notice.
      imageAlt: img ? img.getAttribute("alt") : "",
      liveText: live ? live.textContent.trim() : "",
      liveSameNode: live !== null && live === globalThis.__verifyGalleryLive,
      focusedIsThumb: active === globalThis.__verifyGalleryThumb,
      focusedLabel: active
        ? (active.getAttribute("aria-label") || active.tagName)
        : "nothing",
    }
  })()`)
}

/**
 * `ImageGallery`'s thumbnail strip and the shared `Lightbox` it opens, driven in the browser that
 * owns both: a thumbnail opens on a real Enter press and on Space, Left/Right and a real mouse
 * click on the previous/next buttons all page through the sequence and update the live region that
 * was already on the page before anything opened, Escape closes it, and focus returns to the
 * thumbnail that opened it.
 *
 * `ZoomableImages` (`ui/zoomable-images.tsx`) opens the same `Lightbox`, and its own checks
 * (`zoomableImagesChecks`, below) already prove the backdrop click and the linked-image case; this
 * function does not repeat them.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function imageGalleryChecks(devtools: Devtools): Promise<void> {
  // Parked before the dialog is ever opened, so the later identity comparison proves the counter
  // reaches a region that was already on the page rather than one that arrived with its message
  // already inside it.
  await devtools.evaluate<null>(`(() => {
    globalThis.__verifyGalleryLive = document.querySelector('${GALLERY_DIALOG} [role="status"]')
    globalThis.__verifyGalleryThumb = document.querySelector('${GALLERY_CARD} button')
    globalThis.__verifyGalleryThumb.focus()
    return null
  })()`)

  const beforeOpen = await readGalleryState(devtools)
  const focusedThumb = beforeOpen.focusedIsThumb
  await pressKey(devtools, "Space")
  await poll(async () => (await readGalleryState(devtools)).open, 3_000)
  const afterSpace = await readGalleryState(devtools)
  check(
    "a real Space press opens the thumbnail's lightbox",
    focusedThumb && !beforeOpen.open && afterSpace.open,
    focusedThumb
      ? `closed → Space → ${
        afterSpace.open ? `open, showing "${afterSpace.imageAlt}"` : "still closed"
      }`
      : "the thumbnail never took focus, so a key press proves nothing about it",
  )

  await pressKey(devtools, "ArrowRight")
  await poll(async () => (await readGalleryState(devtools)).imageAlt !== afterSpace.imageAlt, 3_000)
  const afterRight = await readGalleryState(devtools)
  check(
    "a real Right press changes the image and announces it, with its position, in the live region that was already there",
    afterSpace.open && afterRight.imageAlt !== afterSpace.imageAlt &&
      afterRight.liveText.includes(afterRight.imageAlt) && afterRight.liveText.includes(" of ") &&
      afterRight.liveSameNode,
    afterSpace.open
      ? `"${afterSpace.imageAlt}" → Right → "${afterRight.imageAlt}", same live region ` +
        `(${afterRight.liveSameNode}) reads "${afterRight.liveText}"`
      : "the lightbox never opened, so Right proves nothing",
  )

  await pressKey(devtools, "ArrowLeft")
  await poll(async () => (await readGalleryState(devtools)).imageAlt !== afterRight.imageAlt, 3_000)
  const afterLeft = await readGalleryState(devtools)
  check(
    "a real Left press changes the image back",
    // Gated on the dialog having genuinely opened and Right having genuinely moved, not merely on
    // Left's own result equalling the start: without both, a Lightbox that never opened at all —
    // or where Right silently did nothing — reads as "unchanged", which a Left that also did
    // nothing would pass just as well. Measured: an earlier version of this check gated on neither
    // and stayed green with `showModal()` deleted from `ui/lightbox.tsx`.
    afterSpace.open && afterRight.imageAlt !== afterSpace.imageAlt &&
      afterLeft.imageAlt === afterSpace.imageAlt,
    afterSpace.open
      ? `"${afterRight.imageAlt}" → Left → "${afterLeft.imageAlt}"`
      : "the lightbox never opened, so Left proves nothing",
  )

  await pressKey(devtools, "Escape")
  await poll(async () => !(await readGalleryState(devtools)).open, 3_000)
  const afterEscape = await readGalleryState(devtools)
  check(
    "a real Escape press closes the lightbox and returns focus to the thumbnail that opened it",
    // Gated on `afterSpace.open`, not on `afterLeft.imageAlt !== ""`: the latter reads the <img>
    // that `Lightbox` renders whenever its `open` *prop* is true, which is not the same fact as
    // the dialog genuinely being `:modal` — measured in review, deleting `showModal()` left that
    // element in the DOM with a real `alt` while `dialog.matches(":modal")` stayed `false`
    // throughout, and this check stayed green regardless. `readGalleryState` now reads `imageAlt`
    // only while the dialog is modal too, so the two guards agree; this one names the fact the
    // check is actually about.
    afterSpace.open && !afterEscape.open && afterEscape.focusedIsThumb,
    afterSpace.open
      ? `open → Escape → open=${afterEscape.open}, focus is on ` +
        `${afterEscape.focusedIsThumb ? "the thumbnail" : afterEscape.focusedLabel}`
      : "the lightbox was never open, so Escape proves nothing",
  )

  // A real Enter key press, carrying `text: "\r"` — see `pressKey`'s own doc in `harness.ts` for why
  // that field is what makes this genuinely a key press rather than a stand-in for one (#261).
  await pressKey(devtools, "Enter")
  await poll(async () => (await readGalleryState(devtools)).open, 3_000)
  const afterEnter = await readGalleryState(devtools)
  check(
    "a real Enter press opens the thumbnail's lightbox",
    afterEscape.focusedIsThumb && !afterEscape.open && afterEnter.open,
    afterEscape.focusedIsThumb
      ? `closed → Enter → ${
        afterEnter.open ? `open, showing "${afterEnter.imageAlt}"` : "still closed"
      }`
      : "focus was not on the thumbnail after Escape, so a key press proves nothing about it",
  )

  // The previous/next buttons, with real mouse presses at their own rectangles — `.click()` fires
  // with no hit-testing, so it would "press" a button covered by something else just as readily as
  // one that is not.
  await devtools.evaluate<null>(`(() => {
    const dialog = document.querySelector('${GALLERY_DIALOG}')
    globalThis.__verifyGalleryNext = dialog?.querySelector('button[aria-label="Next image"]') ?? null
    globalThis.__verifyGalleryPrevious =
      dialog?.querySelector('button[aria-label="Previous image"]') ?? null
    return null
  })()`)

  const nextAim = await aimAt(devtools, "globalThis.__verifyGalleryNext")
  const nextLanding = await clickAt(devtools, nextAim, "globalThis.__verifyGalleryNext")
  await poll(async () => (await readGalleryState(devtools)).imageAlt !== afterEnter.imageAlt, 3_000)
  const afterNextClick = await readGalleryState(devtools)
  check(
    "a real mouse click on the next button moves forward, not backward or nowhere",
    afterEnter.open && nextAim.onTarget && afterNextClick.imageAlt === afterRight.imageAlt,
    afterEnter.open
      ? nextAim.onTarget
        ? `a real press at ${nextAim.x},${nextAim.y} landed on the next button and moved ` +
          `"${afterEnter.imageAlt}" → "${afterNextClick.imageAlt}" (the same image Right moved to)`
        : `no press was sent: the point landed on ${
          nextLanding?.tag ?? nextAim.tag
        }, not the button`
      : "the lightbox never opened, so this proves nothing",
  )

  const previousAim = await aimAt(devtools, "globalThis.__verifyGalleryPrevious")
  const previousLanding = await clickAt(devtools, previousAim, "globalThis.__verifyGalleryPrevious")
  await poll(
    async () => (await readGalleryState(devtools)).imageAlt !== afterNextClick.imageAlt,
    3_000,
  )
  const afterPreviousClick = await readGalleryState(devtools)
  check(
    "a real mouse click on the previous button moves back to where the next button started",
    afterNextClick.imageAlt !== afterEnter.imageAlt && previousAim.onTarget &&
      afterPreviousClick.imageAlt === afterEnter.imageAlt,
    afterNextClick.imageAlt !== afterEnter.imageAlt
      ? previousAim.onTarget
        ? `a real press at ${previousAim.x},${previousAim.y} landed on the previous button and ` +
          `moved "${afterNextClick.imageAlt}" → "${afterPreviousClick.imageAlt}"`
        : `no press was sent: the point landed on ${previousLanding?.tag ?? previousAim.tag}, ` +
          `not the button`
      : "the next button never moved the image, so this proves nothing about the previous one",
  )

  // Teardown, unconditional: `modalChecks` runs last in this file precisely because it cannot
  // tolerate a dialog left in the top layer, and this one has to leave none behind whatever went
  // wrong above.
  await devtools.evaluate<null>(`(() => {
    const dialog = document.querySelector('${GALLERY_DIALOG}')
    if (dialog && dialog.open) dialog.close()
    return null
  })()`)
}

/** The `ImageGallery` card's strip, `layout="strip"`. */
const GALLERY_STRIP = '#demo-ImageGallery [data-e2e="gallery-strip"]'

const GALLERY_STRIP_ROW = `${GALLERY_STRIP} ul`

/** Where the strip's row has scrolled to, and where each image's start sits within the row. */
interface StripReading {
  found: boolean
  scrollLeft: number
  /** The row's own scroll padding on the left, which is where a snapped image's start lands. */
  paddingLeft: number
  /** Each image's left edge, measured from the row's left edge. */
  starts: number[]
}

/** Read {@link StripReading} in one round trip. */
function readStrip(devtools: Devtools): Promise<StripReading> {
  return devtools.evaluate<StripReading>(`(() => {
    const row = document.querySelector('${GALLERY_STRIP_ROW}')
    if (!row) return { found: false, scrollLeft: 0, paddingLeft: 0, starts: [] }
    const left = row.getBoundingClientRect().left
    return {
      found: true,
      scrollLeft: row.scrollLeft,
      paddingLeft: parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0,
      starts: [...row.children].map((item) => item.getBoundingClientRect().left - left),
    }
  })()`)
}

/**
 * Wait until the strip's row stops scrolling sideways: three reads 100 ms apart that agree, after
 * it has left `from`. `settledScroll` watches the page's vertical scroll, not a row's.
 *
 * @returns Whether the row left `from` and came to rest inside the budget.
 */
async function settledStrip(devtools: Devtools, from: number, timeoutMs = 3_000): Promise<boolean> {
  const reads: number[] = []
  return await poll(async () => {
    reads.push((await readStrip(devtools)).scrollLeft)
    const last = reads.slice(-3)
    return last.length === 3 && last[0] !== from && last.every((value) => value === last[0])
  }, timeoutMs)
}

/** The focused element, and whether it sits wholly inside the strip's row and the viewport. */
interface StripFocus {
  label: string
  inStrip: boolean
  insideRow: boolean
  insideViewport: boolean
  rect: string
}

/** Read {@link StripFocus}. */
function readStripFocus(devtools: Devtools): Promise<StripFocus> {
  return devtools.evaluate<StripFocus>(`(() => {
    const row = document.querySelector('${GALLERY_STRIP_ROW}')
    const active = document.activeElement
    const inStrip = Boolean(row && active && row.contains(active))
    if (!inStrip) {
      return { label: active?.getAttribute("aria-label") || active?.tagName || "nothing",
        inStrip, insideRow: false, insideViewport: false, rect: "" }
    }
    const box = active.getBoundingClientRect()
    const area = row.getBoundingClientRect()
    // The row's visible box, without its padding: the strip pads by 4px so a focus ring is not
    // clipped, and an image half-hidden under that padding is not "fully in view".
    const style = getComputedStyle(row)
    const inner = {
      left: area.left + parseFloat(style.paddingLeft) - 0.5,
      right: area.left + row.clientWidth - parseFloat(style.paddingRight) + 0.5,
    }
    return {
      label: active.getAttribute("aria-label"),
      inStrip,
      insideRow: box.left >= inner.left && box.right <= inner.right,
      insideViewport: box.top >= -0.5 && box.bottom <= document.documentElement.clientHeight + 0.5 &&
        box.left >= -0.5 && box.right <= document.documentElement.clientWidth + 0.5,
      rect: \`\${Math.round(box.left)}–\${Math.round(box.right)} in row \${Math.round(inner.left)}–\${Math.round(inner.right)}, top \${Math.round(box.top)} bottom \${Math.round(box.bottom)}\`,
    }
  })()`)
}

/**
 * `ImageGallery`'s strip layout (#539): a real sideways wheel lands the row on an image's start
 * rather than where the wheel left it, Tab brings each image wholly into view, Enter opens the
 * focused one in `Lightbox`, and a real mouse click on the half-shown next image opens it at once.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function imageGalleryStripChecks(devtools: Devtools): Promise<void> {
  await centreInView(devtools, `document.querySelector('${GALLERY_STRIP_ROW}')`)
  await devtools.evaluate<null>(
    `(document.querySelector('${GALLERY_STRIP_ROW}')?.scrollTo({ left: 0, behavior: "instant" }), null)`,
  )

  // A real wheel, 60% of one image's width: without snapping the row would stop part-way through
  // the first image; with it, the row lands on the second image's start.
  const aim = await devtools.evaluate<{ x: number; y: number; delta: number } | null>(`(() => {
    const row = document.querySelector('${GALLERY_STRIP_ROW}')
    if (!row || !row.children[0]) return null
    const box = row.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2,
      delta: Math.round(row.children[0].getBoundingClientRect().width * 0.6) }
  })()`)
  if (aim) {
    await devtools.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: aim.x,
      y: aim.y,
      deltaX: aim.delta,
      deltaY: 0,
    })
  }
  const moved = await settledStrip(devtools, 0)
  const snapped = await readStrip(devtools)
  const landedOn = snapped.starts.findIndex((start) => Math.abs(start - snapped.paddingLeft) <= 1)
  check(
    "a sideways wheel on the ImageGallery strip lands the row on an image's start, not part-way through one",
    aim !== null && moved && landedOn >= 1,
    aim === null
      ? "the strip's row is not on the page"
      : `wheel by ${aim.delta}px → scrollLeft ${snapped.scrollLeft}, came to rest ${moved}; ` +
        `image starts ${
          snapped.starts.map(Math.round).join(", ")
        } against padding ${snapped.paddingLeft}`,
  )

  // Back to the start, the first image focused, then a real Tab press for each later image.
  await devtools.evaluate<null>(`(() => {
    const row = document.querySelector('${GALLERY_STRIP_ROW}')
    row?.scrollTo({ left: 0, behavior: "instant" })
    row?.querySelector("button")?.focus()
    return null
  })()`)
  const total = snapped.starts.length
  const seen: StripFocus[] = []
  for (let step = 1; step < total; step++) {
    const from = (await readStrip(devtools)).scrollLeft
    await pressKey(devtools, "Tab")
    await settledStrip(devtools, from, 1_500)
    seen.push(await readStripFocus(devtools))
  }
  check(
    "Tab moves through every ImageGallery strip image and brings each one wholly into view",
    total >= 3 && seen.length === total - 1 &&
      seen.every((focus) => focus.inStrip && focus.insideRow && focus.insideViewport),
    seen.map((focus) =>
      `${focus.label}: ${
        focus.inStrip
          ? `row ${focus.insideRow}, viewport ${focus.insideViewport} (${focus.rect})`
          : "not in the strip"
      }`
    ).join("; ") || "no Tab was pressed",
  )

  const focused = seen.at(-1)
  await pressKey(devtools, "Enter")
  const opened = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${GALLERY_STRIP} dialog')?.matches(":modal") === true`,
      ),
    3_000,
  )
  const shown = await devtools.evaluate<string>(
    `document.querySelector('${GALLERY_STRIP} dialog img')?.getAttribute("alt") ?? ""`,
  )
  check(
    "Enter on a focused ImageGallery strip image opens that image in the lightbox",
    focused !== undefined && focused.inStrip && opened && shown === focused.label,
    `focused "${focused?.label}", Enter → ${opened ? `open, showing "${shown}"` : "still closed"}`,
  )

  await pressKey(devtools, "Escape")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${GALLERY_STRIP} dialog')?.matches(":modal") !== true`,
      ),
    3_000,
  )

  // A real mouse press and release on the half-shown second image, the row at its start. Chromium
  // focuses the button on the press; if that focus scrolled the row, the release would land on
  // another element and no click would fire.
  await centreInView(devtools, `document.querySelector('${GALLERY_STRIP_ROW}')`)
  const peek = await devtools.evaluate<
    { x: number; y: number; hit: boolean; label: string; reason: string }
  >(`(() => {
    const row = document.querySelector('${GALLERY_STRIP_ROW}')
    const button = row?.querySelectorAll("button")[1]
    if (!row || !button) return { x: 0, y: 0, hit: false, label: "", reason: "no second image" }
    document.activeElement?.blur()
    row.scrollTo({ left: 0, behavior: "instant" })
    const box = button.getBoundingClientRect()
    const area = row.getBoundingClientRect()
    // The middle of the part of the second image the row shows, vertically in the image's middle.
    // The row is centred in the viewport, below the guide's sticky header.
    const x = Math.round((box.left + Math.min(box.right, area.left + row.clientWidth)) / 2)
    const y = Math.round(box.top + box.height / 2)
    const under = document.elementFromPoint(x, y)
    return { x, y, hit: Boolean(under && button.contains(under)),
      label: button.getAttribute("aria-label") ?? "",
      reason: \`point \${x},\${y} hits \${under?.tagName ?? "nothing"}; image \${Math.round(box.left)}–\${Math.round(box.right)}, row ends \${Math.round(area.left + row.clientWidth)}\` }
  })()`)
  if (peek.hit) await clickAtPoint(devtools, peek)
  const clickOpened = peek.hit && await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${GALLERY_STRIP} dialog')?.matches(":modal") === true`,
      ),
    3_000,
  )
  const clickShown = await devtools.evaluate<{ alt: string; scrollLeft: number }>(`({
    alt: document.querySelector('${GALLERY_STRIP} dialog img')?.getAttribute("alt") ?? "",
    scrollLeft: document.querySelector('${GALLERY_STRIP_ROW}')?.scrollLeft ?? -1,
  })`)
  check(
    "a real mouse click on the half-shown second ImageGallery strip image opens that image at once",
    peek.hit && clickOpened && clickShown.alt === peek.label,
    `${peek.reason} → ${
      clickOpened ? `open, showing "${clickShown.alt}"` : "still closed"
    }, row scrollLeft ${clickShown.scrollLeft}, expected "${peek.label}"`,
  )

  await pressKey(devtools, "Escape")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${GALLERY_STRIP} dialog')?.matches(":modal") !== true`,
      ),
    3_000,
  )
  await pointerToCorner(devtools)
}

/** What {@link imageGalleryStripSizeChecks} measures of the strip and its image-blocked copy. */
interface StripSizeReading {
  found: boolean
  /** Each real strip image's `loading` attribute, `null` where it has none. */
  loading: (string | null)[]
  /** The real row's height, its first image loaded. */
  rowHeight: number
  firstLoaded: boolean
  /** The copy's row height, its images never loaded. */
  pendingRowHeight: number
  /** Each copy image: whether it loaded, its rendered size, and its `width`/`height` attributes. */
  pending: { loaded: boolean; width: number; height: number; attrW: number; attrH: number }[]
}

/**
 * `ImageGallery`'s strip reserves each image's height before it loads (#560), and loads only the
 * first image up front.
 *
 * The guide's strip images are `data:` URIs, which never reach the network and so cannot be held
 * back. The check copies the rendered row next to itself, points each copied image at a same-origin
 * image whose request `Fetch.enable` pauses, and measures the copy while its first image's request
 * is held: the markup and classes are the component's own, only the sources differ.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function imageGalleryStripSizeChecks(devtools: Devtools): Promise<void> {
  await centreInView(devtools, `document.querySelector('${GALLERY_STRIP_ROW}')`)
  let reading: StripSizeReading | null = null
  let paused = false
  try {
    await devtools.send("Fetch.enable", {
      patterns: [{ urlPattern: "*strip-pending=*", requestStage: "Request" }],
    })
    const held = devtools.once<{ requestId: string }>("Fetch.requestPaused", 10_000)
    held.catch(() => {})
    // Each copied image asks for the Map card's tile, a real image the build ships, under a query
    // no earlier load has cached. Every request the copy starts is held until `Fetch.disable`
    // releases it to the preview server, which answers 200, so none ends as a failed request.
    await devtools.evaluate<null>(`(() => {
      const row = document.querySelector('${GALLERY_STRIP_ROW}')
      if (!row) return null
      const copy = row.cloneNode(true)
      copy.dataset.e2e = "strip-pending-copy"
      const stamp = Date.now()
      copy.querySelectorAll("img").forEach((img, i) => {
        img.src = new URL("map-demo/tile.png?strip-pending=" + stamp + "-" + i, document.baseURI).href
      })
      row.after(copy)
      return null
    })()`)
    paused = await held.then(() => true, () => false)
    reading = await devtools.evaluate<StripSizeReading>(`(() => {
      const row = document.querySelector('${GALLERY_STRIP_ROW}')
      const copy = document.querySelector('[data-e2e="strip-pending-copy"]')
      if (!row || !copy) {
        return { found: false, loading: [], rowHeight: 0, firstLoaded: false, pendingRowHeight: 0,
          pending: [] }
      }
      const first = row.querySelector("img")
      return {
        found: true,
        loading: [...row.querySelectorAll("img")].map((img) => img.getAttribute("loading")),
        rowHeight: row.getBoundingClientRect().height,
        firstLoaded: Boolean(first?.complete && first.naturalWidth > 0),
        pendingRowHeight: copy.getBoundingClientRect().height,
        pending: [...copy.querySelectorAll("img")].map((img) => {
          const box = img.getBoundingClientRect()
          return { loaded: img.complete && img.naturalWidth > 0, width: box.width,
            height: box.height, attrW: Number(img.getAttribute("width")),
            attrH: Number(img.getAttribute("height")) }
        }),
      }
    })()`)
  } finally {
    await devtools.evaluate<null>(
      `(document.querySelector('[data-e2e="strip-pending-copy"]')?.remove(), null)`,
    ).catch(() => null)
    await devtools.send("Fetch.disable", {}).catch(() => {})
  }

  const sized = reading?.pending ?? []
  check(
    "an ImageGallery strip whose images pass width and height has its final height before any image loads",
    reading !== null && reading.found && paused && reading.firstLoaded && sized.length >= 3 &&
      sized.every((image) =>
        !image.loaded && image.attrW > 0 && image.attrH > 0 &&
        Math.abs(image.height - image.width * image.attrH / image.attrW) <= 1
      ) && Math.abs(reading.pendingRowHeight - reading.rowHeight) <= 1,
    reading === null || !reading.found
      ? "the strip's row is not on the page"
      : `first request held ${paused}; loaded row ${reading.rowHeight.toFixed(1)}px (first image ` +
        `loaded ${reading.firstLoaded}), blocked row ${reading.pendingRowHeight.toFixed(1)}px; ` +
        sized.map((image) =>
          `${image.width.toFixed(0)}×${image.height.toFixed(1)} for ${image.attrW}×${image.attrH}` +
          `${image.loaded ? " (loaded)" : ""}`
        ).join(", "),
  )

  const loading = reading?.loading ?? []
  check(
    'ImageGallery strip images after the first are loading="lazy", and the first is not',
    loading.length >= 3 && loading[0] !== "lazy" &&
      loading.slice(1).every((value) => value === "lazy"),
    JSON.stringify(loading),
  )
}

/** The `ImageGallery` card's strip with captions, a counter and Previous/Next. */
const GALLERY_NAV = '#demo-ImageGallery [data-e2e="gallery-strip-nav"]'

/** The same, with a portrait first image and so narrower slides. */
const GALLERY_PORTRAIT = '#demo-ImageGallery [data-e2e="gallery-strip-portrait"]'

/** One strip's navigation, read in one round trip. */
interface StripNavReading {
  found: boolean
  counter: string
  /** Each strip button outside the lightbox: its name and `aria-disabled`. */
  buttons: { label: string; disabled: boolean }[]
  focused: string
  overflows: boolean
  /** How far the counted slide's centre sits from the row's centre, in pixels. */
  offCentre: number
  /** Each slide's width. */
  widths: number[]
}

/** Read {@link StripNavReading} for the strip under `card`. */
function readStripNav(devtools: Devtools, card: string): Promise<StripNavReading> {
  return devtools.evaluate<StripNavReading>(`(() => {
    const row = document.querySelector('${card} ul')
    const counter = document.querySelector('${card} p[aria-live]')
    if (!row || !counter) {
      return { found: false, counter: "", buttons: [], focused: "", overflows: false, offCentre: 0,
        widths: [] }
    }
    const text = counter.textContent.trim()
    const index = Number(text.split(" / ")[0]) - 1
    const box = row.getBoundingClientRect()
    const slide = row.children[index]?.getBoundingClientRect()
    return {
      found: true,
      counter: text,
      buttons: [...document.querySelectorAll('${card} button:not(ul button):not(dialog button)')]
        .map((button) => ({ label: button.getAttribute("aria-label") ?? "",
          disabled: button.getAttribute("aria-disabled") === "true" })),
      focused: document.activeElement?.getAttribute("aria-label") ?? "",
      overflows: row.scrollWidth > row.clientWidth + 1,
      offCentre: slide
        ? Math.abs(slide.left + slide.width / 2 - (box.left + row.clientWidth / 2))
        : Infinity,
      widths: [...row.children].map((item) => item.getBoundingClientRect().width),
    }
  })()`)
}

/**
 * `ImageGallery`'s strip navigation (#567): real clicks on Next walk the counter to the last image
 * with each counted slide centred in the row, Next then reads as disabled and keeps focus, Previous
 * walks back, a real sideways wheel moves the counter, captions sit under their images, a WebP
 * source is chosen, and a portrait first image narrows the slides so three fit a wide window, with
 * Previous and Next shown only while the row overflows.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function imageGalleryStripNavChecks(devtools: Devtools): Promise<void> {
  const row = `${GALLERY_NAV} ul`
  const previous = `${GALLERY_NAV} button[aria-label="Previous slide"]:not(dialog button)`
  const next = `${GALLERY_NAV} button[aria-label="Next slide"]:not(dialog button)`
  await centreInView(devtools, `document.querySelector('${row}')`)
  await devtools.evaluate<null>(
    `(document.querySelector('${row}')?.scrollTo({ left: 0, behavior: "instant" }), null)`,
  )
  await poll(async () => (await readStripNav(devtools, GALLERY_NAV)).counter === "1 / 5", 2_000)
  const start = await readStripNav(devtools, GALLERY_NAV)
  check(
    "an ImageGallery strip with navigation starts at 1 / 5 with Previous disabled and Next enabled",
    start.found && start.counter === "1 / 5" && start.overflows &&
      JSON.stringify(start.buttons) ===
        JSON.stringify([{ label: "Previous slide", disabled: true }, {
          label: "Next slide",
          disabled: false,
        }]),
    JSON.stringify(start),
  )

  // The card sets navigationVariant="ghost" (#571): each button carries the exported class list,
  // paints no fill of its own and keeps a visible border.
  const look = await devtools.evaluate<{ classes: string; background: string; border: string }[]>(
    `[...document.querySelectorAll('${GALLERY_NAV} button:not(ul button):not(dialog button)')]
      .map((button) => {
        const style = getComputedStyle(button)
        return { classes: button.getAttribute("class") ?? "", background: style.backgroundColor,
          border: style.borderTopWidth + " " + style.borderTopStyle }
      })`,
  )
  check(
    'navigationVariant="ghost" renders the strip\'s Previous and Next transparent inside a border',
    look.length === 2 &&
      look.every((button) =>
        button.classes === stripNavigationClasses("ghost") &&
        button.background === "rgba(0, 0, 0, 0)" && button.border === "1px solid"
      ),
    JSON.stringify(look),
  )

  const forward: StripNavReading[] = []
  for (let step = 2; step <= 5; step++) {
    const point = await elementCenter(devtools, next)
    if (!point.ok) {
      forward.push({ ...start, counter: `no click: ${point.reason}` })
      break
    }
    const from = await devtools.evaluate<number>(
      `document.querySelector('${row}')?.scrollLeft ?? 0`,
    )
    await clickAtPoint(devtools, point)
    await poll(
      async () => (await readStripNav(devtools, GALLERY_NAV)).counter === `${step} / 5`,
      2_000,
    )
    await poll(async () => {
      const a = await devtools.evaluate<number>(`document.querySelector('${row}').scrollLeft`)
      await new Promise((done) => setTimeout(done, 100))
      const b = await devtools.evaluate<number>(`document.querySelector('${row}').scrollLeft`)
      return a !== from && a === b
    }, 2_000)
    forward.push(await readStripNav(devtools, GALLERY_NAV))
  }
  check(
    "real clicks on the ImageGallery strip's Next walk its counter from 2 / 5 to 5 / 5",
    forward.map((reading) => reading.counter).join(",") === "2 / 5,3 / 5,4 / 5,5 / 5",
    forward.map((reading) => reading.counter).join(", "),
  )
  check(
    "each middle slide the strip's counter names sits centred in the row after Next",
    forward.length === 4 && forward.slice(0, 3).every((reading) => reading.offCentre <= 1.5),
    forward.map((reading) => `${reading.counter}: ${reading.offCentre.toFixed(1)}px`).join(", "),
  )
  const end = forward.at(-1)
  check(
    "at the strip's last image Next reads as disabled and keeps focus, and Previous is enabled",
    end !== undefined && end.focused === "Next slide" &&
      end.buttons.find((button) => button.label === "Next slide")?.disabled === true &&
      end.buttons.find((button) => button.label === "Previous slide")?.disabled === false,
    JSON.stringify(end),
  )

  const captions = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        const img = document.querySelectorAll('${row} img')[3]
        return Boolean(img?.complete && img.currentSrc.startsWith("data:image/webp"))
      })()`),
    3_000,
  )
  const placed = await devtools.evaluate<{ count: number; under: boolean; texts: string[] }>(
    `(() => {
      const figures = [...document.querySelectorAll('${row} figure')]
      return {
        count: figures.length,
        under: figures.every((figure) => {
          const img = figure.querySelector("img")?.getBoundingClientRect()
          const caption = figure.querySelector("figcaption")?.getBoundingClientRect()
          return Boolean(img && caption && caption.top >= img.bottom - 0.5 &&
            Math.abs(caption.left - img.left) <= 1)
        }),
        texts: figures.map((figure) =>
          figure.querySelector("figcaption")?.textContent === figure.querySelector("img")?.alt
            ? "same" : "differs"),
      }
    })()`,
  )
  check(
    "each ImageGallery strip caption sits under its image and repeats its alt text",
    placed.count === 5 && placed.under && placed.texts.every((text) => text === "same"),
    JSON.stringify(placed),
  )
  check(
    "an ImageGallery strip image with a webpSrc loads the WebP source",
    captions,
    await devtools.evaluate<string>(
      `document.querySelectorAll('${row} img')[3]?.currentSrc.slice(0, 20) ?? "no image"`,
    ),
  )

  const back: string[] = []
  for (let step = 4; step >= 1; step--) {
    const point = await elementCenter(devtools, previous)
    if (!point.ok) {
      back.push(`no click: ${point.reason}`)
      break
    }
    await clickAtPoint(devtools, point)
    await poll(
      async () => (await readStripNav(devtools, GALLERY_NAV)).counter === `${step} / 5`,
      2_000,
    )
    back.push((await readStripNav(devtools, GALLERY_NAV)).counter)
  }
  const home = await readStripNav(devtools, GALLERY_NAV)
  check(
    "real clicks on the ImageGallery strip's Previous walk its counter back to 1 / 5",
    back.join(",") === "4 / 5,3 / 5,2 / 5,1 / 5" &&
      home.buttons.find((button) => button.label === "Previous slide")?.disabled === true,
    `${back.join(", ")}; ${JSON.stringify(home.buttons)}`,
  )

  await centreInView(devtools, `document.querySelector('${row}')`)
  await devtools.evaluate<null>(
    `(document.querySelector('${row}')?.scrollTo({ left: 0, behavior: "instant" }), null)`,
  )
  await poll(async () => (await readStripNav(devtools, GALLERY_NAV)).counter === "1 / 5", 2_000)
  const aim = await devtools.evaluate<{ x: number; y: number; delta: number } | null>(`(() => {
    const row = document.querySelector('${row}')
    if (!row || !row.children[0]) return null
    const box = row.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2,
      delta: Math.round(row.children[0].getBoundingClientRect().width * 0.6) }
  })()`)
  if (aim) {
    await devtools.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: aim.x,
      y: aim.y,
      deltaX: aim.delta,
      deltaY: 0,
    })
  }
  const wheeled = await poll(
    async () => (await readStripNav(devtools, GALLERY_NAV)).counter === "2 / 5",
    3_000,
  )
  check(
    "a real sideways wheel on the ImageGallery strip moves its counter to 2 / 5",
    aim !== null && wheeled,
    `wheel ${JSON.stringify(aim)} → counter ${
      (await readStripNav(devtools, GALLERY_NAV)).counter
    }, ` +
      `scrollLeft ${await devtools.evaluate<number>(
        `document.querySelector('${row}').scrollLeft`,
      )}`,
  )

  // The lightbox the strip opens: named after the open image, renamed by its own Next, which keeps
  // its own name beside the strip's "Next slide", and with no second caption under the image.
  const firstSlide = await elementCenter(devtools, `${row} li:first-child button`)
  if (firstSlide.ok) await clickAtPoint(devtools, firstSlide)
  const readLightbox = () =>
    devtools.evaluate<{ open: boolean; name: string; captioned: boolean }>(`(() => {
      const dialog = document.querySelector('${GALLERY_NAV} dialog')
      const alt = dialog?.querySelector("img")?.alt ?? ""
      return { open: dialog?.matches(":modal") === true, name: dialog?.getAttribute("aria-label") ?? "",
        captioned: [...(dialog?.querySelectorAll("p") ?? [])].some((p) => p.textContent === alt) }
    })()`)
  await poll(async () => (await readLightbox()).open, 3_000)
  const opened = await readLightbox()
  await devtools.evaluate<null>(
    `(document.querySelector('${GALLERY_NAV} dialog button[aria-label="Next image"]')?.click(), null)`,
  )
  await poll(async () => (await readLightbox()).name === "The dashboard", 2_000)
  const renamed = await readLightbox()
  check(
    "the strip's lightbox is named after the open image, renamed by its Next image, and shows no second caption",
    firstSlide.ok && opened.open && opened.name === "The sign-in screen" && !opened.captioned &&
      renamed.name === "The dashboard" && !renamed.captioned,
    `click ${firstSlide.ok || firstSlide.reason}; opened ${JSON.stringify(opened)}; after Next ` +
      JSON.stringify(renamed),
  )
  await pressKey(devtools, "Escape")
  await poll(async () => !(await readLightbox()).open, 3_000)

  // A page's test reads `dialog[open]` straight after its click: the dialog must open in the
  // render that the click starts, not after the next paint. One microtask lets Preact's queued
  // render run, and nothing later (no frame, no timer).
  const openAfterClick = await devtools.evaluate<{ clicked: boolean; open: boolean }>(
    `(async () => {
    const button = document.querySelector('${row} li:nth-child(2) button')
    button?.click()
    await new Promise((resolve) => queueMicrotask(resolve))
    return { clicked: button !== null,
      open: document.querySelector('${GALLERY_NAV} dialog[open]') !== null }
  })()`,
  )
  check(
    "a click on a strip slide opens the lightbox before the next frame",
    openAfterClick.clicked && openAfterClick.open,
    JSON.stringify(openAfterClick),
  )
  await poll(async () => (await readLightbox()).open, 3_000)
  await pressKey(devtools, "Escape")
  await poll(async () => !(await readLightbox()).open, 3_000)

  const landscape = (await readStripNav(devtools, GALLERY_NAV)).widths[0] ?? 0
  try {
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await centreInView(devtools, `document.querySelector('${GALLERY_PORTRAIT} ul')`)
    await poll(async () => {
      const reading = await readStripNav(devtools, GALLERY_PORTRAIT)
      return reading.found && !reading.overflows && reading.buttons.length === 0
    }, 3_000)
    const wide = await readStripNav(devtools, GALLERY_PORTRAIT)
    const wideLandscape = (await readStripNav(devtools, GALLERY_NAV)).widths[0] ?? 0
    check(
      "at 1440px a portrait-first ImageGallery strip has narrower slides, all three fit, and it shows no Previous or Next",
      wide.found && wide.widths.length === 3 &&
        wide.widths.every((width) => width < wideLandscape * 0.6) && !wide.overflows &&
        wide.buttons.length === 0 && wide.counter === "1 / 3",
      `portrait slides ${wide.widths.map(Math.round).join(", ")} against landscape ` +
        `${Math.round(wideLandscape)}; overflows ${wide.overflows}; buttons ` +
        `${wide.buttons.length}; counter ${wide.counter}`,
    )

    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await centreInView(devtools, `document.querySelector('${GALLERY_PORTRAIT} ul')`)
    await poll(
      async () => (await readStripNav(devtools, GALLERY_PORTRAIT)).buttons.length === 2,
      3_000,
    )
    const narrow = await readStripNav(devtools, GALLERY_PORTRAIT)
    check(
      "at 390px the same portrait-first strip overflows and shows Previous and Next",
      narrow.overflows && narrow.buttons.map((button) => button.label).join(",") ===
          "Previous image,Next image",
      `overflows ${narrow.overflows}; buttons ${JSON.stringify(narrow.buttons)}; landscape ` +
        `slide at the default width ${Math.round(landscape)}`,
    )
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride").catch(() => {})
  }
}
