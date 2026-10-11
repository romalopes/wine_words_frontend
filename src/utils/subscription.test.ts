import { isFreeSubscriptionName, isPaidSubscriber } from "./subscription";
import type { User } from "../types/authentication";

function makeUser(subscriptionName: string | null): User {
  return {
    id: 1,
    email: "taster@example.com",
    display_name: "Taster",
    first_name: "Tas",
    last_name: "Ter",
    roles: ["Reader"],
    analytics_opt_out: false,
    subscription: subscriptionName ? { id: 2, name: subscriptionName } : null,
    billing_provider: null,
    can_manage_billing: true,
    subscription_status: null,
    subscription_change: null,
  };
}

describe("isFreeSubscriptionName", () => {
  it("matches FREE regardless of case and whitespace", () => {
    expect(isFreeSubscriptionName("FREE")).toBe(true);
    expect(isFreeSubscriptionName("free")).toBe(true);
    expect(isFreeSubscriptionName("  Free ")).toBe(true);
  });

  it("treats paid names, null and empty as not free", () => {
    expect(isFreeSubscriptionName("Consumer")).toBe(false);
    expect(isFreeSubscriptionName(null)).toBe(false);
    expect(isFreeSubscriptionName(undefined)).toBe(false);
    expect(isFreeSubscriptionName("")).toBe(false);
  });
});

describe("isPaidSubscriber", () => {
  it("is false for logged-out visitors", () => {
    expect(isPaidSubscriber(null)).toBe(false);
    expect(isPaidSubscriber(undefined)).toBe(false);
  });

  it("is false for FREE and null-subscription accounts", () => {
    expect(isPaidSubscriber(makeUser("FREE"))).toBe(false);
    expect(isPaidSubscriber(makeUser(null))).toBe(false);
  });

  it("is true for paid plan holders", () => {
    expect(isPaidSubscriber(makeUser("Consumer"))).toBe(true);
    expect(isPaidSubscriber(makeUser("Trade"))).toBe(true);
  });
});
