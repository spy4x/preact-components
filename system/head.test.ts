import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createHeadStore, type PageHead } from "./head.ts"

const DEFAULTS: PageHead = {
  title: "Acme — Widgets",
  description: "Widgets for teams.",
  canonical: "https://acme.example/",
  ogImage: "https://acme.example/og.png",
  ogType: "website",
}

/** The trail a route states for `/products/widgets`, root first, current page last. */
const TRAIL = [
  { name: "Home", href: "/" },
  { name: "Products", href: "/products" },
  { name: "Widgets" },
]

describe("createHeadStore", () => {
  it("starts from the defaults it was given", () => {
    const store = createHeadStore(DEFAULTS)

    expect(store.head.value).toEqual(DEFAULTS)
  })

  it("merges a patch without dropping the other fields", () => {
    const store = createHeadStore(DEFAULTS)

    const next = store.setHead({ title: "Pricing", canonical: "https://acme.example/pricing" })

    expect(next.title).toBe("Pricing")
    expect(next.description).toBe(DEFAULTS.description)
  })

  it("writes a patch into the signal a page renders from, not only into its return value", () => {
    const store = createHeadStore(DEFAULTS)
    // Held before the patch, as a layout holds it: a store that swapped in a new signal would
    // leave this one behind.
    const { head } = store

    store.setHead({ title: "Pricing", canonical: "https://acme.example/pricing" })

    expect(head.value).toEqual({
      ...DEFAULTS,
      title: "Pricing",
      canonical: "https://acme.example/pricing",
    })
  })

  it("merges a second patch on top of the first, not on top of the defaults", () => {
    const store = createHeadStore(DEFAULTS)

    store.setHead({ title: "Pricing" })
    store.setHead({ noindex: true })

    expect(store.head.value).toEqual({ ...DEFAULTS, title: "Pricing", noindex: true })
  })

  it("leaves the head as it was when a patch is empty", () => {
    const store = createHeadStore(DEFAULTS)
    store.setHead({ title: "Pricing" })

    store.setHead({})

    expect(store.head.value).toEqual({ ...DEFAULTS, title: "Pricing" })
  })

  it("clears a field a patch names with the value undefined", () => {
    const store = createHeadStore(DEFAULTS)
    store.setHead({ noindex: true, crumbs: TRAIL })

    store.setHead({ noindex: undefined })

    expect(store.head.value.noindex).toBeUndefined()
    expect(store.head.value.crumbs).toEqual(TRAIL)
  })

  it("resets to the defaults, including after a patch", () => {
    const store = createHeadStore(DEFAULTS)
    store.setHead({ title: "Pricing", noindex: true })

    expect(store.resetHead()).toEqual(DEFAULTS)
  })

  it("writes the defaults into the signal on reset, not only into its return value", () => {
    const store = createHeadStore(DEFAULTS)
    const { head } = store
    store.setHead({ title: "Pricing", noindex: true })

    store.resetHead()

    expect(head.value).toEqual(DEFAULTS)
  })

  it("clears every field two patches set, including ones the defaults do not have", () => {
    const store = createHeadStore(DEFAULTS)
    store.setHead({ title: "Pricing", noindex: true })
    store.setHead({ crumbs: TRAIL, ogType: "article" })

    store.resetHead()

    expect(store.head.value).toEqual(DEFAULTS)
    expect(store.head.value.noindex).toBeUndefined()
    expect(store.head.value.crumbs).toBeUndefined()
  })

  it("applies the next page's patch on top of the defaults, not on top of the page before", () => {
    const store = createHeadStore(DEFAULTS)
    store.setHead({ title: "Admin", noindex: true, crumbs: TRAIL })

    store.resetHead()
    store.setHead({ title: "About", canonical: "https://acme.example/about" })

    expect(store.head.value).toEqual({
      ...DEFAULTS,
      title: "About",
      canonical: "https://acme.example/about",
    })
  })

  it("restores the defaults as they were handed in, even if the caller changes them later", () => {
    const defaults: PageHead = { ...DEFAULTS }
    const store = createHeadStore(defaults)
    defaults.title = "Changed after the store was made"

    store.resetHead()

    expect(store.head.value.title).toBe(DEFAULTS.title)
  })

  it("hands out a fresh copy on every reset, so a change to one cannot leak into the next", () => {
    const store = createHeadStore(DEFAULTS)
    const first = store.resetHead()
    first.title = "Tampered"

    store.resetHead()

    expect(store.head.value.title).toBe(DEFAULTS.title)
  })

  it("does not hand out a store that mutates the defaults object", () => {
    const defaults: PageHead = { ...DEFAULTS }
    const store = createHeadStore(defaults)
    store.setHead({ title: "Pricing" })

    expect(defaults.title).toBe(DEFAULTS.title)
  })

  it("gives each store its own signal, so one request cannot write another's head", () => {
    const one = createHeadStore(DEFAULTS)
    const two = createHeadStore(DEFAULTS)
    one.setHead({ title: "One" })

    expect(two.head.value.title).toBe(DEFAULTS.title)
  })

  it("resets one store to its own defaults and leaves a store with other defaults alone", () => {
    const other: PageHead = {
      ...DEFAULTS,
      title: "Other — Docs",
      canonical: "https://docs.example/",
    }
    const one = createHeadStore(DEFAULTS)
    const two = createHeadStore(other)
    one.setHead({ title: "One" })
    two.setHead({ title: "Two" })

    one.resetHead()

    expect(one.head.value).toEqual(DEFAULTS)
    expect(two.head.value).toEqual({ ...other, title: "Two" })
  })
})
