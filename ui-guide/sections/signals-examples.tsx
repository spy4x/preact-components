/**
 * Examples of `signals/`, which exports state helpers and renders nothing.
 *
 * Each card runs the real export when it renders; see `example.tsx`. Every outside world a helper
 * reads — storage, the media query, the clipboard, `fetch` — is handed in as a stand-in, so the card
 * prints the same thing on the server and in the browser. Where a helper answers through a promise,
 * the card prints what it did synchronously and a comment in its code says what the promise does.
 *
 * `useUrlFilters` has no card: a card calling it would read the parameters of whichever application
 * hosts the catalogue, and write that application's address as soon as a filter changed. Its pure
 * parts have cards here, and the hook itself is demonstrated by the demo app
 * (`pages/src/url-filters.tsx`) and driven by `pages/checks/signals.ts`.
 */

import { signal } from "@preact/signals"
import {
  buildModelStore,
  CLIPBOARD_UNAVAILABLE,
  createClipboard,
  createThemeStore,
  createToastStore,
  deleteMapEntry,
  parseSort,
  patchSignal,
  RemoteEvent,
  removeSortRule,
  resolveFilterValue,
  serializeSort,
  setMapEntry,
  shouldPersistFilter,
  sortRows,
  type SortRule,
  ThemeValue,
  toggleSort,
} from "@spy4x/preact-signals"
import {
  clearFilterFields,
  filterSearch,
  filterWrite,
  restoredAddress,
} from "@spy4x/preact-signals/use-url-filters"
import { type } from "arktype"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  toggleSort: {
    title: "Sort rules in the address",
    wide: false,
    summary:
      "Keeps a table's sort rules in a URL parameter: `parseSort` reads them, `toggleSort` moves one column through ascending, descending and off, and `serializeSort` writes them back.",
    snippet: `import { parseSort, serializeSort, toggleSort } from "@spy4x/preact-signals"

const rules = parseSort("name:asc", ["name", "size"], [])
const next = toggleSort(toggleSort(rules, "name"), "size")
serializeSort(next)`,
    covers: ["toggleSort", "parseSort", "serializeSort"],
    run: () => {
      const rules = parseSort("name:asc", ["name", "size"], [])
      const next = toggleSort(toggleSort(rules, "name"), "size")
      return serializeSort(next)
    },
  },
  sortRows: {
    title: "sortRows() and removeSortRule()",
    wide: false,
    summary:
      "`sortRows` orders rows by several rules at once without changing the input, and `removeSortRule` takes one column out of the rules.",
    snippet: `import { removeSortRule, type SortRule, sortRows } from "@spy4x/preact-signals"

const files = [
  { name: "notes.txt", size: 12 },
  { name: "photo.jpg", size: 2048 },
  { name: "draft.txt", size: null },
  { name: "archive.zip", size: 2048 },
]
const rules: SortRule<"name" | "size">[] = [
  { key: "size", direction: "desc" },
  { key: "name", direction: "asc" },
]
console.log({
  sorted: sortRows(files, rules).map((file) => file.name),
  withoutSize: removeSortRule(rules, "size"),
})`,
    covers: ["sortRows", "removeSortRule"],
    run: () => {
      const files = [
        { name: "notes.txt", size: 12 },
        { name: "photo.jpg", size: 2048 },
        { name: "draft.txt", size: null },
        { name: "archive.zip", size: 2048 },
      ]
      const rules: SortRule<"name" | "size">[] = [
        { key: "size", direction: "desc" },
        { key: "name", direction: "asc" },
      ]
      return {
        sorted: sortRows(files, rules).map((file) => file.name),
        withoutSize: removeSortRule(rules, "size"),
      }
    },
  },
  resolveFilterValue: {
    title: "One filter and its URL parameter",
    wide: true,
    summary:
      "Turns one filter's URL parameter into a value and back: `resolveFilterValue` reads it with the default as fallback, `shouldPersistFilter` says whether the value belongs in the address, and `filterWrite` says what to write.",
    snippet: `import { signal } from "@preact/signals"
import { resolveFilterValue, shouldPersistFilter } from "@spy4x/preact-signals"
import { filterWrite } from "@spy4x/preact-signals/use-url-filters"

const page = { signal: signal(1), urlParam: "page", initialValue: 1 }
console.log({
  read: [resolveFilterValue(page, "3"), resolveFilterValue(page, "abc"), resolveFilterValue(page, null)],
  persist: [shouldPersistFilter(page, 3), shouldPersistFilter(page, 1)],
  write: [filterWrite(page, 3), filterWrite(page, 1)],
})`,
    covers: ["resolveFilterValue", "shouldPersistFilter", "filterWrite"],
    run: () => {
      const page = { signal: signal(1), urlParam: "page", initialValue: 1 }
      return {
        read: [
          resolveFilterValue(page, "3"),
          resolveFilterValue(page, "abc"),
          resolveFilterValue(page, null),
        ],
        persist: [shouldPersistFilter(page, 3), shouldPersistFilter(page, 1)],
        write: [filterWrite(page, 3), filterWrite(page, 1)],
      }
    },
  },
  filterSearch: {
    title: "filterSearch() and restoredAddress()",
    wide: true,
    summary:
      "`filterSearch` writes the filters into a query string and keeps every parameter they do not own, and `restoredAddress` puts back a fragment the router dropped.",
    snippet: `import { filterSearch, restoredAddress } from "@spy4x/preact-signals/use-url-filters"

const search = filterSearch("?tab=files&page=3", [
  { urlParam: "page" },
  { urlParam: "status", value: "open" },
])
const after = { pathname: "/list", search: \`?\${search}\`, hash: "" }
console.log({
  search,
  lostFragment: restoredAddress("#results", { ...after, href: \`https://example.com/list?\${search}\` }),
  nothingLost: restoredAddress("", { ...after, href: \`https://example.com/list?\${search}\` }),
})`,
    covers: ["filterSearch", "restoredAddress"],
    run: () => {
      const search = filterSearch("?tab=files&page=3", [
        { urlParam: "page" },
        { urlParam: "status", value: "open" },
      ])
      const after = { pathname: "/list", search: `?${search}`, hash: "" }
      return {
        search,
        lostFragment: restoredAddress("#results", {
          ...after,
          href: `https://example.com/list?${search}`,
        }),
        nothingLost: restoredAddress("", { ...after, href: `https://example.com/list?${search}` }),
      }
    },
  },
  clearFilterFields: {
    title: "clearFilterFields()",
    wide: false,
    summary:
      "Resets every filter to its default in one batch, so the address changes once and one press of Back undoes the clear.",
    snippet: `import { signal } from "@preact/signals"
import { clearFilterFields } from "@spy4x/preact-signals/use-url-filters"

const status = signal("open")
const page = signal(4)
const before = { status: status.value, page: page.value }
clearFilterFields({
  status: { signal: status, urlParam: "status", initialValue: "" },
  page: { signal: page, urlParam: "page", initialValue: 1 },
})
console.log({ before, after: { status: status.value, page: page.value } })`,
    covers: ["clearFilterFields"],
    run: () => {
      const status = signal("open")
      const page = signal(4)
      const before = { status: status.value, page: page.value }
      clearFilterFields({
        status: { signal: status, urlParam: "status", initialValue: "" },
        page: { signal: page, urlParam: "page", initialValue: 1 },
      })
      return { before, after: { status: status.value, page: page.value } }
    },
  },
  patchSignal: {
    title: "patchSignal()",
    wide: false,
    summary:
      "Replaces an object signal's value with a copy that has some fields changed, so everything reading it updates once.",
    snippet: `import { signal } from "@preact/signals"
import { patchSignal } from "@spy4x/preact-signals"

const settings = signal({ pageSize: 20, density: "comfortable", showArchived: false })
patchSignal(settings, { density: "compact" })
settings.value`,
    covers: ["patchSignal"],
    run: () => {
      const settings = signal({ pageSize: 20, density: "comfortable", showArchived: false })
      patchSignal(settings, { density: "compact" })
      return settings.value
    },
  },
  setMapEntry: {
    title: "setMapEntry() and deleteMapEntry()",
    wide: false,
    summary:
      "Return a new `Map` with one entry set or removed, since a signal holding a `Map` only notices a new value.",
    snippet: `import { deleteMapEntry, setMapEntry } from "@spy4x/preact-signals"

const cart: ReadonlyMap<string, number> = new Map([["apples", 3]])
const added = setMapEntry(cart, "pears", 2)
const removed = deleteMapEntry(added, "apples")
console.log({ cart, added, removed })`,
    covers: ["setMapEntry", "deleteMapEntry"],
    run: () => {
      const cart: ReadonlyMap<string, number> = new Map([["apples", 3]])
      const added = setMapEntry(cart, "pears", 2)
      const removed = deleteMapEntry(added, "apples")
      return { cart, added, removed }
    },
  },
  createToastStore: {
    title: "createToastStore()",
    wide: false,
    summary:
      "Holds the toasts `Toastr` shows: each call adds one and returns its id, and `remove` takes one off.",
    snippet: `import { createToastStore } from "@spy4x/preact-signals"

let count = 0
const toasts = createToastStore({ nextId: () => \`toast-\${++count}\` })
toasts.success({ body: "Settings saved" })
const failed = toasts.error({ title: "Upload failed", body: "The file is over 10 MB", duration: 0 })
toasts.info({ body: "Two new comments" })
toasts.remove(failed)
toasts.list.value // the store runs no timers: whatever renders the toasts removes them`,
    covers: ["createToastStore"],
    run: () => {
      let count = 0
      const toasts = createToastStore({ nextId: () => `toast-${++count}` })
      toasts.success({ body: "Settings saved" })
      const failed = toasts.error({
        title: "Upload failed",
        body: "The file is over 10 MB",
        duration: 0,
      })
      toasts.info({ body: "Two new comments" })
      toasts.remove(failed)
      return toasts.list.value
    },
  },
  createThemeStore: {
    title: "createThemeStore() and ThemeValue",
    wide: true,
    summary:
      "Holds the reader's light, dark or system choice and the palette that is painted, with storage, the system setting and the painting passed in.",
    snippet: `import { createThemeStore, ThemeValue } from "@spy4x/preact-signals"

const saved = new Map([["theme", ThemeValue.DARK as string]])
const theme = createThemeStore({
  storage: { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => void saved.set(key, value) },
  media: () => ({ matches: false }), // the system asks for light
  apply: () => {}, // an app leaves this out, and the store toggles the page's \`dark\` class
})
const actual = [theme.actual.value]
theme.attach() // reads the stored preference: dark
actual.push(theme.actual.value)
theme.toggle()
actual.push(theme.actual.value)
theme.set(ThemeValue.SYSTEM)
actual.push(theme.actual.value)
theme.dispose()
console.log({ actual, preference: theme.preference.value, stored: saved.get("theme") })`,
    props: [
      {
        name: "storage",
        type: "ThemeStorage | null",
        default: "localStorage",
        description: "Where the choice is kept.",
      },
      {
        name: "media",
        type: "(query: string) => ThemeMediaQuery",
        default: "matchMedia",
        description: "Answers whether the system asks for dark.",
      },
      {
        name: "apply",
        type: "(theme: Theme) => void",
        description: "Paints a theme; by default it toggles the page's `dark` class.",
      },
      {
        name: "storageKey",
        type: "string",
        default: '"theme"',
        description: "The storage key the choice is kept under.",
      },
    ],
    covers: ["createThemeStore", "ThemeValue"],
    run: () => {
      const saved = new Map([["theme", ThemeValue.DARK as string]])
      const theme = createThemeStore({
        storage: {
          getItem: (key) => saved.get(key) ?? null,
          setItem: (key, value) => void saved.set(key, value),
        },
        media: () => ({ matches: false }),
        apply: () => {},
      })
      const actual = [theme.actual.value]
      theme.attach()
      actual.push(theme.actual.value)
      theme.toggle()
      actual.push(theme.actual.value)
      theme.set(ThemeValue.SYSTEM)
      actual.push(theme.actual.value)
      theme.dispose()
      return { actual, preference: theme.preference.value, stored: saved.get("theme") }
    },
  },
  createClipboard: {
    title: "createClipboard()",
    wide: true,
    summary:
      "Copies text and reports success or failure through callbacks instead of throwing, with `CLIPBOARD_UNAVAILABLE` when there is no clipboard.",
    snippet: `import { CLIPBOARD_UNAVAILABLE, createClipboard } from "@spy4x/preact-signals"

const reported: string[] = []
// No clipboard, as on an insecure page or in a server render; \`copy\` then resolves to false.
const clipboard = createClipboard({ clipboard: null })
void clipboard.copy("https://example.com/report", {
  onError: (error) => reported.push((error as Error).message),
})
console.log({ reported, isTheExportedMessage: reported[0] === CLIPBOARD_UNAVAILABLE })`,
    covers: ["createClipboard", "CLIPBOARD_UNAVAILABLE"],
    run: () => {
      const reported: string[] = []
      const clipboard = createClipboard({ clipboard: null })
      void clipboard.copy("https://example.com/report", {
        onError: (error) => reported.push((error as Error).message),
      })
      return { reported, isTheExportedMessage: reported[0] === CLIPBOARD_UNAVAILABLE }
    },
  },
  buildModelStore: {
    title: "buildModelStore() and RemoteEvent",
    wide: true,
    summary:
      "A store for one REST collection, validated with arktype, that also applies live updates named by `RemoteEvent`.",
    snippet: `import { buildModelStore, RemoteEvent } from "@spy4x/preact-signals"
import { type } from "arktype"

const notes = buildModelStore({
  model: "note",
  endpoint: "/api/notes",
  schemas: {
    full: type({ id: "number", title: "string", deletedAt: "string | null" }),
    create: type({ title: "string > 0" }),
    update: type({ "title?": "string > 0" }),
  },
  fetch: () => Promise.reject(new Error("this example sends no requests")), // never called
})
void notes.onWs([
  { id: 1, title: "Meeting agenda", deletedAt: null },
  { id: 2, title: "Old draft", deletedAt: "2026-01-05" },
], RemoteEvent.LIST)
void notes.create({ title: "" }) // refused by the schema before any request
console.log({
  active: notes.list.nonDeleted.value.map((note) => note.title),
  archived: notes.list.deleted.value.map((note) => note.title),
  createError: notes.op.create.value.error?.message,
})`,
    props: [
      { name: "model", type: "string", description: "The entity's name, used in notifications." },
      { name: "endpoint", type: "string", description: "The collection's URL." },
      {
        name: "schemas",
        type: "{ full, create, update }",
        description: "The arktype schemas of a row and of the create and update payloads.",
      },
      {
        name: "fetch",
        type: "typeof fetch",
        default: "globalThis.fetch",
        description: "The request port, so a test never touches the network.",
      },
      {
        name: "toast",
        type: "ToastPort",
        description: "Where success and failure notifications go; left out, the store is silent.",
      },
    ],
    covers: ["buildModelStore", "RemoteEvent"],
    run: () => {
      const notes = buildModelStore({
        model: "note",
        endpoint: "/api/notes",
        schemas: {
          full: type({ id: "number", title: "string", deletedAt: "string | null" }),
          create: type({ title: "string > 0" }),
          update: type({ "title?": "string > 0" }),
        },
        fetch: () => Promise.reject(new Error("this example sends no requests")),
      })
      void notes.onWs([
        { id: 1, title: "Meeting agenda", deletedAt: null },
        { id: 2, title: "Old draft", deletedAt: "2026-01-05" },
      ], RemoteEvent.LIST)
      void notes.create({ title: "" })
      return {
        active: notes.list.nonDeleted.value.map((note) => note.title),
        archived: notes.list.deleted.value.map((note) => note.title),
        createError: notes.op.create.value.error?.message,
      }
    },
  },
}

/** The `signals/` examples, as registry cards. */
export const signalsExamples = toExampleDemos(examples)
