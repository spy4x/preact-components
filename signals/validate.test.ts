import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type } from "arktype"
import {
  connectionError,
  firstIssueMessage,
  isSilentError,
  responseError,
  toValidationError,
  validate,
} from "./validate.ts"
import { ErrType } from "./types.ts"

const dateSchema = type("Date | string.date.iso.parse")
const userSchema = type({
  name: "1 <= string <= 10",
  joinedAt: dateSchema,
  address: { city: "string" },
})

describe("validate", () => {
  it("returns parsed data for a valid value", () => {
    const { error, data } = validate(userSchema, {
      name: "Ada",
      joinedAt: "2024-01-01T00:00:00.000Z",
      address: { city: "Berlin" },
    })
    expect(error).toBeNull()
    expect(data?.joinedAt).toBeInstanceOf(Date)
    expect(data?.address.city).toBe("Berlin")
  })

  it("returns null data and field issues for an invalid value", () => {
    const { error, data } = validate(userSchema, { name: "", joinedAt: "nope", address: {} })
    expect(data).toBeNull()
    if (error?.type !== ErrType.VALIDATION) throw new Error("expected a validation error")
    expect(Object.keys(error.errors).sort()).toEqual(["address.city", "joinedAt", "name"])
    expect(error.errors.name?.[0].code).toBe("minLength")
    expect(error.errors["address.city"]?.[0].path).toBe("address.city")
  })

  it("keys nested issues by dotted path", () => {
    const { error } = validate(userSchema, { name: "Ada", joinedAt: new Date(), address: {} })
    if (error?.type !== ErrType.VALIDATION) throw new Error("expected a validation error")
    expect(error.errors["address.city"]?.[0].message).toContain("string")
    expect(error.errors.name).toBeUndefined()
  })

  it("does not parse a valid value twice", () => {
    let calls = 0
    const schema = type({ n: "string" }).pipe((value) => {
      calls++
      return { n: Number(value.n) }
    })
    const { error, data } = validate(schema, { n: "42" })
    expect(error).toBeNull()
    expect(data?.n).toBe(42)
    expect(calls).toBe(1)
  })

  it("parses once on the failure path", () => {
    // The bug this guards is a source application's `safeParse` twice, and it only parsed twice
    // when the value was
    // rejected: the second call sat inside the `else` of the first. A counter on the success path
    // cannot see that, so the schema here rejects one field while a sibling's morph counts — arktype
    // still runs the sibling morph, which makes the count observable on the failure path.
    let calls = 0
    const schema = type({
      n: type("string").pipe((value) => {
        calls++
        return value
      }),
      bad: "number",
    })
    const { error, data } = validate(schema, { n: "42", bad: "not a number" })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(calls).toBe(1)
  })

  it("carries the canonical validation message", () => {
    const { error } = validate(userSchema, null)
    expect(error?.message).toBe(
      "Provided data doesn't seem valid. Check the form validation error messages.",
    )
  })
})

describe("toValidationError", () => {
  it("files an issue per path with its code and a field-local message", () => {
    const result = userSchema({ name: 5, joinedAt: new Date(), address: { city: "x" } })
    if (!(result instanceof type.errors)) throw new Error("expected errors")
    const error = toValidationError(result)
    expect(error.type).toBe(ErrType.VALIDATION)
    expect(error.errors.name?.[0].code).toBe("domain")
    expect(error.errors.name?.[0].message).not.toContain("name must")
  })
})

describe("firstIssueMessage", () => {
  it("returns the first issue it finds", () => {
    const { error } = validate(userSchema, { name: "", joinedAt: "nope", address: {} })
    if (error?.type !== ErrType.VALIDATION) throw new Error("expected a validation error")
    const firstPath = Object.keys(error.errors)[0]
    expect(firstIssueMessage(error)).toBe(error.errors[firstPath]?.[0].message)
    expect(firstIssueMessage(error)).toBeTruthy()
  })

  it("returns null when there are no issues", () => {
    expect(
      firstIssueMessage({
        type: ErrType.VALIDATION,
        message: "Provided data doesn't seem valid. Check the form validation error messages.",
        errors: {},
      }),
    ).toBeNull()
  })
})

describe("connectionError", () => {
  it("tags a message as a connection failure", () => {
    expect(connectionError("offline")).toEqual({ type: ErrType.CONNECTION, message: "offline" })
  })
})

describe("responseError", () => {
  it("reports a status-0 response as a connection failure", async () => {
    const error = await responseError(Response.error())
    expect(error.type).toBe(ErrType.CONNECTION)
    expect(error.message).toContain("problem with connection to the server")
  })

  it("reads the server's own message out of an error body", async () => {
    const error = await responseError(
      Response.json({ error: "name taken" }, { status: 409, statusText: "Conflict" }),
    )
    expect(error.type).toBe(ErrType.SERVER)
    expect(error.message).toBe("name taken")
    if (error.type !== ErrType.SERVER) throw new Error("expected a server error")
    expect(error.status).toBe(409)
  })

  it("accepts a message field too", async () => {
    const error = await responseError(Response.json({ message: "nope" }, { status: 422 }))
    expect(error.message).toBe("nope")
  })

  it("falls back to the status text when the body is not JSON", async () => {
    const error = await responseError(
      new Response("<html>oops</html>", { status: 502, statusText: "Bad Gateway" }),
    )
    expect(error.message).toBe("Bad Gateway")
  })

  it("falls back to the status code when there is no text either", async () => {
    const error = await responseError(new Response(null, { status: 503 }))
    expect(error.message).toBe("HTTP 503")
  })
})

describe("isSilentError", () => {
  it("stays quiet for connection failures and server crashes", () => {
    expect(isSilentError(connectionError("offline"))).toBe(true)
    expect(
      isSilentError({ type: ErrType.SERVER, status: 500, message: "boom" }),
    ).toBe(true)
  })

  it("speaks up for ordinary rejections and validation failures", () => {
    expect(isSilentError({ type: ErrType.SERVER, status: 409, message: "taken" })).toBe(false)
    expect(isSilentError({ type: ErrType.PAYLOAD, message: "malformed" })).toBe(false)
    expect(
      isSilentError({
        type: ErrType.VALIDATION,
        message: "Provided data doesn't seem valid. Check the form validation error messages.",
        errors: {},
      }),
    ).toBe(false)
  })
})
