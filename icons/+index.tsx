/**
 * Merged icon set — every glyph the library ships, deduped by SVG body.
 *
 * Merged by hand from six apps and kept as plain source afterwards, one function per glyph. Six
 * style families are mixed; see README.md's "Style families" and "Provenance" for both.
 *
 * https://github.com/spy4x/preact-components/issues/2 (merge)
 * https://github.com/spy4x/preact-components/issues/15 (remaining icons)
 * https://github.com/spy4x/preact-components/issues/10 (FOSS replacement / provenance)
 */

import type { JSX } from "preact"

/**
 * Common prop surface for every icon.
 *
 * Without `aria-label` or `title` the icon is decorative and hidden from screen readers. With
 * either, it becomes a labelled image that a screen reader announces.
 */
export interface IconProps {
  /** Tailwind classes; replaces the icon's default size. */
  class?: string
  /** Accessible name; makes the icon a labelled image instead of a hidden decoration. */
  "aria-label"?: string
  /** Rendered as the SVG's `<title>` (a name and a hover tooltip); also makes the icon labelled. */
  title?: string
}

/** The accessibility attributes an icon's root `<svg>` carries. */
interface IconA11yAttributes {
  "aria-hidden"?: "true"
  "aria-label"?: string
  role?: "img"
}

/**
 * Accessibility attributes for an icon's root `<svg>`: hidden when the caller gives no name, a
 * labelled image (`role="img"`) when it passes `aria-label` or `title`.
 */
function iconA11y(props: IconProps): IconA11yAttributes {
  const label = props["aria-label"]
  if (!label && !props.title) return { "aria-hidden": "true" }
  return label ? { role: "img", "aria-label": label } : { role: "img" }
}

/** The `<title>` child for an icon given a `title`, or nothing. */
function iconTitle(props: IconProps): JSX.Element | null {
  return props.title ? <title>{props.title}</title> : null
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconAlertTriangle(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  )
}

/** Lucide outline (stroke-2); matches Lucide's "archive" exactly, not Heroicons. */
export function IconArchive(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconArrowDown(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconArrowDownTray(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconArrowLeft(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconArrowPath(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconArrowRight(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconArrowUp(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  )
}

/** Feather outline (stroke 1.75) · matches Feather's "arrow-up-right" exactly. */
export function IconArrowUpRight(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconArrowUturnLeft(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconArrowUturnRight(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3"
      />
    </svg>
  )
}

/** Feather outline (stroke-2); matches Feather's "at-sign" exactly, not Heroicons. */
export function IconAtSign(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconBars3(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconBell(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconBookOpen(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "bookmark" from heroicons@1.0.6 (#233). */
export function IconBookmark(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-2); matches Heroicons v2's "briefcase" exactly, not v1. */
export function IconBriefcase(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "office-building" from heroicons@1.0.6 (#233). */
export function IconBuilding(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconBuildingOffice2(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"
      />
    </svg>
  )
}

/** Feather outline (stroke-2); matches Feather's "calendar" exactly, not Heroicons. */
export function IconCalendar(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconCalendarDays(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconChartPie(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "chat-alt" from heroicons@1.0.6 (#233). */
export function IconChatBubble(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconCheck(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconCheckCircle(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconChevronDown(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
      />
    </svg>
  )
}

/** Lucide outline (stroke-2); matches Lucide's "chevron-left" exactly, not Heroicons. */
export function IconChevronLeft(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

/** Lucide outline (stroke-2); matches Lucide's "chevron-right" exactly, not Heroicons. */
export function IconChevronRight(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "chip" from heroicons@1.0.6 (#233). */
export function IconChip(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
      />
    </svg>
  )
}

/** Lucide outline (stroke-2) · "circle-dot" from lucide-static@1.47.0 (#233). */
export function IconCircleDot(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconClipboard(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconClipboardCopy(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-2); matches Heroicons v2's "clock" exactly, not v1. */
export function IconClock(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

/** Feather outline (stroke-2); matches Feather's "code" exactly, not Heroicons. */
export function IconCode(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconCog6Tooth(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconCpuChip(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "credit-card" from heroicons@1.0.6 (#233). */
export function IconCreditCard(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconCursorArrowRays(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · "document" from heroicons@2.2.0 (#233). */
export function IconDocument(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-2); matches Heroicons v2's "currency-dollar" exactly, not v1. */
export function IconDollar(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconEllipsisVertical(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
      />
    </svg>
  )
}

/** Feather outline (stroke 1.75) · matches Feather's "external-link" exactly. */
export function IconExternal(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconEye(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconEyeOff(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 0 1 1.563-3.029m5.858.908a3 3 0 1 1 4.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0 1 12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 0 1-4.132 5.411m0 0L21 21"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · "fire" from heroicons@2.2.0 (#233). */
export function IconFire(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "flag" from heroicons@1.0.6 (#233). */
export function IconFlag(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "beaker" from heroicons@1.0.6 (#233). */
export function IconFlask(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconFolder(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconFunnel(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
      />
    </svg>
  )
}

/** Lucide outline (stroke-2) · "router" from lucide-static@1.47.0 (#233). */
export function IconGateway(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <rect width="20" height="8" x="2" y="14" rx="2" />
      <path d="M6.01 18H6" />
      <path d="M10.01 18H10" />
      <path d="M15 10v4" />
      <path d="M17.84 7.17a4 4 0 0 0-5.66 0" />
      <path d="M20.66 4.34a8 8 0 0 0-11.31 0" />
    </svg>
  )
}

/** Brand mark (trademarked), filled · "github" from simple-icons@16.33.0 (#233). */
export function IconGitHub(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "globe-alt" from heroicons@1.0.6 (#233). */
export function IconGlobe(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-2); matches Heroicons v2's "squares-2x2" exactly, not v1. */
export function IconGrid(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconHandThumbUp(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconHome(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "photograph" from heroicons@1.0.6 (#233). */
export function IconImage(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconInformationCircle(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-2); matches Heroicons v2's "key" exactly, not v1. */
export function IconKey(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "zoom-in" from heroicons@1.0.6 (#233). */
export function IconLens(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconLightBulb(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
      />
    </svg>
  )
}

/** Feather/Lucide outline (stroke 1.75) · matches both packs' "link" exactly. */
export function IconLink(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

/**
 * Brand mark (trademarked), Feather outline (stroke-2) · "linkedin" from feather-icons@4.29.2
 * (#233). Simple Icons, the source of the other brand marks, no longer ships LinkedIn's.
 */
export function IconLinkedIn(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

/** Feather outline (stroke 1.75) · matches Feather's "list" exactly. */
export function IconList(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

/** Lucide outline (stroke-2) · "loader" from lucide-static@1.47.0 (#233). */
export function IconLoading(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`animate-spin shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconLocationMarker(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

/** Feather outline (stroke 1.75) · matches Feather's "log-out" exactly. */
export function IconLogout(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-2); matches Heroicons v2's "envelope" exactly, not v1. */
export function IconMail(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconMap(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke 1.8); matches Heroicons v2's and Lucide's "minus" exactly. */
export function IconMinus(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M5 12h14" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · "moon" from heroicons@2.2.0 (#233). */
export function IconMoon(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "cube" from heroicons@1.0.6 (#233). */
export function IconPackage(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconPencilSquare(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconPlus(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  )
}

/** Lucide outline (stroke-2) · "quote" from lucide-static@1.47.0 (#233). */
export function IconQuote(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
      <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · "rocket-launch" from heroicons@2.2.0 (#233). */
export function IconRocket(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconSearch(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "status-online" from heroicons@1.0.6 (#233). */
export function IconSensor(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"
      />
    </svg>
  )
}

/** Feather outline (stroke-2); matches Feather's and Lucide's "server" exactly, not Heroicons. */
export function IconServer(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  )
}

/** Feather outline (stroke 1.75) · matches Feather's "share" exactly. */
export function IconShare(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconShieldCheck(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · "sparkles" from heroicons@1.0.6 (#233). */
export function IconSparkle(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  )
}

/** Lucide outline (stroke 2.5); matches Lucide's "loader-circle"/"loader-2" exactly. */
export function IconSpinner(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      {...iconA11y(props)}
      class={`animate-spin shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

/** Feather outline (stroke-2); matches Feather's "star" exactly, not Heroicons. */
export function IconStar(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconSun(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    </svg>
  )
}

/** Feather outline (stroke 1.75) · matches Feather's "tag" exactly. */
export function IconTag(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

/** Lucide outline (stroke-2) · "target" from lucide-static@1.47.0 (#233). */
export function IconTarget(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

/** Brand mark (trademarked), filled · "telegram" from simple-icons@16.33.0 (#233). */
export function IconTelegram(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

/** Lucide outline (stroke-2) · "contrast" from lucide-static@1.47.0 (#233). */
export function IconThemeAuto(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <circle cx="12" cy="12" r="10" />
      <path d="M12 18a6 6 0 0 0 0-12v12z" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconTrashBin(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconTrendingDown(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M13 17h8m0 0V9m0 8-8-8-4 4-6-6"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconTrendingUp(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M13 7h8m0 0v8m0-8-8 8-4-4-6 6"
      />
    </svg>
  )
}

/** Brand mark (trademarked), filled · "x" from simple-icons@16.33.0 (#233). */
export function IconTwitter(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  )
}

/** Brand mark (trademarked), filled · "upwork" from simple-icons@16.33.0 (#233). */
export function IconUpwork(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "h-5 w-auto"}`}
    >
      {iconTitle(props)}
      <path d="M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-1.076.008-.042c.207-1.143.849-3.06 2.839-3.06 1.492 0 2.703 1.212 2.703 2.703-.001 1.489-1.212 2.702-2.704 2.702zm0-8.14c-2.539 0-4.51 1.649-5.31 4.366-1.22-1.834-2.148-4.036-2.687-5.892H7.828v7.112c-.002 1.406-1.141 2.546-2.547 2.548-1.405-.002-2.543-1.143-2.545-2.548V3.492H0v7.112c0 2.914 2.37 5.303 5.281 5.303 2.913 0 5.283-2.389 5.283-5.303v-1.19c.529 1.107 1.182 2.229 1.974 3.221l-1.673 7.873h2.797l1.213-5.71c1.063.679 2.285 1.109 3.686 1.109 3 0 5.439-2.452 5.439-5.45 0-3-2.439-5.439-5.439-5.439z" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconUser(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconUsers(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · "video-camera" from heroicons@2.2.0 (#233). */
export function IconVideo(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5); matches Heroicons v2's "view-columns" exactly, not v1. */
export function IconViewColumns(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z"
      />
    </svg>
  )
}

/** Lucide outline (stroke-2); matches Lucide's "wallet" exactly, not Heroicons. */
export function IconWallet(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · "wrench" from heroicons@2.2.0 (#233). */
export function IconWrench(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4.867 19.125h.008v.008h-.008v-.008Z"
      />
    </svg>
  )
}

/** Heroicons v2 outline (stroke-1.5) · from template. */
export function IconXMark(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  )
}

/** Brand mark (trademarked), filled · "youtube" from simple-icons@16.33.0 (#233). */
export function IconYouTube(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

/** Feather outline (stroke 1.75) · matches Feather's "zap" exactly. */
export function IconZap(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconArrowsPointingOut(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconCloudArrowUp(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. The source's default was `h-6 w-6`. */
export function IconSuccess(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-6"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconDocumentDuplicate(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconDocumentText(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconDownload(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  )
}

/**
 * Heroicons v1 outline (stroke-2) · from a source application, redrawn as "external-link" from
 * heroicons@1.0.6 (#233).
 */
export function IconExternalLink(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconFilm(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconLockClosed(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  )
}

/** Heroicons v1 solid · from a source application; matches Heroicons v1's "lock-closed" exactly, not v2. */
export function IconLockClosedFilled(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconLockOpen(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconMicrophone(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconPlayCircle(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

/** Heroicons v2 outline, filled · from a source application. Not the v2 solid "play" — the `d` matches v2's
 *  *outline* "play" exactly, rendered with a fill instead of a stroke. The source hard-coded red;
 *  `currentColor` is kept so the caller picks the colour, as every other glyph in this set does. */
export function IconPlaySolid(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconRefresh(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconSmile(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconStopCircle(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
      />
    </svg>
  )
}

/** Heroicons v1 outline (stroke-2) · from a source application. */
export function IconVideoCamera(props: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...iconA11y(props)}
      class={`shrink-0 ${props.class || "size-5"}`}
    >
      {iconTitle(props)}
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}
