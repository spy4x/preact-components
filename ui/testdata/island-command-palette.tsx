// An island: a library `CommandPalette` beside a `Toastr`, as antonshubin.com's demo renders them
// (`island-bundle.test.ts`).
import { render } from "preact"
import { CommandPalette } from "@spy4x/preact-ui/command-palette"
import { Toastr } from "@spy4x/preact-ui/toastr"

render(
  <>
    <CommandPalette
      options={[{ id: "combobox", label: "Combobox" }, { id: "toast", label: "Toast" }]}
      trigger="field"
      defaultQuery="combobx"
      showMatch
      onSelect={() => {}}
    />
    <Toastr toasts={[{ id: 1, body: "Copied" }]} onDismiss={() => {}} />
  </>,
  document.body,
)
