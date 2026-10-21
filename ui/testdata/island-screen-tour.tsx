// An island that renders a library `ScreenTour` with no `class` (`island-bundle.test.ts`).
import { render } from "preact"
import { ScreenTour } from "@spy4x/preact-ui/screen-tour"

render(
  <ScreenTour
    frame="browser"
    steps={[{
      id: "home",
      label: "Home",
      image: { src: "/a.webp", alt: "A screenshot", width: 1280, height: 800 },
    }]}
  />,
  document.body,
)
