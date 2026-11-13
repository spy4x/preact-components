import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type } from "arktype"
import { createTranslator, type Translator } from "@spy4x/platform/universal/i18n"
import { buildModelStore } from "./build-model-store.ts"
import signalsDe from "./i18n/de.ts"
import signalsEn from "./i18n/en.ts"
import { createToastStore } from "./toast.ts"
import { RemoteEvent, type ToastMessage } from "./types.ts"

/** An app's own catalog: one full message per model and event. */
const appEn = {
  "note.created": "Note created",
  "note.malformedUpdate": "A note update could not be read: {issue}",
}
const appDe = {
  "note.created": "Notiz angelegt",
  "note.malformedUpdate": "Eine Notiz-Änderung war nicht lesbar: {issue}",
}

const GERMAN = createTranslator({
  language: "de",
  catalogs: [{ source: signalsEn, translation: signalsDe }, { source: appEn, translation: appDe }],
})

const rowSchema = type({ id: "number", name: "string", deletedAt: "null" })

function noteStore(messages: ToastMessage[], translator?: Translator<string>) {
  const record = (message: ToastMessage) => messages.push(message)
  const created = { id: 1, name: "A", deletedAt: null }
  return buildModelStore({
    model: "note",
    endpoint: "/api/notes",
    schemas: {
      full: rowSchema,
      create: type({ name: "string" }),
      update: type({ name: "string" }),
    },
    fetch: (() => Promise.resolve(Response.json(created, { status: 201 }))) as typeof fetch,
    toast: { success: record, error: record },
    translator,
  })
}

describe("the signals words under a translator", () => {
  it("title a toast from the catalog, unless the app names the title", () => {
    const german = createToastStore({ translator: GERMAN, titles: { warning: "Achtung" } })
    german.error({ body: "x" })
    german.warning({ body: "x" })
    const english = createToastStore()
    english.error({ body: "x" })
    expect(german.list.value.map((entry) => entry.title)).toEqual(["Fehler", "Achtung"])
    expect(english.list.value[0].title).toBe("Error")
  })

  it("title each toast in the language in use when it is shown", () => {
    let current: Translator<string> | undefined = undefined
    const store = createToastStore({ translator: () => current })
    store.error({ body: "x" })
    current = GERMAN
    store.error({ body: "x" })
    expect(store.list.value.map((entry) => entry.title)).toEqual(["Error", "Fehler"])
  })

  it("send the app's full message for the model and event", async () => {
    const messages: ToastMessage[] = []
    const store = noteStore(messages, GERMAN)
    await store.create({ name: "A" })
    expect(messages[0].body).toBe("Notiz angelegt")
  })

  it("fill a malformed update's issue into the app's message", async () => {
    const messages: ToastMessage[] = []
    const store = noteStore(messages, GERMAN)
    await store.onWs([{ id: "one", name: "A", deletedAt: null }], RemoteEvent.CREATED)
    expect(messages[0].body).toMatch(/^Eine Notiz-Änderung war nicht lesbar: id must be a number/)
  })

  it("keep every English default without a translator", async () => {
    const messages: ToastMessage[] = []
    const store = noteStore(messages)
    await store.create({ name: "A" })
    expect(messages[0].body).toBe("note was created")
  })
})
