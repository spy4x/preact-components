// An island that renders a library `Lightbox` with no `class` (`island-bundle.test.ts`).
import { render } from "preact"
import { Lightbox } from "@spy4x/preact-ui/lightbox"

render(
  <Lightbox
    images={[{ src: "/a.webp", alt: "A screenshot" }]}
    index={0}
    open={false}
    onClose={() => {}}
    onIndexChange={() => {}}
  />,
  document.body,
)
