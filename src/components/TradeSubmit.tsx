import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { tradeApi, countriesApi, winesApi } from "../services/api";
import type {
  TradeContactInput,
  TradeSubmissionResponse,
  TradeWineInput,
} from "../types/trade";
import type { CountryListItem } from "../types/reference";
import { useAuth } from "../contexts/AuthContext";
import styles from "./trade.module.css";

const draftKey = "wine_words_trade_submission_draft";
// The vintage picker defaults to the current calendar year; NV/MV are the
// non-numeric options offered alongside the last 20 years.
const currentYear = String(new Date().getFullYear());
const vintageOptions = (): string[] => {
  const year = new Date().getFullYear();
  const years: string[] = [];
  for (let y = year; y >= year - 20; y -= 1) years.push(String(y));
  return ["NV", "MV", ...years];
};
const blankWine = (): TradeWineInput => ({
  wine_name: "",
  vintage: currentYear,
  region: "",
  appellation: "",
  grape_varieties: "",
  abv: "",
  volume_ml: "750",
  closure_type: "",
  tasting_notes: "",
  technical_sheet_url: "",
  trade_price: "",
  retail_price: "",
  sample_available: false,
  sample_quantity: "",
});
const blankContact: TradeContactInput = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  country: "Australia",
  website: "",
  role: "winery",
  notes: "",
};

function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function TradeSubmit() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<TradeContactInput>(blankContact);
  const [wines, setWines] = useState<TradeWineInput[]>([blankWine()]);
  const [wineEntryMode, setWineEntryMode] = useState<"quantity" | "details">(
    "details",
  );
  const [wineQuantity, setWineQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TradeSubmissionResponse | null>(null);
  // Anonymous submitters see only name + email; everything else sits behind
  // this toggle until they choose to share more.
  const [showExtra, setShowExtra] = useState(false);
  // Per-wine "additional details" toggles and the catalogue search state for
  // the wine-name picker (only one row searches at a time).
  const [wineExtrasOpen, setWineExtrasOpen] = useState<Record<number, boolean>>(
    {},
  );
  const [wineSearch, setWineSearch] = useState<{
    index: number | null;
    query: string;
    results: Array<{ id: number; name: string }>;
    searching: boolean;
  }>({ index: null, query: "", results: [], searching: false });
  // Country dropdown options — loaded once from the public countries endpoint.
  const [countries, setCountries] = useState<CountryListItem[]>([]);

  useEffect(() => {
    countriesApi
      .list()
      .then((data) => setCountries(Array.isArray(data) ? data : []))
      .catch(() => setCountries([])); // dropdown falls back to just Australia
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let draftWines: TradeWineInput[] | null = null;
    let savedContact: TradeContactInput | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved?.wines?.length) draftWines = saved.wines;
      if (saved?.contact) savedContact = saved.contact;
    } catch {}
    if (isAuthenticated && user) {
      // Signed-in submitters skip the contact step entirely: the snapshot is
      // derived from their account, so the wizard opens straight on Wines.
      setContact({
        ...blankContact,
        company_name: user.display_name || user.first_name || "",
        contact_name: user.display_name || user.first_name || "",
        email: user.email || "",
      });
      setWines(draftWines?.length ? draftWines : [blankWine()]);
      setStep(1);
    } else {
      if (savedContact) setContact({ ...blankContact, ...savedContact });
      setWines(draftWines?.length ? draftWines : [blankWine()]);
    }
  }, [authLoading, isAuthenticated, user]);
  useEffect(() => {
    if (!authLoading)
      localStorage.setItem(draftKey, JSON.stringify({ contact, wines }));
  }, [contact, wines, authLoading]);

  // Signed-in users have no contact step to validate; anonymous submitters
  // need only a contact name and a valid email (everything else is optional).
  const validContact = isAuthenticated
    ? Boolean(user?.email)
    : Boolean(contact.contact_name && /.+@.+\..+/.test(contact.email));
  const validWines =
    wineEntryMode === "quantity"
      ? Number(wineQuantity) >= 1 && Number(wineQuantity) <= 30
      : wines.length > 0 && wines.every((wine) => wine.wine_name.trim());
  const duplicateWines = useMemo(
    () =>
      new Set(
        wines.map(
          (wine) => `${wine.wine_name.trim().toLowerCase()}-${wine.vintage}`,
        ),
      ).size !== wines.length,
    [wines],
  );

  function updateContact(key: keyof TradeContactInput, value: string) {
    setContact((current) => ({ ...current, [key]: value }));
  }
  function updateWine(
    index: number,
    key: keyof TradeWineInput,
    value: string | boolean,
  ) {
    setWines((current) =>
      current.map((wine, i) =>
        i === index ? { ...wine, [key]: value } : wine,
      ),
    );
  }

  // Wine-name picker: debounced catalogue search. Selecting a suggestion fills
  // the plain-text wine_name — the value stays text with no catalogue linkage.
  const wineSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleWineNameInput(index: number, value: string) {
    updateWine(index, "wine_name", value);
    const q = value.trim();
    if (wineSearchTimer.current) clearTimeout(wineSearchTimer.current);
    if (q.length < 2) {
      setWineSearch({ index, query: value, results: [], searching: false });
      return;
    }
    wineSearchTimer.current = setTimeout(() => {
      setWineSearch({ index, query: value, results: [], searching: true });
      winesApi
        .search(q)
        .then((data) => {
          const list = (Array.isArray(data) ? data : []) as Array<{
            id: number;
            name: string;
          }>;
          setWineSearch({
            index,
            query: value,
            results: list.slice(0, 6),
            searching: false,
          });
        })
        .catch(() =>
          setWineSearch({ index, query: value, results: [], searching: false }),
        );
    }, 300);
  }
  function next() {
    setError(null);
    if (step === 0 && !validContact)
      return setError("Please complete your contact name and email.");
    if (
      step === 1 &&
      (!validWines || (wineEntryMode === "details" && duplicateWines))
    )
      return setError(
        wineEntryMode === "details" && duplicateWines
          ? "Each wine and vintage must be unique."
          : "Choose an amount from 1 to 30 wines.",
      );
    setStep((current) => Math.min(2, current + 1));
  }
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const submissionWines =
        wineEntryMode === "quantity"
          ? Array.from({ length: Number(wineQuantity) }, (_, i) => ({
              ...blankWine(),
              wine_name: `Wine ${i + 1}`,
              vintage: currentYear,
            }))
          : wines;
      const response = await tradeApi.submit(
        {
          contact_snapshot: contact,
          wines: submissionWines.map((wine) => ({
            ...wine,
            vintage: wine.vintage,
            quantity: wine.quantity ? Number(wine.quantity) : 1,
            abv: wine.abv ? Number(wine.abv) : undefined,
            volume_ml: wine.volume_ml ? Number(wine.volume_ml) : undefined,
            trade_price: wine.trade_price || undefined,
            retail_price: wine.retail_price || undefined,
            sample_quantity: wine.sample_quantity
              ? Number(wine.sample_quantity)
              : undefined,
          })),
        },
        idempotencyKey(),
      );
      localStorage.removeItem(draftKey);
      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Submission failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  // Redirect authenticated users after successful submission
  useEffect(() => {
    if (result && isAuthenticated) {
      navigate(`/trade/my-packages/${result.package_reference}`);
    }
  }, [result, isAuthenticated]);

  if (result) {
    if (isAuthenticated) {
      return <div className={styles.page}><p>Redirecting to your package…</p></div>;
    }
    return (
      <div className={styles.page}>
        <div className={styles.hero}>
          <h1>Submission received</h1>
          <p>
            Thank you. Wine Words will review the information and contact you at{" "}
            {contact.email}.
          </p>
        </div>
        <div className={styles.card}>
          <h2>Keep this guest access link</h2>
          <p className={styles.muted}>
            You can use this private link to follow the package without creating
            an account.
          </p>
          <div className={styles.linkBox}>{result.guest_url}</div>
          <div className={styles.actions}>
            <button
              className="wine-btn wine-btn--primary"
              onClick={() => navigator.clipboard?.writeText(result.guest_url)}
            >
              Copy link
            </button>
            <Link
              className="wine-btn wine-btn--secondary"
              to={`/trade/packages/${result.guest_token}`}
            >
              Open package
            </Link>
            <button
              className="wine-btn wine-btn--ghost"
              onClick={() => navigate("/")}
            >
              Return home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading)
    return (
      <div className={styles.page}>
        <p>Loading…</p>
      </div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>Submit a wine</h1>
        <p>
          Share one or more wines with the Wine Words editorial team. No account
          is required.
        </p>
      </div>
      <div className={styles.steps}>
        {["Contact", "Wines", "Review"].map((label, index) => (
          <span
            key={label}
            className={`${styles.step} ${index === step ? styles.stepActive : ""}`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {step === 0 &&
        (isAuthenticated ? (
          <section className={styles.card}>
            <h2>Contact</h2>
            <p className={styles.muted}>Submitting as</p>
            <p>
              <strong>
                {user?.display_name || user?.first_name || user?.email}
              </strong>
              <br />
              {user?.email}
            </p>
            <p className={styles.muted}>
              This email will be used for all submission communications.
              Continue to add your wines.
            </p>
          </section>
        ) : (
          <section className={styles.card}>
            <h2>Contact</h2>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="contact_name">Contact name *</label>
                <input
                  id="contact_name"
                  type="text"
                  value={contact.contact_name}
                  onChange={(event) =>
                    updateContact("contact_name", event.target.value)
                  }
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  value={contact.email}
                  onChange={(event) =>
                    updateContact("email", event.target.value)
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className="wine-btn wine-btn--ghost"
              onClick={() => setShowExtra((current) => !current)}
            >
              {showExtra
                ? "Hide additional details"
                : "Show additional details (company, address, phone…)"}
            </button>
            {showExtra && (
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label htmlFor="company_name">Producer / company name</label>
                  <input
                    id="company_name"
                    type="text"
                    value={contact.company_name}
                    onChange={(event) =>
                      updateContact("company_name", event.target.value)
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    type="text"
                    value={contact.phone}
                    onChange={(event) =>
                      updateContact("phone", event.target.value)
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="address">Address</label>
                  <input
                    id="address"
                    type="text"
                    value={contact.address}
                    onChange={(event) =>
                      updateContact("address", event.target.value)
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="url"
                    value={contact.website}
                    onChange={(event) =>
                      updateContact("website", event.target.value)
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="country">Country</label>
                  <select
                    id="country"
                    value={contact.country}
                    onChange={(event) =>
                      updateContact("country", event.target.value)
                    }
                  >
                    {countries.length === 0 && (
                      <option value="Australia">Australia</option>
                    )}
                    {countries.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    value={contact.role}
                    onChange={(event) =>
                      updateContact("role", event.target.value)
                    }
                  >
                    {[
                      "winery",
                      "importer",
                      "distributor",
                      "agent",
                      "other",
                    ].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="contact-notes">Notes</label>
                  <textarea
                    id="contact-notes"
                    value={contact.notes}
                    onChange={(event) =>
                      updateContact("notes", event.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </section>
        ))}

      {step === 1 && (
        <section className={styles.card}>
          <h2>Wines</h2>
          <div
            className={styles.wineModeToggle}
            role="group"
            aria-label="How would you like to submit your wines?"
          >
            <button
              type="button"
              className={`wine-btn ${wineEntryMode === "details" ? "wine-btn--primary" : "wine-btn--secondary"}`}
              aria-pressed={wineEntryMode === "details"}
              onClick={() => setWineEntryMode("details")}
            >
              Specify each wine
            </button>
            <button
              type="button"
              className={`wine-btn ${wineEntryMode === "quantity" ? "wine-btn--primary" : "wine-btn--secondary"}`}
              aria-pressed={wineEntryMode === "quantity"}
              onClick={() => setWineEntryMode("quantity")}
            >
              Just the amount
            </button>
          </div>
          {wineEntryMode === "quantity" ? (
            <div className={styles.quantityChoice}>
              <div className={styles.field}>
                <label htmlFor="wine-quantity">
                  How many wines would you like to submit?
                </label>
                <select
                  id="wine-quantity"
                  value={wineQuantity}
                  onChange={(event) => setWineQuantity(event.target.value)}
                >
                  {Array.from({ length: 30 }, (_, index) => index + 1).map(
                    (quantity) => (
                      <option key={quantity} value={quantity}>
                        {quantity}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <p className={styles.muted}>
                You do not need to enter wine names now. Our team can collect
                the details with you later.
              </p>
            </div>
          ) : (
            wines.map((wine, index) => (
              <div className={styles.wineRow} key={index}>
                <div className={styles.wineHeader}>
                  <h3>Wine {index + 1}</h3>
                  {wines.length > 1 && (
                    <button
                      type="button"
                      className="wine-btn wine-btn--ghost"
                      onClick={() =>
                        setWines((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className={styles.grid}>
                  <div className={styles.field}>
                    <label htmlFor={`wine-${index}-wine_name`}>
                      Wine name *
                    </label>
                    <input
                      id={`wine-${index}-wine_name`}
                      type="text"
                      value={wine.wine_name}
                      onChange={(event) =>
                        handleWineNameInput(index, event.target.value)
                      }
                      autoComplete="off"
                    />
                    {wineSearch.index === index && wineSearch.searching && (
                      <p className={styles.muted}>Searching wines…</p>
                    )}
                    {wineSearch.index === index &&
                      wineSearch.results.length > 0 && (
                        <div>
                          {wineSearch.results.map((candidate) => (
                            <button
                              key={candidate.id}
                              type="button"
                              className="wine-btn wine-btn--ghost"
                              onClick={() => {
                                updateWine(index, "wine_name", candidate.name);
                                setWineSearch({
                                  index: null,
                                  query: "",
                                  results: [],
                                  searching: false,
                                });
                              }}
                            >
                              {candidate.name}
                            </button>
                          ))}
                          <p className={styles.muted}>
                            Or keep the name as typed — it will be used exactly
                            as entered.
                          </p>
                        </div>
                      )}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`wine-${index}-vintage`}>Vintage *</label>
                    <select
                      id={`wine-${index}-vintage`}
                      value={wine.vintage}
                      onChange={(event) =>
                        updateWine(index, "vintage", event.target.value)
                      }
                    >
                      <option value="NV">NV (Non vintage)</option>
                      <option value="MV">MV (Multi vintage)</option>
                      {vintageOptions()
                        .filter((v) => v !== "NV" && v !== "MV")
                        .map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="wine-btn wine-btn--ghost"
                  onClick={() =>
                    setWineExtrasOpen((current) => ({
                      ...current,
                      [index]: !current[index],
                    }))
                  }
                >
                  {wineExtrasOpen[index]
                    ? "Hide additional details"
                    : "Show additional details (region, price, notes…)"}
                </button>
                {wineExtrasOpen[index] && (
                  <div className={styles.grid}>
                    {(
                      [
                        "region",
                        "appellation",
                        "grape_varieties",
                        "abv",
                        "volume_ml",
                        "closure_type",
                        "technical_sheet_url",
                        "trade_price",
                        "retail_price",
                      ] as const
                    ).map((key) => (
                      <div className={styles.field} key={key}>
                        <label htmlFor={`wine-${index}-${key}`}>
                          {key.replaceAll("_", " ")}
                        </label>
                        <input
                          id={`wine-${index}-${key}`}
                          type={
                            key === "technical_sheet_url"
                              ? "url"
                              : ["abv", "trade_price", "retail_price"].includes(
                                    key,
                                  )
                                ? "number"
                                : "text"
                          }
                          value={wine[key]}
                          onChange={(event) =>
                            updateWine(index, key, event.target.value)
                          }
                        />
                      </div>
                    ))}
                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <label htmlFor={`wine-${index}-tasting_notes`}>
                        Tasting notes
                      </label>
                      <textarea
                        id={`wine-${index}-tasting_notes`}
                        value={wine.tasting_notes}
                        onChange={(event) =>
                          updateWine(index, "tasting_notes", event.target.value)
                        }
                      />
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={wine.sample_available}
                        onChange={(event) =>
                          updateWine(
                            index,
                            "sample_available",
                            event.target.checked,
                          )
                        }
                      />{" "}
                      Sample available
                    </label>
                    {wine.sample_available && (
                      <div className={styles.field}>
                        <label htmlFor={`wine-${index}-sample_quantity`}>
                          Sample quantity
                        </label>
                        <input
                          id={`wine-${index}-sample_quantity`}
                          type="number"
                          value={wine.sample_quantity}
                          onChange={(event) =>
                            updateWine(
                              index,
                              "sample_quantity",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {wineEntryMode === "details" && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              onClick={() => setWines((current) => [...current, blankWine()])}
            >
              + Add another wine
            </button>
          )}
        </section>
      )}

      {step === 2 && (
        <section className={styles.card}>
          <h2>Review</h2>
          <p>
            {contact.company_name ? (
              <>
                <strong>{contact.company_name}</strong> —{" "}
              </>
            ) : null}
            {contact.contact_name} · {contact.email}
          </p>
          {wineEntryMode === "quantity" ? (
            <>
              <h3>Wines ({wineQuantity})</h3>
              <ul>
                {Array.from({ length: Number(wineQuantity) }, (_, i) => (
                  <li key={`wine-${i + 1}`}>
                    Wine {i + 1} ({currentYear})
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3>Wines ({wines.length})</h3>
              <ul>
                {wines.map((wine) => (
                  <li key={wine.wine_name + "-" + wine.vintage}>
                    {wine.wine_name} ({wine.vintage})
                    {wine.region ? " - " + wine.region : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.muted}>
            By submitting, you will receive a private guest link. Keep it safe;
            it is scoped to this package.
          </p>
        </section>
      )}
      <div className={styles.actions}>
        {step > 0 && (
          <button
            type="button"
            className="wine-btn wine-btn--secondary"
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </button>
        )}
        {step < 2 ? (
          <button
            type="button"
            className="wine-btn wine-btn--primary"
            onClick={next}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="wine-btn wine-btn--primary"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Submitting..." : "Submit wines"}
          </button>
        )}
      </div>
    </div>
  );
}
