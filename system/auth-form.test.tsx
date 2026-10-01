import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { AuthForm, type AuthFormProps } from "./auth-form.tsx"

const base: AuthFormProps = {
  mode: "sign-in",
  step: "credentials",
}

/**
 * The `<input>` tag carrying this `name`, or `""`.
 *
 * `Field`'s two wiring paths put `id` in different places in the attribute list — cloned onto the
 * end for a plain element child, written first for a function child that places it itself — so a
 * test reading an attribute has to find the whole tag first rather than assume one attribute comes
 * before another.
 */
function inputTag(html: string, name: string): string {
  return [...html.matchAll(/<input[^>]*>/g)].find((match) => match[0].includes(`name="${name}"`))
    ?.[0] ?? ""
}

/** The opening tag of the element carrying `data-e2e="auth-form-mode-switch"`, or `""`. */
function modeSwitchTag(html: string): string {
  return html.match(/<[a-z]+ [^>]*data-e2e="auth-form-mode-switch"[^>]*>/)?.[0] ?? ""
}

const hrefs = { "sign-in": "/sign-in", "sign-up": "/sign-up" }

/** One attribute's value off an already-extracted tag, or `undefined`. */
function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1]
}

/** The submit `<button>`'s opening tag, or `""`. */
function submitButtonTag(html: string): string {
  return [...html.matchAll(/<button[^>]*>/g)].find((match) => match[0].includes('type="submit"'))
    ?.[0] ?? ""
}

/**
 * Whether a tag carries a real `disabled` attribute.
 *
 * `Button`'s own class list spells out `disabled:pointer-events-none disabled:opacity-50` — a
 * Tailwind variant, not the attribute — on every button whether or not it is disabled, so a naive
 * substring search reads a button that is not disabled as one that is. Stripping `class="…"` first
 * is what keeps this reading the attribute rather than the stylesheet.
 */
function hasDisabledAttr(tag: string): boolean {
  return /(?:^|\s)disabled(?:\s|=|\/|>|$)/.test(tag.replace(/\sclass="[^"]*"/, ""))
}

describe("AuthForm", () => {
  it("renders a real form with a login and a password field in the credentials step", () => {
    const html = render(<AuthForm {...base} />)
    expect(html).toContain("<form")
    expect(html).toMatch(/<input[^>]*name="login"[^>]*autocomplete="username"/)
    expect(html).toMatch(/<input[^>]*name="password"[^>]*type="password"/)
    expect(html).not.toContain('name="code"')
  })

  it("labels every field with a real <label for>, so a password manager can match them", () => {
    const html = render(<AuthForm {...base} />)
    const loginId = attr(inputTag(html, "login"), "id")
    const passwordId = attr(inputTag(html, "password"), "id")
    expect(loginId).toBeTruthy()
    expect(passwordId).toBeTruthy()
    expect(html).toContain(`for="${loginId}"`)
    expect(html).toContain(`for="${passwordId}"`)
  })

  it("marks both fields required, on the control as well as on Field (#116)", () => {
    const html = render(<AuthForm {...base} />)
    expect(html).toMatch(/<input[^>]*name="login"[^>]*required/)
    expect(html).toMatch(/<input[^>]*name="password"[^>]*required/)
    // Field's own visible marker for `required`.
    expect(html.match(/text-red-700 dark:text-red-300">\*/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("uses current-password in sign-in mode and new-password in sign-up mode", () => {
    const signIn = render(<AuthForm {...base} mode="sign-in" />)
    const signUp = render(<AuthForm {...base} mode="sign-up" />)
    expect(signIn).toMatch(/name="password"[^>]*autocomplete="current-password"/)
    expect(signUp).toMatch(/name="password"[^>]*autocomplete="new-password"/)
  })

  it("switches the submit label with mode", () => {
    expect(render(<AuthForm {...base} mode="sign-in" />)).toContain(">Sign in<")
    expect(render(<AuthForm {...base} mode="sign-up" />)).toContain(">Sign up<")
  })

  it("without modeHrefs, shows the mode switch as a button only when onModeChange is supplied", () => {
    const withPort = render(<AuthForm {...base} onModeChange={() => {}} />)
    const withoutPort = render(<AuthForm {...base} />)
    expect(modeSwitchTag(withPort)).toMatch(/^<button /)
    expect(attr(modeSwitchTag(withPort), "type")).toBe("button")
    expect(withPort).toContain("Need an account? Sign up")
    expect(withPort).not.toContain("<a")
    expect(withoutPort).not.toContain("Need an account? Sign up")
  })

  it("with modeHrefs, renders the mode switch as a link to the other mode's page", () => {
    const signIn = render(<AuthForm {...base} modeHrefs={hrefs} onModeChange={() => {}} />)
    const signUp = render(<AuthForm {...base} mode="sign-up" modeHrefs={hrefs} />)
    expect(modeSwitchTag(signIn)).toMatch(/^<a /)
    expect(attr(modeSwitchTag(signIn), "href")).toBe("/sign-up")
    expect(attr(modeSwitchTag(signUp), "href")).toBe("/sign-in")
    expect(signUp).toContain("Have an account? Sign in")
  })

  it("with modeHrefs, renders the mode-switch link even without onModeChange", () => {
    const html = render(<AuthForm {...base} modeHrefs={hrefs} />)
    expect(attr(modeSwitchTag(html), "href")).toBe("/sign-up")
    expect(html).toContain("Need an account? Sign up")
  })

  it("draws the mode-switch link with the same classes as the mode-switch button", () => {
    const button = render(<AuthForm {...base} onModeChange={() => {}} />)
    const link = render(<AuthForm {...base} modeHrefs={hrefs} onModeChange={() => {}} />)
    expect(attr(modeSwitchTag(link), "class")).toBe(attr(modeSwitchTag(button), "class"))
  })

  it("renders the one-time-code field with the right autocomplete and inputmode", () => {
    const html = render(<AuthForm {...base} step="one-time-code" />)
    expect(html).toMatch(/<input[^>]*name="code"[^>]*autocomplete="one-time-code"/)
    expect(html).toMatch(/<input[^>]*name="code"[^>]*inputmode="numeric"/)
    expect(html).not.toContain('name="login"')
    expect(html).not.toContain('name="password"')
    expect(html).toContain("Enter the code you were sent.")
  })

  it("renders an empty, always-present alert region when there is no error", () => {
    const html = render(<AuthForm {...base} />)
    expect(html).toMatch(/<div role="alert" aria-live="assertive" aria-atomic="true"><\/div>/)
  })

  it("puts a form-level error, given as a plain string, in the alert region", () => {
    const html = render(<AuthForm {...base} error="Wrong login or password" />)
    expect(html).toMatch(
      /<div role="alert" aria-live="assertive" aria-atomic="true"><p[^>]*>Wrong login or password<\/p><\/div>/,
    )
    expect(html).not.toContain("aria-invalid")
  })

  it("links a field-level error to its field, and marks the field aria-invalid", () => {
    const html = render(
      <AuthForm {...base} error={{ message: "No account with that login", field: "login" }} />,
    )
    // In the always-present region, for the same reason a form-level one is.
    expect(html).toContain("No account with that login")
    // And on the field itself: Field's own message, plus aria-invalid on the control.
    expect(html).toMatch(/<input[^>]*name="login"[^>]*aria-invalid="true"/)
    expect(html).not.toMatch(/<input[^>]*name="password"[^>]*aria-invalid/)
  })

  it("marks the password field aria-invalid for a password-named error, and no other field", () => {
    const html = render(
      <AuthForm {...base} error={{ message: "That password is too short", field: "password" }} />,
    )
    expect(attr(inputTag(html, "password"), "aria-invalid")).toBe("true")
    expect(attr(inputTag(html, "login"), "aria-invalid")).toBeUndefined()
  })

  it("marks the code field aria-invalid for a code-named error, and no other field", () => {
    const html = render(
      <AuthForm
        {...base}
        step="one-time-code"
        error={{ message: "That code has expired", field: "code" }}
      />,
    )
    expect(attr(inputTag(html, "code"), "aria-invalid")).toBe("true")
  })

  it("treats an empty string error the same as no error", () => {
    const html = render(<AuthForm {...base} error="" />)
    expect(html).toMatch(/<div role="alert" aria-live="assertive" aria-atomic="true"><\/div>/)
  })

  it("disables the submit button and carries the busy label off-screen while busy", () => {
    const idle = render(<AuthForm {...base} />)
    const busy = render(<AuthForm {...base} busy />)
    expect(hasDisabledAttr(submitButtonTag(idle))).toBe(false)
    expect(hasDisabledAttr(submitButtonTag(busy))).toBe(true)
    expect(idle).toMatch(/class="sr-only">\s*<\/p>/)
    expect(busy).toContain("Working…")
  })

  it("accepts a partial labels override, keeping the rest of the defaults", () => {
    const html = render(<AuthForm {...base} labels={{ signIn: "Log in" }} />)
    expect(html).toContain(">Log in<")
    expect(html).toContain("Email or username") // the default, not overridden
  })

  it("renames the credentials inputs from a partial names override, keeping the other default", () => {
    const html = render(<AuthForm {...base} names={{ login: "username" }} />)
    expect(attr(inputTag(html, "username"), "autocomplete")).toBe("username")
    expect(attr(inputTag(html, "password"), "type")).toBe("password")
    expect(html).not.toContain('name="login"')
  })

  it("renames the one-time-code input from a names override", () => {
    const html = render(<AuthForm {...base} step="one-time-code" names={{ code: "otp" }} />)
    expect(attr(inputTag(html, "otp"), "autocomplete")).toBe("one-time-code")
    expect(html).not.toContain('name="code"')
  })

  it('renders method="post" whether or not action is given', () => {
    const withAction = render(<AuthForm {...base} action="/auth/sign-in" />)
    const withoutAction = render(<AuthForm {...base} />)
    expect(withAction).toContain('action="/auth/sign-in"')
    expect(withAction).toContain('method="post"')
    expect(withoutAction).not.toContain("action=")
    expect(withoutAction).toContain('method="post"')
  })

  it("ignores a stray method prop from a plain-JS caller: there is nowhere for it to go", () => {
    // `AuthFormProps` carries no `method` field, so this is only reachable without the type —
    // exactly the caller the old runtime guard existed for. There is no `...rest` spread onto
    // <form> either, so the value is never read at all, not merely overridden.
    const strayProps = { ...base, method: "get" } as unknown as AuthFormProps
    const html = render(<AuthForm {...strayProps} />)
    expect(html).toContain('method="post"')
    expect(html).not.toContain('method="get"')
  })

  it("names the form after the current mode or step, for two forms on one page", () => {
    expect(render(<AuthForm {...base} mode="sign-up" />)).toContain('aria-label="Sign up"')
    expect(render(<AuthForm {...base} step="one-time-code" />)).toContain(
      'aria-label="Verify code"',
    )
  })

  it("gives two instances on the same page different field ids", () => {
    // Both in one tree, the way two cards on one guide page or two forms in one modal flow would
    // sit: `useId()` is scoped to the render tree, so two independent `render()` calls are not a
    // test of this at all — each would restart the id sequence and collide by coincidence.
    const html = render(
      <>
        <AuthForm {...base} />
        <AuthForm {...base} />
      </>,
    )
    const ids = [...html.matchAll(/name="login"[^>]*id="([^"]+)"/g)].map((match) => match[1])
    expect(ids.length).toBe(2)
    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })

  it("renders the toggle as an eye icon named by its label, inside the field's padding", () => {
    const html = render(<AuthForm {...base} />)
    const toggle = /<button[^>]*aria-pressed="false"[^>]*>(.*?)<\/button>/.exec(html)
    expect(toggle?.[0]).toContain('aria-label="Show password"')
    expect(toggle?.[1]).toMatch(/^<svg/)
    expect(toggle?.[1]).not.toContain("Show password")
    expect(toggle?.[0]).toContain("size-8")
    expect(inputTag(html, "password")).toContain("pr-12")
  })

  it("takes the toggle's accessible name from a labels override", () => {
    const html = render(<AuthForm {...base} labels={{ showPassword: "Passwort zeigen" }} />)
    expect(html).toContain('aria-label="Passwort zeigen"')
  })

  it("puts a fixed data-e2e on every credentials control, whatever the labels say", () => {
    const html = render(
      <AuthForm {...base} onModeChange={() => {}} labels={{ login: "Benutzer" }} />,
    )
    expect(attr(inputTag(html, "login"), "data-e2e")).toBe("auth-form-login")
    expect(attr(inputTag(html, "password"), "data-e2e")).toBe("auth-form-password")
    expect(attr(submitButtonTag(html), "data-e2e")).toBe("auth-form-submit")
    const hooks = [...html.matchAll(/data-e2e="([^"]+)"/g)].map((match) => match[1])
    expect(hooks).toEqual([
      "auth-form",
      "auth-form-login",
      "auth-form-password",
      "auth-form-password-toggle",
      "auth-form-submit",
      "auth-form-mode-switch",
    ])
  })

  it("puts a fixed data-e2e on the one-time-code field and its submit button", () => {
    const html = render(<AuthForm {...base} step="one-time-code" />)
    expect(attr(inputTag(html, "code"), "data-e2e")).toBe("auth-form-code")
    expect(attr(submitButtonTag(html), "data-e2e")).toBe("auth-form-submit")
  })

  it("never renders a show/hide toggle that could submit the form", () => {
    const html = render(<AuthForm {...base} />)
    expect(html).toMatch(
      /aria-pressed="false"[^>]*type="button"|type="button"[^>]*aria-pressed="false"/,
    )
  })

  it("renders the caller's footer inside the form, after its submit and mode switch", () => {
    for (const step of ["credentials", "one-time-code"] as const) {
      const html = render(
        <AuthForm
          {...base}
          step={step}
          onModeChange={() => {}}
          footer={<a href="/sign-in">Back to sign in</a>}
        />,
      )
      const footer = html.indexOf('<div data-e2e="auth-form-footer"><a href="/sign-in">')
      expect(footer).toBeGreaterThan(html.indexOf('data-e2e="auth-form-submit"'))
      expect(footer).toBeGreaterThan(html.indexOf('data-e2e="auth-form-mode-switch"'))
      expect(footer).toBeLessThan(html.indexOf("</form>"))
      expect(html).toContain("Back to sign in")
    }
  })

  it("renders no footer wrapper when the caller gives no footer", () => {
    expect(render(<AuthForm {...base} />)).not.toContain("auth-form-footer")
    expect(render(<AuthForm {...base} footer={null} />)).not.toContain("auth-form-footer")
  })
})
