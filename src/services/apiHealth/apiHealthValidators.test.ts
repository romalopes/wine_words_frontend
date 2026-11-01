import {
  isSearchIndexHealthy,
  isSearchIndexPayload,
  describeSearchIndexFailure,
  isNotificationTestDelivered,
} from "./apiHealthValidators";

/**
 * The search-index check exists because the failure it catches is invisible:
 * an unbuilt tsvector answers every `?query=` with an empty list, so the API
 * looks healthy while search silently returns nothing.
 */
describe("search index health validators", () => {
  const healthy = {
    status: "ok",
    reviews: { total: 48, indexed: 48, missing: 0 },
    articles: { total: 12, indexed: 12, missing: 0 },
  };

  it("accepts a fully built index", () => {
    expect(isSearchIndexPayload(healthy)).toBe(true);
    expect(isSearchIndexHealthy(healthy)).toBe(true);
  });

  it("rejects a payload that is missing the vector counts", () => {
    expect(isSearchIndexPayload({ status: "ok" })).toBe(false);
    expect(isSearchIndexPayload(null)).toBe(false);
    expect(isSearchIndexHealthy({ status: "degraded" })).toBe(false);
  });

  it("fails when rows were never indexed", () => {
    const degraded = {
      status: "degraded",
      reviews: { total: 48, indexed: 0, missing: 48 },
      articles: { total: 12, indexed: 12, missing: 0 },
    };

    expect(isSearchIndexHealthy(degraded)).toBe(false);
  });

  it("names the unindexed counts and the repair command", () => {
    const degraded = {
      status: "degraded",
      reviews: { total: 48, indexed: 0, missing: 48 },
      articles: { total: 12, indexed: 0, missing: 12 },
    };

    expect(describeSearchIndexFailure(degraded)).toBe(
      "48 review(s) and 12 article(s) are not indexed, so search cannot find them — run `bin/rails search:reindex`",
    );
  });

  it("explains the expected shape when the payload is unrecognisable", () => {
    expect(describeSearchIndexFailure(null)).toContain("reviews: { total, missing }");
  });
});

/**
 * The send-test-notification diagnostic exists to prove a notification is not
 * just created but actually reflected in the bell, whose badge is driven by the
 * delivered-unread count. The validator therefore rejects any payload that does
 * not carry a positive integer unread count.
 */
describe("notification test health validator", () => {
  const delivered = {
    status: "delivered",
    notification_id: 42,
    notification_type: "health_test",
    message: "API Health test notification",
    unread_count: 2,
    delivered_at: "2026-01-11T00:00:00.000Z",
  };

  it("accepts a delivered notification whose unread count reaches the bell", () => {
    expect(isNotificationTestDelivered(delivered)).toBe(true);
  });

  it("rejects a payload that does not prove the bell will light up", () => {
    expect(isNotificationTestDelivered({ ...delivered, unread_count: 0 })).toBe(false);
    expect(isNotificationTestDelivered({ ...delivered, status: "failed" })).toBe(false);
    expect(
      isNotificationTestDelivered({
        ...delivered,
        notification_type: "wine_package_deadline",
      }),
    ).toBe(false);
    expect(isNotificationTestDelivered({ ...delivered, notification_id: "42" })).toBe(false);
    expect(isNotificationTestDelivered({ ...delivered, unread_count: 1.5 })).toBe(false);
    expect(isNotificationTestDelivered({ ...delivered, unread_count: "2" })).toBe(false);
    expect(isNotificationTestDelivered({ ...delivered, message: undefined })).toBe(false);
    expect(isNotificationTestDelivered(null)).toBe(false);
    expect(isNotificationTestDelivered("delivered")).toBe(false);
  });
});
