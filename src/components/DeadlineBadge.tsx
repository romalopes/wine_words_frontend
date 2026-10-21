import { formatDate, daysUntil } from "../utils/dates"

interface DeadlineBadgeProps {
  /**
   * Date-only ISO string (`YYYY-MM-DD`) returned by the API.
   *
   * `undefined` is part of the type on purpose: this project compiles with
   * `exactOptionalPropertyTypes`, and callers pass optional API fields
   * straight through, so the value may be explicitly `undefined`.
   */
  deadline?: string | null | undefined
  /** Content lifecycle status: draft | published | archived. */
  status?: string | null | undefined
  /**
   * The API's draft-only overdue flag. Preferred over a client-side date
   * comparison so the badge can never disagree with the server.
   */
  overdue?: boolean | null | undefined
  /**
   * The API's signed day count. Preferred over recomputing from the date,
   * which would use the browser's timezone rather than the application's.
   */
  daysUntilDeadline?: number | null | undefined
}

/**
 * Publication deadline badge (issue #185).
 *
 * The text carries the meaning ("Due today", "Overdue by 2 days"), so colour
 * is only a supporting cue. Published and archived records keep their stored
 * date but are never operationally due, so nothing renders for them.
 */
function DeadlineBadge({
  deadline,
  status,
  overdue,
  daysUntilDeadline,
}: DeadlineBadgeProps) {
  if (!deadline || status !== "draft") return null

  const days =
    typeof daysUntilDeadline === "number" ? daysUntilDeadline : daysUntil(deadline)
  const isOverdue = typeof overdue === "boolean" ? overdue : (days ?? 0) < 0
  const state = isOverdue ? "overdue" : days === 0 ? "today" : "upcoming"

  let label: string
  if (state === "overdue") {
    const count = days === null ? null : Math.abs(days)
    label =
      count === null
        ? "Overdue"
        : `Overdue by ${count} ${count === 1 ? "day" : "days"}`
  } else if (state === "today") {
    label = "Due today"
  } else {
    label = `Due ${formatDate(deadline) ?? deadline}`
  }

  return (
    <span className={`deadline-badge deadline-badge--${state}`}>
      <span aria-hidden="true">
        {state === "overdue" ? "⚠" : state === "today" ? "⏰" : "📅"}
      </span>{" "}
      {label}
    </span>
  )
}

export default DeadlineBadge
