import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  BookingSubmit,
  emailProblem,
  fieldProblem,
  type FieldReader,
  type FieldRule,
  gateSubmit,
  resolveTimeZone,
} from "./booking-submit.tsx"

const fields: FieldRule[] = [
  { name: "name", required: "Please enter your name.", min: 2, max: 100, focus: "#f-name" },
  { name: "email", required: "Please enter your email.", check: emailProblem, focus: "#f-email" },
]

/** A reader over a fixed record, standing in for `new FormData(form)`. */
function reader(values: Record<string, string>): FieldReader {
  return (name) => values[name] ?? ""
}

/** A gate that records what the component would have done to the event and the DOM. */
function recorder(values: Record<string, string>) {
  const calls: string[] = []
  return {
    calls,
    gate: {
      read: reader(values),
      prevent: () => calls.push("prevent"),
      focus: (selector: string) => calls.push(`focus:${selector}`),
    },
  }
}

const valid = { name: "Ada Lovelace", email: "ada@example.com" }

describe("emailProblem", () => {
  it("accepts a plain address", () => {
    expect(emailProblem("ada@example.com")).toBeNull()
  })

  it("accepts a subdomain and a plus tag", () => {
    expect(emailProblem("ada+booking@mail.example.co.uk")).toBeNull()
  })

  it("rejects an address without a domain", () => {
    expect(emailProblem("ada@example")).toBe("Please enter a valid email address.")
  })

  it("rejects a value that is not an address at all", () => {
    expect(emailProblem("not-an-address")).toBe("Please enter a valid email address.")
    expect(emailProblem("")).toBe("Please enter a valid email address.")
  })
})

describe("fieldProblem", () => {
  it("returns null when every rule passes", () => {
    expect(fieldProblem(reader(valid), fields)).toBeNull()
  })

  it("trims before measuring", () => {
    expect(fieldProblem(reader({ name: "  Ada  ", email: "ada@example.com" }), fields)).toBeNull()
  })

  it("reports the first failing field, in declaration order", () => {
    const problem = fieldProblem(reader({ name: "", email: "nope" }), fields)

    expect(problem?.message).toBe("Please enter your name.")
    expect(problem?.focus).toBe("#f-name")
  })

  it("uses the required message for an empty value", () => {
    expect(fieldProblem(reader({ name: "Ada", email: "   " }), fields)?.message)
      .toBe("Please enter your email.")
  })

  it("treats a whitespace-only value as empty", () => {
    expect(fieldProblem(reader({ name: " ", email: "ada@example.com" }), fields)?.message)
      .toBe("Please enter your name.")
  })

  it("enforces the minimum length with the rule's own message", () => {
    const rule: FieldRule[] = [{
      name: "name",
      required: "required",
      min: 3,
      tooShort: "Too short.",
    }]

    expect(fieldProblem(reader({ name: "ab" }), rule)?.message).toBe("Too short.")
  })

  it("falls back to a generated message for the minimum length", () => {
    const rule: FieldRule[] = [{ name: "name", required: "required", min: 3 }]

    expect(fieldProblem(reader({ name: "ab" }), rule)?.message)
      .toBe("Please enter at least 3 characters.")
  })

  it("enforces the maximum length", () => {
    const rule: FieldRule[] = [{ name: "name", required: "required", max: 4, tooLong: "Too long." }]

    expect(fieldProblem(reader({ name: "abcde" }), rule)?.message).toBe("Too long.")
  })

  it("falls back to a generated message for the maximum length", () => {
    const rule: FieldRule[] = [{ name: "name", required: "required", max: 4 }]

    expect(fieldProblem(reader({ name: "abcde" }), rule)?.message)
      .toBe("Please use at most 4 characters.")
  })

  it("skips an optional field that is empty", () => {
    const rule: FieldRule[] = [{ name: "phone", min: 5 }]

    expect(fieldProblem(reader({}), rule)).toBeNull()
  })

  it("derives the focus selector from the field name", () => {
    expect(fieldProblem(reader({}), fields)?.focus).toBe("#f-name")
    expect(fieldProblem(reader({ name: "Ada" }), fields)?.focus).toBe("#f-email")
    expect(fieldProblem(reader({}), [{ name: "company", required: "required" }])?.focus)
      .toBe('[name="company"]')
  })

  it("passes with no rules at all", () => {
    expect(fieldProblem(reader({}), [])).toBeNull()
  })
})

describe("gateSubmit", () => {
  it("blocks an invalid submit and moves focus to the offending control", () => {
    const { calls, gate } = recorder({ name: "", email: "" })

    const problem = gateSubmit(gate, (read) => fieldProblem(read, fields))

    expect(problem?.message).toBe("Please enter your name.")
    expect(calls).toEqual(["prevent", "focus:#f-name"])
  })

  it("never touches the event or the DOM when the form is valid", () => {
    const { calls, gate } = recorder(valid)

    const problem = gateSubmit(gate, (read) => fieldProblem(read, fields))

    expect(problem).toBeNull()
    expect(calls).toEqual([])
  })

  it("skips focus when the problem names no control", () => {
    const { calls, gate } = recorder({})

    const problem = gateSubmit(gate, () => ({ message: "Something is off." }))

    expect(problem?.message).toBe("Something is off.")
    expect(calls).toEqual(["prevent"])
  })

  it("takes a validator that is not field-rule based", () => {
    const { calls, gate } = recorder({})

    const problem = gateSubmit(gate, () => null)

    expect(problem).toBeNull()
    expect(calls).toEqual([])
  })
})

describe("resolveTimeZone", () => {
  it("returns a string, never throwing in an environment without Intl data", () => {
    expect(typeof resolveTimeZone()).toBe("string")
  })
})

describe("BookingSubmit", () => {
  it("renders a hidden timezone field next to the submit button", () => {
    const html = render(<BookingSubmit label="Confirm — Fri, 28 Aug, 14:00" />)

    // Preact renders the empty hidden value as a bare `value` attribute.
    expect(html).toContain('<input type="hidden" name="guestTz" value')
    expect(html).toContain('type="submit"')
    expect(html).toContain("Confirm — Fri, 28 Aug, 14:00")
  })

  it("takes a different timezone field name", () => {
    const html = render(<BookingSubmit label="Confirm" timeZoneField="visitorTz" />)

    expect(html).toContain('name="visitorTz"')
    expect(html).not.toContain("guestTz")
  })

  it("renders no hidden field when the field is opted out", () => {
    const html = render(<BookingSubmit label="Confirm" timeZoneField={false} />)

    expect(html).not.toContain('type="hidden"')
  })

  it("starts idle: no aria-busy and no error paragraph", () => {
    const html = render(<BookingSubmit label="Confirm" />)

    expect(html).not.toContain("aria-busy")
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain("Confirming")
  })

  it("carries no spinner before the form is in flight", () => {
    const html = render(<BookingSubmit label="Confirm" fields={fields} />)

    expect(html).not.toContain("animate-spin")
  })

  it("keeps the caller's utilities and lets them win over the default", () => {
    const html = render(<BookingSubmit label="Confirm" class="bg-red-600" />)

    expect(html).toContain("bg-red-600")
    expect(html).not.toContain("bg-purple-900")
  })
})
