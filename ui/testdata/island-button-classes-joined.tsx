// An island: a link styled as a button through `buttonClassesJoined`, with a caller class
// (`island-bundle.test.ts`).
import { render } from "preact"
import { buttonClassesJoined } from "@spy4x/preact-ui/button-classes"

render(
  <a href="/pricing" class={buttonClassesJoined("outline", "lg", "w-full")}>See pricing</a>,
  document.body,
)
