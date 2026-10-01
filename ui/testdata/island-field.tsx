// An island: library `Field`s around an `Input`, a `Textarea` and a `Select`
// (`island-bundle.test.ts`).
import { render } from "preact"
import { Field } from "@spy4x/preact-ui/field"
import { Input, Select, Textarea } from "@spy4x/preact-ui/input"

render(
  <form>
    <Field id="name" label="Name">
      <Input name="name" />
    </Field>
    <Field id="message" label="Message">
      <Textarea name="message" />
    </Field>
    <Field id="topic" label="Topic">
      <Select name="topic" options={[{ value: "general", label: "General" }]} />
    </Field>
  </form>,
  document.body,
)
