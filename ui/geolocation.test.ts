import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { requestGeolocation } from "./geolocation.ts"

describe("requestGeolocation", () => {
  it("maps a resolved position onto the coordinates port", () => {
    const positions: Array<{ latitude: number; longitude: number }> = []

    requestGeolocation(
      (position) => positions.push(position),
      () => {},
      fakeGeolocation((success) =>
        success({
          coords: { latitude: 52.52, longitude: 13.405 },
          timestamp: 0,
        } as GeolocationPosition)
      ),
    )

    expect(positions).toEqual([{ latitude: 52.52, longitude: 13.405 }])
  })

  it("reports a denied permission as one readable message", () => {
    const errors: string[] = []

    requestGeolocation(
      () => {},
      (message) => errors.push(message),
      fakeGeolocation((_success, failure) => failure?.({} as GeolocationPositionError)),
    )

    expect(errors).toEqual(["Cannot get geolocation"])
  })

  it("reports an unsupported browser instead of throwing", () => {
    const errors: string[] = []

    requestGeolocation(() => {}, (message) => errors.push(message), undefined)

    expect(errors).toEqual(["Geolocation is not supported by this browser"])
  })

  it("stays silent when no error port is injected", () => {
    expect(() => requestGeolocation(() => {}, undefined, undefined)).not.toThrow()
  })
})

function fakeGeolocation(
  resolve: (
    success: (position: GeolocationPosition) => void,
    failure?: (error: GeolocationPositionError) => void,
  ) => void,
): Geolocation {
  return {
    getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback) =>
      resolve(success, failure),
    watchPosition: () => 0,
    clearWatch: () => {},
  } as unknown as Geolocation
}
