import { centreInView, check, type Devtools, pointerToCorner, poll, pressKey } from "../harness.ts"
import { aimAt, clickAt } from "./shared.ts"
import {
  composeThenCommit,
  compositionDetail,
  heldThenFiltered,
  narrowedEachTime,
  pressTagKey,
  typeEachCharacter,
  typeInto,
  typingDetail,
} from "./shared-typing.ts"

/**
 * Reads the `TagInput` card's tag field in one round trip, or `null` when the card lost it.
 *
 * The chips are read from the list named "Tags", the suggestions from the listbox the input's
 * `aria-controls` names, and the highlighted row from its `aria-activedescendant`, so every value
 * here is what assistive technology is pointed at rather than what a class name suggests.
 */
const TAG_INPUT_STATE = `(() => {
  const card = document.querySelector("#demo-TagInput")
  const input = card?.querySelector("#guide-tag-input") ?? null
  if (input === null) return null
  const root = input.closest("div.relative")
  const listbox = document.getElementById(input.getAttribute("aria-controls") ?? "")
  const activeId = input.getAttribute("aria-activedescendant")
  const active = activeId === null ? null : document.getElementById(activeId)
  return {
    chips: [...root.querySelectorAll('ul[aria-label="Tags"] > li')].map((li) => li.textContent.trim()),
    removeNames: [...root.querySelectorAll('ul[aria-label="Tags"] button')]
      .map((button) => button.getAttribute("aria-label")),
    value: input.value,
    expanded: input.getAttribute("aria-expanded"),
    options: listbox === null || listbox.hidden
      ? []
      : [...listbox.querySelectorAll('[role="option"]')].map((option) => option.textContent.trim()),
    active: active?.textContent.trim() ?? null,
    activeSelected: active?.getAttribute("aria-selected") ?? null,
    focused: document.activeElement === input,
    status: (root.querySelector('[role="status"]')?.textContent ?? "").trim(),
    statusRaw: root.querySelector('[role="status"]')?.textContent ?? "",
    optionHeight: listbox === null || listbox.hidden
      ? 0
      : Math.min(...[...listbox.querySelectorAll('[role="option"]')]
        .map((option) => Math.round(option.getBoundingClientRect().height))),
    echo: card.querySelector('[data-e2e="controlled-value"]')?.textContent.trim() ?? "",
  }
})()`

/** A {@link TAG_INPUT_STATE} read. */
interface TagInputState {
  chips: string[]
  removeNames: string[]
  value: string
  expanded: string | null
  /** The suggestions on screen; empty while the listbox is hidden. */
  options: string[]
  active: string | null
  activeSelected: string | null
  focused: boolean
  status: string
  /** The live region's text untrimmed: a repeat announcement differs from the last one only here. */
  statusRaw: string
  /** The shortest suggestion row's height in px; 0 while the listbox is hidden. */
  optionHeight: number
  echo: string
}

/** The tag field of the card, as a page expression. */
const TAG_INPUT = `document.querySelector("#demo-TagInput #guide-tag-input")`

/**
 * `TagInput`, driven with real clicks and key presses on its card: Enter and a comma add the typed
 * word, a word already there in another case is refused and announced again when typed again,
 * Escape with no suggestion showing keeps the typed text, the arrow keys walk the 44 px suggestion
 * rows with the chosen tags left out and Enter picks one, a chip's named remove button takes it away and
 * gives focus back to the text field, Backspace in the empty field removes the last chip, and at a
 * 375 px wide viewport the chips wrap inside the field with every target 44 px.
 *
 * None of this reaches a string render: the key handler, the focus moved after a removal and the
 * wrapping are all the browser's. The card starts with the one tag `work` and is put back to it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function tagInputChecks(devtools: Devtools): Promise<void> {
  const read = async () =>
    await devtools.evaluate<TagInputState | null>(TAG_INPUT_STATE) ??
      ({
        chips: [],
        removeNames: [],
        value: "missing",
        expanded: null,
        options: [],
        active: null,
        activeSelected: null,
        focused: false,
        status: "",
        statusRaw: "",
        optionHeight: 0,
        echo: "",
      } satisfies TagInputState)
  const chipsAre = (expected: string[]) => async () =>
    (await read()).chips.join("|") === expected.join("|")

  await centreInView(devtools, TAG_INPUT)
  await pointerToCorner(devtools)
  const landing = await clickAt(devtools, await aimAt(devtools, TAG_INPUT), TAG_INPUT)
  await poll(async () => (await read()).focused, 2_000)
  const start = await read()

  await typeInto(devtools, "Urgent")
  await pressKey(devtools, "Enter")
  await poll(chipsAre(["work", "Urgent"]), 2_000)
  const entered = await read()
  check(
    "typing a word and pressing Enter adds it to TagInput as a chip and empties the field",
    landing?.onTarget === true && start.chips.join("|") === "work" &&
      entered.chips.join("|") === "work|Urgent" && entered.value === "" && entered.focused &&
      entered.echo === "tags: work, Urgent" && entered.status === "Added tag Urgent",
    `click ${landing?.onTarget ? "landed" : `missed (${landing?.tag ?? "nothing"})`}; chips ` +
      `${start.chips.join(", ")} → ${entered.chips.join(", ")}; field "${entered.value}", ` +
      `"${entered.echo}", said "${entered.status}"`,
  )

  await typeInto(devtools, "phone")
  await pressTagKey(devtools, "Comma")
  await poll(chipsAre(["work", "Urgent", "phone"]), 2_000)
  const comma = await read()
  await typeInto(devtools, "WORK")
  await pressTagKey(devtools, "Comma")
  await poll(async () => (await read()).value === "", 2_000)
  const duplicate = await read()
  check(
    "a comma adds the typed word, and TagInput refuses a tag it holds in another case",
    comma.chips.join("|") === "work|Urgent|phone" && comma.value === "" &&
      duplicate.chips.join("|") === "work|Urgent|phone" && duplicate.value === "" &&
      duplicate.status === "WORK is already added",
    `after "phone," ${comma.chips.join(", ")} with field "${comma.value}"; after "WORK," ` +
      `${duplicate.chips.join(", ")} with field "${duplicate.value}", said "${duplicate.status}"`,
  )

  await typeInto(devtools, "WORK")
  await pressTagKey(devtools, "Comma")
  await poll(async () => (await read()).statusRaw !== duplicate.statusRaw, 2_000)
  const again = await read()
  check(
    "TagInput announces a duplicate typed a second time in a row, by changing its live region again",
    again.statusRaw !== duplicate.statusRaw && again.status === "WORK is already added" &&
      again.chips.join("|") === "work|Urgent|phone" && again.value === "",
    `region ${JSON.stringify(duplicate.statusRaw)} → ${JSON.stringify(again.statusRaw)}; chips ` +
      `${again.chips.join(", ")} with field "${again.value}"`,
  )

  await typeInto(devtools, "newtag")
  await poll(async () => (await read()).value === "newtag", 2_000)
  const unmatched = await read()
  await pressKey(devtools, "Escape")
  // Given time to go wrong: a field that drops the text on Escape empties within a frame or two.
  await poll(async () => (await read()).value !== "newtag", 300)
  const escaped = await read()
  check(
    "Escape in TagInput with no suggestion showing leaves the typed text in the field",
    unmatched.expanded === "false" && unmatched.options.length === 0 &&
      escaped.value === "newtag" && escaped.chips.join("|") === "work|Urgent|phone",
    `typed "${unmatched.value}" with expanded ${unmatched.expanded} and ` +
      `${unmatched.options.length} suggestions; after Escape the field holds "${escaped.value}"`,
  )
  // Clear the six letters, one Backspace each; a seventh would take a chip.
  for (let letter = 0; letter < "newtag".length; letter++) await pressTagKey(devtools, "Backspace")
  await poll(async () => (await read()).value === "", 2_000)

  await pressKey(devtools, "ArrowDown")
  await poll(async () => (await read()).active !== null, 2_000)
  const first = await read()
  await pressKey(devtools, "ArrowDown")
  await poll(async () => (await read()).active !== first.active, 2_000)
  const second = await read()
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).chips.length === 4, 2_000)
  const picked = await read()
  check(
    "ArrowDown walks TagInput's suggestions without the chosen tags, and Enter picks one",
    first.expanded === "true" &&
      !first.options.some((option) => ["work", "phone"].includes(option)) &&
      first.active === first.options[0] && first.activeSelected === "true" &&
      second.active === first.options[1] && picked.chips.at(-1) === first.options[1] &&
      picked.expanded === "false" && picked.focused,
    `suggestions ${first.options.join(", ")}; active ${first.active} (selected ` +
      `${first.activeSelected}) → ${second.active}; chips after Enter ${
        picked.chips.join(", ")
      }, ` +
      `expanded ${picked.expanded}`,
  )
  check(
    "every TagInput suggestion row is a 44 px target",
    first.optionHeight >= 44,
    `shortest row ${first.optionHeight} px over ${first.options.length} suggestions`,
  )

  const remove = `[...document.querySelectorAll('#demo-TagInput ul[aria-label="Tags"] button')]
    .find((button) => button.getAttribute("aria-label") === "Remove tag Urgent")`
  await devtools.evaluate<null>(`(${remove}?.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(async () => !(await read()).chips.includes("Urgent"), 2_000)
  const removed = await read()
  check(
    "each TagInput chip's remove button is named after it, and a press returns focus to the field",
    picked.removeNames.join("|") === picked.chips.map((chip) => `Remove tag ${chip}`).join("|") &&
      !removed.chips.includes("Urgent") && removed.chips.length === 3 && removed.focused &&
      removed.status === "Removed tag Urgent" && removed.expanded === "false",
    `names ${picked.removeNames.join(", ")}; chips ${removed.chips.join(", ")}, focus ` +
      `${removed.focused ? "on the field" : "elsewhere"}, said "${removed.status}"`,
  )

  await pressTagKey(devtools, "Backspace")
  await poll(async () => (await read()).chips.length === 2, 2_000)
  const backspaced = await read()
  check(
    "Backspace in TagInput's empty field removes the last chip",
    backspaced.chips.join("|") === removed.chips.slice(0, -1).join("|") && backspaced.focused,
    `${removed.chips.join(", ")} → ${backspaced.chips.join(", ")}`,
  )

  await typeInto(devtools, "groceries, appointments, reading-list, someday-maybe, waiting-for,")
  await poll(async () => (await read()).chips.length === 7, 2_000)
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: false,
  })
  let fit: TagInputFit | null = null
  try {
    await new Promise((done) => setTimeout(done, 200))
    fit = await devtools.evaluate<TagInputFit | null>(TAG_INPUT_FIT)
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
  check(
    "at 375 px TagInput's chips wrap inside the field, and every remove button and the field are 44 px",
    fit !== null && fit.chips === 7 && fit.rows > 1 && fit.inside && fit.pageWidth <= 375 &&
      fit.smallestButton >= 44 && fit.inputHeight >= 44,
    fit === null
      ? "the card lost its tag field"
      : `${fit.chips} chips on ${fit.rows} rows, ${fit.inside ? "inside" : "outside"} the field; ` +
        `page ${fit.pageWidth} px wide; smallest button ${fit.smallestButton} px, field ` +
        `${fit.inputHeight} px`,
  )

  // Back to the card's starting value, one Backspace per extra chip.
  await devtools.evaluate<null>(`(${TAG_INPUT}.focus(), null)`)
  for (let extra = (await read()).chips.length - 1; extra > 0; extra--) {
    await pressTagKey(devtools, "Backspace")
  }
  await poll(chipsAre(["work"]), 2_000)
  await pressKey(devtools, "Escape")
}

/** How the card's tag field lays out, read by {@link TAG_INPUT_FIT}. */
interface TagInputFit {
  chips: number
  /** How many distinct rows the chips sit on. */
  rows: number
  /** Every chip lies inside the field's box. */
  inside: boolean
  /** The page's scroll width: wider than the viewport means a sideways scroll. */
  pageWidth: number
  /** The smaller side of the smallest remove button, rounded. */
  smallestButton: number
  inputHeight: number
}

/** Measures {@link TagInputFit} off the card's tag field, or `null` when the card lost it. */
const TAG_INPUT_FIT = `(() => {
  const input = document.querySelector("#demo-TagInput #guide-tag-input")
  if (input === null) return null
  const field = input.parentElement.getBoundingClientRect()
  const chips = [...input.parentElement.querySelectorAll('ul[aria-label="Tags"] > li')]
    .map((chip) => chip.getBoundingClientRect())
  const buttons = [...input.parentElement.querySelectorAll('ul[aria-label="Tags"] button')]
    .map((button) => button.getBoundingClientRect())
  return {
    chips: chips.length,
    rows: new Set(chips.map((box) => Math.round(box.top))).size,
    inside: chips.every((box) => box.left >= field.left - 0.5 && box.right <= field.right + 0.5),
    pageWidth: document.documentElement.scrollWidth,
    smallestButton: Math.round(Math.min(...buttons.map((box) => Math.min(box.width, box.height)))),
    inputHeight: Math.round(input.getBoundingClientRect().height),
  }
})()`

/** The `TagInput` card's suggestion texts, in list order; `[]` while its list is hidden. */
const TAG_INPUT_OPTIONS = `(${TAG_INPUT_STATE})?.options ?? []`

/**
 * An input method's steps leave the TagInput suggestions as they were, the finished word filters
 * them once, and plain typing still filters on every keystroke (#643).
 *
 * The card holds the tag `work`; a click opens its other five suggestions. The composition builds
 * "h" then "ho", either of which would leave only home and phone. The field is emptied with
 * Backspace, which removes no chip while it holds text, and "e" and "r" are then typed as two
 * keystrokes: four suggestions, then errand alone. Escape drops the text, and the card is left with
 * its one tag.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function compositionTagInputCheck(devtools: Devtools): Promise<void> {
  const read = () => devtools.evaluate<TagInputState | null>(TAG_INPUT_STATE)
  await centreInView(devtools, TAG_INPUT)
  await pointerToCorner(devtools)
  const landing = await clickAt(devtools, await aimAt(devtools, TAG_INPUT), TAG_INPUT)
  await poll(async () => (await read())?.expanded === "true", 2_000)
  const steps = ["h", "ho"]
  const composed = await composeThenCommit(
    devtools,
    TAG_INPUT,
    `document.getElementById(${TAG_INPUT}?.getAttribute("aria-controls") ?? "")`,
    TAG_INPUT_OPTIONS,
    steps,
  )
  check(
    "an input method's steps leave the TagInput suggestions unchanged, and the finished word filters them",
    landing?.onTarget === true && heldThenFiltered(composed, steps, ["home", "phone"]),
    `the click ${landing?.onTarget === true ? "landed" : "missed"}; ${compositionDetail(composed)}`,
  )

  await pressTagKey(devtools, "Backspace")
  await pressTagKey(devtools, "Backspace")
  await poll(async () => (await read())?.value === "", 2_000)
  const cleared = await devtools.evaluate<string[]>(TAG_INPUT_OPTIONS)
  const typed = await typeEachCharacter(devtools, TAG_INPUT_OPTIONS, "er")
  const chips = (await read())?.chips.join("|") ?? "missing"
  check(
    "plain typing still filters the TagInput suggestions on every keystroke",
    chips === "work" && narrowedEachTime(cleared, typed),
    `chips ${chips}; ${typingDetail("er", cleared, typed)}`,
  )
  await pressKey(devtools, "Escape")
  await poll(async () => (await read())?.value === "", 2_000)

  // A comma inside a word the input method is still building ends no tag; the finished word does.
  for (const text of ["a", "a,b"]) {
    await devtools.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    })
  }
  // A fixed wait: it proves the steps add no chip, and an absence has no state to poll for.
  await new Promise((done) => setTimeout(done, 200))
  const composing = await read()
  await devtools.send("Input.insertText", { text: "a,b" })
  await poll(async () => (await read())?.chips.join("|") === "work|a", 2_000)
  const committed = await read()
  check(
    "a comma inside an input method's composition adds no TagInput chip until the word is finished",
    composing?.chips.join("|") === "work" && composing.value === "a,b" &&
      committed?.chips.join("|") === "work|a" && committed.value === "b",
    `while composing: chips ${composing?.chips.join(", ")}, field "${composing?.value}"; after ` +
      `the commit: chips ${committed?.chips.join(", ")}, field "${committed?.value}"`,
  )
  // Back to the card's one tag: the first Backspace empties the field, the second removes `a`.
  await pressTagKey(devtools, "Backspace")
  await poll(async () => (await read())?.value === "", 2_000)
  await pressTagKey(devtools, "Backspace")
  await poll(async () => (await read())?.chips.join("|") === "work", 2_000)
  await pressKey(devtools, "Escape")
}
