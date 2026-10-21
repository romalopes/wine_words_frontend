import type {
  AuthResponse,
  ForgotPasswordPayload,
  Identity,
  MessageResponse,
  ResetPasswordPayload,
  SignInPayload,
  SignUpPayload,
  SignUpResponse,
  SocialSignInInput,
  User,
} from "./authentication"

export type SocialProvider = "google" | "apple" | "microsoft" | "facebook"

export interface AuthApi {
  signIn(payload: SignInPayload): Promise<AuthResponse>
  signUp(payload: SignUpPayload): Promise<SignUpResponse>
  signOut(): Promise<unknown>
  forgotPassword(email: string): Promise<MessageResponse>
  resetPassword(payload: ResetPasswordPayload): Promise<AuthResponse>
  me(): Promise<AuthResponse>
  socialSignIn(
    provider: SocialProvider,
    payload?: SocialSignInInput,
  ): Promise<AuthResponse>
}

export interface IdentityListResponse {
  identities: Identity[]
  password_authentication: boolean
}

export interface IdentityResponse {
  identity: Identity
}

export interface IdentitiesApi {
  list(): Promise<IdentityListResponse>
  connect(
    provider: SocialProvider,
    payload?: SocialSignInInput,
  ): Promise<IdentityResponse>
  disconnect(id: number): Promise<unknown>
}

export interface ForgotPasswordRequest {
  email: ForgotPasswordPayload["email"]
}

import type { QueryParams, ResourceResponse } from "./common"
import type { Account, AccountUpdate, PasswordChange } from "./account"
import type { Configuration, Setting } from "./notification"
import type { AuditLog, ImpersonationResponse, UserWineProfile } from "./user"
import type { Article } from "./article"
import type {
  Category,
  CategoryDetail,
  GrapeDetail,
  GrapeSearchResult,
  TasteParameter,
} from "./catalog"
import type {
  Country,
  CountryDetail,
  CountryListItem,
  CountryRegionNode,
  Region,
  RegionDetail,
} from "./reference"
import type { Notification } from "./notification"
import type { Stats } from "./stats"
import type { Producer, ProducerSearchResult } from "./producer"
import type { Subscription, SubscriptionWritePayload } from "./subscription"
import type { Review } from "./review"
import type { ShipmentTracking } from "./shipmentTracking"
import type { ImageableType, ImageListResponse, ImageUploadResponse } from "./image"
import type { AdminUser, RoleOption } from "./user"
import type { Vintage, Wine, WineListItem } from "./wine"
import type { WinePackage, WinePackageItem, WinePackageListItem } from "./winePackage"
import type { ArticleProject, ArticleProjectDetail, ArticleProjectLookupItem, ArticleProjectLookupKind, ArticleProjectNotebook, ArticleProjectWritePayload } from "./articleProject"

export interface WineSearchInput {
  q?: string
  /** Serialised straight into `producer_id`, so a string id is accepted too. */
  producerId?: number | string
}

export interface WineWritePayload {
  name?: string
  slug?: string
  producer_id?: number | null
  color?: string | null
  category_ids?: number[]
  [key: string]: unknown
}

export interface WineGroup {
  category: string
  count: number
  wines: WineListItem[]
}

export interface WineApi {
  list(params?: QueryParams): Promise<ResourceResponse<WineListItem>>
  grouped(params?: QueryParams): Promise<WineGroup[]>
  search(query: string | WineSearchInput, options?: Omit<WineSearchInput, "q">): Promise<WineListItem[]>
  advancedSearch(params?: QueryParams): Promise<ResourceResponse<WineListItem>>
  show(id: string | number): Promise<Wine>
  create(payload: WineWritePayload): Promise<Wine>
  update(id: string | number, payload: WineWritePayload): Promise<Wine>
  destroy(id: string | number): Promise<unknown>
}

export interface ArticleProjectsApi {
  list(params?: QueryParams): Promise<ResourceResponse<ArticleProject>>
  show(id: string | number): Promise<ArticleProjectDetail>
  lookup(kind: ArticleProjectLookupKind, query: string, producerId?: number): Promise<ArticleProjectLookupItem[]>
  create(payload: ArticleProjectWritePayload): Promise<ArticleProject>
  update(id: string | number, payload: ArticleProjectWritePayload): Promise<ArticleProject>
  destroy(id: string | number): Promise<unknown>
  // Notebook CRUD methods
  listNotebooks(projectId: string | number, vintageId: string | number): Promise<ArticleProjectNotebook[]>
  createNotebook(projectId: string | number, vintageId: string | number, payload: { title: string; content?: string | null; position?: number }): Promise<ArticleProjectNotebook>
  showNotebook(projectId: string | number, vintageId: string | number, notebookId: string | number): Promise<ArticleProjectNotebook>
  updateNotebook(projectId: string | number, vintageId: string | number, notebookId: string | number, payload: { title?: string; content?: string | null; position?: number; lock_version: number }): Promise<ArticleProjectNotebook>
  destroyNotebook(projectId: string | number, vintageId: string | number, notebookId: string | number, lockVersion: number): Promise<void>
  createReviewFromNotebook(projectId: string | number, vintageId: string | number, notebookId: string | number): Promise<Review>
}

export interface ProducerWritePayload {
  name?: string
  email?: string | null
  [key: string]: unknown
}

export interface ProducerApi {
  list(params?: QueryParams): Promise<ResourceResponse<Producer>>
  search(query: string): Promise<ProducerSearchResult[]>
  show(id: string | number): Promise<Producer>
  create(payload: ProducerWritePayload): Promise<Producer>
  update(id: string | number, payload: ProducerWritePayload): Promise<Producer>
  destroy(id: string | number): Promise<unknown>
  uploadLogo(id: string | number, file: File): Promise<unknown>
  removeLogo(id: string | number): Promise<unknown>
  linkWine(id: string | number, wineId: string | number): Promise<Producer>
}

/** One content source (manual / substack / wine_front) with its item counts. */
export interface Source {
  source: string
  label: string
  reviews_count: number
  articles_count: number
  [key: string]: unknown
}

/** Envelope returned by `GET /api/v1/sources`. */
export interface SourcesResponse {
  sources: Source[]
}

export interface SourcesApi {
  list(): Promise<SourcesResponse>
}

export interface ReviewWritePayload {
  title?: string
  comment?: string | null
  score?: number | null
  status?: string
  /** Only sent with status transitions (`updateStatus`). */
  published_at?: string | null
  category_ids?: number[]
  [key: string]: unknown
}

export interface ReviewGroup {
  category: string
  count: number
  reviews: Review[]
}

/**
 * The one option a cancellable read accepts. Declared here (rather than
 * imported from the client) so `types/*` stays free of service imports — the
 * shape is structurally identical to `RequestOptions['signal']`.
 */
export interface RequestSignal {
  signal?: AbortSignal
}

export interface ReviewApi {
  updateStatus(id: string | number, payload: Pick<ReviewWritePayload, "status" | "published_at">): Promise<void>
  all(params?: QueryParams, options?: RequestSignal): Promise<ResourceResponse<Review>>
  list(wineSlug: string, vintageId: number): Promise<Review[]>
  show(id: string | number): Promise<Review>
  create(wineSlug: string, vintageId: number, payload: ReviewWritePayload): Promise<Review>
  update(id: string | number, payload: ReviewWritePayload): Promise<Review>
  destroy(id: string | number): Promise<unknown>
  myReviews(): Promise<Review[]>
  grouped(params?: QueryParams, options?: RequestSignal): Promise<ReviewGroup[]>
  /** Newest reviews from the same categories, excluding this one. */
  related(id: string | number, params?: QueryParams, options?: RequestSignal): Promise<Review[]>
}

export interface ArticleWritePayload {
  title?: string
  body?: string
  status?: string
  /** Only sent with status transitions (`updateStatus`). */
  published_at?: string | null
  [key: string]: unknown
}

export interface ArticleGroup {
  category: string
  count: number
  articles: Article[]
}

export interface ArticleApi {
  updateStatus(id: string | number, payload: Pick<ArticleWritePayload, "status" | "published_at">): Promise<void>
  list(params?: QueryParams, options?: RequestSignal): Promise<ResourceResponse<Article>>
  myArticles(): Promise<Article[]>
  show(id: string | number): Promise<Article>
  create(payload: ArticleWritePayload | FormData): Promise<Article>
  update(id: string | number, payload: ArticleWritePayload | FormData): Promise<Article>
  destroy(id: string | number): Promise<unknown>
  grouped(params?: QueryParams, options?: RequestSignal): Promise<ArticleGroup[]>
  /** Newest articles from the same categories, excluding this one. */
  related(id: string | number, params?: QueryParams, options?: RequestSignal): Promise<Article[]>
}

export interface WinePackageWritePayload {
  producer_id?: number | null
  reviewer_id?: number | null
  source?: string
  expected_at?: string | null
  announced_at?: string | null
  arrived_at?: string | null
  review_deadline?: string | null
  reviewed_at?: string | null
  notes?: string | null
  [key: string]: unknown
}

export interface WinePackageActionPayload {
  arrived_at?: string
  review_deadline?: string
  reviewed_at?: string
}

export interface WinePackagesApi {
  list(params?: QueryParams): Promise<ResourceResponse<WinePackageListItem>>
  show(id: string | number): Promise<WinePackage>
  create(payload: WinePackageWritePayload): Promise<WinePackage>
  update(id: string | number, payload: WinePackageWritePayload): Promise<WinePackage>
  destroy(id: string | number): Promise<unknown>
  markArrived(id: string | number, payload?: WinePackageActionPayload): Promise<WinePackage>
  markInTransit(id: string | number): Promise<WinePackage>
  markCompleted(id: string | number, payload?: WinePackageActionPayload): Promise<WinePackage>
  reopen(id: string | number): Promise<WinePackage>
  cancel(id: string | number): Promise<WinePackage>
  accept(id: string | number): Promise<WinePackage>
  reject(id: string | number, reason?: string | null): Promise<WinePackage>
}

export interface WinePackageItemWritePayload {
  vintage_id?: number | null
  quantity?: number
  review_requested?: boolean
  condition?: string | null
  notes?: string | null
  received_at?: string | null
  review_id?: number | null
  [key: string]: unknown
}

export interface WinePackageItemsApi {
  create(packageId: string | number, payload: WinePackageItemWritePayload): Promise<WinePackageItem>
  update(packageId: string | number, itemId: string | number, payload: WinePackageItemWritePayload): Promise<WinePackageItem>
  destroy(packageId: string | number, itemId: string | number): Promise<unknown>
  createReview(packageId: string | number, itemId: string | number, payload: ReviewWritePayload): Promise<Review>
}

export interface ShipmentTrackingWritePayload {
  carrier?: string | null
  number?: string | null
  url?: string | null
  provider?: string | null
  status?: string | null
  estimated_delivery_at?: string | null
  delivered_at?: string | null
  [key: string]: unknown
}

export interface ShipmentTrackingsApi {
  show(packageId: string | number): Promise<ShipmentTracking>
  update(packageId: string | number, payload: ShipmentTrackingWritePayload): Promise<ShipmentTracking>
  refresh(packageId: string | number): Promise<ShipmentTracking>
}

export interface NotificationsApi {
  list(params?: QueryParams): Promise<ResourceResponse<Notification>>
  unreadCount(): Promise<{ unread_count: number }>
  markRead(id: string | number): Promise<Notification>
  markAllRead(): Promise<{ marked: number }>
}

export interface ConfigurationUpdatePayload {
  logs_saved_to_database?: boolean
  use_test_email?: boolean
  test_email?: string | null
  mail_transport?: string | null
  [key: string]: unknown
}

export interface TestAccessResponse {
  authenticated: boolean
  disabled?: boolean
  token?: string
  error?: string
  [key: string]: unknown
}

export interface AccountUpdatePayload extends AccountUpdate {}
export interface PasswordUpdatePayload extends PasswordChange {}

export interface AccountApi {
  show(): Promise<Account>
  update(payload: AccountUpdatePayload): Promise<Account>
  changePassword(payload: PasswordUpdatePayload): Promise<unknown>
  updateAnalyticsOptOut(optOut: boolean): Promise<{ analytics_opt_out: boolean }>
}

export interface UserApi {
  findUser(email: string): Promise<User>
}

export interface UsersApi {
  roles(): Promise<RoleOption[]>
  /**
   * With `page` the API returns the pagination envelope; without it, a bare
   * `AdminUser[]` (legacy shape kept for compatibility). `UserRoles` normalises
   * both — see `AdminUserResults`.
   */
  search(query: string, page?: number): Promise<ResourceResponse<AdminUser>>
  assignRoles(userId: number, roleIds: number[]): Promise<AdminUser>
  assignSubscription(userId: number, subscriptionId: number | null): Promise<AdminUser>
}

export interface SubscriptionsApi {
  list(options?: { auth?: boolean }): Promise<Subscription[]>
  show(id: string | number): Promise<Subscription>
  create(payload: SubscriptionWritePayload): Promise<Subscription>
  update(id: string | number, payload: SubscriptionWritePayload): Promise<Subscription>
  destroy(id: string | number): Promise<unknown>
}

/**
 * Stripe-backed subscription billing.
 *
 * Every payload here is a plain hash built by `app/services/billing/**` and
 * rendered verbatim by `Api::V1::BillingController` — there is no serializer,
 * so the field names below are snake_case exactly as Rails emits them.
 */

/** `POST /billing/checkout` — redirect the browser to Stripe Checkout. */
export interface CheckoutSessionResponse {
  url: string
  session_id: string
}

/** `POST /billing/portal` — redirect to the Stripe Customer Portal. */
export interface PortalSessionResponse {
  url: string
}

/**
 * `POST /billing/confirm` — reconcile a Checkout Session the user just came
 * back from. `applied` is false while the session is unpaid or still open (the
 * controller answers 202 in that case) and true once the plan is active.
 */
export interface ConfirmCheckoutResponse {
  applied: boolean
  session_id: string
  payment_status: string | null
  status: string
  subscription_id: number | null
  provider_subscription_id: string | null
  /** Present only when the webhook had already applied the plan. */
  already_applied?: boolean
}

/** The plan fields `changePreview` echoes for the current and target plans. */
export interface ChangePreviewPlan {
  id: number | null
  name: string | null
  slug: string | null
  rank: number | null
  yearly_price_cents: number | null
}

/** An amount in minor units plus its ISO currency code. */
export interface MoneyAmount {
  amount_cents: number
  currency: string
}

/** Whether the target plan costs more or less than the current one. */
export type ChangeDirection = "upgrade" | "downgrade" | "same"

/**
 * `POST /billing/change/preview` — the proration summary shown before the user
 * commits. Stripe performs the arithmetic; the app never recomputes it.
 */
export interface ChangePreviewResponse {
  direction: ChangeDirection
  /** Null when the user has no current subscription (a fresh purchase). */
  current: ChangePreviewPlan | null
  target: ChangePreviewPlan
  due_today: MoneyAmount
  next_renewal: MoneyAmount & { at: string | null }
  current_period_end: string | null
  provider_subscription_id: string | null
}

/**
 * `POST /billing/change/confirm` — the outcome of executing the change.
 * `hosted_invoice_url` is only set for an upgrade whose card needs 3DS/SCA:
 * Stripe leaves the invoice open and the customer must complete it at that URL
 * before the new plan activates.
 */
export interface ChangeConfirmResponse {
  status: string
  subscription_change_id: number
  effective_at: string | null
  mode: "upgrade" | "downgrade" | null
  provider_invoice_id: string | null
  hosted_invoice_url: string | null
  /** Set when the idempotency key replayed an earlier request. */
  already_requested?: boolean
}

export interface BillingApi {
  checkout(subscriptionId: number): Promise<CheckoutSessionResponse>
  confirm(sessionId: string): Promise<ConfirmCheckoutResponse>
  portal(): Promise<PortalSessionResponse>
  changePreview(subscriptionId: number): Promise<ChangePreviewResponse>
  changeConfirm(
    subscriptionId: number,
    idempotencyKey: string,
  ): Promise<ChangeConfirmResponse>
}


export interface TasteParametersApi {
  list(): Promise<TasteParameter[]>
}

/** Payload of `vintages#create` — nested under a wine slug. */
export interface VintageInput {
  year: number
  no_vintage?: boolean
  prompt?: string | null
  price?: number | null
}

export interface VintagesApi {
  create(wineSlug: string, payload: VintageInput): Promise<Vintage>
}

/** The three item types the category counts are broken down by. */
export type CategoryCountType = "wine" | "review" | "article";

/**
 * The payload of `GET /api/v1/categories/counts`.
 *
 * `wine` / `review` / `article` map a category id to how many of that item type
 * are linked to it (only categories flagged `for_<type>` appear). The keys are
 * the numbers Rails serialises, so they arrive as strings. `uncategorised` and
 * `totals` are per-type scalars rather than maps.
 */
export interface CategoryCounts {
  wine?: Record<string, number>
  review?: Record<string, number>
  article?: Record<string, number>
  uncategorised?: Record<CategoryCountType, number>
  totals?: Record<CategoryCountType, number>
}

export interface CategoriesApi {
  list(type?: string | null): Promise<ResourceResponse<Category>>
  show(id: string | number): Promise<CategoryDetail>
  counts(): Promise<CategoryCounts>
  create(payload: Record<string, unknown>): Promise<Category>
  update(id: string | number, payload: Record<string, unknown>): Promise<Category>
  remove(id: string | number): Promise<unknown>
  reorder(type: string, orderedIds: number[]): Promise<unknown>
  linkWine(id: string | number, wineId: string | number): Promise<Category>
  linkProducer(id: string | number, producerId: string | number): Promise<Category>
  linkReview(id: string | number, reviewId: string | number): Promise<Category>
  linkArticle(id: string | number, articleId: string | number): Promise<Category>
}

export interface GrapesApi {
  /**
   * `index` and `show` share the same `grape_json`, differing only in the
   * `wines` key that `show` adds — so both are `GrapeDetail` (`wines`
   * optional). `search` is a reduced projection: only these four keys.
   */
  list(params?: QueryParams): Promise<ResourceResponse<GrapeDetail>>
  search(query: string): Promise<GrapeSearchResult[]>
  show(id: string | number): Promise<GrapeDetail>
  create(payload: Record<string, unknown>): Promise<GrapeDetail>
  update(id: string | number, payload: Record<string, unknown>): Promise<GrapeDetail>
  remove(id: string | number): Promise<unknown>
  linkWine(id: string | number, wineId: string | number): Promise<GrapeDetail>
  linkProducer(id: string | number, producerId: string | number): Promise<GrapeDetail>
}

export interface CountriesApi {
  list(params?: { include_wine_counts?: boolean }): Promise<ResourceResponse<CountryListItem>>
  show(id: string | number): Promise<CountryDetail>
  create(payload: Record<string, unknown>): Promise<Country>
  update(id: string | number, payload: Record<string, unknown>): Promise<Country>
  remove(id: string | number): Promise<unknown>
  linkProducer(id: string | number, producerId: string | number): Promise<Country>
}

export interface StatsApi {
  get(): Promise<Stats>
}

export interface RegionsApi {
  list(): Promise<Region[]>
  tree(): Promise<CountryRegionNode[]>
  show(id: string | number): Promise<RegionDetail>
  create(payload: Record<string, unknown>): Promise<Region>
  update(id: string | number, payload: Record<string, unknown>): Promise<Region>
  linkWine(id: string | number, wineId: string | number): Promise<RegionDetail>
  linkProducer(id: string | number, producerId: string | number): Promise<Region>
  remove(id: string | number): Promise<unknown>
}

export interface LogsApi {
  /** Raw tail of the log file — the Rails controller renders `{ logs: [...] }`. */
  fetchLines(lines?: number): Promise<{ logs: string[] }>
  fetchAuditLogs(params?: QueryParams): Promise<ResourceResponse<AuditLog>>
  fetchAuditLog(id: string | number): Promise<AuditLog>
}

export interface ImpersonationApi {
  start(userId: number): Promise<ImpersonationResponse>
  stop(): Promise<ImpersonationResponse>
  status(): Promise<ImpersonationResponse>
}

export interface ConfigurationApi {
  fetch(): Promise<Configuration>
  update(payload: ConfigurationUpdatePayload): Promise<Configuration>
}

/**
 * Success body of `GET /api/v1/email-verifications/:token`. `message` is
 * optional because the API returns `status`/`email`/`display_name`; the UI falls
 * back to its own copy.
 */
export interface EmailVerificationResult {
  status: string
  email?: string | null
  display_name?: string | null
  message?: string | null
}

/** 202 body of `POST /api/v1/email-verifications/resend`. */
export interface EmailVerificationResendResult {
  status: string
  email_address?: string | null
  message?: string | null
}

export interface EmailVerificationsApi {
  verify(token: string): Promise<EmailVerificationResult>
  resend(emailAddress: string): Promise<EmailVerificationResendResult>
}

export interface SettingsApi {
  list(): Promise<Setting[]>
  create(payload: { key: string; value: unknown }): Promise<Setting>
  update(id: string | number, payload: { value: unknown }): Promise<Setting>
  destroy(id: string | number): Promise<unknown>
}

export interface TestAccessApi {
  submit(password: string): Promise<TestAccessResponse>
  verify(): Promise<TestAccessResponse>
}


export interface ImagesApi {
  upload(imageableType: ImageableType, imageableId: string | number, files: FileList | File[]): Promise<ImageUploadResponse>
  destroy(imageableType: ImageableType, imageableId: string | number, imageId: number): Promise<unknown>
  reorder(imageableType: ImageableType, imageableId: string | number, orderedIds: number[]): Promise<ImageListResponse>
  setPrimary(imageableType: ImageableType, imageableId: string | number, imageId: number): Promise<ImageListResponse>
}

export interface WineProfileSearchResponse {
  wines: Wine[]
  wine_profiles: UserWineProfile[]
  llm_interpreted?: unknown
}

export interface WineProfilesApi {
  create(profile: Partial<UserWineProfile>): Promise<UserWineProfile>
  update(slug: string, profile: Partial<UserWineProfile>): Promise<UserWineProfile>
  list(): Promise<UserWineProfile[]>
  show(id: string): Promise<UserWineProfile>
  search(query: string, limit?: number): Promise<WineProfileSearchResponse>
}
