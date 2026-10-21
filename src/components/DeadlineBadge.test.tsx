import { render, screen } from "@testing-library/react"
import DeadlineBadge from "./DeadlineBadge"
import { formatDate } from "../utils/dates"

// Issue #185: deadlines are operational only for drafts. The badge must make
// the state obvious in text (not colour alone), and must never contradict the
// API's `overdue` / `days_until_deadline` values.
describe("DeadlineBadge", () => {
  it("renders nothing without a deadline", () => {
    const { container } = render(<DeadlineBadge status="draft" deadline={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing for published or archived content", () => {
    const published = render(
      <DeadlineBadge status="published" deadline="2026-10-25" overdue />,
    )
    expect(published.container).toBeEmptyDOMElement()

    const archived = render(
      <DeadlineBadge status="archived" deadline="2026-10-25" overdue />,
    )
    expect(archived.container).toBeEmptyDOMElement()
  })

  it("shows the due date for an upcoming draft", () => {
    render(
      <DeadlineBadge
        status="draft"
        deadline="2026-10-25"
        overdue={false}
        daysUntilDeadline={4}
      />,
    )

    expect(
      screen.getByText(`Due ${formatDate("2026-10-25")}`),
    ).toBeInTheDocument()
  })

  it("shows 'Due today' when the API reports zero days", () => {
    render(
      <DeadlineBadge
        status="draft"
        deadline="2026-10-21"
        overdue={false}
        daysUntilDeadline={0}
      />,
    )

    expect(screen.getByText(/Due today/)).toBeInTheDocument()
  })

  it("shows the overdue count from the API", () => {
    render(
      <DeadlineBadge
        status="draft"
        deadline="2026-10-18"
        overdue
        daysUntilDeadline={-3}
      />,
    )

    expect(screen.getByText(/Overdue by 3 days/)).toBeInTheDocument()
  })

  it("trusts the API over a client-side date comparison", () => {
    // The date looks far in the future, but the API says this draft is overdue
    // (server timezone / clock). The server is the source of truth.
    render(
      <DeadlineBadge
        status="draft"
        deadline="2030-01-01"
        overdue
        daysUntilDeadline={-1}
      />,
    )

    expect(screen.getByText(/Overdue by 1 day/)).toBeInTheDocument()
  })
})
