import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  pointerToCorner,
  poll,
  pressKey,
} from "../harness.ts"
import { BUTTON_LINK, describeLinkOutcome, pressLink } from "./shared-links.ts"
import { type Chord, pressChord } from "./shared.ts"

/** What one read of the busy `Button` demo sees. */
interface BusyState {
  /** `aria-busy` on the Confirm button, or `null` when it is not set. */
  busy: string | null
  /** `aria-disabled` on the Confirm button, or `null` when it is not set. */
  ariaDisabled: string | null
  /** `true` when the native `disabled` attribute is set, which a busy button must not do. */
  disabled: boolean
  /** The Confirm button's visible text. */
  text: string
  /** `true` when the spinner is inside the Confirm button. */
  spinner: boolean
  /** How many presses the demo's own counter recorded. */
  count: number
  /** `true` when the Confirm button has focus. */
  focused: boolean
}

/** Reads {@link BusyState} off the `Button` card in one round trip. */
const BUSY_STATE = `(() => {
  const confirm = document.querySelector('#demo-Button [data-e2e="busy-confirm"]')
  const counter = confirm.parentElement.textContent.match(/confirmed (\\d+)/)
  return {
    busy: confirm.getAttribute("aria-busy"),
    ariaDisabled: confirm.getAttribute("aria-disabled"),
    disabled: confirm.disabled,
    text: confirm.textContent.trim(),
    spinner: confirm.querySelector("svg.animate-spin") !== null,
    count: counter === null ? -1 : Number(counter[1]),
    focused: document.activeElement === confirm,
  }
})()`

/**
 * `Button`'s `busy` state, driven with real key presses on the `Button` card's busy demo.
 *
 * A press on Confirm makes it busy. Busy means a spinner, `aria-busy="true"`, the busy label in
 * place of the children, focus left where it was, and further presses ignored: the demo counts
 * every press its `onClick` receives, so a second Enter and a Space that reached it would move the
 * count past one. A string render sees the attributes of a busy button, but not that a press on one
 * does nothing, nor that focus survives the switch; only a browser shows those. Finish ends the
 * work, and the idle button has to come back with its own label.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function busyButtonChecks(devtools: Devtools): Promise<void> {
  const confirm = `document.querySelector('#demo-Button [data-e2e="busy-confirm"]')`
  const finish = `document.querySelector('#demo-Button [data-e2e="busy-finish"]')`
  await centreInView(devtools, confirm)

  const before = await devtools.evaluate<BusyState>(BUSY_STATE)
  await devtools.evaluate<null>(`(${confirm}.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${BUSY_STATE}.busy === "true"`), 2_000)
  const busy = await devtools.evaluate<BusyState>(BUSY_STATE)

  check(
    "a real Enter press makes the busy Button busy: spinner, aria-busy, busy label, focus kept",
    before.busy === null && before.text === "Confirm" && !before.spinner &&
      busy.busy === "true" && busy.ariaDisabled === "true" && !busy.disabled &&
      busy.text === "Confirming…" && busy.spinner && busy.focused &&
      busy.count === before.count + 1,
    `aria-busy ${before.busy} → ${busy.busy}, aria-disabled ${busy.ariaDisabled}, ` +
      `disabled ${busy.disabled}, "${before.text}" → "${busy.text}", spinner ${busy.spinner}, ` +
      `focus ${busy.focused ? "kept" : "lost"}, count ${before.count} → ${busy.count}`,
  )

  await pressKey(devtools, "Enter")
  await pressKey(devtools, "Space")
  // A fixed wait, not a poll: it proves a press does nothing, and an absence has no state to poll
  // for. A press that got through would re-render the counter at once; give it time to show up.
  await new Promise((done) => setTimeout(done, 200))
  const pressed = await devtools.evaluate<BusyState>(BUSY_STATE)
  check(
    "a busy Button ignores Enter and Space: its onClick does not run again",
    pressed.busy === "true" && pressed.count === busy.count && pressed.focused,
    `count ${busy.count} → ${pressed.count} after Enter and Space, aria-busy ${pressed.busy}, ` +
      `focus ${pressed.focused ? "kept" : "lost"}`,
  )

  await devtools.evaluate<null>(`(${finish}.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${BUSY_STATE}.busy === null`), 2_000)
  const idle = await devtools.evaluate<BusyState>(BUSY_STATE)
  check(
    "a Button that stops being busy drops aria-busy, the spinner and the busy label",
    idle.busy === null && idle.ariaDisabled === null && idle.text === "Confirm" && !idle.spinner,
    `aria-busy ${pressed.busy} → ${idle.busy}, "${pressed.text}" → "${idle.text}", ` +
      `spinner ${idle.spinner}`,
  )
}

/** What one read of the busy submit demo sees. */
interface BusySubmitState {
  /** `aria-busy` on the submit button, or `null` when it is not set. */
  busy: string | null
  /** How many submissions the form's own counter recorded. */
  submits: number
}

/** Reads {@link BusySubmitState} off the `Button` card's form in one round trip. */
const BUSY_SUBMIT_STATE = `(() => {
  const form = document.querySelector('#demo-Button [data-e2e="busy-form"]')
  const counter = form.textContent.match(/submitted (\\d+)/)
  return {
    busy: form.querySelector('[data-e2e="busy-form-submit"]').getAttribute("aria-busy"),
    submits: counter === null ? -1 : Number(counter[1]),
  }
})()`

/**
 * A busy submit `Button` stops its form from being sent a second time.
 *
 * Enter in a text field submits the form by clicking its submit button for the user, so the first
 * Enter has to submit once and make the button busy. A second Enter in the field and an Enter on
 * the busy button itself are both presses the button cancels, so the form's own count stays at one.
 * The field is where most double submissions start, and no string render reaches either path.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function busySubmitChecks(devtools: Devtools): Promise<void> {
  const field = `document.querySelector('#demo-Button [data-e2e="busy-form-field"]')`
  const submit = `document.querySelector('#demo-Button [data-e2e="busy-form-submit"]')`
  const finish = `document.querySelector('#demo-Button [data-e2e="busy-form-finish"]')`
  await centreInView(devtools, field)

  const before = await devtools.evaluate<BusySubmitState>(BUSY_SUBMIT_STATE)
  await devtools.evaluate<null>(`(${field}.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${BUSY_SUBMIT_STATE}.busy === "true"`), 2_000)
  const first = await devtools.evaluate<BusySubmitState>(BUSY_SUBMIT_STATE)
  check(
    "Enter in a form's field submits it once and makes its submit Button busy",
    before.busy === null && first.busy === "true" && first.submits === before.submits + 1,
    `aria-busy ${before.busy} → ${first.busy}, submitted ${before.submits} → ${first.submits}`,
  )

  await pressKey(devtools, "Enter")
  await devtools.evaluate<null>(`(${submit}.focus(), null)`)
  await pressKey(devtools, "Enter")
  // A fixed wait, not a poll: it proves a submission does not happen, and an absence has no state
  // to poll for. One that got through would re-render the counter at once; give it time to show up.
  await new Promise((done) => setTimeout(done, 200))
  const again = await devtools.evaluate<BusySubmitState>(BUSY_SUBMIT_STATE)
  check(
    "a busy submit Button keeps its form from being sent again, from the field or from itself",
    again.busy === "true" && again.submits === first.submits,
    `submitted ${first.submits} → ${again.submits} after Enter in the field and on the button`,
  )

  await devtools.evaluate<null>(`(${finish}.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${BUSY_SUBMIT_STATE}.busy === null`), 2_000)
}

/** A primary Button's fill and label, read in one palette. */
interface PrimaryFill {
  fill: string
  /** The fill against the palette's canvas. */
  onCanvas: number
  /** The fill against the palette's raised surface, a card. */
  onSurface: number
  /** The label against the fill. */
  label: number
  /** `true` when the fill is exactly accent step 900, the light palette's own. */
  isStep900: boolean
}

/** The primary Button under a real pointer, in the dark palette. */
interface PrimaryHover {
  /** `true` when the browser put the button into `:hover`. */
  hovered: boolean
  fill: string
  onCanvas: number
  label: number
}

/** The Button card's primary button, the one both checks below read. */
const PRIMARY_BUTTON = `document.querySelector("#demo-Button button")`

/** In-page helpers the two readings share: a token's colour, and a wait for running transitions. */
const PRIMARY_HELPERS = `
  const token = (name) => {
    const probe = document.createElement("div")
    probe.style.backgroundColor = "var(" + name + ")"
    document.body.appendChild(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  }
  const settle = (element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})))
`

/**
 * In the dark palette a primary Button at rest stands 3:1 off the gray-900 canvas and keeps its
 * label at 4.5:1 (#397), and in the light palette it is still accent step 900. Then a real pointer
 * rests on it in dark: the hovered fill must differ from the resting one and keep the label at
 * 4.5:1. The hovered fill is not held to 3:1 on the canvas: it shows only under the pointer, and
 * no accent step but the resting fill's own both stands 3:1 off the canvas and holds a white label
 * at 4.5:1; its ratio is printed.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function primaryButtonFillCheck(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const reading = await devtools.evaluate<
    { found: boolean; hovered: boolean; light: PrimaryFill; dark: PrimaryFill }
  >(
    `(async () => {
    ${CONTRAST_HELPERS}
    ${PRIMARY_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const button = ${PRIMARY_BUTTON}
    const measure = () => {
      const fill = getComputedStyle(button).backgroundColor
      const painted = paint(fill)
      return {
        fill,
        onCanvas: ratio(painted, paint(token("--color-canvas"))),
        onSurface: ratio(painted, paint(token("--color-surface"))),
        label: seenRatio(button),
        isStep900: fill === token("--color-accent-900"),
      }
    }
    if (!button) return { found: false, hovered: false, light: null, dark: null }
    try {
      root.classList.remove("dark")
      await settle(button)
      const light = measure()
      root.classList.add("dark")
      await settle(button)
      return { found: true, hovered: button.matches(":hover"), light, dark: measure() }
    } finally {
      root.classList.toggle("dark", wasDark)
    }
  })()`,
  )
  const { found, light, dark } = reading
  check(
    "in the dark palette a primary Button stands 3:1 off the canvas with its label at 4.5:1, " +
      "and its light fill is unchanged",
    found && !reading.hovered && dark.onCanvas >= 3 && dark.label >= 4.5 && light.isStep900 &&
      light.label >= 4.5,
    !found
      ? "the Button card has no button"
      : reading.hovered
      ? "the pointer rests on the button, so the reading is its hover fill"
      : `dark: fill ${dark.fill} ${dark.onCanvas.toFixed(2)}:1 on the canvas, ` +
        `${dark.onSurface.toFixed(2)}:1 on the surface, label ${dark.label.toFixed(2)}:1 — ` +
        `light: fill ${light.fill} (step 900 ${light.isStep900}), ` +
        `${light.onCanvas.toFixed(2)}:1 on the canvas, label ${light.label.toFixed(2)}:1`,
  )
  if (!found) return

  const wasDark = await devtools.evaluate<boolean>(`(() => {
    const was = document.documentElement.classList.contains("dark")
    document.documentElement.classList.add("dark")
    return was
  })()`)
  try {
    await centreInView(devtools, PRIMARY_BUTTON)
    const aim = await devtools.evaluate<{ x: number; y: number; onTarget: boolean }>(`(() => {
      const button = ${PRIMARY_BUTTON}
      const box = button.getBoundingClientRect()
      const x = Math.round(box.left + box.width / 2)
      const y = Math.round(box.top + box.height / 2)
      const hit = document.elementFromPoint(x, y)
      return { x, y, onTarget: hit !== null && button.contains(hit) }
    })()`)
    await devtools.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: aim.x,
      y: aim.y,
      button: "none",
      buttons: 0,
    })
    await poll(() => devtools.evaluate<boolean>(`${PRIMARY_BUTTON}.matches(":hover")`), 2_000)
    const hover = await devtools.evaluate<PrimaryHover>(`(async () => {
      ${CONTRAST_HELPERS}
      ${PRIMARY_HELPERS}
      const button = ${PRIMARY_BUTTON}
      await settle(button)
      const fill = getComputedStyle(button).backgroundColor
      const painted = paint(fill)
      return {
        hovered: button.matches(":hover"),
        fill,
        onCanvas: ratio(painted, paint(token("--color-canvas"))),
        label: seenRatio(button),
      }
    })()`)
    check(
      "under a real pointer in the dark palette a primary Button changes its fill and keeps its " +
        "label at 4.5:1",
      aim.onTarget && hover.hovered && hover.fill !== dark.fill && hover.label >= 4.5,
      !aim.onTarget
        ? `the point (${aim.x}, ${aim.y}) is not on the button, so the pointer cannot hover it`
        : !hover.hovered
        ? "the pointer reached the button but the browser never put it into :hover"
        : `rest ${dark.fill} → hover ${hover.fill}, label ${hover.label.toFixed(2)}:1, ` +
          `${hover.onCanvas.toFixed(2)}:1 on the canvas (not asserted)`,
    )
  } finally {
    await pointerToCorner(devtools)
    await devtools.evaluate<null>(
      `(document.documentElement.classList.toggle("dark", ${wasDark}), null)`,
    )
  }
}

const BUTTON_LINK_DISABLED = `#demo-Button [data-e2e="button-link-disabled"]`

const BUTTON_LINK_FOREIGN = `#demo-Button [data-e2e="button-link-foreign"]`

const BUTTON_LINK_COUNTER = `#demo-Button [data-e2e="button-link-navigated"]`

/**
 * A `Button` given `href` and `navigate` follows the rule `Link` runs: a plain click calls
 * `navigate` and cancels the browser's navigation, and a Ctrl click is left to the browser. Its
 * disabled form cannot take focus, as a disabled `<button>` cannot. Each click is one real press;
 * see {@link pressLink}.
 *
 * @param devtools The connected session, on the `ui` page.
 */
export async function buttonLinkChecks(devtools: Devtools): Promise<void> {
  const routed = await pressLink(
    devtools,
    BUTTON_LINK,
    { name: "a plain click", button: "left", modifiers: 0 },
    BUTTON_LINK_COUNTER,
  )
  check(
    "a plain click on a Button link with navigate calls navigate and cancels the browser's " +
      "navigation",
    routed.aimed && routed.type === "click" && routed.prevented === true &&
      routed.navigations === 1 && !routed.navigated,
    describeLinkOutcome(routed),
  )

  const ctrl = await pressLink(
    devtools,
    BUTTON_LINK,
    { name: "a Ctrl click", button: "left", modifiers: 2 },
    BUTTON_LINK_COUNTER,
  )
  check(
    "a Ctrl click on a Button link with navigate is left to the browser and does not call navigate",
    ctrl.aimed && ctrl.type === "click" && ctrl.prevented === false && ctrl.navigations === 0 &&
      !ctrl.navigated,
    describeLinkOutcome(ctrl),
  )

  const foreign = await pressLink(
    devtools,
    BUTTON_LINK_FOREIGN,
    { name: "a plain click", button: "left", modifiers: 0 },
    BUTTON_LINK_COUNTER,
  )
  check(
    "a plain click on a Button link with navigate to another origin is left to the browser and does not call navigate",
    foreign.aimed && foreign.type === "click" && foreign.prevented === false &&
      foreign.navigations === 0 && !foreign.navigated,
    describeLinkOutcome(foreign),
  )

  const disabled = await devtools.evaluate<{ found: boolean; href: boolean; focused: boolean }>(
    `(() => {
      const link = document.querySelector('${BUTTON_LINK_DISABLED}')
      if (!link) return { found: false, href: false, focused: false }
      link.focus({ preventScroll: true })
      const focused = document.activeElement === link
      link.blur()
      return { found: true, href: link.hasAttribute("href"), focused }
    })()`,
  )
  check(
    "a disabled Button link has no href and cannot take focus",
    disabled.found && !disabled.href && !disabled.focused,
    disabled.found
      ? `href ${disabled.href ? "present" : "absent"}, focus ${
        disabled.focused ? "taken" : "refused"
      }`
      : `nothing at ${BUTTON_LINK_DISABLED}`,
  )

  await pointerToCorner(devtools)
}

/** One plain key press with no modifier: a letter or a digit, as a US keyboard types it. */
function plainKey(key: string): Chord {
  const code = /\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`
  return { key, code, keyCode: key.toUpperCase().charCodeAt(0), text: key, modifiers: 0 }
}

/** What one read of the `Button` card's hotkey demo sees. */
interface HotkeyButtonState {
  /** Presses the demo's `onClick` counted. */
  count: number
  /** `aria-keyshortcuts` on the button. */
  shortcuts: string | null
  /** The hint's text, or `null` when there is no hint. */
  hint: string | null
  /** The hint's rendered width; 0 when it is not displayed. */
  hintWidth: number
  /** The hint is hidden from the accessibility tree. */
  hintHidden: boolean
  /** The text field's value. */
  field: string
  /** Presses the "Send" button (`hotkey="mod+enter"`) counted. */
  sent: number
}

/** Reads {@link HotkeyButtonState} off the `Button` card in one round trip. */
const HOTKEY_BUTTON_STATE = `(() => {
  const card = document.querySelector("#demo-Button")
  const button = card.querySelector('[data-e2e="hotkey-button"]')
  const hint = button.querySelector("[data-hotkey-hint]")
  return {
    count: Number(card.querySelector('[data-e2e="hotkey-count"]').textContent.match(/\\d+/)[0]),
    shortcuts: button.getAttribute("aria-keyshortcuts"),
    hint: hint === null ? null : hint.textContent,
    hintWidth: hint === null ? 0 : hint.getBoundingClientRect().width,
    hintHidden: hint?.getAttribute("aria-hidden") === "true",
    field: card.querySelector('[data-e2e="hotkey-field"]').value,
    sent: Number(card.querySelector('[data-e2e="hotkey-count"]').textContent.match(/sent (\\d+)/)[1]),
  }
})()`

/**
 * Records whether the page's next key press reached `window` with its default action cancelled,
 * in `window.__hotkeyPrevented`. Bubble phase on `window`: after every listener on `document`.
 */
const RECORD_PREVENTED = `(window.__hotkeyPrevented = "no press", window.addEventListener(
  "keydown",
  (event) => { window.__hotkeyPrevented = event.defaultPrevented },
  { once: true },
), null)`

/**
 * The `hotkey` prop (#610), driven with real key presses: `Button`'s own demo, then the `Tabs`,
 * `ThemeToggle`, `CopyButton` and `PageAction` cards that pass the prop on.
 *
 * On `Button`: the button announces N as `aria-keyshortcuts="N"` and shows N in a hint that this
 * fine-pointer browser displays and screen readers skip. N pressed with focus on the page clicks
 * it once. N typed in the card's text field lands in the field and clicks nothing, while Control+Enter
 * pressed there clicks "Send" (`hotkey="mod+enter"`), since a chord types no text. With the card's
 * checkbox disabling the button, N clicks nothing and leaves the press uncancelled, so the key is
 * still the page's: a disabled button does not take it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function hotkeyPropChecks(devtools: Devtools): Promise<void> {
  const button = `document.querySelector('#demo-Button [data-e2e="hotkey-button"]')`
  const field = `document.querySelector('#demo-Button [data-e2e="hotkey-field"]')`
  const toggle = `document.querySelector('#demo-Button [data-e2e="hotkey-disable"]')`
  const present = await devtools.evaluate<boolean>(
    `${button} !== null && ${field} !== null && ${toggle} !== null`,
  )
  check("the Button card's hotkey demo is on the page, with its field and checkbox", present)
  if (!present) return
  await centreInView(devtools, button)
  const read = () => devtools.evaluate<HotkeyButtonState>(HOTKEY_BUTTON_STATE)
  // A fixed wait for the checks that prove a press did nothing: an absence has nothing to poll.
  const settle = () => new Promise((done) => setTimeout(done, 200))
  const blur = () => devtools.evaluate<null>(`(document.activeElement?.blur(), null)`)
  const n = plainKey("n")

  const start = await read()
  check(
    'Button hotkey="n" announces aria-keyshortcuts="N"',
    start.shortcuts === "N",
    `aria-keyshortcuts=${JSON.stringify(start.shortcuts)}`,
  )
  check(
    "Button's hotkey hint shows N on a fine-pointer screen and is hidden from screen readers",
    start.hint === "N" && start.hintWidth > 0 && start.hintHidden,
    `hint ${JSON.stringify(start.hint)}, width ${start.hintWidth}, aria-hidden ${start.hintHidden}`,
  )

  await blur()
  await pressChord(devtools, n)
  await poll(
    () => devtools.evaluate<boolean>(`${HOTKEY_BUTTON_STATE}.count > ${start.count}`),
    3_000,
  )
  await settle()
  const pressed = await read()
  check(
    "pressing N clicks the Button that has hotkey n, once",
    pressed.count === start.count + 1,
    `count ${start.count} → ${pressed.count}`,
  )

  await devtools.evaluate<null>(`(${field}.focus(), ${field}.value = "", null)`)
  await pressChord(devtools, n)
  await settle()
  const typed = await read()
  check(
    "N typed in a text field lands in the field and does not click the Button",
    typed.field === "n" && typed.count === pressed.count,
    `field ${JSON.stringify(typed.field)}, count ${pressed.count} → ${typed.count}`,
  )

  // Control+Enter: no text, as a real Control+Enter in Chromium types none into a text field.
  await pressChord(devtools, { key: "Enter", code: "Enter", keyCode: 13, modifiers: 2 })
  await poll(() => devtools.evaluate<boolean>(`${HOTKEY_BUTTON_STATE}.sent > ${typed.sent}`), 3_000)
  await settle()
  const chord = await read()
  const stillFocused = await devtools.evaluate<boolean>(`document.activeElement === ${field}`)
  check(
    "Control+Enter pressed in a text field clicks the Button with hotkey mod+enter, once",
    chord.sent === typed.sent + 1 && chord.field === "n" && chord.count === typed.count &&
      stillFocused,
    `sent ${typed.sent} → ${chord.sent}, field ${JSON.stringify(chord.field)}, notes ` +
      `${typed.count} → ${chord.count}, focus stayed in the field ${stillFocused}`,
  )

  await devtools.evaluate<null>(`(${toggle}.click(), null)`)
  const disabled = await poll(() => devtools.evaluate<boolean>(`${button}.disabled`), 3_000)
  // The switch reaches the hook through an effect; two frames and a task are past it.
  await devtools.evaluate<null>(`(async () => {
    for (let k = 0; k < 2; k++) {
      await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)))
    }
    return null
  })()`)
  await blur()
  await devtools.evaluate<null>(RECORD_PREVENTED)
  await pressChord(devtools, n)
  await settle()
  const off = await read()
  const prevented = await devtools.evaluate<boolean | string>(`window.__hotkeyPrevented`)
  check(
    "N does not click a disabled Button with hotkey n, and leaves the key press to the page",
    disabled && off.count === typed.count && prevented === false,
    `disabled ${disabled}, count ${typed.count} → ${off.count}, press cancelled ${prevented}`,
  )
  await devtools.evaluate<null>(`(${toggle}.click(), ${field}.value = "", null)`)
  await poll(() => devtools.evaluate<boolean>(`!${button}.disabled`), 3_000)

  await tabsHotkeyCheck(devtools)
  await themeToggleHotkeyCheck(devtools)
  await copyButtonHotkeyCheck(devtools)
  await pageActionHotkeyCheck(devtools)
  await dropdownItemHotkeyChecks(devtools)
  await commandPaletteHotkeyAnnouncementCheck(devtools)
}

/**
 * `Tabs` with a `hotkey` per tab: 2 selects Detail, 3 selects nothing because Archived is
 * disabled, and 1 goes back to Overview, where the card started.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function tabsHotkeyCheck(devtools: Devtools): Promise<void> {
  const selected = `document.querySelector('#demo-Tabs [role="tab"][aria-selected="true"]')?.id`
  const first = `document.querySelector('#demo-Tabs [role="tab"]')`
  const present = await devtools.evaluate<boolean>(`${first} !== null`)
  check("the Tabs card is on the page", present)
  if (!present) return
  await centreInView(devtools, first)
  await devtools.evaluate<null>(`(document.activeElement?.blur(), null)`)
  const shortcuts = await devtools.evaluate<string | null>(
    `${first}.getAttribute("aria-keyshortcuts")`,
  )
  const before = await devtools.evaluate<string>(selected)
  await pressChord(devtools, plainKey("2"))
  await poll(() => devtools.evaluate<boolean>(`${selected} === "guide-tab-detail-tab"`), 3_000)
  const two = await devtools.evaluate<string>(selected)
  await pressChord(devtools, plainKey("3"))
  await new Promise((done) => setTimeout(done, 200))
  const three = await devtools.evaluate<string>(selected)
  await pressChord(devtools, plainKey("1"))
  await poll(() => devtools.evaluate<boolean>(`${selected} === "guide-tab-overview-tab"`), 3_000)
  const one = await devtools.evaluate<string>(selected)
  check(
    "a Tabs hotkey selects its tab, and the hotkey of a disabled tab selects nothing",
    shortcuts === "1" && before === "guide-tab-overview-tab" && two === "guide-tab-detail-tab" &&
      three === two && one === "guide-tab-overview-tab",
    `first tab aria-keyshortcuts=${JSON.stringify(shortcuts)}; ${before} → 2: ${two} → 3: ` +
      `${three} → 1: ${one}`,
  )
}

/**
 * `ThemeToggle hotkey="t"`: T steps the first toggle's preference, and two more presses bring it
 * back round to where it started. As an icon button it announces T and shows no hint.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function themeToggleHotkeyCheck(devtools: Devtools): Promise<void> {
  const toggle = `document.querySelector("#demo-ThemeToggle button")`
  const readout = `document.querySelector('#demo-ThemeToggle [data-e2e="theme-toggle-readout"]')`
  const present = await devtools.evaluate<boolean>(`${toggle} !== null && ${readout} !== null`)
  check("the ThemeToggle card is on the page, with its readout", present)
  if (!present) return
  await centreInView(devtools, toggle)
  await devtools.evaluate<null>(`(document.activeElement?.blur(), null)`)
  const text = () => devtools.evaluate<string>(`${readout}.textContent`)
  const attributes = await devtools.evaluate<{ shortcuts: string | null; hint: boolean }>(
    `({ shortcuts: ${toggle}.getAttribute("aria-keyshortcuts"),
      hint: ${toggle}.querySelector("[data-hotkey-hint]") !== null })`,
  )
  const start = await text()
  const seen = [start]
  for (let press = 0; press < 3; press++) {
    const last = seen[seen.length - 1]
    await pressChord(devtools, plainKey("t"))
    await poll(async () => (await text()) !== last, 3_000)
    seen.push(await text())
  }
  check(
    "pressing T steps a ThemeToggle with hotkey t, and three presses come back round",
    attributes.shortcuts === "T" && !attributes.hint && seen[1] !== start && seen[3] === start,
    `aria-keyshortcuts=${JSON.stringify(attributes.shortcuts)}, hint ${attributes.hint}; ` +
      seen.join(" → "),
  )
}

/**
 * `CopyButton hotkey="c"` on the card's "Copy via port" button: C copies through the port, and
 * the button's own live region says "Copied".
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function copyButtonHotkeyCheck(devtools: Devtools): Promise<void> {
  const button = `[...document.querySelectorAll("#demo-CopyButton button")]
    .find((button) => button.getAttribute("aria-keyshortcuts") === "C")`
  const present = await devtools.evaluate<boolean>(`(${button}) !== undefined`)
  check("the CopyButton card has a button with hotkey c", present)
  if (!present) return
  await centreInView(devtools, `(${button})`)
  // A confirmation an earlier check left up has to clear first, or it would read as this one.
  await poll(
    () => devtools.evaluate<boolean>(`(${button}).nextElementSibling.textContent === ""`),
    3_000,
  )
  await devtools.evaluate<null>(`(document.activeElement?.blur(), null)`)
  await pressChord(devtools, plainKey("c"))
  const copied = await poll(
    () => devtools.evaluate<boolean>(`(${button}).nextElementSibling.textContent === "Copied"`),
    3_000,
  )
  const label = await devtools.evaluate<string>(`(${button}).textContent`)
  check(
    "pressing C copies through a CopyButton with hotkey c",
    copied,
    `region ${copied ? "said Copied" : "stayed silent"}, button text ${JSON.stringify(label)}`,
  )
}

/**
 * `PageAction hotkey="p"`: P presses "New task", which the card counts.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function pageActionHotkeyCheck(devtools: Devtools): Promise<void> {
  const action = `document.querySelector('[data-e2e="page-action-hotkey"]')`
  const presses = `Number(document.querySelector('[data-e2e="page-action-presses"]').textContent
    .match(/\\d+/)[0])`
  const present = await devtools.evaluate<boolean>(`${action} !== null`)
  check("the PageAction card has an action with hotkey p", present)
  if (!present) return
  await centreInView(devtools, action)
  await devtools.evaluate<null>(`(document.activeElement?.blur(), null)`)
  const before = await devtools.evaluate<number>(presses)
  const shortcuts = await devtools.evaluate<string | null>(
    `${action}.getAttribute("aria-keyshortcuts")`,
  )
  await pressChord(devtools, plainKey("p"))
  await poll(() => devtools.evaluate<boolean>(`${presses} > ${before}`), 3_000)
  const after = await devtools.evaluate<number>(presses)
  check(
    "pressing P presses a PageAction with hotkey p",
    shortcuts === "P" && after === before + 1,
    `aria-keyshortcuts=${JSON.stringify(shortcuts)}, presses ${before} → ${after}`,
  )
}

/** What one read of the `DropdownItem` card's hotkey menu sees. */
interface DropdownHotkeyState {
  /** The status line under the menu: what the keys chose. */
  status: string
  /** Whether the menu is open, by its trigger's `aria-expanded`. */
  open: boolean
  /** Whether focus is on the page itself rather than on any element. */
  focusOnBody: boolean
  /** `aria-keyshortcuts` of the three items, in order. */
  shortcuts: (string | null)[]
}

/** Reads {@link DropdownHotkeyState} off the `DropdownItem` card in one round trip. */
const DROPDOWN_HOTKEY_STATE = `(() => {
  const card = document.querySelector("#demo-DropdownItem")
  return {
    status: card.querySelector('[data-e2e="dropdown-hotkey-status"]').textContent,
    open: card.querySelector('[data-e2e="dropdown-hotkey-trigger"]')
      .getAttribute("aria-expanded") === "true",
    focusOnBody: document.activeElement === document.body,
    shortcuts: ["item", "link", "disabled"].map((name) =>
      card.querySelector(\`[data-e2e="dropdown-hotkey-\${name}"]\`).getAttribute("aria-keyshortcuts")
    ),
  }
})()`

/** Shift and one letter, as a US keyboard types it. */
function shiftLetter(letter: string): Chord {
  const upper = letter.toUpperCase()
  return {
    key: upper,
    code: `Key${upper}`,
    keyCode: upper.charCodeAt(0),
    text: upper,
    modifiers: 8,
  }
}

/**
 * `DropdownItem`'s `hotkey` (#610), on the card's menu of three items. Each item announces its key
 * in `aria-keyshortcuts`, and the open menu shows each key in a hint at the item's right edge.
 * With the menu closed: Shift+E chooses its item once, and the menu stays closed with focus where
 * it was; Shift+R hands the routed link's address to `navigate` and the link's click is cancelled,
 * so the page does not load it; Shift+D chooses nothing, because its item is disabled, and leaves
 * the press uncancelled.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function dropdownItemHotkeyChecks(devtools: Devtools): Promise<void> {
  const trigger =
    `document.querySelector('#demo-DropdownItem [data-e2e="dropdown-hotkey-trigger"]')`
  const present = await devtools.evaluate<boolean>(`${trigger} !== null`)
  check("the DropdownItem card's hotkey menu is on the page", present)
  if (!present) return
  await centreInView(devtools, trigger)
  const read = () => devtools.evaluate<DropdownHotkeyState>(DROPDOWN_HOTKEY_STATE)
  const settle = () => new Promise((done) => setTimeout(done, 200))
  const blur = () => devtools.evaluate<null>(`(document.activeElement?.blur(), null)`)

  const start = await read()
  check(
    "each DropdownItem with a hotkey announces it in aria-keyshortcuts",
    start.shortcuts.join() === "Shift+E,Shift+R,Shift+D",
    `aria-keyshortcuts ${JSON.stringify(start.shortcuts)}`,
  )

  // The hints are measured in the open menu: a closed one renders none of its items.
  await devtools.evaluate<null>(`(${trigger}.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${DROPDOWN_HOTKEY_STATE}.open`), 3_000)
  const hints = await devtools.evaluate<
    { name: string; hint: string; gapToEdge: number; afterText: boolean; hidden: boolean }[]
  >(`["item", "link", "disabled"].map((name) => {
    const item = document.querySelector(\`#demo-DropdownItem [data-e2e="dropdown-hotkey-\${name}"]\`)
    const hint = item.querySelector("[data-hotkey-hint]")
    const box = item.getBoundingClientRect()
    const hintBox = hint?.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(item.firstChild)
    const textRight = range.getBoundingClientRect().right
    return {
      name,
      hint: hint?.textContent ?? "",
      gapToEdge: hintBox ? box.right - parseFloat(getComputedStyle(item).paddingRight) -
        hintBox.right : NaN,
      afterText: hintBox !== undefined && hintBox.width > 0 && hintBox.left > textRight,
      hidden: hint?.getAttribute("aria-hidden") === "true",
    }
  })`)
  await devtools.evaluate<null>(`(${trigger}.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`!${DROPDOWN_HOTKEY_STATE}.open`), 3_000)
  check(
    "an open menu shows each DropdownItem's hotkey in a hint at the item's right edge, hidden " +
      "from screen readers",
    hints.map((hint) => hint.hint).join() === "Shift+E,Shift+R,Shift+D" &&
      hints.every((hint) => Math.abs(hint.gapToEdge) < 1 && hint.afterText && hint.hidden),
    hints.map((hint) =>
      `${hint.name}: "${hint.hint}", ${hint.gapToEdge}px short of the edge, after the text ` +
      `${hint.afterText}, aria-hidden ${hint.hidden}`
    ).join("; "),
  )

  await blur()
  const closed = await read()
  await pressChord(devtools, shiftLetter("e"))
  await poll(
    () => devtools.evaluate<boolean>(`${DROPDOWN_HOTKEY_STATE}.status.includes("chosen 1,")`),
    3_000,
  )
  await settle()
  const chosen = await read()
  check(
    "Shift+E chooses its DropdownItem once with the menu closed, which stays closed with focus " +
      "where it was",
    !closed.open && chosen.status.startsWith("chosen 1,") && !chosen.open && chosen.focusOnBody,
    `before: open ${closed.open}, "${closed.status}"; after: "${chosen.status}", open ` +
      `${chosen.open}, focus on the page ${chosen.focusOnBody}`,
  )

  // The link's click is read from a document listener, which then cancels it anyway, so the check
  // never lets the page really navigate.
  await devtools.evaluate<null>(`(window.__dropdownLinkClick = "no click",
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.('[data-e2e="dropdown-hotkey-link"]')) return
      window.__dropdownLinkClick = event.defaultPrevented
      event.preventDefault()
    }, { once: true }), null)`)
  const hashBefore = await devtools.evaluate<string>(`location.hash`)
  await pressChord(devtools, shiftLetter("r"))
  await poll(
    () => devtools.evaluate<boolean>(`${DROPDOWN_HOTKEY_STATE}.status.includes("#/system")`),
    3_000,
  )
  await settle()
  const routed = await read()
  const linkClick = await devtools.evaluate<boolean | string>(`window.__dropdownLinkClick`)
  const hashAfter = await devtools.evaluate<string>(`location.hash`)
  check(
    "Shift+R follows a closed menu's link DropdownItem through its navigate port, not a page load",
    routed.status.endsWith("routed to #/system") && linkClick === true &&
      hashAfter === hashBefore && !routed.open,
    `"${routed.status}"; click cancelled by the item ${linkClick}; hash ${hashBefore} → ` +
      `${hashAfter}; open ${routed.open}`,
  )

  await blur()
  await devtools.evaluate<null>(RECORD_PREVENTED)
  await pressChord(devtools, shiftLetter("d"))
  await settle()
  const disabled = await read()
  const prevented = await devtools.evaluate<boolean | string>(`window.__hotkeyPrevented`)
  check(
    "Shift+D does not choose a disabled DropdownItem, and leaves the key press to the page",
    disabled.status.includes("disabled chosen 0") && prevented === false && !disabled.open,
    `"${disabled.status}"; press cancelled ${prevented}; open ${disabled.open}`,
  )
}

/**
 * The `CommandPalette` trigger's hotkeys come from a button's `hotkey` machinery (#610): the card's
 * local palette (`hotkeys={["mod+p"]}`) announces Control+P, or Meta+P on an Apple platform, in
 * `aria-keyshortcuts` and shows the same key in a hint screen readers skip; the guide's own search
 * announces all three of its keys; the remote palette, whose hotkeys are off, announces and shows
 * nothing.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function commandPaletteHotkeyAnnouncementCheck(devtools: Devtools): Promise<void> {
  const read = await devtools.evaluate<
    {
      apple: boolean
      local: string | null
      hint: string
      hintWidth: number
      hintHidden: boolean
      guide: string | null
      remote: string | null
      remoteHint: boolean
    } | null
  >(`(() => {
    const local = document.querySelector('[data-e2e="palette-local-open"]')
    const remote = document.querySelector('[data-e2e="palette-remote-open"]')
    const guide = document.querySelector('[data-e2e="ui-guide-search-open"]')
    if (!local || !remote || !guide) return null
    const hint = local.querySelector("[data-hotkey-hint]")
    return {
      apple: /mac|iphone|ipad|ipod/i.test(navigator.userAgentData?.platform || navigator.platform || ""),
      local: local.getAttribute("aria-keyshortcuts"),
      hint: hint?.textContent ?? "",
      hintWidth: hint?.getBoundingClientRect().width ?? 0,
      hintHidden: hint?.getAttribute("aria-hidden") === "true",
      guide: guide.getAttribute("aria-keyshortcuts"),
      remote: remote.getAttribute("aria-keyshortcuts"),
      remoteHint: remote.querySelector("[data-hotkey-hint], kbd") !== null,
    }
  })()`)
  if (read === null) {
    check("the CommandPalette card and the guide's search are on the page", false)
    return
  }
  const mod = read.apple ? "Meta" : "Control"
  const face = read.apple ? "⌘P" : "Ctrl+P"
  check(
    "the CommandPalette trigger announces its hotkeys in aria-keyshortcuts and shows the first in " +
      "a hotkey hint, and a palette with none announces and shows nothing",
    read.local === `${mod}+P` && read.hint === face && read.hintWidth > 0 && read.hintHidden &&
      read.guide === "/ Control+K Meta+K" && read.remote === null && !read.remoteHint,
    `local ${JSON.stringify(read.local)}, hint "${read.hint}" ${read.hintWidth}px wide, ` +
      `aria-hidden ${read.hintHidden}; guide search ${JSON.stringify(read.guide)}; remote ` +
      `${JSON.stringify(read.remote)}, hint ${read.remoteHint}`,
  )
}
