import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createThemeStore, type ThemeStore, ThemeValue } from "@spy4x/preact-signals/theme"
import { IconMoon, IconSun, IconThemeAuto } from "@spy4x/preact-icons"
import { render } from "preact-render-to-string"
import { ThemeToggle } from "./theme-toggle.tsx"

/**
 * A store that touches nothing outside itself: no storage, no document, and a device that asks for
 * `device`. Attached, so `system` reads the device the way it does in a browser.
 */
function storeOn(device: "light" | "dark"): ThemeStore {
  const store = createThemeStore({
    storage: null,
    media: () => ({ matches: device === "dark" }),
    apply: () => {},
  })
  store.attach()
  return store
}

/** The markup an icon renders at the size the toggle draws it, to find it in the button. */
const iconMarkup = {
  auto: render(<IconThemeAuto class="size-4" />),
  light: render(<IconSun class="size-4" />),
  dark: render(<IconMoon class="size-4" />),
}

describe("ThemeToggle", () => {
  it("renders auto on a light device before the store is attached, as a server does", () => {
    const html = render(<ThemeToggle store={createThemeStore({ storage: null, media: null })} />)

    expect(html).toContain('aria-label="Theme: auto (light)"')
    expect(html).toContain(iconMarkup.auto)
  })

  it("names auto with the device's theme and shows the auto icon", () => {
    const html = render(<ThemeToggle store={storeOn("dark")} />)

    expect(html).toContain('aria-label="Theme: auto (dark)"')
    expect(html).toContain('title="Theme: auto (dark)"')
    expect(html).toContain(iconMarkup.auto)
  })

  it("shows the sun and names light when light is chosen", () => {
    const store = storeOn("dark")
    store.set(ThemeValue.LIGHT)
    const html = render(<ThemeToggle store={store} />)

    expect(html).toContain('aria-label="Theme: light"')
    expect(html).toContain(iconMarkup.light)
    expect(html).not.toContain(iconMarkup.auto)
  })

  it("shows the moon and names dark when dark is chosen", () => {
    const store = storeOn("light")
    store.set(ThemeValue.DARK)
    const html = render(<ThemeToggle store={store} />)

    expect(html).toContain('aria-label="Theme: dark"')
    expect(html).toContain(iconMarkup.dark)
  })

  it("takes a caller's words for every state", () => {
    const labels = { autoLight: "Thème : auto (clair)", dark: "Thème : sombre" }
    const store = storeOn("light")

    expect(render(<ThemeToggle store={store} labels={labels} />))
      .toContain('aria-label="Thème : auto (clair)"')
    store.set(ThemeValue.DARK)
    expect(render(<ThemeToggle store={store} labels={labels} />))
      .toContain('aria-label="Thème : sombre"')
  })

  it("renders an empty polite live region from the start, so a later hint is announced", () => {
    const html = render(<ThemeToggle store={storeOn("light")} />)

    expect(html).toMatch(
      /<span role="status" aria-live="polite" aria-atomic="true" class="[^"]*"><\/span>/,
    )
    expect(html).not.toContain("Auto mode")
  })

  it("keeps the hint out of the layout and out of hit testing", () => {
    const html = render(<ThemeToggle store={storeOn("light")} />)
    const region = html.match(/<span role="status"[^>]*class="([^"]*)"/)?.[1] ?? ""

    expect(region.split(" ")).toEqual(expect.arrayContaining(["absolute", "pointer-events-none"]))
    expect(html).toMatch(/^<span class="relative inline-flex">/)
  })

  it("renders an icon-only button that does not submit a form", () => {
    const html = render(<ThemeToggle store={storeOn("light")} />)

    expect(html).toContain('type="button"')
    expect(html).toContain("size-9")
  })

  it("appends a caller class to the wrapper", () => {
    expect(render(<ThemeToggle store={storeOn("light")} class="ml-auto" />))
      .toMatch(/^<span class="relative inline-flex ml-auto">/)
  })
})

describe("ThemeToggle hotkey", () => {
  it("announces its hotkey and, as an icon button, shows no hint unless asked", () => {
    const store = storeOn("light")
    const quiet = render(<ThemeToggle store={store} hotkey="t" />)
    expect(quiet).toContain('aria-keyshortcuts="T"')
    expect(quiet).not.toContain("data-hotkey-hint")
    expect(render(<ThemeToggle store={store} hotkey="t" hotkeyHint />))
      .toContain("data-hotkey-hint")
  })
})
