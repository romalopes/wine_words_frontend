export interface TradeWineInput {
  wine_name: string
  vintage: string
  quantity?: string
  region: string
  appellation: string
  grape_varieties: string
  abv: string
  volume_ml: string
  closure_type: string
  tasting_notes: string
  technical_sheet_url: string
  trade_price: string
  retail_price: string
  sample_available: boolean
  sample_quantity: string
}

export interface TradeContactInput {
  company_name: string
  contact_name: string
  email: string
  phone: string
  address: string
  country: string
  website: string
  role: string
  notes: string
}

export interface TradeSubmissionResponse {
  package_reference: number
  status: string
  guest_token: string
  guest_url: string
  replayed?: boolean
}

export interface TradeMessage {
  id: number
  sender_type: string
  sender_name: string
  body: string
  internal_note: boolean
  created_at: string
}

export interface TradePackageItem {
  id: number
  /** The name the submitter sent. Never overwritten by a catalogue match. */
  wine_name: string
  quantity?: number
  /** The vintage the submitter sent (snapshot). */
  vintage?: string | number | null
  region?: string | null
  appellation?: string | null
  grape_varieties?: string | null
  abv?: string | number | null
  volume_ml?: string | number | null
  tasting_notes?: string | null
  trade_price?: string | number | null
  retail_price?: string | number | null
  item_status: string
  review_progress: string
  received: boolean
  condition?: string | null
  /** True once the Wine Words team linked this line to a catalogue wine + vintage. */
  resolved?: boolean
  /** True when the line came from the submitter's form (has a snapshot name). */
  submitted?: boolean
  /** The catalogue wine the line was resolved to (null until matched). */
  catalogue_wine_id?: number | null
  catalogue_wine_name?: string | null
  catalogue_wine_slug?: string | null
  catalogue_producer_id?: number | null
  catalogue_producer_name?: string | null
  catalogue_producer_slug?: string | null
  /** The catalogue vintage the line was resolved to. */
  vintage_id?: number | null
  vintage_year?: number | null
  vintage_no_vintage?: boolean | null
  vintage_label?: string | null
}

export interface TradeQuote {
  id: number
  service_type: string
  status: string
  currency: string
  subtotal: string | number
  tax: string | number
  total: string | number
  valid_until?: string | null
}

export interface TradeInvoice {
  id: number
  invoice_number: string
  status: string
  currency: string
  subtotal: string | number
  tax: string | number
  total: string | number
  issued_at?: string | null
  due_at?: string | null
  paid_at?: string | null
  payment_source?: string
  billable_bottle_count?: number
  unit_fee?: string | number
  recorded_by_id?: number
  recorded_at?: string | null
  cancellation_reason?: string | null
  notes?: string | null
  email_sent_at?: string | null
  email_send_count?: number
  reminder_sent_at?: string | null
  overdue?: boolean
}

export interface TradeBillingSummary {
  bottles_submitted: number
  billable_to_date: number
  /** Billable bottles not covered by an active (sent/paid) invoice yet. */
  billable_uninvoiced?: number
  total_invoiced: string
  total_paid: string
  total_cancelled: string
  outstanding: string
  payment_state: string
  overdue: boolean
  invoices: TradeInvoice[]
}

/** One row of the staff-wide invoice overview (GET /api/v1/invoices). */
export interface InvoiceListItem {
  id: number
  invoice_number: string
  status: string
  payment_source?: string
  overdue: boolean
  billable_bottle_count?: number
  unit_fee?: string | null
  currency: string
  subtotal?: string | null
  tax?: string | null
  total?: string | null
  issued_at?: string | null
  due_at?: string | null
  paid_at?: string | null
  email_sent_at?: string | null
  email_send_count?: number
  client: {
    company_name?: string | null
    contact_name?: string | null
    email?: string | null
  }
  wine_package: {
    id: number
    status: string
    source?: string | null
    producer_name?: string | null
    item_count: number
  }
}

export interface TradePackage {
  id: number
  status: string
  source?: string | null
  claimed?: boolean
  claimable?: boolean
  created_at?: string | null
  submitted_at?: string | null
  contact_snapshot?: TradeContactInput
  items: TradePackageItem[]
  events: Array<{
    id: number
    event_type: string
    occurred_at: string
    description?: string | null
    internal?: boolean
  }>
  quotes: TradeQuote[]
  invoices: TradeInvoice[]
  shipping?: {
    address?: Record<string, string> | null
    tracking?: { carrier?: string; number?: string; url?: string; status?: string }
  }
}