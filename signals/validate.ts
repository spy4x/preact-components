import { type ArkErrors, Type, type } from "arktype"
import {
  type ConnectionError,
  ErrType,
  type ResponseError,
  type StoreError,
  type ValidationError,
  type ValidationIssues,
} from "./types.ts"

/** Value a schema produces after parsing (morphs applied). */
export type SchemaOutput<T extends Type> = T["infer"]

/** Value a schema accepts as input, before parsing. */
export type SchemaInput<T extends Type> = T["inferIn"]

/** Outcome of {@link validate}: the parsed value, or the issues that rejected it. */
export type ValidationResult<T extends Type> =
  | { error: ValidationError; data: null }
  | { error: null; data: SchemaOutput<T> }

/**
 * Parse `value` with an arktype schema exactly once.
 *
 * Returns `{ data }` on success and `{ error }` on failure, so a caller can
 * branch without a try/catch. The error carries arktype's issues flattened by
 * field path, ready to render next to form inputs.
 *
 * @example
 * ```ts
 * const { error, data } = validate(userSchema, input)
 * if (error) return error.errors.name?.[0]?.message
 * ```
 */
export function validate<T extends Type>(schema: T, value: unknown): ValidationResult<T> {
  const result = schema(value)
  if (result instanceof type.errors) {
    return { error: toValidationError(result), data: null }
  }
  return { error: null, data: result }
}

/**
 * Build a {@link ValidationError} from arktype's issues.
 *
 * Every issue is filed under its dotted path (`"body.lower"` for nested data),
 * so a form can look up its own field and ignore the rest. Duplicate paths are
 * already merged by arktype.
 */
export function toValidationError(issues: ArkErrors): ValidationError {
  const errors: ValidationIssues = {}
  for (const [path, list] of Object.entries(issues.flatByPath)) {
    errors[path] = list.map((issue) => ({
      code: issue.code,
      path,
      message: issue.problem,
    }))
  }
  return {
    type: ErrType.VALIDATION,
    message: "Provided data doesn't seem valid. Check the form validation error messages.",
    errors,
  }
}

/** Wrap a message the caller already has into a {@link ConnectionError}. */
export function connectionError(message: string): ConnectionError {
  return { type: ErrType.CONNECTION, message }
}

/**
 * First issue message in a validation error, in field order.
 *
 * Useful when a whole batch is rejected and only one line of copy is available.
 * Returns `null` when the error carries no issues.
 */
export function firstIssueMessage(error: ValidationError): string | null {
  for (const issues of Object.values(error.errors)) {
    const first = issues?.[0]
    if (first) return first.message
  }
  return null
}

/**
 * Turn a failed response into a structured error.
 *
 * A status of `0` is `Response.error()` — the request never left — and becomes a
 * {@link ConnectionError}. Anything else becomes a server error carrying
 * the server's own message when the body holds one (`{"error": "..."}` or
 * `{"message": "..."}`), falling back to the status text. Reading the body
 * consumes it, which is fine: the caller has already decided the response failed.
 */
export async function responseError(response: Response): Promise<ResponseError> {
  const { status, statusText } = response
  if (status === 0) {
    return connectionError(
      "There seems to be a problem with connection to the server. Check your internet connection.",
    )
  }
  return {
    type: ErrType.SERVER,
    status,
    message: await readErrorMessage(response) || statusText || `HTTP ${status}`,
  }
}

/**
 * Whether an error should stay quiet.
 *
 * Connection failures and server crashes are reported once by the transport or
 * the global error surface, so per-operation toasts for them would only add
 * noise. Validation failures and ordinary server rejections are always shown.
 */
export function isSilentError(error: StoreError): boolean {
  return error.type === ErrType.CONNECTION ||
    (error.type === ErrType.SERVER && error.status === 500)
}

/** Body-derived message, or `null` when the body is absent, unparseable or empty. */
async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json()
    if (typeof body === "string") return body || null
    if (body && typeof body === "object") {
      for (const key of ["error", "message", "detail"]) {
        const value = (body as Record<string, unknown>)[key]
        if (typeof value === "string" && value) return value
      }
    }
    return null
  } catch {
    return null
  }
}
