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
  wine_name: string
  quantity?: number
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