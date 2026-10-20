// An island: a library `RadioChips` an island controls (`island-bundle.test.ts`).
import { render } from "preact"
import { RadioChips } from "@spy4x/preact-ui/radio-chips"

render(
  <RadioChips
    legend="Mode"
    name="mode"
    value="all"
    onChange={() => {}}
    options={[{ value: "all", label: "All" }, { value: "read-only", label: "Read only" }]}
  />,
  document.body,
)
