import { guidePages } from "@spy4x/preact-ui-guide/registry"
import { ACCENTS } from "../src/accent-switch.tsx"
import { centreInView, check, type Devtools, openGuidePage, pressKey } from "./harness.ts"

/**
 * `theme/`'s browser checks: the form controls and surfaces of the class chapter as native events
 * and computed styles, the palette toggle, the Tailwind/`tokens.css` output that only a real
 * stylesheet could have produced, and the opt-in `data-theme="ink"` palette (#257).
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function themeChecks(devtools: Devtools): Promise<void> {
  // The form chapter is a section of the theme rather than of `ui/`, so the interaction is the
  // native one: type into `.input`, toggle `.checkbox`, pick a `.radio`. The computed styles are
  // what says the class itself reached the browser, not only the markup.
  const forms = await devtools.evaluate<{
    echoBefore: string
    echoAfter: string
    inputHeight: string
    inputRadius: string
    checkboxBefore: string
    checkboxAfter: string
    checkboxSize: string
    radio: string
    inlineButton: string
  }>(`(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 30))
    const echo = (card) => document.querySelector("#demo-" + card + ' [data-e2e="controlled-value"]')
      .textContent.trim()

    const input = document.querySelector("#demo-class-input input.input")
    const echoBefore = echo("class-input")
    input.value = "ada@example.com"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await settle()

    const box = document.querySelector("#demo-class-checkbox input.checkbox")
    const checkboxBefore = echo("class-checkbox")
    box.click()
    await settle()

    const radio = document.querySelector('#demo-class-radio input.radio[value="sms"]')
    radio.click()
    await settle()

    return {
      echoBefore,
      echoAfter: echo("class-input"),
      inputHeight: getComputedStyle(input).height,
      inputRadius: getComputedStyle(input).borderRadius,
      checkboxBefore,
      checkboxAfter: echo("class-checkbox"),
      checkboxSize: getComputedStyle(box).width,
      radio: echo("class-radio"),
      inlineButton: document.querySelector("#demo-class-input-button button.btn-input-icon")
        .getAttribute("aria-label"),
    }
  })()`)
  check(
    "typing into a `.input` drives the demo's controlled value",
    forms.echoBefore !== forms.echoAfter && forms.echoAfter.includes("ada@example.com"),
    `${forms.echoBefore} → ${forms.echoAfter}`,
  )
  check(
    "the form classes reach the browser",
    forms.inputHeight === "48px" && forms.inputRadius === "8px" &&
      forms.checkboxSize === "20px",
    `.input ${forms.inputHeight}/radius ${forms.inputRadius} (h-12, radius-primary), ` +
      `.checkbox ${forms.checkboxSize} (size-5)`,
  )
  check(
    "a `.checkbox` and a `.radio` report through the native events",
    forms.checkboxBefore !== forms.checkboxAfter && forms.radio.includes("sms"),
    `${forms.checkboxBefore} → ${forms.checkboxAfter}; radio ${forms.radio}`,
  )
  check(
    "the inline `.btn-input-icon` is labelled for assistive tech",
    forms.inlineButton === "Search",
    `aria-label="${forms.inlineButton}"`,
  )

  // The surface chapter has no control of its own: its interaction is the copy button its cards
  // carry (asserted above per card, for every section) plus the scroll container, which is driven
  // here. The rest is the stylesheet applying, read off computed styles.
  const surfaces = await devtools.evaluate<{
    cardRadius: string
    headerBorder: string
    footerBorder: string
    kpiValue: string
    numAlign: string
    barHeight: string
    scrolled: boolean
    overflow: boolean
    canvas: string
    surface: string
    link: string
    linkHovered: boolean
    list: string
  }>(`(async () => {
    const style = (selector) => getComputedStyle(document.querySelector(selector))
    const scroller = document.querySelector('#demo-class-scrollbar [data-e2e="scrollbar"]')
    const overflow = scroller.scrollWidth > scroller.clientWidth
    scroller.scrollLeft = 120
    await new Promise((done) => setTimeout(done, 50))

    return {
      cardRadius: style("#demo-class-card .card").borderRadius,
      headerBorder: style("#demo-class-card .card-header").borderBottomWidth,
      footerBorder: style("#demo-class-card .card-footer").borderTopWidth,
      kpiValue: style("#demo-class-data-display .kpi-value").fontSize,
      numAlign: style("#demo-class-data-display .num").textAlign,
      barHeight: style("#demo-class-data-display .bar").height,
      scrolled: scroller.scrollLeft > 0,
      overflow,
      canvas: style("#demo-class-colour-atoms .bg-canvas").backgroundColor,
      surface: style("#demo-class-colour-atoms .bg-surface").backgroundColor,
      link: style("#demo-class-typography .link").textDecorationLine,
      // The .link class applies hover:no-underline, and an applied hover variant is gated by
      // "@media (hover: hover)" exactly like a utility written in the markup — checked against
      // the built stylesheet, not assumed. The browser is now hover-capable, so a pointer
      // resting on this link would take the underline away and this check would read the hovered
      // state as the resting one. Nothing moves a pointer before this file runs today; asserted
      // so that a later check which does fails here by name.
      linkHovered: document.querySelector("#demo-class-typography .link").matches(":hover"),
      list: style("#demo-class-typography .list-ul").listStyleType,
    }
  })()`)
  check(
    "the surface classes reach the browser",
    surfaces.cardRadius === "8px" && surfaces.headerBorder === "1px" &&
      surfaces.footerBorder === "1px" && surfaces.kpiValue === "24px" &&
      surfaces.barHeight === "6px",
    `card radius ${surfaces.cardRadius}, header ${surfaces.headerBorder}, ` +
      `footer ${surfaces.footerBorder}, kpi-value ${surfaces.kpiValue}, bar ${surfaces.barHeight}`,
  )
  check(
    "`.num` right-aligns and `.list-ul`/`.link` style their text",
    surfaces.numAlign === "right" && surfaces.list === "disc" && surfaces.link === "underline" &&
      !surfaces.linkHovered,
    surfaces.linkHovered
      ? `a pointer was resting on the link when its decoration was read, so ${surfaces.link} is ` +
        `the hovered state and says nothing about the resting one`
      : `num ${surfaces.numAlign}, list ${surfaces.list}, link ${surfaces.link}, read with ` +
        `nothing hovering it`,
  )
  check(
    "`.scrollbar` is a real horizontal scroller",
    surfaces.overflow && surfaces.scrolled,
    `overflow ${surfaces.overflow}, scrolled to a non-zero offset`,
  )
  check(
    "`.bg-canvas` and `.bg-surface` are two different tokens",
    surfaces.canvas !== surfaces.surface,
    `${surfaces.canvas} vs ${surfaces.surface}`,
  )

  const theme = await devtools.evaluate<{ before: boolean; after: boolean; pressed: string }>(
    `(async () => {
      const button = document.querySelector('[data-e2e="theme-toggle"]')
      const before = document.documentElement.classList.contains("dark")
      button.click()
      await new Promise((done) => setTimeout(done, 50))
      return {
        before,
        after: document.documentElement.classList.contains("dark"),
        pressed: button.getAttribute("aria-pressed"),
      }
    })()`,
  )
  check(
    "the palette toggle flips the class the preset styles against",
    theme.before !== theme.after,
    `dark ${theme.before} → ${theme.after}, aria-pressed=${theme.pressed}`,
  )

  // Markup alone does not prove the stylesheet is live: these read declarations only Tailwind could
  // have emitted, and only `tokens.css` can switch between the two palettes. The deep-link outline
  // this probe used to read alongside `light`/`dark` is `pages.ts`'s "the deep link outlines its
  // card" check now — that assertion is about routing, not the theme, and reading it here would mean
  // this file also owning the deep-link hash the routing checks set up.
  // The Button card is on the `ui` page.
  await openGuidePage(devtools, "ui")
  const styled = await devtools.evaluate<{
    buttonRadius: string
    buttonBackground: string
    buttonHovered: boolean
    light: string
    dark: string
  }>(`(async () => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const canvas = () => getComputedStyle(document.body).backgroundColor
    root.classList.toggle("dark", false)
    const light = canvas()
    root.classList.toggle("dark", true)
    const dark = canvas()
    root.classList.toggle("dark", wasDark)

    const button = document.querySelector("#demo-Button button")
    // The palette-toggle click just above this probe flips \`.dark\` on <html>, and \`.btn\`'s
    // transition-colors utility animates the button's background-color across that flip, so a read
    // taken right after the click samples the fill mid-transition, not where it ends up. Waiting
    // for two consecutive reads to agree does NOT fix this — that was tried here first, and it does
    // not work: a headless page only advances a transition when it produces a frame, and nothing
    // forces one between two reads a few milliseconds apart, so the very first comparison agrees,
    // on a value that has not moved yet rather than one that has settled. Wait for the element's
    // own running animations instead; once none are left, the browser has committed the end state.
    // \`finished\` rejects if an animation is cancelled instead — a cancelled animation just means
    // there is nothing left to wait for, and the read right below is what actually judges the
    // colour, so losing the rest of this package's checks to that rejection would be out of all
    // proportion.
    await Promise.all(button.getAnimations().map((animation) => animation.finished.catch(() => {})))

    return {
      buttonRadius: getComputedStyle(button).borderRadius,
      buttonBackground: getComputedStyle(button).backgroundColor,
      // The browser is launched with a hover-capable pointer (see \`pages/verify.ts\`), so
      // \`.btn-primary\`'s \`hover:bg-purple-800\` now applies whenever a pointer happens to be
      // resting on this button — and a fill read in that state is the hover fill rather than the
      // one this check is about. Nothing moves a pointer before \`theme.ts\` today, which is the
      // only reason the reading is safe; asserted rather than relied on, so a later check that
      // moves one first fails here by name instead of quietly reading the wrong colour.
      buttonHovered: button.matches(":hover"),
      light,
      dark,
    }
  })()`)
  check(
    "Tailwind utilities style the components in the browser",
    styled.buttonRadius === "6px" && styled.buttonBackground !== "rgba(0, 0, 0, 0)" &&
      !styled.buttonHovered,
    styled.buttonHovered
      ? `a pointer was resting on the Button card when its fill was read, so ` +
        `${styled.buttonBackground} is the hover fill and says nothing about the resting one`
      : `Button radius ${styled.buttonRadius} (rounded-md), primary fill ` +
        `${styled.buttonBackground}, read with nothing hovering it`,
  )
  check(
    "tokens.css switches the palette on the .dark class",
    styled.light !== "rgba(0, 0, 0, 0)" && styled.light !== styled.dark,
    `canvas ${styled.light} light / ${styled.dark} dark`,
  )

  await accentChecks(devtools)

  // Ink (#257) is opt-in and applies only together with .dark, on <html> — the same element the
  // light/dark toggle above already owns, per the convention `ui-guide/sections/surfaces.tsx`'s
  // ink card documents rather than fakes locally. This reads document.body's canvas background
  // (the same property the "tokens.css switches the palette" check above reads) with .dark alone,
  // then with .dark plus data-theme="ink", then with .dark alone again, and restores whatever
  // state <html> had before the probe ran.
  const ink = await devtools.evaluate<{ before: string; ink: string; after: string }>(
    `(async () => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const wasTheme = root.getAttribute("data-theme")
    const canvas = () => getComputedStyle(document.body).backgroundColor

    root.classList.add("dark")
    root.removeAttribute("data-theme")
    await new Promise((done) => setTimeout(done, 30))
    const before = canvas()

    root.setAttribute("data-theme", "ink")
    await new Promise((done) => setTimeout(done, 30))
    const ink = canvas()

    root.removeAttribute("data-theme")
    await new Promise((done) => setTimeout(done, 30))
    const after = canvas()

    root.classList.toggle("dark", wasDark)
    if (wasTheme === null) root.removeAttribute("data-theme")
    else root.setAttribute("data-theme", wasTheme)

    return { before, ink, after }
  })()`,
  )
  check(
    'data-theme="ink" together with .dark on <html> repaints the canvas, and removing it ' +
      "restores the default dark canvas",
    ink.before !== ink.ink && ink.before === ink.after,
    `default dark ${ink.before} → ink ${ink.ink} → default dark again ${ink.after}`,
  )

  // #257's reviewer round: ink applies only together with .dark — data-theme="ink" alone, on a
  // page that never picked up .dark, must be a no-op. This is the light-mode half of the check
  // above, which only ever toggled data-theme while .dark stayed on.
  const inkWithoutDark = await devtools.evaluate<{ before: string; withInk: string }>(
    `(async () => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const wasTheme = root.getAttribute("data-theme")
    const canvas = () => getComputedStyle(document.body).backgroundColor

    root.classList.remove("dark")
    root.removeAttribute("data-theme")
    await new Promise((done) => setTimeout(done, 30))
    const before = canvas()

    root.setAttribute("data-theme", "ink")
    await new Promise((done) => setTimeout(done, 30))
    const withInk = canvas()

    root.classList.toggle("dark", wasDark)
    if (wasTheme === null) root.removeAttribute("data-theme")
    else root.setAttribute("data-theme", wasTheme)

    return { before, withInk }
  })()`,
  )
  check(
    'data-theme="ink" without .dark on <html> is a no-op: the canvas stays the default light one',
    inkWithoutDark.before === inkWithoutDark.withInk,
    `light canvas ${inkWithoutDark.before} → with data-theme="ink" alone ${inkWithoutDark.withInk}`,
  )

  // A focused `.btn` has to show a ring of at least 3:1 against the page and against a card, in
  // every palette. Tailwind's `outline-*` utilities leave the ring's colour alone, so a `.btn`
  // draws the browser's own focus colour unless preset.css sets one, and in a dark page that colour
  // is near-black: #291 found it under ink, and #297 in the default dark palette (about 1.07:1).
  // preset.css now points `.btn`'s ring at --color-focus-ring under any `.dark`, and the tone
  // buttons use a lighter shade there.
  // `.btn` and its tones are classes this preset ships, not a component the catalogue instantiates
  // anywhere — the nearest catalogue card, "Button", is `ui/Button`, a different, Tailwind-utility
  // button with its own `focus-visible:ring-*` styling and no connection to this class at all. So
  // this probe builds a real `<button class="btn …">` itself, fixed on screen so a real click can
  // reach it, reads it, and removes it again.
  //
  // A script call to .focus() was tried first to read the outline back, and Chromium does not
  // enter :focus-visible for a button focused that way — it reads back the browser's own
  // unrelated default outline (a plain white ring) regardless of what preset.css says, which
  // would make this check pass even with the fix reverted. A real click doesn't either: Chromium
  // does not treat a mouse-triggered focus as :focus-visible. What does is tabbing away from the
  // button and back — both genuine keyboard interactions — so this clicks the button once (an
  // ordinary focus, not yet the one this check reads), tabs forward and Shift+Tabs straight back,
  // and only then reads what the second, keyboard-driven focus actually committed.
  // The light palette is probed too: the dark fix must not change the ring every existing
  // consumer's light primary button draws (#291's third review found an earlier fix had). So in
  // the light palette a `.btn-primary`'s ring must also be the browser's own focus colour, read
  // off an element whose outline is `-webkit-focus-ring-color`; 3:1 alone let a purple ring pass.
  const palettes = [
    { dark: true, ink: true, name: "under ink" },
    { dark: true, ink: false, name: "in the default dark palette" },
    { dark: false, ink: false, name: "in the default light palette" },
  ]
  const buttonClasses = [
    "btn-primary",
    "btn-danger",
    "btn-danger-outline",
    "btn-warning",
    "btn-warning-outline",
    "btn-success",
    "btn-success-outline",
  ]
  const probes = palettes.flatMap((palette) =>
    buttonClasses.map((buttonClass) => ({ palette, buttonClass }))
  )
  for (const { palette, buttonClass } of probes) {
    const rect = await devtools.evaluate<{ x: number; y: number }>(`(() => {
      const root = document.documentElement
      window.__inkFocusRingRestore = {
        wasDark: root.classList.contains("dark"),
        wasTheme: root.getAttribute("data-theme"),
      }
      root.classList.toggle("dark", ${palette.dark})
      if (${palette.ink}) root.setAttribute("data-theme", "ink")
      else root.removeAttribute("data-theme")

      const button = document.createElement("button")
      button.type = "button"
      button.className = "btn ${buttonClass}"
      button.textContent = "Focus ring probe"
      button.id = "ink-focus-ring-probe"
      // The button sits on a card painted in --color-surface, because a ring must read against a
      // raised surface as well as the page: #297's second report was orange-700 at 2.98:1 on an
      // ink card, while the same ring clears 3:1 on ink's darker page.
      const card = document.createElement("div")
      card.style.position = "fixed"
      card.style.top = "8px"
      card.style.left = "8px"
      card.style.zIndex = "99999"
      card.style.padding = "12px"
      card.style.background = "var(--color-surface)"
      card.appendChild(button)
      document.body.appendChild(card)

      const box = button.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    })()`)
    const settle = () => devtools.evaluate(`new Promise((done) => setTimeout(done, 60))`)
    for (const type of ["mousePressed", "mouseReleased"]) {
      await devtools.send("Input.dispatchMouseEvent", {
        type,
        x: rect.x,
        y: rect.y,
        button: "left",
        buttons: type === "mousePressed" ? 1 : 0,
        clickCount: 1,
      })
    }
    await settle()
    await pressKey(devtools, "Tab")
    await settle()
    // Shift+Tab, to come straight back to the button — `pressKey`'s table carries no modifier keys,
    // so this one dispatch is written directly against the same `Input.dispatchKeyEvent` it wraps.
    // CDP's Shift bit is 8.
    for (const type of ["keyDown", "keyUp"]) {
      await devtools.send("Input.dispatchKeyEvent", {
        type,
        key: "Tab",
        code: "Tab",
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
        modifiers: 8,
      })
    }
    await settle()
    const focusRing = await devtools.evaluate<{
      outlineColor: string
      pageBackground: string
      cardBackground: string
      browserRing: string
      ratio: number
    }>(`(async () => {
      const root = document.documentElement
      const { wasDark, wasTheme } = window.__inkFocusRingRestore
      delete window.__inkFocusRingRestore

      const button = document.getElementById("ink-focus-ring-probe")
      if (document.activeElement !== button) {
        button.parentElement.remove()
        throw new Error(
          "the probe button never received focus — document.activeElement is " +
            (document.activeElement ? document.activeElement.tagName : "nothing") +
            ", not the probe; this check's own click-then-tab-and-back sequence did not land " +
            "where it expected",
        )
      }

      const outlineStyle = getComputedStyle(button).outlineStyle
      if (outlineStyle === "none") {
        button.parentElement.remove()
        throw new Error(
          "the probe button never entered :focus-visible — outline-style is none, so " +
            "outlineColor below would be the browser's unrelated default rather than anything " +
            "preset.css set",
        )
      }
      // .btn applies transition-all, which covers outline-color too, so a read taken right after
      // focus samples the colour mid-transition rather than where it ends up — the same problem
      // the "Tailwind utilities style the components" probe above hits for a button's
      // background-color, and the same fix: wait for the element's own running animations before
      // reading anything off it.
      await Promise.all(
        button.getAnimations().map((animation) => animation.finished.catch(() => {})),
      )
      const outlineColor = getComputedStyle(button).outlineColor
      const pageBackground = getComputedStyle(document.body).backgroundColor
      const cardBackground = getComputedStyle(button.parentElement).backgroundColor
      const reference = document.createElement("div")
      reference.style.outline = "2px solid -webkit-focus-ring-color"
      button.parentElement.appendChild(reference)
      const browserRing = getComputedStyle(reference).outlineColor

      // Chromium's computed-style serialization keeps a colour in whatever colour function it was
      // authored in rather than always converting to rgb() — this repository's tokens are oklch(),
      // so getComputedStyle can hand back "oklch(L C H)" as readily as "rgb(r g b)". WCAG's relative
      // luminance wants linear-light RGB either way, so this parses both forms down to it: rgb()
      // through the usual sRGB gamma decode, oklch()/oklab() through the linear-sRGB matrix from
      // the OKLab colour space's own definition (Björn Ottosson's oklab.org write-up), which is
      // already linear-light and skips the gamma step.
      function linearRgb(color) {
        const oklchMatch = color.match(
          /oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/,
        )
        const oklabMatch = color.match(
          /oklab\\(([\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)/,
        )
        let L, a, b
        if (oklchMatch) {
          const [, l, c, h] = oklchMatch.map(Number)
          L = l
          a = c * Math.cos(h * Math.PI / 180)
          b = c * Math.sin(h * Math.PI / 180)
        } else if (oklabMatch) {
          ;[, L, a, b] = oklabMatch.map(Number)
        } else {
          const [r, g, bl] = color.match(/[\\d.]+/g).slice(0, 3).map(Number).map((channel) => {
            const s = channel / 255
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
          })
          return [r, g, bl]
        }
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b
        const s_ = L - 0.0894841775 * a - 1.2914855480 * b
        const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
        return [
          4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
        ]
      }
      function luminance(color) {
        const [r, g, b] = linearRgb(color).map((channel) => Math.max(0, Math.min(1, channel)))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      function contrast(background) {
        const lighter = Math.max(luminance(outlineColor), luminance(background))
        const darker = Math.min(luminance(outlineColor), luminance(background))
        return (lighter + 0.05) / (darker + 0.05)
      }
      const ratio = Math.min(contrast(pageBackground), contrast(cardBackground))

      button.parentElement.remove()
      root.classList.toggle("dark", wasDark)
      if (wasTheme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", wasTheme)

      return { outlineColor, pageBackground, cardBackground, browserRing, ratio }
    })()`)
    check(
      `${palette.name}, a focused .btn.${buttonClass}'s outline clears 3:1 contrast against the ` +
        "page and against a card",
      focusRing.ratio >= 3,
      `outline ${focusRing.outlineColor} vs page ${focusRing.pageBackground} and card ` +
        `${focusRing.cardBackground}, lower ratio ${focusRing.ratio.toFixed(2)}:1`,
    )
    if (!palette.dark && buttonClass === "btn-primary") {
      check(
        "in the default light palette, a focused .btn.btn-primary keeps the browser's own ring",
        focusRing.outlineColor === focusRing.browserRing,
        `outline ${focusRing.outlineColor}, browser's focus colour ${focusRing.browserRing}`,
      )
    }
  }

  await darkControlsChecks(devtools)
  await canvasContrastCheck(devtools)
}

/**
 * The luminance of the pixel at a viewport point, read from a real screenshot. A native checkbox or
 * radio is drawn by the browser from `color-scheme`, not from any style a computed-style read can
 * see, so the pixels are the only proof of what a reader gets.
 *
 * @param devtools The connected session.
 * @param element A JavaScript expression for the element; its centre is sampled.
 * @returns The WCAG relative luminance there, 0 (black) to 1 (white).
 */
async function luminanceAtCentre(devtools: Devtools, element: string): Promise<number> {
  if (!await centreInView(devtools, element)) throw new Error(`${element} is not on the page`)
  const point = await devtools.evaluate<{ x: number; y: number; width: number }>(`(() => {
    const box = (${element}).getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, width: innerWidth }
  })()`)
  const { data } = await devtools.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  return await devtools.evaluate<number>(`(async () => {
    const blob = await (await fetch("data:image/png;base64,${data}")).blob()
    const bitmap = await createImageBitmap(blob)
    const scale = bitmap.width / ${point.width}
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext("2d")
    context.drawImage(bitmap, 0, 0)
    const [r, g, b] = context.getImageData(
      Math.round(${point.x} * scale),
      Math.round(${point.y} * scale),
      1,
      1,
    ).data
    const linear = (channel) => {
      const s = channel / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
  })()`)
}

/**
 * The dark palette's native controls and accent fill (#347, #358), and how Checkbox and Radio sit
 * beside their labels. Runs after {@link themeChecks}, on the UI page, and leaves the palette as it
 * found it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function darkControlsChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "ui")
  const wasDark = await devtools.evaluate<boolean>(`(() => {
    const was = document.documentElement.classList.contains("dark")
    document.documentElement.classList.add("dark")
    // An unchecked box shows its own fill; a ticked one shows the accent over it.
    for (const control of document.querySelectorAll(
      "#demo-Checkbox input.checkbox",
    )) control.checked = false
    return was
  })()`)
  try {
    const checkbox = await luminanceAtCentre(
      devtools,
      `document.querySelector("#demo-Checkbox input.checkbox")`,
    )
    check(
      "in the dark palette an unticked Checkbox is drawn dark, not as a white box",
      checkbox < 0.2,
      `luminance at the box's centre ${checkbox.toFixed(3)} (white is 1)`,
    )
    const radio = await luminanceAtCentre(
      devtools,
      `[...document.querySelectorAll("#demo-Radio input.radio")].find((radio) => !radio.checked)`,
    )
    check(
      "in the dark palette an unpicked Radio is drawn dark, not as a white disc",
      radio < 0.2,
      `luminance at the disc's centre ${radio.toFixed(3)} (white is 1)`,
    )

    const progress = await devtools.evaluate<{ fill: string; track: string; ratio: number }>(
      `(() => {
      const fill = document.querySelector("#demo-Progress [role=progressbar] .bg-primary")
      const track = fill.parentElement
      const channels = (element) => {
        const probe = document.createElement("canvas").getContext("2d")
        probe.fillStyle = getComputedStyle(element).backgroundColor
        probe.fillRect(0, 0, 1, 1)
        return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)]
      }
      const luminance = (rgb) => {
        const [r, g, b] = rgb.map((channel) => {
          const s = channel / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const a = luminance(channels(fill))
      const b = luminance(channels(track))
      return {
        fill: getComputedStyle(fill).backgroundColor,
        track: getComputedStyle(track).backgroundColor,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      }
    })()`,
    )
    check(
      "in the dark palette the default Progress bar clears 3:1 against its track",
      progress.ratio >= 3,
      `fill ${progress.fill} on track ${progress.track}, ${progress.ratio.toFixed(2)}:1`,
    )
  } finally {
    await devtools.evaluate(
      `document.documentElement.classList.toggle("dark", ${wasDark})`,
    )
  }

  const layout = await devtools.evaluate<{ rows: string[]; bad: string[]; group: string }>(`(() => {
    const rows = []
    const bad = []
    for (const label of document.querySelectorAll(
      "#demo-Checkbox label, #demo-Radio label, #demo-RadioGroup label",
    )) {
      const control = label.querySelector("input.checkbox, input.radio")
      if (!control) continue
      const range = document.createRange()
      range.setStartAfter(control)
      range.setEndAfter(label.lastChild)
      const text = range.getBoundingClientRect()
      const box = control.getBoundingClientRect()
      const offCentre = (text.top + text.height / 2) - (box.top + box.height / 2)
      const gap = text.left - box.right
      const row = label.closest("[id^=demo-]").id + " " + label.textContent.trim() + ": " +
        "centre " + offCentre.toFixed(1) + "px, gap " + gap.toFixed(1) + "px"
      rows.push(row)
      if (Math.abs(offCentre) > 1 || Math.abs(gap - 8) > 0.5) bad.push(row)
    }
    const fieldset = document.querySelector("#demo-RadioGroup fieldset")
    const legend = fieldset.querySelector("legend").getBoundingClientRect()
    const options = [...fieldset.querySelectorAll("label")].map((label) =>
      label.getBoundingClientRect()
    )
    const gaps = [options[0].top - legend.bottom].concat(
      options.slice(1).map((option, index) => option.top - options[index].bottom),
    )
    const group = "legend to first option, then between options: " +
      gaps.map((gap) => gap.toFixed(1)).join(", ") + "px"
    if (gaps.some((gap) => Math.abs(gap - 8) > 0.5)) bad.push(group)
    return { rows, bad, group }
  })()`)
  check(
    "Checkbox and Radio centre their label on the control, 8px (the sm gap) from it, and a " +
      "RadioGroup spaces its legend and options by the same gap",
    layout.rows.length >= 4 && layout.bad.length === 0,
    layout.bad.length > 0 ? layout.bad.join("; ") : `${layout.rows.join("; ")}; ${layout.group}`,
  )
}

/**
 * In the light palette, every line of the guide's own text clears WCAG AA against what sits behind
 * it (#358). The canvas went a step darker so a card stands off it, and grey text that cleared AA
 * on the old canvas does not always clear it on the new one. Demos are left out: what a component
 * draws is that component's business, and its own checks hold it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function canvasContrastCheck(devtools: Devtools): Promise<void> {
  const failures: string[] = []
  let lines = 0
  // Wide enough for both side columns, the navigation and "On this page": at the browser's own
  // 800px they are hidden, and their grey labels would go unread.
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  try {
    for (const page of guidePages) {
      await openGuidePage(devtools, page.id)
      const read = await devtools.evaluate<{ lines: number; failures: string[] }>(`(async () => {
      // Put back afterwards: the header's theme switch reads the store, not the class, and a later
      // check expects the two to agree.
      const wasDark = document.documentElement.classList.contains("dark")
      document.documentElement.classList.remove("dark")
      // A spinner or a skeleton pulse runs forever; only a finite transition can be waited out.
      const finite = document.getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      await Promise.all(finite.map((animation) => animation.finished.catch(() => {})))
      const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
      const rgba = (color) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = "#000"
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data]
      }
      const luminance = ([r, g, b]) => {
        const linear = (channel) => {
          const s = channel / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
      }
      // What the text really sits on: each translucent layer (a scrim, an overlay) is laid over
      // whatever is behind it, up to the first opaque one. A scrim block would otherwise read as
      // the page beneath it.
      const behind = (element) => {
        const layers = []
        for (let at = element; at; at = at.parentElement) {
          const colour = rgba(getComputedStyle(at).backgroundColor)
          if (colour[3] === 0) continue
          layers.push(colour)
          if (colour[3] === 255) break
        }
        let result = layers.length && layers[layers.length - 1][3] === 255
          ? layers.pop()
          : rgba(getComputedStyle(document.body).backgroundColor)
        while (layers.length) {
          const top = layers.pop()
          const alpha = top[3] / 255
          result = [0, 1, 2].map((i) => top[i] * alpha + result[i] * (1 - alpha)).concat([255])
        }
        return result
      }
      const failures = []
      let lines = 0
      for (const element of document.querySelectorAll(".ui-guide *")) {
        const own = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())
        if (!own || !element.checkVisibility()) continue
        if (element.closest('[data-card-part="demo"], pre, .sr-only')) continue
        lines++
        const a = luminance(rgba(getComputedStyle(element).color))
        const b = luminance(behind(element))
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        if (ratio < 4.5) {
          failures.push('"' + element.textContent.trim().slice(0, 30) + '" ' + ratio.toFixed(2) + ":1")
        }
      }
      document.documentElement.classList.toggle("dark", wasDark)
      return { lines, failures }
    })()`)
      lines += read.lines
      failures.push(...read.failures.map((failure) => `${page.id}: ${failure}`))
    }
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
  check(
    "in the light palette every line of the guide's own text clears 4.5:1 against its background",
    lines > 0 && failures.length === 0,
    failures.length > 0 ? failures.slice(0, 12).join(", ") : `${lines} lines checked`,
  )
}

/**
 * Tailwind's purple steps as `tokens.css`'s accent scale reproduces them with no token set: the
 * colours the components drew before they read the scale (#380), copied from Tailwind 4.1.12's
 * `theme.css` rather than read from the page, so a scale that drifted from them fails by step.
 */
const PURPLE: Record<number, string> = {
  50: "oklch(0.977 0.014 308.299)",
  100: "oklch(0.946 0.033 307.174)",
  200: "oklch(0.902 0.063 306.703)",
  300: "oklch(0.827 0.119 306.383)",
  400: "oklch(0.714 0.203 305.504)",
  500: "oklch(0.627 0.265 303.9)",
  600: "oklch(0.558 0.288 302.321)",
  700: "oklch(0.496 0.265 301.924)",
  800: "oklch(0.438 0.218 303.724)",
  900: "oklch(0.381 0.176 304.987)",
  950: "oklch(0.291 0.149 302.717)",
}

/** The accent an app sets in {@link accentChecks}: Tailwind's blue-800, far from any purple. */
const APP_ACCENT = "oklch(0.424 0.199 265.638)"

/**
 * Page-side helpers every {@link accentChecks} read shares, as source text to put at the top of an
 * evaluated function. `resolve` asks the browser what a colour expression computes to on a probe
 * inside `<body>`, so a `var()` reads the same tokens a component reads; `same` compares two
 * computed colours by their numbers to the third decimal, because a step worked out by relative
 * colour syntax computes to floating-point noise around the literal it reproduces; `settle` waits
 * for the elements' own transitions to finish (`transition-colors` animates a token change), and
 * only those: the spinner's spin never finishes.
 */
const ACCENT_HELPERS = `
  const resolve = (value) => {
    const probe = document.createElement("span")
    probe.style.color = value
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }
  const numbers = (color) => (color.match(/-?[0-9.]+(?:e-?[0-9]+)?/g) || []).map(Number)
  const same = (a, b) => {
    const x = numbers(a)
    const y = numbers(b)
    return a.slice(0, a.indexOf("(")) === b.slice(0, b.indexOf("(")) && x.length === y.length &&
      x.every((value, index) => Math.abs(value - y[index]) < 0.0015)
  }
  const frame = () => new Promise((done) => requestAnimationFrame(() => done()))
  const settle = async (...elements) => {
    await frame()
    await frame()
    // Transitions only: the spinner's own spin is an animation that never finishes.
    await Promise.all(elements.flatMap((element) => element.getAnimations())
      .filter((animation) => animation instanceof CSSTransition)
      .map((animation) => animation.finished.catch(() => {})))
  }
`

/**
 * The accents {@link accentChecks} holds to the sRGB gamut: Tailwind's orange-800, the warm colour
 * the review found clipped into pure red, and the host switch's own Rose, Blue and Green.
 */
const GAMUT_ACCENTS = {
  orange800: "oklch(0.47 0.157 37.304)",
  rose: ACCENTS.rose.color,
  blue: ACCENTS.blue.color,
  green: ACCENTS.green.color,
}

/**
 * Page-side OKLab helpers, as source text. `oklabOfComputed` converts a computed `oklch(L C H)`
 * string; `oklabOfPixel` draws the colour on a 1x1 sRGB canvas, reads the pixel back and converts
 * that, so the difference between the two is what clipping to the screen's gamut cost.
 * `whiteContrastOfPixel` is white text's WCAG contrast on that drawn pixel.
 */
const OKLAB_HELPERS = `
  const oklabOfComputed = (color) => {
    const [l, c, h] = numbers(color)
    if (!color.startsWith("oklch(")) throw new Error("expected an oklch() colour, got " + color)
    return [l, c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180)]
  }
  const pixelCanvas = document.createElement("canvas")
  pixelCanvas.width = 1
  pixelCanvas.height = 1
  const pixelContext = pixelCanvas.getContext("2d", { willReadFrequently: true })
  const oklabOfPixel = (color) => {
    pixelContext.clearRect(0, 0, 1, 1)
    pixelContext.fillStyle = color
    pixelContext.fillRect(0, 0, 1, 1)
    const [r, g, b] = [...pixelContext.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
      const x = v / 255
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    })
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ]
  }
  const oklabDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const whiteContrastOfPixel = (color) => {
    pixelContext.clearRect(0, 0, 1, 1)
    pixelContext.fillStyle = color
    pixelContext.fillRect(0, 0, 1, 1)
    const [r, g, b] = [...pixelContext.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
      const x = v / 255
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    })
    return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05)
  }
`

/**
 * The accent (#380): the components read `tokens.css`'s accent scale instead of Tailwind's
 * `purple-*`, so an app that sets no token sees the purple it saw before, in both palettes, and an
 * app that sets `--color-primary` on `:root` sees a primary `Button`, `LoadingSpinner`, `Calendar`
 * and the components' focus rings take its colour. The demo host's accent switch does what that app
 * does, and a reader sees the cards follow it.
 *
 * Colours are compared as computed colours, never by eye: each expected value is what the browser
 * computes for the literal, next to what it computes for the component.
 *
 * @param devtools The connected session, on the `ui` page.
 */
async function accentChecks(devtools: Devtools): Promise<void> {
  const defaults = await devtools.evaluate<{
    steps: { dark: boolean; step: string; token: string; purple: string; ok: boolean }[]
    button: { light: string; dark: string; lightOk: boolean; darkOk: boolean; hovered: boolean }
  }>(`(async () => {
    ${ACCENT_HELPERS}
    const purple = ${JSON.stringify(PURPLE)}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const button = document.querySelector("#demo-Button button")
    const steps = []
    const fills = {}
    for (const dark of [false, true]) {
      root.classList.toggle("dark", dark)
      await settle(button)
      for (const [step, literal] of Object.entries(purple)) {
        const token = resolve("var(--color-accent-" + step + ")")
        const expected = resolve(literal)
        steps.push({ dark, step, token, purple: expected, ok: same(token, expected) })
      }
      fills[dark ? "dark" : "light"] = getComputedStyle(button).backgroundColor
    }
    root.classList.toggle("dark", wasDark)
    await settle(button)
    return {
      steps,
      button: {
        ...fills,
        lightOk: same(fills.light, resolve(purple[900])),
        darkOk: same(fills.dark, resolve(purple[700])),
        hovered: button.matches(":hover"),
      },
    }
  })()`)
  const offScale = defaults.steps.filter((step) => !step.ok)
  check(
    "with no token set, every step of the accent scale is Tailwind's purple step, light and dark",
    defaults.steps.length === 22 && offScale.length === 0,
    offScale.length === 0
      ? `${defaults.steps.length} steps read, e.g. 50 → ${defaults.steps[0]?.token}`
      : offScale.map((step) =>
        `${step.dark ? "dark" : "light"} ${step.step}: ${step.token}, purple ${step.purple}`
      ).join("; "),
  )
  check(
    "with no token set, a primary Button is filled purple-900 in light and purple-700 in dark",
    defaults.button.lightOk && defaults.button.darkOk && !defaults.button.hovered,
    `light ${defaults.button.light}, dark ${defaults.button.dark}` +
      (defaults.button.hovered ? ", read with a pointer resting on it" : ""),
  )

  // An app's own stylesheet, after the theme's: `--color-primary` alone, on `:root`.
  const primary = await devtools.evaluate<{
    expected: string
    button: string
    spinner: string
    darkButton: string
    darkExpected: string
    ok: { button: boolean; spinner: boolean; dark: boolean }
  }>(`(async () => {
    ${ACCENT_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    root.classList.toggle("dark", false)
    const style = document.createElement("style")
    style.id = "accent-check-primary"
    style.textContent = ":root { --color-primary: ${APP_ACCENT}; }"
    document.head.append(style)
    const button = document.querySelector("#demo-Button button")
    const spinner = document.querySelector("#demo-LoadingSpinner svg")
    await settle(button, spinner)
    const expected = resolve("${APP_ACCENT}")
    const result = {
      expected,
      button: getComputedStyle(button).backgroundColor,
      spinner: getComputedStyle(spinner).color,
    }
    // In the dark palette --color-primary is near-black chrome, so .dark keeps the components'
    // accent on its own token: --color-primary alone leaves the dark Button purple-700.
    root.classList.toggle("dark", true)
    await settle(button)
    result.darkButton = getComputedStyle(button).backgroundColor
    result.darkExpected = resolve("${PURPLE[700]}")
    style.remove()
    root.classList.toggle("dark", wasDark)
    await settle(button, spinner)
    result.ok = {
      button: same(result.button, expected),
      spinner: same(result.spinner, expected),
      dark: same(result.darkButton, result.darkExpected),
    }
    return result
  })()`)
  check(
    "--color-primary on :root recolours a primary Button and LoadingSpinner with that colour",
    primary.ok.button && primary.ok.spinner,
    `expected ${primary.expected}: Button ${primary.button}, LoadingSpinner ${primary.spinner}`,
  )
  check(
    "--color-primary alone leaves the dark palette's accent on its own token, as documented",
    primary.ok.dark,
    `dark Button ${primary.darkButton}, purple-700 ${primary.darkExpected}`,
  )

  // The focus ring: a real keyboard interaction first, so the scripted focus that follows counts as
  // keyboard focus and the Button enters :focus-visible, where `ring-accent-900` applies.
  await devtools.evaluate(`(() => {
    const style = document.createElement("style")
    style.id = "accent-check-ring"
    style.textContent = ":root { --color-primary: ${APP_ACCENT}; }"
    document.head.append(style)
    // Put back in the ring reading below: the palette toggle's check above left the app dark, and a
    // class left light here would disagree with the toggle for every block after this one.
    window.__accentRingWasDark = document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", false)
  })()`)
  await pressKey(devtools, "Tab")
  const ring = await devtools.evaluate<{
    focusVisible: boolean
    ringColor: string
    expected: string
    ok: boolean
  }>(`(async () => {
    ${ACCENT_HELPERS}
    const button = document.querySelector("#demo-Button button")
    button.focus({ preventScroll: true })
    await settle(button)
    const focusVisible = button.matches(":focus-visible")
    const ringColor = resolve(getComputedStyle(button).getPropertyValue("--tw-ring-color"))
    const expected = resolve("${APP_ACCENT}")
    button.blur()
    document.getElementById("accent-check-ring").remove()
    document.documentElement.classList.toggle("dark", window.__accentRingWasDark)
    delete window.__accentRingWasDark
    await settle(button)
    return { focusVisible, ringColor, expected, ok: same(ringColor, expected) }
  })()`)
  check(
    "--color-primary on :root recolours a focused Button's focus ring",
    ring.focusVisible && ring.ok,
    ring.focusVisible
      ? `ring ${ring.ringColor}, expected ${ring.expected}`
      : "the Button never entered :focus-visible, so its ring was not drawn",
  )

  // The host's accent switch: the control a reader uses, in both palettes, and back.
  const control = await devtools.evaluate<{
    light: string
    dark: string
    expectedLight: string
    expectedDark: string
    reset: string
    styleLeft: boolean
    ok: { light: boolean; dark: boolean; reset: boolean }
  }>(`(async () => {
    ${ACCENT_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const select = document.querySelector('[data-e2e="accent-switch"]')
    const button = document.querySelector("#demo-Button button")
    const choose = async (value) => {
      select.value = value
      select.dispatchEvent(new Event("change", { bubbles: true }))
      await settle(button)
    }
    root.classList.toggle("dark", false)
    await choose("blue")
    const light = getComputedStyle(button).backgroundColor
    root.classList.toggle("dark", true)
    await settle(button)
    const dark = getComputedStyle(button).backgroundColor
    // The dark Button is step 700 of the scale the switch's accent set: whatever tokens.css works
    // that step out to, it carries the accent's hue moved by purple-700's offset, -3.063.
    const darkStep = resolve("var(--color-accent-700)")
    const blue = "${ACCENTS.blue.color}"
    await choose("purple")
    const reset = getComputedStyle(button).backgroundColor
    const styleLeft = document.getElementById("accent-override") !== null
    root.classList.toggle("dark", wasDark)
    await settle(button)
    const expectedLight = resolve(blue)
    const expectedDark = numbers(darkStep)[2].toFixed(3) ===
        (numbers(resolve(blue))[2] - 3.063).toFixed(3)
      ? darkStep
      : "a step 700 with the blue accent's hue, not " + darkStep
    const expectedReset = resolve("${PURPLE[700]}")
    return {
      light,
      dark,
      expectedLight,
      expectedDark,
      reset,
      styleLeft,
      ok: {
        light: same(light, expectedLight),
        dark: same(dark, expectedDark),
        reset: same(reset, expectedReset) && !styleLeft,
      },
    }
  })()`)
  check(
    "the host's accent switch repaints the Button card in light and dark, and Purple puts it back",
    control.ok.light && control.ok.dark && control.ok.reset,
    `Blue: light ${control.light} (expected ${control.expectedLight}), dark ${control.dark} ` +
      `(expected ${control.expectedDark}); Purple in dark: ${control.reset}` +
      (control.styleLeft ? ", and the switch's stylesheet was left behind" : ""),
  )

  // A warm accent (#387's review): the scale's chroma is capped to what sRGB can show, so every step
  // renders as the colour it names instead of being clipped channel by channel into pure red, and
  // every fill that carries the primary Button's white label keeps it at 4.5:1 (#387's second
  // review: lightening the dark steps had dropped it to 3:1). Read as rendered pixels: each
  // computed colour is drawn on a 1x1 canvas and read back, because a computed colour string says
  // nothing about clipping.
  const gamut = await devtools.evaluate<{
    offGamut: string[]
    worst: string
    lowContrast: string[]
    lowest: string
  }>(`(async () => {
    ${ACCENT_HELPERS}
    ${OKLAB_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const accents = ${JSON.stringify(GAMUT_ACCENTS)}
    const style = document.createElement("style")
    document.head.append(style)
    const offGamut = []
    let worst = { distance: 0, label: "" }
    for (const [name, color] of Object.entries(accents)) {
      style.textContent = ":root { --color-primary: " + color + "; --color-accent: " + color + "; }"
      for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 950]) {
        const specified = resolve("var(--color-accent-" + step + ")")
        const distance = oklabDistance(oklabOfComputed(specified), oklabOfPixel(specified))
        const label = name + " " + step + " " + specified + " → " + distance.toFixed(3)
        if (distance > worst.distance) worst = { distance, label }
        if (!(distance < 0.02)) offGamut.push(label)
      }
    }
    // The primary Button's white label sits on step 900 (light fill), 800 (light hover), 700
    // (dark fill) and 600 (dark hover). The fills are read off the Button card itself.
    const button = document.querySelector("#demo-Button button")
    const lowContrast = []
    let lowest = { ratio: Infinity, label: "" }
    for (const [name, color] of Object.entries(accents)) {
      style.textContent = ":root { --color-primary: " + color + "; --color-accent: " + color + "; }"
      for (const dark of [false, true]) {
        root.classList.toggle("dark", dark)
        await settle(button)
        const fills = {
          [dark ? "dark fill" : "light fill"]: getComputedStyle(button).backgroundColor,
          [dark ? "dark hover" : "light hover"]: resolve(
            "var(--color-accent-" + (dark ? 600 : 800) + ")",
          ),
        }
        for (const [where, fill] of Object.entries(fills)) {
          const ratio = whiteContrastOfPixel(fill)
          const label = name + " " + where + " " + fill + " → " + ratio.toFixed(2) + ":1"
          if (ratio < lowest.ratio) lowest = { ratio, label }
          if (!(ratio >= 4.5)) lowContrast.push(label)
        }
      }
    }
    style.remove()
    root.classList.toggle("dark", wasDark)
    await settle(button)
    return { offGamut, worst: worst.label, lowContrast, lowest: lowest.label }
  })()`)
  check(
    "a warm, a rose, a blue and a green accent render every derived step as the colour it names",
    gamut.offGamut.length === 0,
    gamut.offGamut.length === 0
      ? `worst step ${gamut.worst} (OKLab, drawn and read back)`
      : `clipped by more than 0.02 OKLab: ${gamut.offGamut.join("; ")}`,
  )
  check(
    "with those accents, the primary Button's white label clears 4.5:1 on its fill and hover, " +
      "light and dark",
    gamut.lowContrast.length === 0,
    gamut.lowContrast.length === 0
      ? `lowest ${gamut.lowest} (drawn and read back)`
      : `below 4.5:1: ${gamut.lowContrast.join("; ")}`,
  )

  // Calendar is on the system page. Picking a day there changes only that card's own state, and the
  // page is left again right after, so the system block meets a fresh card.
  await openGuidePage(devtools, "system")
  const calendar = await devtools.evaluate<{
    before: { selected: string; dot: string }
    after: { selected: string; dot: string }
    expected: { selected: string; dot: string }
    ok: { before: boolean; after: boolean }
  }>(`(async () => {
    ${ACCENT_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    root.classList.toggle("dark", false)
    const card = document.querySelector('#demo-Calendar [data-e2e="calendar-interactive"]')
    card.querySelector('button[data-calendar-date="2026-03-11"]').click()
    await frame()
    const day = card.querySelector('[data-calendar-date="2026-03-11"][aria-current="date"]')
    const dot = card.querySelector('[data-calendar-date="2026-03-12"] span[aria-hidden="true"]')
    const read = async () => {
      await settle(day, dot)
      return {
        selected: getComputedStyle(day).backgroundColor,
        dot: getComputedStyle(dot).backgroundColor,
      }
    }
    const before = await read()
    const style = document.createElement("style")
    style.textContent = ":root { --color-primary: ${APP_ACCENT}; }"
    document.head.append(style)
    const after = await read()
    // The dot is step 600 of the scale this accent sets, so it carries the accent's hue moved by
    // purple-600's offset, -2.666.
    const dotStep = resolve("var(--color-accent-600)")
    style.remove()
    root.classList.toggle("dark", wasDark)
    await settle(day, dot)
    const expected = {
      selected: resolve("${APP_ACCENT}"),
      dot: numbers(dotStep)[2].toFixed(3) ===
          (numbers(resolve("${APP_ACCENT}"))[2] - 2.666).toFixed(3)
        ? dotStep
        : "a step 600 with the accent's hue, not " + dotStep,
    }
    const purple900 = resolve("${PURPLE[900]}")
    const purple600 = resolve("${PURPLE[600]}")
    return {
      before,
      after,
      expected,
      ok: {
        before: same(before.selected, purple900) && same(before.dot, purple600),
        after: same(after.selected, expected.selected) && same(after.dot, expected.dot),
      },
    }
  })()`)
  check(
    "Calendar's selected day and scarce-day dot are purple with no token, and follow --color-primary",
    calendar.ok.before && calendar.ok.after,
    `no token: selected ${calendar.before.selected}, dot ${calendar.before.dot}; with ` +
      `--color-primary: selected ${calendar.after.selected} (expected ` +
      `${calendar.expected.selected}), dot ${calendar.after.dot} (expected ${calendar.expected.dot})`,
  )
  await openGuidePage(devtools, "ui")
  await lightAccentChecks(devtools)

  // Every reading above flips `.dark` and puts it back; one that forgot would leave the page's class
  // disagreeing with the app's own state, and the next block to press the toggle would land in the
  // wrong palette (#387's CI failure). The toggle's name says what a press does, so it names the
  // palette the app believes it is in.
  const agreement = await devtools.evaluate<{ dark: boolean; toggle: string }>(`(() => ({
    dark: document.documentElement.classList.contains("dark"),
    toggle: document.querySelector('[data-e2e="theme-toggle"]').getAttribute("aria-label"),
  }))()`)
  check(
    "after the accent checks, <html>'s dark class still matches the palette toggle",
    agreement.dark === (agreement.toggle === "Switch to light mode"),
    `dark class ${agreement.dark}, toggle "${agreement.toggle}"`,
  )
}

/** Page-side drawing and WCAG contrast, as source text: colours are read back from pixels. */
const CONTRAST_HELPERS = `
  const pixel = (color) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d", { colorSpace: "srgb" })
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
  }
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((value) => {
      const c = value / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrast = (a, b) => {
    const x = luminance(pixel(a))
    const y = luminance(pixel(b))
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }
`

/**
 * The accent label and the danger label (#417).
 *
 * - With no token set, the primary Button's label is exactly `oklch(1 0 0)` and the danger
 *   Button's is white, at 4.5:1 or better on its fill in light and dark, with the hover steps the
 *   Button had before.
 * - With `#f97316` as the accent, the label reads at 4.5:1 on the fill, the hover and the dark fill.
 * - A sweep of {@link SWEEP_HUES} x {@link SWEEP_LIGHTNESSES} accents at high chroma: the label
 *   `--color-accent-foreground` reads at 4.5:1 on steps 900, 800, 700 and 600 for every one. That
 *   sweep is the whole claim the README makes about a light accent.
 * - Headings follow `--font-heading` and inherit without it; `font-medium` follows
 *   `--font-weight-medium`.
 *
 * Contrast is measured on pixels the browser drew (a 1x1 canvas), never computed from a token.
 *
 * @param devtools The connected session, on the `ui` page.
 */
async function lightAccentChecks(devtools: Devtools): Promise<void> {
  const defaults = await devtools.evaluate<{
    dangerFound: boolean
    primaryLabel: string
    primaryExpected: string
    dangerLight: { label: string; fill: string; contrast: number; hover: string }
    dangerDark: { label: string; fill: string; contrast: number; hover: string }
    expected: { red600: string; red700: string; white: string }
  }>(`(async () => {
    ${ACCENT_HELPERS}
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const primary = document.querySelector("#demo-Button button")
    const danger = Array.from(document.querySelectorAll("#demo-Button button"))
      .find((button) => button.className.includes("bg-danger-fill"))
    const read = async (dark) => {
      root.classList.toggle("dark", dark)
      await settle(primary)
      const style = getComputedStyle(danger)
      const probe = document.createElement("span")
      probe.className = "bg-danger-fill-hover"
      document.body.append(probe)
      const hover = getComputedStyle(probe).backgroundColor
      probe.remove()
      return {
        label: style.color,
        fill: style.backgroundColor,
        contrast: contrast(style.color, style.backgroundColor),
        hover,
      }
    }
    const result = { dangerFound: Boolean(danger) }
    if (danger) {
      result.dangerLight = await read(false)
      result.dangerDark = await read(true)
    }
    root.classList.toggle("dark", false)
    await settle(primary)
    result.primaryLabel = getComputedStyle(primary).color
    result.primaryExpected = resolve("oklch(1 0 0)")
    result.expected = {
      red600: resolve("oklch(0.577 0.245 27.325)"),
      red700: resolve("oklch(0.505 0.213 27.518)"),
      white: resolve("oklch(1 0 0)"),
    }
    root.classList.toggle("dark", wasDark)
    await settle(primary)
    return result
  })()`)
  const dl = defaults.dangerLight
  const dd = defaults.dangerDark
  check(
    "with no token set, the primary Button's label is exactly white, oklch(1 0 0)",
    defaults.primaryLabel === defaults.primaryExpected,
    `label ${defaults.primaryLabel}, expected ${defaults.primaryExpected}`,
  )
  check(
    "with no token set, the danger Button has a white label at 4.5:1 or better, light and dark",
    defaults.dangerFound && dl.label === defaults.expected.white &&
      dd.label === defaults.expected.white && dl.contrast >= 4.5 && dd.contrast >= 4.5,
    defaults.dangerFound
      ? `light ${dl.label} on ${dl.fill}: ${dl.contrast.toFixed(2)}:1; dark ${dd.label} on ` +
        `${dd.fill}: ${dd.contrast.toFixed(2)}:1`
      : "no danger Button in the Button card",
  )
  check(
    "with no token set, the danger Button is red-600 in light and red-700 in dark, hover the other",
    defaults.dangerFound && dl.fill === defaults.expected.red600 &&
      dl.hover === defaults.expected.red700 && dd.fill === defaults.expected.red700 &&
      dd.hover === defaults.expected.red600,
    defaults.dangerFound
      ? `light ${dl.fill} → ${dl.hover}; dark ${dd.fill} → ${dd.hover}`
      : "no danger Button in the Button card",
  )

  const light = await devtools.evaluate<{
    fill: string
    label: string
    fillContrast: number
    hoverContrast: number
    darkFillContrast: number
  }>(`(async () => {
    ${ACCENT_HELPERS}
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const style = document.createElement("style")
    style.textContent = ":root { --color-primary: #f97316; --color-accent: #f97316; }"
    document.head.append(style)
    const button = document.querySelector("#demo-Button button")
    const result = {}
    root.classList.toggle("dark", false)
    await settle(button)
    const label = getComputedStyle(button).color
    result.fill = getComputedStyle(button).backgroundColor
    result.label = label
    result.fillContrast = contrast(label, result.fill)
    result.hoverContrast = contrast(label, resolve("var(--color-accent-800)"))
    root.classList.toggle("dark", true)
    await settle(button)
    result.darkFillContrast = contrast(getComputedStyle(button).color, getComputedStyle(button).backgroundColor)
    style.remove()
    root.classList.toggle("dark", wasDark)
    await settle(button)
    return result
  })()`)
  check(
    "with #f97316 as the accent, the primary Button's label reads at 4.5:1 on its fill, its hover and in dark",
    light.fillContrast >= 4.5 && light.hoverContrast >= 4.5 && light.darkFillContrast >= 4.5,
    `label ${light.label} on ${light.fill}: ${light.fillContrast.toFixed(2)}:1, hover ` +
      `${light.hoverContrast.toFixed(2)}:1, dark ${light.darkFillContrast.toFixed(2)}:1`,
  )

  const sweep = await devtools.evaluate<{
    tried: number
    failures: string[]
    dark: number
  }>(`(async () => {
    ${ACCENT_HELPERS}
    ${CONTRAST_HELPERS}
    const style = document.createElement("style")
    document.head.append(style)
    const failures = []
    let tried = 0
    let dark = 0
    for (const hue of ${JSON.stringify(SWEEP_HUES)}) {
      for (const lightness of ${JSON.stringify(SWEEP_LIGHTNESSES)}) {
        const accent = "oklch(" + lightness + " 0.3 " + hue + ")"
        style.textContent = ":root { --color-accent: " + accent + "; }"
        await frame()
        const label = resolve("var(--color-accent-foreground)")
        if (!same(label, resolve("oklch(1 0 0)"))) dark++
        tried++
        for (const step of [900, 800, 700, 600]) {
          const fill = resolve("var(--color-accent-" + step + ")")
          const ratio = contrast(label, fill)
          if (ratio < 4.5) failures.push(accent + " step " + step + " " + ratio.toFixed(2) + ":1")
        }
      }
    }
    style.remove()
    return { tried, failures, dark }
  })()`)
  check(
    "for accents of seven hues and eight lightnesses at high chroma, the label reads at 4.5:1 on steps 900, 800, 700 and 600",
    sweep.tried === SWEEP_HUES.length * SWEEP_LIGHTNESSES.length && sweep.failures.length === 0 &&
      sweep.dark > 0 && sweep.dark < sweep.tried,
    sweep.failures.length === 0
      ? `${sweep.tried} accents, ${sweep.dark} take the dark label, all four steps ≥ 4.5:1`
      : `${sweep.failures.length} of ${sweep.tried * 4} fails, e.g. ${
        sweep.failures.slice(0, 4).join("; ")
      }`,
  )

  const fonts = await devtools.evaluate<{
    inherited: string
    mono: string
    unset: string
    set: string
    setInMono: string
    own: string
    ownExpected: string
    weight: string
  }>(`(async () => {
    ${ACCENT_HELPERS}
    const host = document.createElement("div")
    host.className = "font-mono"
    host.innerHTML = '<h3 id="hf-a">Wrapped</h3><h3 id="hf-b" class="font-sans">Own</h3>' +
      '<h2 id="hf-c" class="h2">Class</h2>'
    document.body.append(host)
    const family = (id) => getComputedStyle(document.getElementById(id)).fontFamily
    const sansProbe = document.createElement("div")
    sansProbe.className = "font-sans"
    document.body.append(sansProbe)
    await frame()
    const unset = { wrapped: family("hf-a"), klass: family("hf-c"), mono: getComputedStyle(host).fontFamily }
    const style = document.createElement("style")
    style.textContent = ":root { --font-heading: Georgia, serif; --font-weight-medium: 600; }"
    document.head.append(style)
    await frame()
    const result = {
      inherited: unset.wrapped,
      mono: unset.mono,
      unset: unset.klass,
      set: family("hf-a"),
      setInMono: family("hf-c"),
      own: family("hf-b"),
      ownExpected: getComputedStyle(sansProbe).fontFamily,
      weight: getComputedStyle(document.getElementById("hf-c")).fontWeight,
    }
    style.remove()
    host.remove()
    sansProbe.remove()
    return result
  })()`)
  check(
    "with no --font-heading, a heading and an h2 class inside font-mono keep the wrapper's font",
    fonts.inherited === fonts.mono && fonts.unset === fonts.mono,
    `wrapper ${fonts.mono}; h3 ${fonts.inherited}; h2 class ${fonts.unset}`,
  )
  check(
    "--font-heading sets a bare heading and the h2 class, but not a heading with a font class of its own",
    fonts.set.startsWith("Georgia") && fonts.setInMono.startsWith("Georgia") &&
      fonts.own === fonts.ownExpected,
    `bare ${fonts.set}; class ${fonts.setInMono}; font-sans ${fonts.own}`,
  )
  check(
    "--font-weight-medium sets the weight of the library's h2 class",
    fonts.weight === "600",
    `h2 class weight ${fonts.weight}`,
  )
}

/** The hues (OKLCH degrees) the label sweep covers: red, orange, yellow, green, cyan, blue, purple. */
const SWEEP_HUES = [25, 55, 100, 145, 200, 260, 305]

/** The lightnesses the label sweep covers, from a dark fill to a pale one. */
const SWEEP_LIGHTNESSES = [0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9]
