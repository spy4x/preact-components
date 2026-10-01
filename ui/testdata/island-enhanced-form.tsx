// An island that renders a library `EnhancedForm` with no `class` (`island-bundle.test.ts`).
import { render } from "preact"
import { EnhancedForm } from "@spy4x/preact-ui/enhanced-form"

render(
  <EnhancedForm action="/contact" onSubmit={() => {}}>
    <button type="submit">Send</button>
  </EnhancedForm>,
  document.body,
)
