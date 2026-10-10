// An island: a library `Toastr` with one toast and nothing else (`island-bundle.test.ts`).
import { render } from "preact"
import { Toastr } from "@spy4x/preact-ui/toastr"

render(
  <Toastr
    toasts={[{ id: 1, body: "Note deleted", action: { label: "Undo", onAction: () => {} } }]}
    onDismiss={() => {}}
  />,
  document.body,
)
