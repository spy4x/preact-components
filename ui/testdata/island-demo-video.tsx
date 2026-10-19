// An island that renders a library `DemoVideo` (`island-bundle.test.ts`).
import { render } from "preact"
import { DemoVideo } from "@spy4x/preact-ui/demo-video"

render(
  <DemoVideo
    title="A demo"
    poster={{ src: "/demo.webp", width: 1280, height: 720 }}
    sources={[{ src: "/demo.webm", type: "video/webm" }]}
  />,
  document.body,
)
