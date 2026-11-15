// An island that renders a library `LoopVideo` (`island-bundle.test.ts`).
import { render } from "preact"
import { LoopVideo } from "@spy4x/preact-ui/loop-video"

render(
  <LoopVideo
    name="A loop"
    title="A loop that proves a claim"
    poster={{ src: "/loop.webp", width: 1440, height: 900 }}
    sources={[{ src: "/loop.webm", type: "video/webm" }]}
  />,
  document.body,
)
