import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { nextStepIndex, ScreenTour, type ScreenTourStep } from "./screen-tour.tsx"

const steps: ScreenTourStep[] = [
  {
    id: "tour-dashboard",
    label: "Dashboard",
    group: "Monitor",
    text: "A map of every pole.",
    image: { src: "/dashboard.png", alt: "The dashboard with a map", width: 1280, height: 800 },
  },
  {
    id: "tour-alerts",
    label: "Alerts",
    group: "Monitor",
    text: "Failure detection with alerts.",
    image: { src: "/alerts.png", alt: "The alerts list", width: 1280, height: 800 },
  },
  {
    id: "tour-users",
    label: "Users",
    group: "Access",
    image: { src: "/users.png", alt: "The users table", width: 1280, height: 800 },
  },
]

/** Every `<button role="tab">` start tag, in order. */
function tabTags(html: string): string[] {
  return html.match(/<button[^>]*role="tab"[^>]*>/g) ?? []
}

describe("ScreenTour", () => {
  it("renders the first step selected, and the only Tab stop, on the server", () => {
    const tabs = tabTags(render(<ScreenTour steps={steps} frame="browser" />))
    expect(tabs.length).toBe(3)
    expect(tabs[0]).toContain('aria-selected="true"')
    expect(tabs[0]).toContain('tabindex="0"')
    for (const tab of tabs.slice(1)) {
      expect(tab).toContain('aria-selected="false"')
      expect(tab).toContain('tabindex="-1"')
    }
  })

  it("puts every step's caption and text in the server HTML, hidden only where scripts run", () => {
    const html = render(<ScreenTour steps={steps} frame="browser" />)
    for (const step of steps) {
      expect(html).toContain(`>${step.image.alt}</p>`)
      expect(html).toMatch(new RegExp(`<div role="tabpanel" id="${step.id}-panel"[^>]*>`))
    }
    expect(html).toContain("A map of every pole.")
    expect(html).toContain("Failure detection with alerts.")
    const panels = html.match(/<div role="tabpanel"[^>]*>/g) ?? []
    expect(panels.length).toBe(3)
    for (const panel of panels) {
      // Nothing hides a panel for a reader without scripts: no `hidden`, no `inert`, no bare
      // `invisible`, and every panel is reachable.
      expect(panel).not.toMatch(/\shidden(=|>|\s)|\sinert|[\s"]invisible\b|[\s"]opacity-0\b/)
      expect(panel).toContain('tabindex="0"')
    }
    expect(panels[0]).not.toContain("[@media(scripting:enabled)]:invisible")
    for (const panel of panels.slice(1)) {
      expect(panel).toContain("[@media(scripting:enabled)]:invisible")
    }
    // The texts share one cell where scripts run, and stack in a column otherwise.
    expect(html).toMatch(
      /<div class="relative flex flex-col gap-6 \[@media\(scripting:enabled\)\]:grid">/,
    )
  })

  it("takes a panel that is not selected out of the flow where scripts run, so a step without text leaves no gap", () => {
    const panels = render(<ScreenTour steps={steps} frame="browser" />)
      .match(/<div role="tabpanel"[^>]*>/g) ?? []
    expect(panels[0]).not.toContain("[@media(scripting:enabled)]:absolute")
    for (const panel of panels.slice(1)) {
      expect(panel).toContain("[@media(scripting:enabled)]:absolute")
      expect(panel).not.toMatch(/[\s"]absolute\b/)
    }
  })

  it("pairs each tab with its panel through derived ids", () => {
    const html = render(<ScreenTour steps={steps} frame="browser" />)
    expect(html).toContain('id="tour-alerts-tab"')
    expect(html).toContain('aria-controls="tour-alerts-panel"')
    expect(html).toContain('aria-labelledby="tour-alerts-tab"')
  })

  it("renders only the first screenshot, so the others load when first picked", () => {
    const images = render(<ScreenTour steps={steps} frame="browser" />).match(/<img [^>]*>/g) ?? []
    expect(images.length).toBe(1)
    expect(images[0]).toContain('src="/dashboard.png"')
    expect(images[0]).toContain('alt="The dashboard with a map"')
    expect(images[0]).toContain('width="1280"')
    expect(images[0]).not.toContain("loading=")
  })

  it("sets no fetchpriority unless the page asks, and then on the first screenshot", () => {
    expect(render(<ScreenTour steps={steps} frame="browser" />)).not.toContain("fetchpriority")
    expect(render(<ScreenTour steps={steps} frame="browser" fetchPriority="high" />)).toMatch(
      /<img [^>]*fetchpriority="high"[^>]*src="\/dashboard\.png"|<img [^>]*src="\/dashboard\.png"[^>]*fetchpriority="high"/,
    )
  })

  it("cross-fades only under reduced-motion: no-preference", () => {
    const image = render(<ScreenTour steps={steps} frame="browser" />).match(/<img [^>]*>/)![0]
    expect(image).toContain("motion-safe:transition-opacity")
    expect(image).toContain("motion-safe:duration-150")
    expect(image).not.toMatch(/class="[^"]*(?<!motion-safe:)transition-/)
  })

  it("links View full size to the selected screenshot, so it opens without JavaScript", () => {
    const html = render(<ScreenTour steps={steps} frame="browser" />)
    expect(html).toMatch(/<a href="\/dashboard\.png"[^>]*>View full size<\/a>/)
  })

  it("makes View full size a 44 px target on a phone", () => {
    const link = render(<ScreenTour steps={steps} frame="browser" />).match(/<a href[^>]*>/)![0]
    expect(link).toMatch(/class="[^"]*\bmin-h-11\b[^"]*\bsm:min-h-9\b/)
  })

  it("takes its words from props", () => {
    const html = render(
      <ScreenTour steps={steps} frame="browser" label="Pages" viewFullSizeLabel="Open large" />,
    )
    expect(html).toContain('aria-label="Pages"')
    expect(html).toContain(">Open large</a>")
  })

  it("shows each group's label once, before the first step of its run, hidden from assistive tech", () => {
    const html = render(<ScreenTour steps={steps} frame="browser" />).match(
      /<div role="tablist"(?:(?!<\/div><div class).)*/,
    )![0]
    expect(html.match(/aria-hidden="true"[^>]*>Monitor</g)?.length).toBe(1)
    expect(html.match(/aria-hidden="true"[^>]*>Access</g)?.length).toBe(1)
    expect(html.indexOf(">Access<")).toBeLessThan(html.indexOf('id="tour-users-tab"'))
    expect(html.indexOf(">Access<")).toBeGreaterThan(html.indexOf('id="tour-alerts-tab"'))
  })

  it("shows the selected step's group above the frame below 1024 px, hidden from assistive tech", () => {
    const html = render(<ScreenTour steps={steps} frame="browser" />)
    expect(html).toMatch(
      /<p aria-hidden="true" class="[^"]*\blg:hidden\b[^"]*" data-screen-tour-group>Monitor<\/p>/,
    )
    expect(html.indexOf("data-screen-tour-group")).toBeGreaterThan(html.indexOf('role="tablist"'))
    expect(html.indexOf("data-screen-tour-group")).toBeLessThan(html.indexOf("<img"))
    const ungrouped = steps.map(({ group: _, ...step }) => step)
    expect(render(<ScreenTour steps={ungrouped} frame="browser" />)).not.toContain(
      "data-screen-tour-group",
    )
  })

  it("names each tab's group as its description", () => {
    const html = render(<ScreenTour steps={steps} frame="browser" />)
    expect(html).toContain('id="tour-dashboard-group"')
    expect(html).toContain('id="tour-users-group"')
    const tabs = tabTags(html)
    expect(tabs[0]).toContain('aria-describedby="tour-dashboard-group"')
    expect(tabs[1]).toContain('aria-describedby="tour-dashboard-group"')
    expect(tabs[2]).toContain('aria-describedby="tour-users-group"')
    const ungrouped = steps.map(({ group: _, ...step }) => step)
    expect(render(<ScreenTour steps={ungrouped} frame="browser" />)).not.toContain(
      "aria-describedby",
    )
  })

  it("numbers the tabs only when asked", () => {
    expect(render(<ScreenTour steps={steps} frame="phone" />)).not.toContain("tabular-nums")
    const html = render(<ScreenTour steps={steps} frame="phone" numbered />)
    expect(html).toMatch(/id="tour-users-tab"[^>]*><span aria-hidden="true"[^>]*>3<\/span>Users/)
  })

  it("draws the browser frame with the address, and the phone frame with its notch", () => {
    expect(render(<ScreenTour steps={steps} frame="browser" browserUrl="app.example.com" />))
      .toMatch(/<div aria-hidden="true"[^>]*>(?:(?!<\/div>).)*app\.example\.com/)
    expect(render(<ScreenTour steps={steps} frame="phone" />)).toContain("aspect-[9/19]")
  })

  it("draws the plain frame with no bar and no address", () => {
    const html = render(<ScreenTour steps={steps} frame="plain" browserUrl="app.example.com" />)
    expect(html).toMatch(/<div class="[^"]*rounded-xl[^"]*bg-surface[^"]*"><div class="grid"><img /)
    expect(html).not.toContain("app.example.com")
  })

  it("keeps the phone and its caption in one 16 rem column from 1024 px, and leaves the browser frame full width", () => {
    expect(render(<ScreenTour steps={steps} frame="phone" />)).toContain(
      '<div class="flex min-w-0 flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-64">',
    )
    expect(render(<ScreenTour steps={steps} frame="browser" />)).not.toContain("lg:max-w-64")
  })

  it("appends viewFullSizeClass to View full size, after its own classes", () => {
    const link = render(
      <ScreenTour steps={steps} frame="browser" viewFullSizeClass="rounded-full" />,
    ).match(/<a href[^>]*>/)![0]
    expect(link).toMatch(/class="[^"]*\bsm:min-h-9 rounded-full"/)
    expect(link).toContain("data-screen-tour-full-size")
  })

  it("appends the caller's class to the root", () => {
    expect(render(<ScreenTour steps={steps} frame="browser" class="max-w-5xl" />)).toMatch(
      /^<div class="[^"]*max-w-5xl"/,
    )
  })

  it("refuses an empty tour and a screenshot with a blank alt", () => {
    expect(() => render(<ScreenTour steps={[]} frame="browser" />)).toThrow("at least one step")
    const blank = [{ ...steps[0], image: { ...steps[0].image, alt: "  " } }]
    expect(() => render(<ScreenTour steps={blank} frame="browser" />)).toThrow("tour-dashboard")
  })
})

describe("nextStepIndex", () => {
  it("steps with Left and Right, and with Up and Down for the column, wrapping at both ends", () => {
    expect(nextStepIndex("ArrowRight", 0, 3)).toBe(1)
    expect(nextStepIndex("ArrowDown", 0, 3)).toBe(1)
    expect(nextStepIndex("ArrowLeft", 0, 3)).toBe(2)
    expect(nextStepIndex("ArrowUp", 0, 3)).toBe(2)
    expect(nextStepIndex("ArrowDown", 2, 3)).toBe(0)
  })

  it("jumps with Home and End, and leaves every other key alone", () => {
    expect(nextStepIndex("Home", 2, 3)).toBe(0)
    expect(nextStepIndex("End", 0, 3)).toBe(2)
    expect(nextStepIndex("Enter", 1, 3)).toBeUndefined()
    expect(nextStepIndex("a", 1, 3)).toBeUndefined()
  })
})
