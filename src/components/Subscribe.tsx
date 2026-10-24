import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DetailHero from "./DetailHero";
import { subscriptionsApi, billingApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type { Subscription } from "../types/subscription";
import type { ChangePreviewResponse } from "../types/api";
import { errorMessage } from "../utils/errors";

function formatPrice(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
}

function isFreePlan(plan: Subscription): boolean {
  return Boolean(
    plan && (plan.yearly_price_cents === 0 || plan.yearly_price_cents == null),
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "your next renewal";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "your next renewal";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

/**
 * Where the POST /billing/confirm reconciliation stands. `null` is the initial
 * state before the confirm call starts, and also covers the window where the
 * user has returned from Stripe but the webhook already applied the plan.
 */
type CheckoutConfirmState = "confirming" | "confirmed" | "error" | null;

interface PlanCardProps {
  plan: Subscription
  isCurrent: boolean
  /**
   * Whether the signed-in user is on a paid tier. The FREE row has no
   * checkout and no downgrade path from this page (the backend 422s on
   * free-plan checkout and rejects free change targets), so a paid user gets
   * a portal button there instead of a plan CTA.
   */
  onPaidPlan: boolean
  // Free plans have no checkout and managed plans no "choose" CTA, so the
  // matching handler is genuinely absent on some rows. Logged-out visitors
  // get an `onLoginRequest` instead, which routes them through sign-in first.
  onChoose?: ((planId: number) => void) | undefined
  onManage?: (() => void) | undefined
  onLoginRequest?: (() => void) | undefined
  loadingPlanId: number | null
}

// One card renders every kind of plan — free and paid are just different rows
// of the same list. The small visual differences (price line, badge, CTA) are
// derived from the plan itself.
function PlanCard({
  plan,
  isCurrent,
  onPaidPlan,
  onChoose,
  onManage,
  onLoginRequest,
  loadingPlanId,
}: PlanCardProps) {
  const isFree =
    plan.yearly_price_cents === 0 || plan.yearly_price_cents == null;
  const yearly = formatPrice(plan.yearly_price_cents);
  const monthly = formatPrice(plan.monthly_price_cents);
  const busy = loadingPlanId === plan.id;
  // FREE has no checkout and no downgrade path from this page. Three states:
  // - on the free tier → disabled "Current plan" status display;
  // - on a paid tier → portal button (cancel/downgrade lives in Stripe);
  // - logged out → routes through sign-in first.
  const freeIsCurrent = isFree && isCurrent && !onPaidPlan;
  const freeChoosePlan = Boolean(isFree && onPaidPlan && onManage);
  // Logged-in free-tier user whose session hasn't resolved a handler yet —
  // nothing to do, never an enabled dead button.
  const freeNoop = Boolean(isFree && !isCurrent && !onPaidPlan && !onLoginRequest);
  const buttonDisabled =
    busy ||
    freeIsCurrent ||
    freeNoop ||
    (!isFree && !onChoose && !onManage && !onLoginRequest);
  const buttonLabel = busy
    ? "Processing…"
    : isFree
      ? freeIsCurrent
        ? "Current plan"
        : freeChoosePlan
          ? "Choose plan"
          : "Login to choose"
      : isCurrent
        ? onManage
          ? "Manage subscription"
          : "Current plan"
        : onLoginRequest
          ? "Login to choose plan"
          : "Choose plan";

  return (
    <article
      className="review-card"
      style={isFree ? { maxWidth: 340, border: "1px dashed #ccc" } : undefined}
    >
      <div style={{ position: "relative" }}>
        {plan.popular && (
          <span
            className="review-card__badge"
            style={{
              background: "#7f4f24",
              color: "#fff",
              borderRadius: 999,
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Most popular
          </span>
        )}
        <h2 className="review-card__title">{plan.name}</h2>
      </div>

      {plan.description && (
        <p className="review-card__comment">{plan.description}</p>
      )}

      <p style={{ fontSize: 32, fontWeight: 700, margin: "8px 0" }}>
        {isFree ? "$0" : (yearly ?? "—")}
        {!isFree && (
          <span style={{ fontSize: 14, fontWeight: 400, color: "#666" }}>
            {" "}
            / year
          </span>
        )}
      </p>
      {!isFree && monthly && (
        <p className="review-card__comment">or {monthly} billed monthly</p>
      )}

      <ul style={{ paddingLeft: 20, margin: "16px 0" }}>
        {(plan.features || []).map((f, i) => (
          <li key={f.id ?? i} style={{ marginBottom: 6, fontSize: 14 }}>
            ✓ {f.name}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="auth-form__submit"
        disabled={buttonDisabled}
        onClick={() => {
          if (freeIsCurrent || freeNoop) return;
          if (onManage) onManage();
          else if (onChoose) onChoose(plan.id);
          else if (onLoginRequest) onLoginRequest();
        }}
        title={freeIsCurrent ? "FREE is your current plan" : undefined}
      >
        {buttonLabel}
      </button>
    </article>
  );
}

function Subscribe() {
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  // Set when the user returns from Stripe Checkout (?checkout=success|cancelled).
  const [checkoutNotice, setCheckoutNotice] = useState<"success" | "cancelled" | null>(null);
  // Reconciliation with Stripe after returning from Checkout (no webhook needed).
  const [confirmState, setConfirmState] = useState<CheckoutConfirmState>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // Plan-change (upgrade/downgrade) pre-approval state.
  const [changePreview, setChangePreview] = useState<ChangePreviewResponse | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeNotice, setChangeNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    subscriptionsApi
      .list()
      .then((data) => {
        if (!cancelled) setPlans(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load plans"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Self-heal: some auth paths (password-reset sign-in, impersonation) return a
  // user payload without the billing fields, which would leave every paid-plan
  // CTA disabled until a manual refresh. Fetch the full session once in that
  // case (GET /me always includes them, so this cannot loop).
  useEffect(() => {
    if (user && user.can_manage_billing === undefined) {
      refreshSession();
    }
  }, [user, refreshSession]);

  // Coming back from Stripe Checkout lands on
  // /subscribe?checkout=success&session_id=cs_... (or checkout=cancelled).
  // The plan is reconciled via POST /billing/confirm, which verifies the
  // Stripe session server-side and applies the subscription — the Stripe
  // webhook may not have been delivered yet in local dev.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("checkout");
    if (!state) return undefined;

    const sessionId = params.get("session_id");
    setCheckoutNotice(state === "success" ? "success" : "cancelled");
    window.history.replaceState({}, "", window.location.pathname);

    // A single retry timer drives a follow-up session refresh; the cleanup
    // clears whichever one is pending when the effect re-runs or unmounts.
    let retry: ReturnType<typeof setTimeout> | undefined;
    if (state === "success" && sessionId) {
      setConfirmState("confirming");
      setConfirmError(null);
      billingApi
        .confirm(sessionId)
        .then(() => {
          setConfirmState("confirmed");
          return refreshSession();
        })
        .catch((err: unknown) => {
          // Session not paid yet (202) or an error — surface it but still
          // refresh in case the webhook applied the plan in the meantime.
          setConfirmState("error");
          setConfirmError(errorMessage(err, "Could not confirm payment yet."));
          return refreshSession();
        })
        .then(() => {
          retry = setTimeout(() => refreshSession(), 3000);
        });
    } else {
      refreshSession();
      retry = setTimeout(() => refreshSession(), 3000);
    }

    return () => {
      if (retry !== undefined) clearTimeout(retry);
    };
  }, [refreshSession]);

  const currentPlanId = user?.subscription?.id;
  const currentPlan = plans.find((p) => p.id === currentPlanId);

  // Users on a paid plan go through the plan-change (preview/confirm) flow;
  // users on FREE (or no subscription) still use Checkout.
  const handleChoose = useCallback(
    async (planId: number) => {
      setError(null);
      setChangeNotice(null);
      setLoadingPlanId(planId);
      try {
        const onPaidPlan = currentPlan && !isFreePlan(currentPlan);
        if (onPaidPlan) {
          const preview = await billingApi.changePreview(planId);
          setLoadingPlanId(null);
          setChangeError(null);
          setChangePreview(preview);
        } else {
          const result = await billingApi.checkout(planId);
          window.location.href = result.url;
        }
      } catch (err) {
        setError(errorMessage(err, "Could not start plan change."));
        setLoadingPlanId(null);
      }
    },
    [currentPlan],
  );

  const handleChangeConfirm = useCallback(async () => {
    const preview = changePreview;
    const targetId = preview?.target.id;
    if (!preview || !targetId) return;
    setChangeBusy(true);
    setChangeError(null);
    try {
      const result = await billingApi.changeConfirm(
        targetId,
        newIdempotencyKey(),
      );
      const downgrade = preview.direction === "downgrade";
      const targetName = preview.target.name;
      setChangePreview(null);
      // A charge that needs authentication (3DS/SCA) comes back as an open
      // Stripe invoice: send the customer there to finish paying it.
      if (result?.hosted_invoice_url) {
        window.open(result.hosted_invoice_url, "_blank", "noopener,noreferrer");
      }
      setChangeNotice(
        downgrade
          ? `✅ Downgrade scheduled — you'll move to ${targetName} at ${formatDate(preview.current_period_end)}. Your current plan stays active until then.`
          : result?.hosted_invoice_url
            ? `💳 Almost there — complete the ${formatPrice(preview.due_today.amount_cents)} payment to activate ${targetName}.`
            : `✅ Upgrade started — ${targetName} will take effect as soon as payment is confirmed.`,
      );
      await refreshSession();
      setTimeout(() => refreshSession(), 3000);
    } catch (err) {
      setChangeError(errorMessage(err, "Could not confirm the change."));
    } finally {
      setChangeBusy(false);
      setLoadingPlanId(null);
    }
  }, [changePreview, refreshSession]);

  const handleCancelChange = useCallback(() => {
    setChangePreview(null);
    setChangeError(null);
  }, []);

  const handleManage = useCallback(async () => {
    setError(null);
    try {
      const result = await billingApi.portal();
      window.location.href = result.url;
    } catch (err) {
      setError(errorMessage(err, "Could not open billing portal."));
    }
  }, []);

  const canManageBilling = user?.can_manage_billing; // Stripe is available for this user

  // Logged-out visitors can't start checkout — every CTA routes them through
  // sign-in first, returning here afterwards (see Login's `from` state).
  const handleLoginRequest = useCallback(() => {
    navigate("/login", { state: { from: "/subscribe" } });
  }, [navigate]);

  // FREE first, then the paid tiers sorted by price.
  const free =
    plans.find((p) => p.yearly_price_cents === 0) ||
    plans.find((p) => p.name === "FREE");
  const paid = plans.filter((p) => p !== free);
  const orderedPlans = [
    ...(free ? [free] : []),
    // Rails allows a null yearly price; the old `null - x` comparison
    // coerced it to 0, so `?? 0` preserves that exact ordering.
    ...paid
      .slice()
      .sort(
        (a, b) =>
          (a.yearly_price_cents ?? 0) - (b.yearly_price_cents ?? 0),
      ),
  ];

  return (
    <main className="wine-app">
      <Link to="/" className="wine-detail__back">
        &larr; Back to Dashboard
      </Link>
      <DetailHero
        kicker="Cellar"
        title="Membership"
        intro="Choose the plan that fits how you explore and share wine words."
      />

      {loading && <p className="wine-management__loading">Loading plans…</p>}
      {error && <p className="review-form__error">{error}</p>}
      {checkoutNotice === "success" && (
        <p className="review-card__comment" style={{ fontWeight: 600 }}>
          {confirmState === "confirming" &&
            "⏳ Confirming your payment with Stripe…"}
          {confirmState === "confirmed" &&
            "✅ Payment confirmed — your plan is now active."}
          {confirmState === "error" &&
            `⚠️ Payment received but activation needs a moment${confirmError ? `: ${confirmError}` : "."} If it still shows the old plan in a moment, refresh once more.`}
          {confirmState === null &&
            "✅ Payment received — your plan is being activated. This page will update automatically; if it still shows the old plan in a moment, refresh once more."}
        </p>
      )}
      {checkoutNotice === "cancelled" && (
        <p className="review-card__comment">
          Checkout cancelled — you have not been charged.
        </p>
      )}
      {changeNotice && (
        <p className="review-card__comment" style={{ fontWeight: 600 }}>
          {changeNotice}
        </p>
      )}
      {user?.subscription_change?.change_type === "downgrade" &&
        user?.subscription_change?.status === "scheduled" && (
          <p
            className="review-card__comment"
            style={{ fontWeight: 600, border: "1px solid #7f4f24", padding: 8 }}
          >
            ✅ Downgrade scheduled — you'll move to{" "}
            {user.subscription_change.to_subscription?.name} on{" "}
            {formatDate(user.subscription_change.effective_at)}. Your current
            plan stays active until then.
          </p>
        )}

      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 24,
            marginBottom: 32,
          }}
        >
          {orderedPlans.map((plan) => {
            const isCurrent =
              currentPlanId === plan.id ||
              // Stale/pre-backfill sessions can carry `subscription: null`
              // even though the backend treats the account as FREE — the
              // default plan still marks the signed-in user's current tier.
              (!currentPlanId && Boolean(user) && plan.is_default);
            const isFree = isFreePlan(plan);
            const userOnPaidPlan = Boolean(
              currentPlan && !isFreePlan(currentPlan),
            );
            // Paid plans that aren't the current plan get a "Choose plan"
            // button (which routes to the change flow for existing paid
            // users). The current paid plan gets "Manage subscription". The
            // FREE row for a paid user gets the portal button too — there is
            // no downgrade-to-FREE path from this page, so cancel/downgrade
            // lives in Stripe.
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={isCurrent}
                onPaidPlan={userOnPaidPlan}
                onChoose={
                  !isFree && !isCurrent && canManageBilling
                    ? handleChoose
                    : undefined
                }
                onManage={
                  (isCurrent || (isFree && userOnPaidPlan)) && canManageBilling
                    ? handleManage
                    : undefined
                }
                onLoginRequest={!user ? handleLoginRequest : undefined}
                loadingPlanId={loadingPlanId}
              />
            );
          })}
        </div>
      )}

      {changePreview && (
        <div
          className="review-card"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: 460,
              padding: 24,
              borderRadius: 12,
              background: "#fff",
              boxShadow: "0 12px 40px rgba(0,0,0,.25)",
            }}
          >
            <h2 style={{ margin: 0 }}>
              {changePreview.direction === "downgrade"
                ? `Downgrade to ${changePreview.target.name}`
                : `Upgrade to ${changePreview.target.name}`}
            </h2>
            <p className="review-card__comment">
              Current plan:{" "}
              <strong>{changePreview.current?.name ?? "None"}</strong>
              {changePreview.direction === "downgrade" && (
                <span>
                  {" "}
                  — stays active until{" "}
                  {formatDate(changePreview.current_period_end)}
                </span>
              )}
            </p>
            <ul style={{ padding: 0, margin: "16px 0", listStyle: "none" }}>
              {changePreview.direction === "upgrade" && (
                <li>
                  Amount due today:{" "}
                  <strong>
                    {formatPrice(changePreview.due_today.amount_cents)}
                  </strong>
                </li>
              )}
              <li>
                Next renewal:{" "}
                <strong>
                  {formatPrice(changePreview.next_renewal.amount_cents)}
                </strong>{" "}
                on {formatDate(changePreview.current_period_end)}
              </li>
              {changePreview.direction === "downgrade" && (
                <li>
                  Amount due today: <strong>$0</strong>
                </li>
              )}
            </ul>
            {changeError && (
              <p className="review-form__error" role="alert">
                {changeError}
              </p>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                className="auth-form__submit"
                disabled={changeBusy}
                onClick={handleChangeConfirm}
              >
                {changeBusy
                  ? "Processing…"
                  : changePreview.direction === "downgrade"
                    ? "Confirm downgrade"
                    : `Confirm upgrade — ${formatPrice(changePreview.due_today.amount_cents)}`}
              </button>
              <button
                type="button"
                className="auth-form__submit"
                disabled={changeBusy}
                onClick={handleCancelChange}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Subscribe;
