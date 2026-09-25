import { check, type Devtools, pressKey } from "./harness.ts"

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
      const button = [...document.querySelectorAll("header button")]
        .find((candidate) => ["Dark", "Light"].includes(candidate.textContent.trim()))
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

  // #257's reviewer round: under ink, .btn's focus-visible outline used to draw in currentColor,
  // which on .btn-primary is that button's own near-black text — invisible against its own fill.
  // preset.css now points it at var(--color-focus-ring, currentColor). `.btn`/`.btn-primary` are
  // classes this preset ships, not a component the catalogue instantiates anywhere — the nearest
  // catalogue card, "Button", is `ui/Button`, a different, Tailwind-utility button with its own
  // `focus-visible:ring-*` styling and no connection to this class at all. So this probe builds a
  // real `<button class="btn btn-primary">` itself, fixed on screen so a real click can reach it,
  // reads it, and removes it again.
  //
  // A script call to .focus() was tried first to read the outline back, and Chromium does not
  // enter :focus-visible for a button focused that way — it reads back the browser's own
  // unrelated default outline (a plain white ring) regardless of what preset.css says, which
  // would make this check pass even with the fix reverted. A real click doesn't either: Chromium
  // does not treat a mouse-triggered focus as :focus-visible. What does is tabbing away from the
  // button and back — both genuine keyboard interactions — so this clicks the button once (an
  // ordinary focus, not yet the one this check reads), tabs forward and Shift+Tabs straight back,
  // and only then reads what the second, keyboard-driven focus actually committed.
  const rect = await devtools.evaluate<{ x: number; y: number }>(`(() => {
    const root = document.documentElement
    window.__inkFocusRingRestore = {
      wasDark: root.classList.contains("dark"),
      wasTheme: root.getAttribute("data-theme"),
    }
    root.classList.add("dark")
    root.setAttribute("data-theme", "ink")

    const button = document.createElement("button")
    button.type = "button"
    button.className = "btn btn-primary"
    button.textContent = "Focus ring probe"
    button.id = "ink-focus-ring-probe"
    button.style.position = "fixed"
    button.style.top = "8px"
    button.style.left = "8px"
    button.style.zIndex = "99999"
    document.body.appendChild(button)

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
    ratio: number
  }>(`(async () => {
    const root = document.documentElement
    const { wasDark, wasTheme } = window.__inkFocusRingRestore
    delete window.__inkFocusRingRestore

    const button = document.getElementById("ink-focus-ring-probe")
    if (document.activeElement !== button) {
      button.remove()
      throw new Error(
        "the probe button never received focus — document.activeElement is " +
          (document.activeElement ? document.activeElement.tagName : "nothing") +
          ", not the probe; this check's own click-then-tab-and-back sequence did not land " +
          "where it expected",
      )
    }

    const outlineStyle = getComputedStyle(button).outlineStyle
    if (outlineStyle === "none") {
      button.remove()
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
    const lighter = Math.max(luminance(outlineColor), luminance(pageBackground))
    const darker = Math.min(luminance(outlineColor), luminance(pageBackground))
    const ratio = (lighter + 0.05) / (darker + 0.05)

    button.remove()
    root.classList.toggle("dark", wasDark)
    if (wasTheme === null) root.removeAttribute("data-theme")
    else root.setAttribute("data-theme", wasTheme)

    return { outlineColor, pageBackground, ratio }
  })()`)
  check(
    "under ink, a focused .btn.btn-primary's outline clears 3:1 contrast against the page",
    focusRing.ratio >= 3,
    `outline ${focusRing.outlineColor} vs page ${focusRing.pageBackground}, ratio ` +
      `${focusRing.ratio.toFixed(2)}:1`,
  )
}
