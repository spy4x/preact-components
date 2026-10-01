// An island that renders a library `Button` with no `class` (`island-bundle.test.ts`).
import { render } from "preact"
import { Button } from "@spy4x/preact-ui/button"

render(<Button>Save</Button>, document.body)
