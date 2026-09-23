import { Button } from "./button.tsx"
import type { ComponentChildren, JSX } from "preact"

export interface GeoCoordinates {
  latitude: number
  longitude: number
}

export interface GeoButtonProps {
  /** Receives the resolved coordinates. */
  onLocation: (position: GeoCoordinates) => void
  /** Receives a human-readable failure reason. */
  onError?: (message: string) => void
  /** Button content. Defaults to `"Use my geolocation"`. */
  children?: ComponentChildren
  /** Tooltip. Defaults to `"Use my geolocation"`; override it when `children` says something else. */
  title?: string
  class?: string
}

/**
 * Ask the browser for the current position and route the result to a port.
 *
 * Split out of the component so the wiring is testable with a fake `Geolocation`: the success
 * callback maps `coords` to {@link GeoCoordinates}, and every failure — unsupported browser,
 * denied permission, timeout — becomes one `onError` message.
 *
 * @param onLocation Called with the resolved coordinates.
 * @param onError Called with a human-readable failure reason; a no-op by default.
 * @param geolocation Geolocation port; defaults to the global `navigator.geolocation`.
 */
export function requestGeolocation(
  onLocation: (position: GeoCoordinates) => void,
  onError: (message: string) => void = () => {},
  geolocation: Geolocation | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.geolocation,
): void {
  if (!geolocation) {
    onError("Geolocation is not supported by this browser")
    return
  }

  geolocation.getCurrentPosition(
    (position) =>
      onLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
    () => onError("Cannot get geolocation"),
  )
}

/**
 * Button that resolves the browser's current position into a callback.
 *
 * The source component wrote into a `Signal` it was handed and pushed toasts through the app's
 * toast store. Both are ports here: `onLocation` for the value, `onError` for the message.
 * `navigator` is read inside the handler, so the component server-renders.
 */
export function GeoButton(
  { onLocation, onError, children, title = "Use my geolocation", class: className }: GeoButtonProps,
): JSX.Element {
  const handleClick = () => requestGeolocation(onLocation, onError)

  return (
    <Button
      variant="outline"
      class={className}
      title={title}
      onClick={handleClick}
    >
      <svg
        class="-ml-1 size-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
      <span>{children ?? "Use my geolocation"}</span>
    </Button>
  )
}
