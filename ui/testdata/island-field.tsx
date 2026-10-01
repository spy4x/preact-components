// An island: library `Field`s around an `Input` and a `Textarea` (`island-bundle.test.ts`).
import { render } from "preact"
import { Field } from "@spy4x/preact-ui/field"
import { Input, Textarea } from "@spy4x/preact-ui/input"

render(
  <form>
    <Field id="name" label="Name">
      <Input name="name" />
    </Field>
    <Field id="message" label="Message">
      <Textarea name="message" />
    </Field>
  </form>,
  document.body,
)
