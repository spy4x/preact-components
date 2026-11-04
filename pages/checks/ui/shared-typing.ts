import { type Devtools, poll } from "../harness.ts"

/**
 * Press and release `key` as Safari sends the key press that ends an input method's composition:
 * a real key press with keyCode 229 and `isComposing` false.
 *
 * @param devtools The connected session.
 * @param key `"Enter"` or `"Escape"`.
 */
export async function pressImeKey(devtools: Devtools, key: "Enter" | "Escape"): Promise<void> {
  for (const type of ["rawKeyDown", "keyUp"]) {
    await devtools.send("Input.dispatchKeyEvent", {
      type,
      key,
      code: key,
      windowsVirtualKeyCode: 229,
      nativeVirtualKeyCode: 229,
    })
  }
}

/**
 * Start recording every keydown the page sees, as `"<key> <keyCode> <isComposing>"`, into
 * `globalThis.__verifyImeKeys`, so a press that arrived as something else reports itself instead
 * of passing as ignored. Read and stop it with {@link TAKE_IME_KEYS}.
 */
export const RECORD_IME_KEYS = `(() => {
  globalThis.__verifyImeKeys = []
  globalThis.__verifyImeListener = (event) => {
    globalThis.__verifyImeKeys.push(event.key + " " + event.keyCode + " " + event.isComposing)
  }
  document.addEventListener("keydown", globalThis.__verifyImeListener, { capture: true })
  return null
})()`

/** What {@link RECORD_IME_KEYS} recorded, joined by commas; the recording stops. */
export const TAKE_IME_KEYS = `(() => {
  document.removeEventListener("keydown", globalThis.__verifyImeListener, { capture: true })
  const keys = (globalThis.__verifyImeKeys ?? []).join(", ")
  delete globalThis.__verifyImeKeys
  delete globalThis.__verifyImeListener
  return keys
})()`

/**
 * Type text into whatever the page has focused, through the browser's own input pipeline.
 *
 * `Input.insertText` rather than a key press, and the difference is worth stating plainly. The
 * shared key table in `harness.ts` describes no character keys and this file may not add one; what
 * the component reads its query from is the `input` event and never a `keydown`; and an insertion
 * the browser delivers is a trusted event, unlike one synthesised inside the page. So this drives
 * the same path a typed character drives. Every caller reads the query back afterwards and reports
 * a query that never arrived as exactly that.
 *
 * @param devtools The connected session.
 * @param text The text to insert at the caret.
 */
export async function typeInto(devtools: Devtools, text: string): Promise<void> {
  await devtools.send("Input.insertText", { text })
}

/**
 * Press a key the shared table in `harness.ts` does not describe, through the browser's own input
 * pipeline: the comma that adds a tag, and Backspace.
 *
 * @param devtools The connected session; the key goes to whatever the page has focused.
 * @param key Which of the two.
 */
export async function pressTagKey(devtools: Devtools, key: "Comma" | "Backspace"): Promise<void> {
  const press = key === "Comma"
    ? { key: ",", code: "Comma", windowsVirtualKeyCode: 188, nativeVirtualKeyCode: 188, text: "," }
    : { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 }
  await devtools.send("Input.dispatchKeyEvent", { type: "keyDown", ...press })
  const { text: _text, ...up } = press as typeof press & { text?: string }
  await devtools.send("Input.dispatchKeyEvent", { type: "keyUp", ...up })
}

/** What {@link composeThenCommit} saw of one field and the list it filters. */
interface Composition {
  /** The list before the composition began. */
  before: string[]
  /** The field's text after each composition step, so a step that never reached it shows itself. */
  fields: string[]
  /** The list after each composition step. */
  steps: string[][]
  /** Mutation records on the list from the composition's start until just before its commit. */
  mutations: number
  /** The composition and `input` events the field got, in order; `input` with `isComposing`. */
  events: string
  /** The list once the commit has been answered. */
  after: string[]
}

/**
 * Compose `steps` in `field` the way an input method builds a word, then commit the last one.
 *
 * Each step is an `Input.imeSetComposition`, the browser's own path for composition text: the
 * field gets `compositionstart`, then an `input` event with `isComposing` true for every step. The
 * commit is an `Input.insertText` of the finished word, which ends the composition. A short fixed
 * wait after each step proves an absence — a list that re-filtered on the step re-renders at once,
 * so 150 ms is time for a wrong one to show — and a mutation observer on the list catches a change
 * that came and went between reads. After the commit, the list is polled until it changes.
 *
 * @param devtools The connected session; `field` must already have focus.
 * @param field Page expression for the text field.
 * @param list Page expression for the element holding the options.
 * @param options Page expression for the options' texts, in list order.
 * @param steps The composition text at each step; the last is what the commit inserts.
 */
export async function composeThenCommit(
  devtools: Devtools,
  field: string,
  list: string,
  options: string,
  steps: readonly string[],
): Promise<Composition> {
  const read = () => devtools.evaluate<string[]>(options)
  await devtools.evaluate<null>(`(() => {
    const field = ${field}
    const list = ${list}
    const record = globalThis.__verifyComposition = { events: [], mutations: 0 }
    record.field = field
    record.listener = (event) => {
      record.events.push(event.type === "input" ? "input " + event.isComposing : event.type)
    }
    for (const type of ["compositionstart", "input", "compositionend"]) {
      field?.addEventListener(type, record.listener)
    }
    record.observer = new MutationObserver((records) => {
      record.mutations += records.length
    })
    if (list) {
      record.observer.observe(list, {
        subtree: true, childList: true, characterData: true, attributes: true,
      })
    }
    return null
  })()`)
  const before = await read()
  const fields: string[] = []
  const seen: string[][] = []
  for (const text of steps) {
    await devtools.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    })
    await new Promise((done) => setTimeout(done, 150))
    fields.push(await devtools.evaluate<string>(`(${field})?.value ?? "missing"`))
    seen.push(await read())
  }
  const mutations = await devtools.evaluate<number>(
    `(() => {
      const record = globalThis.__verifyComposition
      record.observer.disconnect()
      return record.mutations
    })()`,
  )
  await devtools.send("Input.insertText", { text: steps.at(-1) ?? "" })
  await poll(async () => (await read()).join("|") !== before.join("|"), 3_000)
  const after = await read()
  const events = await devtools.evaluate<string>(`(() => {
    const record = globalThis.__verifyComposition
    for (const type of ["compositionstart", "input", "compositionend"]) {
      record.field?.removeEventListener(type, record.listener)
    }
    delete globalThis.__verifyComposition
    return record.events.join(", ")
  })()`)
  return { before, fields, steps: seen, mutations, events, after }
}

/**
 * Whether `composition` held its list still through every step and filtered it on the commit.
 *
 * @param composition What {@link composeThenCommit} saw.
 * @param steps The steps it was given.
 * @param expected The list the committed word must leave.
 */
export function heldThenFiltered(
  composition: Composition,
  steps: readonly string[],
  expected: readonly string[],
): boolean {
  const before = composition.before.join("|")
  return composition.before.length > expected.length &&
    composition.fields.join("|") === steps.join("|") &&
    composition.steps.every((list) => list.join("|") === before) &&
    composition.mutations === 0 &&
    composition.events.startsWith("compositionstart, input true") &&
    composition.events.includes("compositionend") &&
    composition.after.join("|") === expected.join("|")
}

/** The detail line for a {@link heldThenFiltered} check. */
export function compositionDetail(composition: Composition): string {
  return `before [${composition.before.join(", ")}]; field ${
    composition.fields.map((text) => `"${text}"`).join(" → ")
  }, list ${
    composition.steps.map((list) => `[${list.join(", ")}]`).join(" → ")
  }; ${composition.mutations} list mutations while composing; events ${composition.events}; ` +
    `after the commit [${composition.after.join(", ")}]`
}

/**
 * Type `text` one character per `Input.insertText`, reading the list after each once it changes.
 *
 * One character per call because `Input.insertText` delivers its whole string as one `input`
 * event, and the point is what each keystroke does.
 *
 * @param devtools The connected session; the field must already have focus.
 * @param options Page expression for the options' texts, in list order.
 * @param text The characters to type.
 */
export async function typeEachCharacter(
  devtools: Devtools,
  options: string,
  text: string,
): Promise<string[][]> {
  const read = () => devtools.evaluate<string[]>(options)
  const lists: string[][] = []
  let previous = (await read()).join("|")
  for (const character of text) {
    await devtools.send("Input.insertText", { text: character })
    await poll(async () => (await read()).join("|") !== previous, 2_000)
    const list = await read()
    lists.push(list)
    previous = list.join("|")
  }
  return lists
}

/**
 * Whether each keystroke narrowed the list: every list shorter than the one before, none empty.
 *
 * @param before The list before the first keystroke.
 * @param lists The list after each keystroke.
 */
export function narrowedEachTime(before: readonly string[], lists: readonly string[][]): boolean {
  let length = before.length
  for (const list of lists) {
    if (list.length === 0 || list.length >= length) return false
    length = list.length
  }
  return lists.length > 0
}

/** The detail line for a {@link narrowedEachTime} check. */
export function typingDetail(
  text: string,
  before: readonly string[],
  lists: readonly string[][],
): string {
  return `before [${before.join(", ")}]; ` +
    [...text].map((character, index) => `"${character}" → [${(lists[index] ?? []).join(", ")}]`)
      .join("; ")
}
