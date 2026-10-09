import { afterEach, beforeEach } from "@std/testing/bdd"

/**
 * Put the test on a page at `url`: `location` becomes that URL, and `document`, when `baseURI` is
 * given, a document with that base address. Deno has neither, and `followLinkClick` routes only a
 * link to the page's own origin, so a test that expects a click to route needs a page. `null`
 * removes `location`, as on a server. Returns the function that puts both globals back.
 */
export function pageAt(url: string | null, baseURI?: string): () => void {
  const own = {
    location: Object.getOwnPropertyDescriptor(globalThis, "location"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
  }
  const set = (name: "location" | "document", value: unknown) =>
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  set("location", url === null ? undefined : new URL(url))
  set("document", baseURI === undefined ? undefined : { baseURI })
  return () => {
    for (const name of ["location", "document"] as const) {
      const descriptor = own[name]
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete (globalThis as Record<string, unknown>)[name]
    }
  }
}

/** Every test in the enclosing `describe` runs on a page at `https://app.example.com/home`. */
export function onAppPage(): void {
  let restore = () => {}
  beforeEach(() => {
    restore = pageAt("https://app.example.com/home")
  })
  afterEach(() => restore())
}
