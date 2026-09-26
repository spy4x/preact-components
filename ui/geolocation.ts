export interface GeoCoordinates {
  latitude: number
  longitude: number
}

/**
 * Ask the browser for the current position and route the result to a port.
 *
 * Testable with a fake `Geolocation`: the success callback maps `coords` to
 * {@link GeoCoordinates}, and every failure — unsupported browser, denied permission, timeout —
 * becomes one `onError` message. `navigator` is read only when it is called, so an app can call it
 * from any event handler of its own `Button`.
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
