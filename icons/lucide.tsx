// Not exported from the package as such: the Lucide drawings of the category set, reached only
// through `registry.tsx`'s `ICONS`. Several share a name with a glyph of another family in the main
// entry (`IconCreditCard` is Heroicons v1's, `IconTag` Feather's), so they are named after their
// pack here and never exported as `Icon*`: the main entry stays as it is, and a picker drawing from
// the registry cannot mix families. Each is Lucide's own drawing at stroke 2; `provenance.ts` reads
// this file next to `+index.tsx`.
import type { JSX } from "preact"
import type { IconProps } from "./+index.tsx"
import { svgIcon } from "./glyph.tsx"

/** Lucide outline (stroke-2); matches Lucide's "house" (lucide-static@1.47.0) exactly. */
export function LucideHouse(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />,
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "zap" (lucide-static@1.47.0) exactly. */
export function LucideZap(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "flame" (lucide-static@1.47.0) exactly. */
export function LucideFlame(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "droplet" (lucide-static@1.47.0) exactly. */
export function LucideDroplet(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "wifi" (lucide-static@1.47.0) exactly. */
export function LucideWifi(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M12 20h.01" />,
    <path d="M2 8.82a15 15 0 0 1 20 0" />,
    <path d="M5 12.859a10 10 0 0 1 14 0" />,
    <path d="M8.5 16.429a5 5 0 0 1 7 0" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "smartphone" (lucide-static@1.47.0) exactly. */
export function LucideSmartphone(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />,
    <path d="M12 18h.01" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "receipt" (lucide-static@1.47.0) exactly. */
export function LucideReceipt(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M12 17V7" />,
    <path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" />,
    <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "repeat" (lucide-static@1.47.0) exactly. */
export function LucideRepeat(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="m17 2 4 4-4 4" />,
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />,
    <path d="m7 22-4-4 4-4" />,
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "wrench" (lucide-static@1.47.0) exactly. */
export function LucideWrench(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "shopping-cart" (lucide-static@1.47.0) exactly. */
export function LucideShoppingCart(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18" />,
    <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25" />,
    <circle cx="18" cy="20" r="2" />,
    <circle cx="8" cy="20" r="2" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "utensils" (lucide-static@1.47.0) exactly. */
export function LucideUtensils(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />,
    <path d="M7 2v20" />,
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "coffee" (lucide-static@1.47.0) exactly. */
export function LucideCoffee(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M10 2v2" />,
    <path d="M14 2v2" />,
    <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />,
    <path d="M6 2v2" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "car" (lucide-static@1.47.0) exactly. */
export function LucideCar(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />,
    <circle cx="7" cy="17" r="2" />,
    <path d="M9 17h6" />,
    <circle cx="17" cy="17" r="2" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "fuel" (lucide-static@1.47.0) exactly. */
export function LucideFuel(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" />,
    <path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" />,
    <path d="M2 21h13" />,
    <path d="M3 9h11" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "bus" (lucide-static@1.47.0) exactly. */
export function LucideBus(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M8 6v6" />,
    <path d="M15 6v6" />,
    <path d="M2 12h19.6" />,
    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />,
    <circle cx="7" cy="18" r="2" />,
    <path d="M9 18h5" />,
    <circle cx="16" cy="18" r="2" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "plane" (lucide-static@1.47.0) exactly. */
export function LucidePlane(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "bed" (lucide-static@1.47.0) exactly. */
export function LucideBed(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M2 4v16" />,
    <path d="M2 8h18a2 2 0 0 1 2 2v10" />,
    <path d="M2 17h20" />,
    <path d="M6 8v9" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "shopping-bag" (lucide-static@1.47.0) exactly. */
export function LucideShoppingBag(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M16 10a4 4 0 0 1-8 0" />,
    <path d="M3.103 6.034h17.794" />,
    <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "shirt" (lucide-static@1.47.0) exactly. */
export function LucideShirt(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "scissors" (lucide-static@1.47.0) exactly. */
export function LucideScissors(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <circle cx="6" cy="6" r="3" />,
    <path d="M8.12 8.12 12 12" />,
    <path d="M20 4 8.12 15.88" />,
    <circle cx="6" cy="18" r="3" />,
    <path d="M14.8 14.8 20 20" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "gift" (lucide-static@1.47.0) exactly. */
export function LucideGift(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M12 7v14" />,
    <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />,
    <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" />,
    <rect x="3" y="7" width="18" height="4" rx="1" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "heart-pulse" (lucide-static@1.47.0) exactly. */
export function LucideHeartPulse(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />,
    <path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "pill" (lucide-static@1.47.0) exactly. */
export function LucidePill(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />,
    <path d="m8.5 8.5 7 7" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "dumbbell" (lucide-static@1.47.0) exactly. */
export function LucideDumbbell(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" />,
    <path d="m2.5 21.5 1.4-1.4" />,
    <path d="m20.1 3.9 1.4-1.4" />,
    <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />,
    <path d="m9.6 14.4 4.8-4.8" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "baby" (lucide-static@1.47.0) exactly. */
export function LucideBaby(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />,
    <path d="M15 12h.01" />,
    <path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />,
    <path d="M9 12h.01" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "paw-print" (lucide-static@1.47.0) exactly. */
export function LucidePawPrint(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <circle cx="11" cy="4" r="2" />,
    <circle cx="18" cy="8" r="2" />,
    <circle cx="20" cy="16" r="2" />,
    <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "graduation-cap" (lucide-static@1.47.0) exactly. */
export function LucideGraduationCap(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />,
    <path d="M22 10v6" />,
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "film" (lucide-static@1.47.0) exactly. */
export function LucideFilm(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <rect width="18" height="18" x="3" y="3" rx="2" />,
    <path d="M7 3v18" />,
    <path d="M3 7.5h4" />,
    <path d="M3 12h18" />,
    <path d="M3 16.5h4" />,
    <path d="M17 3v18" />,
    <path d="M17 7.5h4" />,
    <path d="M17 16.5h4" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "gamepad-2" (lucide-static@1.47.0) exactly. */
export function LucideGamepad2(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <line x1="6" x2="10" y1="11" y2="11" />,
    <line x1="8" x2="8" y1="9" y2="13" />,
    <line x1="15" x2="15.01" y1="12" y2="12" />,
    <line x1="18" x2="18.01" y1="10" y2="10" />,
    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "banknote" (lucide-static@1.47.0) exactly. */
export function LucideBanknote(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <rect width="20" height="12" x="2" y="6" rx="2" />,
    <circle cx="12" cy="12" r="2" />,
    <path d="M6 12h.01M18 12h.01" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "briefcase" (lucide-static@1.47.0) exactly. */
export function LucideBriefcase(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />,
    <rect width="20" height="14" x="2" y="6" rx="2" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "credit-card" (lucide-static@1.47.0) exactly. */
export function LucideCreditCard(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <rect width="20" height="14" x="2" y="5" rx="2" />,
    <line x1="2" x2="22" y1="10" y2="10" />,
    <path d="M6 14h2" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "piggy-bank" (lucide-static@1.47.0) exactly. */
export function LucidePiggyBank(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" />,
    <path d="M16 10h.01" />,
    <path d="M2 8v1a2 2 0 0 0 2 2h1" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "trending-up" (lucide-static@1.47.0) exactly. */
export function LucideTrendingUp(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M16 7h6v6" />,
    <path d="m22 7-8.5 8.5-5-5L2 17" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "landmark" (lucide-static@1.47.0) exactly. */
export function LucideLandmark(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M10 18v-7" />,
    <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" />,
    <path d="M14 18v-7" />,
    <path d="M18 18v-7" />,
    <path d="M3 22h18" />,
    <path d="M6 18v-7" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "hand-coins" (lucide-static@1.47.0) exactly. */
export function LucideHandCoins(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />,
    <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />,
    <path d="m2 16 6 6" />,
    <circle cx="16" cy="9" r="2.9" />,
    <circle cx="6" cy="5" r="3" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "shield-check" (lucide-static@1.47.0) exactly. */
export function LucideShieldCheck(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />,
    <path d="m9 12 2 2 4-4" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "hand-heart" (lucide-static@1.47.0) exactly. */
export function LucideHandHeart(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" />,
    <path d="m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95" />,
    <path d="m2 15 6 6" />,
    <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "tag" (lucide-static@1.47.0) exactly. */
export function LucideTag(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />,
    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />,
  )
}

/** Lucide outline (stroke-2); matches Lucide's "circle-ellipsis" (lucide-static@1.47.0) exactly. */
export function LucideCircleEllipsis(props: IconProps): JSX.Element {
  return svgIcon(
    props,
    { stroke: "2", round: true },
    <circle cx="12" cy="12" r="10" />,
    <path d="M17 12h.01" />,
    <path d="M12 12h.01" />,
    <path d="M7 12h.01" />,
  )
}
