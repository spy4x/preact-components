import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { IconAlertTriangle } from "@spy4x/preact-icons"
import { render } from "preact-render-to-string"
import {
  BillingInterval,
  PlanCard,
  type PricingPlan,
  PricingTable,
  SubscriptionStatus,
  UpgradePrompt,
} from "./billing.tsx"

/** Another package's enums with the same values, the way `@spy4x/billing` would declare its own. */
enum ForeignStatus {
  Trialing = 1,
  Active = 2,
  PastDue = 3,
  Canceled = 4,
  Incomplete = 5,
}
enum ForeignInterval {
  Month = 1,
  Year = 2,
}

const free: PricingPlan = { id: "free", name: "Free", amount: 0, currency: "EUR" }
const proMonth: PricingPlan = {
  id: "pro-month",
  name: "Pro",
  amount: 1200,
  currency: "EUR",
  interval: BillingInterval.Month,
  features: ["Unlimited projects", "Priority support"],
  highlighted: true,
}
const proYear: PricingPlan = {
  id: "pro-year",
  name: "Pro",
  amount: 12000,
  currency: "EUR",
  interval: BillingInterval.Year,
}

/** The markup of one plan's `<li>`, found by its `data-plan` attribute. */
function planItem(html: string, id: string): string {
  const start = html.indexOf(`data-plan="${id}"`)
  if (start === -1) throw new Error(`no plan ${id} in the markup`)
  const open = html.lastIndexOf("<li", start)
  return html.slice(open, html.indexOf("</form>", start))
}

/** The class attribute of the element that carries `data-plan="<id>"`. */
function planClass(html: string, id: string): string {
  const item = planItem(html, id)
  return item.match(/class="([^"]*)"/)?.[1] ?? ""
}

describe("PricingTable", () => {
  it("posts each plan's ID in its own form, so a choice works with no script", () => {
    const html = render(<PricingTable plans={[free, proMonth]} />)

    for (const id of ["free", "pro-month"]) {
      const item = planItem(html, id)
      expect(item).toContain('<form method="post"')
      expect(item).toContain(`<input type="hidden" name="planId" value="${id}"/>`)
      expect(item).toContain('type="submit"')
    }
    expect(html).not.toContain("action=")
  })

  it("posts to the caller's action under the caller's field name", () => {
    const html = render(<PricingTable plans={[proMonth]} action="/checkout" fieldName="plan" />)

    expect(html).toContain('action="/checkout"')
    expect(html).toContain('<input type="hidden" name="plan" value="pro-month"/>')
  })

  it("formats each price from its smallest unit and names its interval", () => {
    const html = render(<PricingTable plans={[free, proMonth, proYear]} />)

    expect(planItem(html, "pro-month")).toContain("€12.00")
    expect(planItem(html, "pro-month")).toContain("per month")
    expect(planItem(html, "pro-year")).toContain("€120.00")
    expect(planItem(html, "pro-year")).toContain("per year")
    expect(planItem(html, "free")).toContain("€0.00")
    expect(planItem(html, "free")).not.toContain("per ")
  })

  it("names each plan's button after the plan", () => {
    const html = render(<PricingTable plans={[free, proMonth]} />)

    expect(planItem(html, "free")).toContain('aria-label="Choose Free"')
    expect(planItem(html, "pro-month")).toContain('aria-label="Choose Pro"')
  })

  it("labels the highlighted plan in words and draws its border in the selected colour", () => {
    const html = render(<PricingTable plans={[free, proMonth]} />)

    expect(planItem(html, "pro-month")).toContain("Most popular")
    expect(planItem(html, "free")).not.toContain("Most popular")
    expect(planClass(html, "pro-month")).toContain("border-selected")
    expect(planClass(html, "free")).not.toContain("border-selected")
  })

  it("puts the highlighted label after the plan's heading, where heading navigation reaches it", () => {
    const item = planItem(render(<PricingTable plans={[proMonth]} />), "pro-month")

    expect(item.indexOf("</h3>")).toBeGreaterThan(-1)
    expect(item.indexOf("Most popular")).toBeGreaterThan(item.indexOf("</h3>"))
  })

  it("marks the checked interval with a check icon and bolder text, not by its fill alone", () => {
    const html = render(<PricingTable plans={[proMonth, proYear]} />)

    expect(html.match(/hidden size-4 group-has-\[:checked\]\/option:block/g)?.length).toBe(2)
    expect(html.match(/has-\[:checked\]:font-semibold/g)?.length).toBe(2)
  })

  it("draws no interval toggle when the plans have one interval", () => {
    const html = render(<PricingTable plans={[free, proMonth]} />)

    expect(html).not.toContain('type="radio"')
    expect(html).not.toContain("group-has-")
  })

  it("draws a monthly/yearly radio pair with monthly checked when the plans have both", () => {
    const html = render(<PricingTable plans={[free, proMonth, proYear]} />)

    expect(html).toContain('<legend class="sr-only">Billing period</legend>')
    expect(html.match(/type="radio"/g)?.length).toBe(2)
    expect(html).toMatch(/value="month" data-pricing-interval="month" checked/)
    expect(html).not.toMatch(/value="year" data-pricing-interval="year" checked/)
    expect(html).toContain("Monthly")
    expect(html).toContain("Yearly")
  })

  it("checks the caller's default interval", () => {
    const html = render(
      <PricingTable plans={[proMonth, proYear]} defaultInterval={BillingInterval.Year} />,
    )

    expect(html).toMatch(/value="year" data-pricing-interval="year" checked/)
    expect(html).not.toMatch(/value="month" data-pricing-interval="month" checked/)
  })

  it("hides each plan while the other interval is checked, and never a plan with no interval", () => {
    const html = render(<PricingTable plans={[free, proMonth, proYear]} />)

    expect(planClass(html, "pro-month")).toContain(
      "group-has-[[data-pricing-interval=year]:checked]/pricing:hidden",
    )
    expect(planClass(html, "pro-year")).toContain(
      "group-has-[[data-pricing-interval=month]:checked]/pricing:hidden",
    )
    expect(planClass(html, "free")).not.toContain("group-has-")
  })

  it("gives two tables on one page separate radio groups", () => {
    const html = render(
      <div>
        <PricingTable plans={[proMonth, proYear]} />
        <PricingTable plans={[proMonth, proYear]} />
      </div>,
    )
    const names = [...html.matchAll(/type="radio" class="sr-only" name="([^"]+)"/g)].map((m) =>
      m[1]
    )

    expect(names.length).toBe(4)
    expect(new Set(names).size).toBe(2)
  })

  it("replaces any word through labels", () => {
    const html = render(
      <PricingTable
        plans={[proMonth, proYear]}
        locale="de"
        labels={{
          intervals: { [BillingInterval.Month]: "Monatlich", [BillingInterval.Year]: "Jährlich" },
          per: { [BillingInterval.Month]: "pro Monat", [BillingInterval.Year]: "pro Jahr" },
          highlighted: "Beliebt",
          choose: "Wählen",
          chooseName: (name) => `${name} wählen`,
          intervalLegend: "Abrechnung",
        }}
      />,
    )

    for (const word of ["Monatlich", "Jährlich", "pro Monat", "Beliebt", "Wählen", "Abrechnung"]) {
      expect(html).toContain(word)
    }
    expect(html).toContain('aria-label="Pro wählen"')
    expect(html).toContain("12,00")
    expect(html).not.toContain("Most popular")
  })

  it("merges a partial interval label over the English defaults", () => {
    const html = render(
      <PricingTable plans={[proMonth, proYear]} labels={{ intervals: { 2: "Annual" } }} />,
    )

    expect(html).toContain("Monthly")
    expect(html).toContain("Annual")
    expect(html).not.toContain("Yearly")
  })

  it("names each button from a translated choose when chooseName is left out", () => {
    const html = render(<PricingTable plans={[proMonth]} labels={{ choose: "Wählen" }} />)

    expect(html).toContain('aria-label="Wählen Pro"')
    expect(html).not.toContain("Choose")
  })

  it("accepts a same-valued interval enum from another package without a cast", () => {
    const html = render(
      <PricingTable
        plans={[{ ...proMonth, interval: ForeignInterval.Month }, {
          ...proYear,
          interval: ForeignInterval.Year,
        }]}
        defaultInterval={ForeignInterval.Year}
      />,
    )

    expect(html).toMatch(/value="year" data-pricing-interval="year" checked/)
  })

  it("says what one price buys after it, with its interval", () => {
    const html = render(
      <PricingTable plans={[{ ...proMonth, unit: "member" }, { ...proYear, unit: "member" }]} />,
    )

    expect(planItem(html, "pro-month")).toContain(
      '€12.00</span><span class="text-sm text-muted">per member / month</span>',
    )
    expect(planItem(html, "pro-year")).toContain(">per member / year</span>")
  })

  it("says what one price buys with no interval when the plan has none", () => {
    const item = planItem(render(<PricingTable plans={[{ ...free, unit: "seat" }]} />), "free")

    expect(item).toContain(">per seat</span>")
  })

  it("renders a plan with no unit exactly as before, beside one with a unit", () => {
    const before = render(<PricingTable plans={[proMonth, proYear]} />)
    const after = render(<PricingTable plans={[{ ...proMonth, unit: "member" }, proYear]} />)

    expect(planItem(after, "pro-year")).toBe(planItem(before, "pro-year"))
    expect(planItem(after, "pro-year")).toContain(">per year</span>")
  })

  it("words the per-unit text with a translated perUnit label", () => {
    const html = render(
      <PricingTable
        plans={[{ ...proMonth, unit: "Mitglied" }]}
        labels={{
          perUnit: (unit, interval) => `pro ${unit} und ${interval === 1 ? "Monat" : "Jahr"}`,
        }}
      />,
    )

    expect(planItem(html, "pro-month")).toContain(">pro Mitglied und Monat</span>")
    expect(html).not.toContain("per Mitglied")
  })

  it("falls back to the English per-unit text when a translation leaves it undefined", () => {
    const html = render(
      <PricingTable plans={[{ ...proMonth, unit: "member" }]} labels={{ perUnit: undefined }} />,
    )

    expect(planItem(html, "pro-month")).toContain(">per member / month</span>")
  })

  it("levels each plan's name heading as asked", () => {
    expect(render(<PricingTable plans={[free]} />)).toContain("<h3")
    expect(render(<PricingTable plans={[free]} headingLevel={2} />)).toContain("<h2")
  })
})

/** 23:30 UTC on 31 October 2026: already 1 November east of UTC. */
const periodEnd = new Date(Date.UTC(2026, 9, 31, 23, 30))

describe("PlanCard", () => {
  const base = { planName: "Pro", manageAction: "/billing/portal", periodEnd }
  const warningIcon = render(<IconAlertTriangle class="size-5 text-warning" />)

  it("posts Manage billing to the caller's action", () => {
    const html = render(<PlanCard {...base} status={SubscriptionStatus.Active} />)

    expect(html).toContain('<form method="post" action="/billing/portal"')
    expect(html).toMatch(/type="submit"[^>]*>Manage billing</)
  })

  it("shows the renewal date of an active plan, in UTC by default", () => {
    const html = render(<PlanCard {...base} status={SubscriptionStatus.Active} />)

    expect(html).toContain("Active")
    expect(html).toContain("Renews on October 31, 2026")
    expect(html).not.toContain("data-plan-warning")
  })

  it("shows the date in the caller's time zone", () => {
    const html = render(
      <PlanCard {...base} status={SubscriptionStatus.Active} timeZone="Asia/Tokyo" />,
    )

    expect(html).toContain("Renews on November 1, 2026")
  })

  it("says an active plan set to stop ends rather than renews", () => {
    const html = render(<PlanCard {...base} status={SubscriptionStatus.Active} cancelAtPeriodEnd />)

    expect(html).toContain("Ends on October 31, 2026")
    expect(html).not.toContain("Renews")
  })

  it("shows when a trial ends", () => {
    const html = render(<PlanCard {...base} status={SubscriptionStatus.Trialing} />)

    expect(html).toContain("Trial")
    expect(html).toContain("Trial ends on October 31, 2026")
  })

  it("shows when a canceled plan ended", () => {
    const html = render(<PlanCard {...base} status={SubscriptionStatus.Canceled} />)

    expect(html).toContain("Canceled")
    expect(html).toContain("Ended on October 31, 2026")
  })

  it("warns about a past-due plan in words beside a warning icon", () => {
    const html = render(<PlanCard {...base} status={SubscriptionStatus.PastDue} />)

    expect(html).toContain("Past due")
    expect(html).toContain("data-plan-warning")
    expect(html).toContain("Your last payment failed.")
    expect(html).toContain(warningIcon)
    expect(html).not.toContain("Renews on")
  })

  it("warns about an incomplete plan in words beside a warning icon", () => {
    const html = render(<PlanCard {...base} status={SubscriptionStatus.Incomplete} />)

    expect(html).toContain("Incomplete")
    expect(html).toContain("Your first payment has not gone through.")
    expect(html).toContain(warningIcon)
  })

  it("shows no payment warning for a trial, active, ending or canceled plan", () => {
    for (
      const status of [
        SubscriptionStatus.Trialing,
        SubscriptionStatus.Active,
        SubscriptionStatus.Canceled,
      ]
    ) {
      for (const cancelAtPeriodEnd of [false, true]) {
        const html = render(
          <PlanCard {...base} status={status} cancelAtPeriodEnd={cancelAtPeriodEnd} />,
        )
        expect(html).not.toContain("data-plan-warning")
        expect(html).not.toContain(warningIcon)
      }
    }
  })

  it("draws the warning's border in the warning colour token", () => {
    const html = render(<PlanCard {...base} status={SubscriptionStatus.PastDue} />)

    expect(html).toMatch(/data-plan-warning[^>]*\bborder-warning\b/)
  })

  it("accepts a same-valued status enum from another package without a cast", () => {
    const html = render(
      <PlanCard
        {...base}
        status={ForeignStatus.PastDue}
        price={{ amount: 1200, currency: "EUR", interval: ForeignInterval.Month }}
      />,
    )

    expect(html).toContain("Past due")
    expect(html).toContain("per month")
  })

  it("merges a partial status label over the English defaults", () => {
    const labels = { status: { [SubscriptionStatus.PastDue]: "Überfällig" } }

    expect(render(<PlanCard {...base} status={SubscriptionStatus.PastDue} labels={labels} />))
      .toContain("Überfällig")
    expect(render(<PlanCard {...base} status={SubscriptionStatus.Active} labels={labels} />))
      .toContain(">Active<")
  })

  it("shows no empty pill for a status it has no word for", () => {
    const html = render(<PlanCard {...base} status={6 as SubscriptionStatus} />)

    expect(html).toContain("Pro")
    expect(html).not.toMatch(/<span[^>]*><\/span>/)
  })

  it("shows the price with its interval when given", () => {
    const html = render(
      <PlanCard
        {...base}
        status={SubscriptionStatus.Active}
        price={{ amount: 12000, currency: "EUR", interval: BillingInterval.Year }}
      />,
    )

    expect(html).toContain("€120.00")
    expect(html).toContain("per year")
  })

  it("shows no date line without a period end", () => {
    const html = render(
      <PlanCard planName="Pro" manageAction="/p" status={SubscriptionStatus.Active} />,
    )

    expect(html).not.toContain("Renews")
  })

  it("replaces any word through labels, and formats the date in the caller's locale", () => {
    const html = render(
      <PlanCard
        {...base}
        status={SubscriptionStatus.PastDue}
        locale="de"
        labels={{
          status: {
            [SubscriptionStatus.Trialing]: "Testphase",
            [SubscriptionStatus.Active]: "Aktiv",
            [SubscriptionStatus.PastDue]: "Überfällig",
            [SubscriptionStatus.Canceled]: "Gekündigt",
            [SubscriptionStatus.Incomplete]: "Unvollständig",
          },
          pastDue: "Zahlung fehlgeschlagen.",
          manage: "Abrechnung verwalten",
        }}
      />,
    )

    expect(html).toContain("Überfällig")
    expect(html).toContain("Zahlung fehlgeschlagen.")
    expect(html).toContain("Abrechnung verwalten")
    expect(render(
      <PlanCard
        {...base}
        status={SubscriptionStatus.Active}
        locale="de"
        labels={{ renews: (date) => `Verlängert am ${date}` }}
      />,
    )).toContain("Verlängert am 31. Oktober 2026")
  })
})

describe("UpgradePrompt", () => {
  it("links to the caller's href with an English default message", () => {
    const html = render(<UpgradePrompt href="/pricing" />)

    expect(html).toContain('href="/pricing"')
    expect(html).toContain("Upgrade to use this feature")
    expect(html).toContain("Your plan does not include this feature.")
    expect(html).toMatch(/<a [^>]*>See plans<\/a>/)
  })

  it("draws no box of its own, so it sits inside a card without a box in a box", () => {
    const root = render(<UpgradePrompt href="/pricing" />).match(/^<div class="([^"]*)"/)?.[1]

    expect(root).toBeDefined()
    expect(root).not.toMatch(/\b(border|bg|p|px|py|rounded)(-|\b)/)
  })

  it("frames itself with the caller's class", () => {
    const html = render(<UpgradePrompt href="/pricing" class="rounded-md border p-4" />)

    expect(html).toMatch(/^<div class="[^"]*rounded-md border p-4"/)
  })

  it("keeps the real href when a router port is given", () => {
    const html = render(<UpgradePrompt href="/pricing" navigate={() => {}} />)

    expect(html).toContain('href="/pricing"')
  })

  it("replaces any word through labels, and levels its heading as asked", () => {
    const html = render(
      <UpgradePrompt
        href="/preise"
        headingLevel={3}
        labels={{ title: "Upgrade nötig", message: "Exporte gibt es ab Pro.", action: "Pläne" }}
      />,
    )

    expect(html).toContain("<h3")
    expect(html).toContain("Upgrade nötig")
    expect(html).toContain("Exporte gibt es ab Pro.")
    expect(html).toMatch(/<a [^>]*>Pläne<\/a>/)
  })
})
