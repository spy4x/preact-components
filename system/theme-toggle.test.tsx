import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { nextThemeMode, type ThemeMode, ThemeToggle, themeToggleLabel } from "./theme-toggle.tsx"

describe("nextThemeMode", () => {
  it("cycles auto → light → dark → auto", () => {
    expect(nextThemeMode("auto")).toBe("light")
    expect(nextThemeMode("light")).toBe("dark")
    expect(nextThemeMode("dark")).toBe("auto")
  })

  it("returns to the start after three steps", () => {
    let mode: ThemeMode = "auto"
    for (let step = 0; step < 3; step++) mode = nextThemeMode(mode)

    expect(mode).toBe("auto")
  })
})

describe("themeToggleLabel", () => {
  it("names the current mode and the next click", () => {
    expect(themeToggleLabel("auto")).toContain("follows system")
    expect(themeToggleLabel("light")).toContain("light")
    expect(themeToggleLabel("dark")).toContain("dark")
  })

  it("differs for every mode", () => {
    const labels = new Set(
      ["auto", "light", "dark"].map((mode) => themeToggleLabel(mode as ThemeMode)),
    )

    expect(labels.size).toBe(3)
  })
})

describe("ThemeToggle", () => {
  it("renders an inert, same-size placeholder while the mode is unknown", () => {
    const html = render(<ThemeToggle onChange={() => {}} />)

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain("opacity-0")
    expect(html).not.toContain("aria-label")
  })

  it("takes a custom placeholder", () => {
    const html = render(<ThemeToggle onChange={() => {}} placeholder={<span>loading</span>} />)

    expect(html).toContain("loading")
  })

  it("renders a labelled button once the mode is known", () => {
    const html = render(<ThemeToggle mode="dark" onChange={() => {}} />)

    expect(html).toContain('aria-label="Theme: dark. Click for auto."')
    expect(html).toContain('title="Theme: dark. Click for auto."')
    expect(html).not.toContain("opacity-0")
    expect(html).not.toContain('aria-hidden="true"')
  })

  it("takes a label override", () => {
    const html = render(<ThemeToggle mode="light" onChange={() => {}} label="Switch theme" />)

    expect(html).toContain('aria-label="Switch theme"')
  })

  it("renders a sun for light, a moon for dark and a system glyph for auto", () => {
    const light = render(<ThemeToggle mode="light" onChange={() => {}} />)
    const dark = render(<ThemeToggle mode="dark" onChange={() => {}} />)
    const auto = render(<ThemeToggle mode="auto" onChange={() => {}} />)

    expect(light).not.toBe(dark)
    expect(dark).not.toBe(auto)
    expect(auto).not.toBe(light)
  })

  it("keeps the caller's utilities and lets them win over the default", () => {
    const html = render(<ThemeToggle mode="auto" onChange={() => {}} class="size-8" />)

    expect(html).toContain("size-8")
    expect(html).not.toContain("size-9")
  })

  it("stays server-renderable with a known mode", () => {
    const html = render(<ThemeToggle mode="auto" onChange={() => {}} />)

    expect(html.startsWith("<button")).toBe(true)
    expect(html).toContain("rounded-full")
  })

  it("calls onChange with the next mode when the button is clicked", () => {
    const calls: ThemeMode[] = []
    // No DOM in this suite: the handler is taken straight off the returned vnode.
    const vnode = ThemeToggle({
      mode: "auto",
      onChange: (mode) => calls.push(mode),
    }) as unknown as {
      props: { onClick: () => void }
    }

    vnode.props.onClick()

    expect(calls).toEqual(["light"])
  })

  it("renders no click handler in the placeholder state", () => {
    const vnode = ThemeToggle({ onChange: () => {} }) as unknown as {
      props: { onClick?: () => void }
    }

    expect(vnode.props.onClick).toBeUndefined()
  })
})
