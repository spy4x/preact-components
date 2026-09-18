import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type } from "arktype"
import {
  isValid,
  sameValidation,
  schemaIssues,
  setFieldIssue,
  validateSchema,
  type ValidationModel,
  ValidationType,
} from "./validation.ts"

const personSchema = type({
  name: "1 <= string <= 10",
  age: "number",
  address: { city: "string" },
})

type Person = typeof personSchema.infer

const clean = (): ValidationModel<Person> => ({})

describe("isValid", () => {
  it("accepts a model with no issues", () => {
    expect(isValid(clean())).toBe(true)
  })

  it("rejects a model whose field carries an issue", () => {
    const vl = setFieldIssue(clean(), "name", ValidationType.SCHEMA, "name must be non-empty")
    expect(isValid(vl)).toBe(false)
  })

  it("accepts a field whose issues have all been cleared", () => {
    const set = setFieldIssue(clean(), "name", ValidationType.SCHEMA, "name must be non-empty")
    const cleared = setFieldIssue(set, "name", ValidationType.SCHEMA, undefined)
    expect(isValid(cleared)).toBe(true)
  })

  it("keeps one issue type when another is cleared", () => {
    const both = setFieldIssue(
      setFieldIssue(clean(), "name", ValidationType.SCHEMA, "too short"),
      "name",
      "NON_UNIQUE",
      "already in use",
    )
    const withoutSchema = setFieldIssue(both, "name", ValidationType.SCHEMA, undefined)

    expect(withoutSchema.name?.NON_UNIQUE?.message).toBe("already in use")
    expect(withoutSchema.name?.[ValidationType.SCHEMA]).toBeUndefined()
    expect(isValid(withoutSchema)).toBe(false)
  })
})

describe("setFieldIssue", () => {
  it("carries the payload the UI navigates with", () => {
    const vl = setFieldIssue(clean(), "name", "NON_UNIQUE", "already in use", 42)
    expect(vl.name?.NON_UNIQUE?.payload).toBe(42)
  })

  it("does not mutate the model it was given", () => {
    const before = clean()
    setFieldIssue(before, "name", ValidationType.SCHEMA, "too short")
    expect(before.name).toBeUndefined()
  })
})

describe("schemaIssues", () => {
  it("reports nothing for a value the schema accepts", () => {
    expect(schemaIssues(personSchema, { name: "Ada", age: 36, address: { city: "London" } }))
      .toEqual({})
  })

  it("keys an issue by the field it belongs to", () => {
    const issues = schemaIssues(personSchema, { name: "Ada", age: "old", address: { city: "L" } })
    expect(issues.age?.[ValidationType.SCHEMA]?.message).toContain("age must be a number")
  })

  it("reports a nested failure against its top-level field", () => {
    const issues = schemaIssues(personSchema, { name: "Ada", age: 36, address: { city: 5 } })
    expect(issues.address?.[ValidationType.SCHEMA]?.message).toContain("address.city")
  })

  it("joins several issues on one field into one message", () => {
    const issues = schemaIssues(personSchema, { name: "", age: 36, address: { city: "L" } })
    expect(issues.name?.[ValidationType.SCHEMA]?.message).toContain("name must be non-empty")
  })
})

describe("validateSchema", () => {
  it("clears the issue of a field that now passes", () => {
    const invalid = validateSchema(
      personSchema,
      { name: "", age: 36, address: { city: "L" } },
      clean(),
    )
    expect(isValid(invalid)).toBe(false)

    const fixed = validateSchema(
      personSchema,
      { name: "Ada", age: 36, address: { city: "L" } },
      invalid,
    )
    expect(isValid(fixed)).toBe(true)
  })

  it("leaves an application's own issue types alone", () => {
    const withDomainIssue = setFieldIssue(clean(), "name", "NON_UNIQUE", "already in use")
    const validated = validateSchema(
      personSchema,
      { name: "Ada", age: 36, address: { city: "L" } },
      withDomainIssue,
    )

    expect(validated.name?.NON_UNIQUE?.message).toBe("already in use")
    expect(validated.name?.[ValidationType.SCHEMA]).toBeUndefined()
  })
})

describe("sameValidation", () => {
  it("compares by issue, not by object identity", () => {
    const a = setFieldIssue(clean(), "name", ValidationType.SCHEMA, "too short")
    const b = setFieldIssue(clean(), "name", ValidationType.SCHEMA, "too short")
    expect(sameValidation(a, b)).toBe(true)
  })

  it("ignores the order the fields were added in", () => {
    const a = setFieldIssue(
      setFieldIssue(clean(), "name", "NON_UNIQUE", "x"),
      "age",
      "NON_UNIQUE",
      "y",
    )
    const b = setFieldIssue(
      setFieldIssue(clean(), "age", "NON_UNIQUE", "y"),
      "name",
      "NON_UNIQUE",
      "x",
    )
    expect(sameValidation(a, b)).toBe(true)
  })

  it("separates an empty model from one with an issue", () => {
    expect(sameValidation(clean(), setFieldIssue(clean(), "age", "NON_UNIQUE", "y"))).toBe(false)
  })
})
