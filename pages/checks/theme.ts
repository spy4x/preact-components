import { check, type Devtools } from "./harness.ts"

/**
 * `theme/`'s browser checks: the form controls and surfaces of the class chapter as native events
 * and computed styles, the palette toggle, and the Tailwind/`tokens.css` output that only a real
 * stylesheet could have produced.
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
    surfaces.numAlign === "right" && surfaces.list === "disc" && surfaces.link === "underline",
    `num ${surfaces.numAlign}, list ${surfaces.list}, link ${surfaces.link}`,
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
    // transition-colors utility animates the button's background-color across that flip. Sampled
    // once, this probe caught the fill mid-transition — a different colour on every run, since how
    // far the transition had gotten by the time this ran was a race against the click. Poll until
    // two consecutive reads agree, so the sample is the settled colour (or, if nothing was
    // transitioning, the first read repeats immediately) rather than a snapshot of motion — do not
    // remove this as redundant.
    let previous = getComputedStyle(button).backgroundColor
    let buttonBackground = previous
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((done) => setTimeout(done, 30))
      const next = getComputedStyle(button).backgroundColor
      if (next === previous) {
        buttonBackground = next
        break
      }
      previous = next
      buttonBackground = next
    }

    return {
      buttonRadius: getComputedStyle(button).borderRadius,
      buttonBackground,
      light,
      dark,
    }
  })()`)
  check(
    "Tailwind utilities style the components in the browser",
    styled.buttonRadius === "6px" && styled.buttonBackground !== "rgba(0, 0, 0, 0)",
    `Button radius ${styled.buttonRadius} (rounded-md), primary fill ${styled.buttonBackground}`,
  )
  check(
    "tokens.css switches the palette on the .dark class",
    styled.light !== "rgba(0, 0, 0, 0)" && styled.light !== styled.dark,
    `canvas ${styled.light} light / ${styled.dark} dark`,
  )
}
