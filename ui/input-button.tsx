import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX, Ref, VNode } from "preact"
import { forwardRef } from "./forward-ref.ts"

/**
 * An input with an icon button positioned inside it — the `.btn-input-icon` pattern.
 *
 * A separate export rather than a slot on `Input`, for two reasons. The pattern is not a property of
 * an input: it is a layout, and it needs two wrappers (a positioned box and the button's container)
 * plus right padding reserved on the input, none of which `Input` should carry for the callers that
 * do not want it. And `Input`'s contract is deliberately "a native input, verbatim"; a slot would put
 * a button inside every consumer's markup decision, including the ones that need the input to stay a
 * bare element. A caller wanting the slot behaviour composes it in three lines from `Input` and
 * `Button variant="icon"`, which is the escape hatch.
 *
 * The button is a sibling of the input, not its parent, so clicking it never focuses or activates the
 * input and it keeps its own tab stop. `type` defaults to `"button"` so the trailing button does not
 * submit the form the input belongs to.
 */
export interface InputButtonProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class" | "onClick"> {
  /** Plain utilities. Narrowed from Preact's `Signalish<string>`: this package never renders a signal in `class`. */
  class?: string
  /** Utilities on the positioned wrapper. */
  wrapperClass?: string
  /** Icon or text of the trailing button. */
  icon: ComponentChildren
  /** Accessible name of the button. Required: an icon-only button has no other name. */
  iconLabel: string
  /**
   * Replaces the input's right padding when the button is wider than one icon. Defaults to `pr-12`.
   */
  iconMarginClass?: string
  /** Click handler of the trailing button — the input keeps its own events from `rest`. */
  onClick?: JSX.MouseEventHandler<HTMLButtonElement>
  /** Disables the input *and* the trailing button: half a disabled control is a footgun. */
  disabled?: boolean
  /** Tooltip of the button. Falls back to `iconLabel`. */
  title?: string
}

/**
 * Render the input, the button and the chrome that positions them.
 *
 * Controlled like {@link Input}: `value` in, `onInput`/`onChange` out.
 *
 * Wrapped in `forwardRef` from `./forward-ref.ts` (see that file for why): the `ref` goes to the
 * native `<input>`, not the wrapper or the button, because the input is what a form focuses.
 */
export const InputButton: (
  props: InputButtonProps & { ref?: Ref<HTMLInputElement> },
) => VNode | null = forwardRef<HTMLInputElement, InputButtonProps>(
  "InputButton",
  function InputButton(
    {
      class: className,
      wrapperClass,
      icon,
      iconLabel,
      iconMarginClass,
      onClick,
      disabled,
      title,
      ...rest
    },
    ref,
  ) {
    return (
      <div class={cn("relative", wrapperClass)}>
        <input
          {...rest}
          ref={ref}
          disabled={disabled}
          class={cn("pc-input", iconMarginClass ?? "pr-12", className)}
        />
        <div class="absolute top-1.5 right-1.5">
          <button
            type="button"
            class="btn-input-icon"
            title={title ?? iconLabel}
            aria-label={iconLabel}
            disabled={disabled}
            onClick={onClick}
          >
            {icon}
          </button>
        </div>
      </div>
    )
  },
)
