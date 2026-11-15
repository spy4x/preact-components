import { join } from "@spy4x/preact-cn/join"
import { IconEye, IconEyeOff } from "@spy4x/preact-icons"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { Button } from "./button.tsx"
import { useLabels } from "./i18n.tsx"
import { Input, type InputProps } from "./input.tsx"

/** The words of a {@link PasswordInput}: the toggle's name in each state. */
export interface PasswordInputLabels {
  /** The toggle's name while the password is hidden. */
  show: string
  /** The toggle's name while the password is shown. */
  hide: string
}

/** The English defaults of {@link PasswordInputLabels}. */
export const defaultPasswordInputLabels: PasswordInputLabels = {
  show: "Show password",
  hide: "Hide password",
}

/**
 * What {@link PasswordInput} takes: every native input attribute but `type`, which the toggle owns,
 * so `name`, `autocomplete`, `required`, `id`, `aria-describedby` and `data-e2e` reach the
 * `<input>`, and a `Field` around it wires the label and messages to the input.
 */
export interface PasswordInputProps extends Omit<InputProps, "type"> {
  labels?: Partial<PasswordInputLabels>
  /** Stamps `data-e2e` on the show/hide toggle. */
  toggleDataE2E?: string
}

/**
 * A password field with an eye button that shows and hides what was typed.
 *
 * The button sits beside the input, not in it, has `type="button"` so it never submits the form,
 * and reports its state with `aria-pressed` and a name that follows it. The box and its button stay
 * left to right on a right-to-left page, because a password is typed left to right either way.
 *
 * @param props See {@link PasswordInputProps}.
 */
export function PasswordInput(
  { labels, toggleDataE2E, class: className, ...rest }: PasswordInputProps,
): JSX.Element {
  const text = useLabels("PasswordInput", defaultPasswordInputLabels, labels)
  const shown = useSignal(false)
  return (
    <div class="relative" dir="ltr">
      <Input
        {...rest}
        type={shown.value ? "text" : "password"}
        class={join("pe-12", className)}
      />
      {
        /* An icon-only toggle, 32 px square at 4 px from the edge, so the field's `pe-12` (48 px)
          keeps a shown password clear of it; a word-sized button needed more room than any step
          on the spacing scale. */
      }
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-pressed={shown.value}
        aria-label={shown.value ? text.hide : text.show}
        class="absolute top-1/2 end-1 -translate-y-1/2"
        data-e2e={toggleDataE2E}
        onClick={(event) => {
          // Keeps the toggle itself the Tab stop after the type swap re-renders it, rather than
          // leaving the browser's own click-focus behaviour to decide — that behaviour is not the
          // same in every engine.
          event.currentTarget.focus()
          shown.value = !shown.value
        }}
      >
        {shown.value ? <IconEyeOff class="size-5" /> : <IconEye class="size-5" />}
      </Button>
    </div>
  )
}
