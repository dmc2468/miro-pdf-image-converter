import { useEffect, useMemo, useRef, useState } from "react";
import imported from "./data/orders.json";
import importedAdjustments from "./data/adjustments.json";
import { PrivateBalances } from "./PrivateBalances";
import {
  ProStringAdjustments,
  type Adjustment,
  type Sundry,
} from "./ProStringAdjustments";
import { AdminReports } from "./AdminReports";
import { Analytics } from "./Analytics";
import { NewOrderDialog } from "./NewOrderDialog";
import { SummaryDashboard } from "./SummaryDashboard";
import {
  Expenses,
  StringCosts,
  type Expense,
  type StringPrice,
} from "./Expenses";
type Row = {
  id: string;
  source: "private" | "prostring";
  row: number;
  name: string;
  date?: string | null;
  collectionDate?: string | null;
  racquet?: string | null;
  main?: string | null;
  cross?: string | null;
  tension?: unknown;
  tensionMain?: unknown;
  tensionCross?: unknown;
  status?: string;
  payment?: string;
  customerPrice?: unknown;
  dueToMe?: unknown;
  cashHeld?: unknown;
  received?: unknown;
  overUnder?: unknown;
  stringCost?: unknown;
  labour?: unknown;
  notes?: string | null;
};
type View =
  | "summary"
  | "prostring"
  | "private"
  | "balances"
  | "records"
  | "analytics"
  | "admin"
  | "expenses"
  | "strings";
type SortKey = keyof Row | "balance";
const n = (v: unknown) => (typeof v === "number" ? v : 0);
const gbp = (v: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    v,
  );
const date = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-GB") : "—";
const jobNumber = (r: Row) => (r.source === "private" ? r.row - 2 : r.row - 1);
const orderBalance = (r: Row) =>
  r.source === "prostring" ? n(r.dueToMe) : n(r.customerPrice) - n(r.received);
const startingExpenses: Expense[] = [
  ["Gamma machine", "Equipment", 1375],
  ["Head machine", "Equipment", 4500],
  ["ERSA training", "Training", 225],
  ["ERSA test", "Training", 100],
  ["Sale of Gamma", "Sale", 925],
].map((x, i) => ({
  id: `startup-${i}`,
  date: "2024-01-01",
  supplier: String(x[0]),
  category: String(x[1]),
  description: "Imported from Break Even",
  amount: Number(x[2]),
}));
const baseStrings: StringPrice[] = [
  ["Toroline", "O-Toro", "1.23", "Poly", 9.18,12,78,0,"100m",12],
  ["Toroline", "Toro-Toro", "1.23", "Poly", 6.82,12,58,0,"100m",12],
  ["Toroline", "Wasabi", "1.23", "Poly", 6.82,12,58,0,"100m",12],
  ["Toroline", "Wasabi-X", "1.23", "Poly", 6.82,12,58,0,"100m",12],
  ["Pro String", "Pro Multi", "1.25", "Multifilament", 6,0,0,100,"200m",16],
  ["Head", "Velocity MLT", "1.25", "Multifilament", 4.71,9.47,0,80,"200m",9.47],
  ["Babolat", "XALT", "1.25", "Multifilament", 11.18,7.99,0,190,"200m",7.99],
  ["Tecnifibre", "X-ONE BIPHASE", "1.25", "Multifilament", 12.65,19,0,215,"200m",19],
].map((x, i) => ({
  id: `string-${i}`,
  brand: String(x[0]),
  name: String(x[1]),
  gauge: String(x[2]),
  type: String(x[3]),
  costPerRacket: Number(x[4]),
  setCost: Number(x[5]),reel100Cost:Number(x[6]),reel200Cost:Number(x[7]),purchaseFormat:String(x[8]) as "set"|"100m"|"200m",priceToCustomer:Number(x[9]),
  priceSource:String(x[0]).includes("Toroline")?"ph-tennis":String(x[0]).includes("Pro String")?"manual":"all-things-tennis",
}));
const yonexStrings: StringPrice[] = [
  { id:"yonex-poly-tour-pro-125-blue", brand:"Yonex", name:"Poly Tour Pro", gauge:"1.25", type:"Poly", colour:"Blue", hardness:"1 Soft", characteristics:["Comfort","Power","Spin","Control"], costPerRacket:89.99/17, reel200Cost:89.99, purchaseFormat:"200m", priceToCustomer:9.5, priceSource:"all-things-tennis", reelPriceUrl:"https://allthingstennis.co.uk/products/yonex-poly-tour-pro-1-25-200m-reel-assorted-colours" },
  { id:"yonex-poly-tour-pro-125-yellow", brand:"Yonex", name:"Poly Tour Pro", gauge:"1.25", type:"Poly", colour:"Yellow", hardness:"1 Soft", characteristics:["Comfort","Power","Spin","Control"], costPerRacket:89.99/17, reel200Cost:89.99, purchaseFormat:"200m", priceToCustomer:9.5, priceSource:"all-things-tennis", reelPriceUrl:"https://allthingstennis.co.uk/products/yonex-poly-tour-pro-1-25-200m-reel-assorted-colours" },
  { id:"yonex-poly-tour-pro-120-yellow", brand:"Yonex", name:"Poly Tour Pro", gauge:"1.20", type:"Poly", colour:"Yellow", hardness:"1 Soft", characteristics:["Comfort","Power","Spin","Control"], costPerRacket:89.99/17, reel200Cost:89.99, purchaseFormat:"200m", priceToCustomer:9.5, priceSource:"all-things-tennis", reelPriceUrl:"https://allthingstennis.co.uk/products/yonex-poly-tour-pro-1-25-200m-reel-assorted-colours" },
  { id:"yonex-poly-tour-fire-125-red", brand:"Yonex", name:"Poly Tour Fire (round, silicon infused)", gauge:"1.25", type:"Poly", colour:"Red", hardness:"2 Soft", characteristics:["Spin","Control","Durability"], costPerRacket:99.99/17, reel200Cost:99.99, purchaseFormat:"200m", priceToCustomer:12.99, priceSource:"all-things-tennis", reelPriceUrl:"https://allthingstennis.co.uk/products/yonex-poly-tour-fire-200m-reel" },
  { id:"yonex-poly-tour-spin-125-blue", brand:"Yonex", name:"Poly Tour Spin (pentagonal)", gauge:"1.25", type:"Poly", colour:"Blue", hardness:"3 Medium", characteristics:["Spin"], costPerRacket:79.99/17, reel200Cost:79.99, purchaseFormat:"200m", priceToCustomer:12.99, priceSource:"all-things-tennis", reelPriceUrl:"https://allthingstennis.co.uk/products/yonex-poly-tour-spin-200m-reel-cobalt-blue" },
  { id:"yonex-poly-tour-rev-125-orange", brand:"Yonex", name:"Poly Tour Rev (octagonal, silicon infused)", gauge:"1.25", type:"Poly", colour:"Orange", hardness:"4 Firm", characteristics:["Spin","Control","Durability"], costPerRacket:89.99/17, reel200Cost:89.99, purchaseFormat:"200m", priceToCustomer:12.99, priceSource:"all-things-tennis", reelPriceUrl:"https://allthingstennis.co.uk/products/yonex-poly-tour-rev-1-25mm-200m-reel" },
  { id:"yonex-poly-tour-strike-125-grey", brand:"Yonex", name:"Poly Tour Strike (round)", gauge:"1.25", type:"Poly", colour:"Grey", hardness:"5 Firm", characteristics:["Power","Spin","Control","Durability"], costPerRacket:99.99/17, reel200Cost:99.99, purchaseFormat:"200m", priceToCustomer:12.99, priceSource:"all-things-tennis", reelPriceUrl:"https://allthingstennis.co.uk/products/yonex-poly-tour-strike-200m-reel-iron-grey" },
  { id:"yonex-rexis-comfort-130-white", brand:"Yonex", name:"Rexis Comfort", gauge:"1.30", type:"Multifilament", colour:"White", characteristics:["Comfort"], costPerRacket:0, reel200Cost:0, purchaseFormat:"200m", priceToCustomer:0, priceSource:"all-things-tennis" },
  { id:"yonex-rexis-speed-125-white-clear", brand:"Yonex", name:"Rexis Speed", gauge:"1.25", type:"Multifilament", colour:"White / Clear", characteristics:["Comfort","Power","Responsive"], costPerRacket:0, reel200Cost:0, purchaseFormat:"200m", priceToCustomer:0, priceSource:"all-things-tennis" },
];
const startingStrings: StringPrice[] = [...baseStrings, ...yonexStrings].map(item=>({...item,inStock:true}));
export function StringingTracker({
  token,
  email,
  onLogout,
}: {
  token: string;
  email: string;
  onLogout: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(imported as Row[]),
    [adjustments, setAdjustments] = useState<Adjustment[]>(
      importedAdjustments as Adjustment[],
    ),
    [sundries, setSundries] = useState<Sundry[]>([]),
    [view, setView] = useState<View>("summary"),
    [query, setQuery] = useState(""),
    [undo, setUndo] = useState<Row[] | null>(null),
    [draft, setDraft] = useState<Row | null>(null),
    [sortKey, setSortKey] = useState<SortKey>("row"),
    [sortDir, setSortDir] = useState<"asc" | "desc">("asc"),
    [saveStatus, setSaveStatus] = useState<
      "loading" | "saving" | "saved" | "error"
    >("loading");
  const [expenses, setExpenses] = useState<Expense[]>(startingExpenses),
    [strings, setStrings] = useState<StringPrice[]>(startingStrings);
  const storageReady = useRef(false),
    saveSequence = useRef(0);
  useEffect(() => {
    let active = true;
    fetch("/api/stringing/state", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.status === 401) {
          onLogout();
          throw new Error("session expired");
        }
        if (!response.ok) throw new Error("load failed");
        return response.json();
      })
      .then(async ({ state }) => {
        if (!active) return;
        if (state) {
          setRows(state.rows);
          setAdjustments(state.adjustments);
          setSundries(state.sundries ?? []);
          setExpenses(state.expenses ?? startingExpenses);
          const storedStrings=state.strings??[];
          const mergedStrings=[...startingStrings.map(seed=>({...seed,...storedStrings.find((item:StringPrice)=>item.id===seed.id)})),...storedStrings.filter((item:StringPrice)=>!startingStrings.some(seed=>seed.id===item.id))];
          setStrings(mergedStrings.map((item:StringPrice)=>item.id==="string-4"&&item.priceToCustomer===6?{...item,priceToCustomer:16,priceSource:"manual"}:item));
          storageReady.current = true;
          setSaveStatus("saved");
          return;
        }
        setSaveStatus("saving");
        const response = await fetch("/api/stringing/state", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rows, adjustments, sundries, expenses, strings }),
        });
        if (response.status === 401) {
          onLogout();
          throw new Error("session expired");
        }
        if (!response.ok) throw new Error("initial save failed");
        if (active) {
          storageReady.current = true;
          setSaveStatus("saved");
        }
      })
      .catch(() => {
        if (active) setSaveStatus("error");
      });
    return () => {
      active = false;
    };
  }, [token, onLogout]);
  useEffect(() => {
    if (!storageReady.current) return;
    const sequence = ++saveSequence.current;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      fetch("/api/stringing/state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows, adjustments, sundries, expenses, strings }),
      })
        .then((response) => {
          if (response.status === 401) {
            onLogout();
            throw new Error("session expired");
          }
          if (!response.ok) throw new Error("save failed");
          if (sequence === saveSequence.current) setSaveStatus("saved");
        })
        .catch(() => {
          if (sequence === saveSequence.current) setSaveStatus("error");
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [rows, adjustments, sundries, expenses, strings, token, onLogout]);
  const shown = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (view === "records" || r.source === view) &&
            (!query ||
              JSON.stringify(r).toLowerCase().includes(query.toLowerCase())),
        )
        .sort((a, b) => {
          const av =
              sortKey === "balance"
                ? orderBalance(a)
                : sortKey === "date"
                  ? new Date(String(a[sortKey] || 0)).valueOf()
                  : (a[sortKey] ?? ""),
            bv =
              sortKey === "balance"
                ? orderBalance(b)
                : sortKey === "date"
                  ? new Date(String(b[sortKey] || 0)).valueOf()
                  : (b[sortKey] ?? "");
          const result =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv), undefined, {
                  numeric: true,
                  sensitivity: "base",
                });
          return sortDir === "asc" ? result : -result;
        }),
    [rows, view, query, sortKey, sortDir],
  );
  const pro = rows.filter((r) => r.source === "prostring"),
    priv = rows.filter((r) => r.source === "private");
  const jobBalance = pro.reduce((s, r) => s + n(r.dueToMe) - n(r.cashHeld), 0),
    adjustmentBalance = adjustments.reduce(
      (s, a) => s + (a.type === "supplied" ? -a.amount : a.amount),
      0,
    ),
    dueToMe = jobBalance + adjustmentBalance;
  const privateOutstanding = priv
    .filter((r) => String(r.payment).toLowerCase() === "unpaid")
    .reduce((s, r) => s + n(r.customerPrice), 0);
  const privateIncome=priv.reduce((sum,row)=>sum+n(row.customerPrice),0),
    privateProfit=priv.reduce((sum,row)=>sum+n(row.customerPrice)-n(row.stringCost),0),
    proIncome=pro.reduce((sum,row)=>sum+n(row.customerPrice),0);
  function setPayment(row: Row, value: string) {
    if (value === "Paid") {
      setDraft({
        ...row,
        payment: "Paid",
        received: n(row.received) || n(row.customerPrice),
      });
      return;
    }
    setUndo(rows);
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? {
              ...r,
              payment: value,
              received: value === "Unpaid" ? 0 : r.received,
            }
          : r,
      ),
    );
  }
  function saveDraft() {
    if (!draft) return;
    const original = rows.find((r) => r.id === draft.id),
      paymentChanged =
        draft.source === "prostring" && original?.payment !== draft.payment;
    const saved = paymentChanged
      ? {
          ...draft,
          cashHeld: draft.payment === "Paid Cash" ? n(draft.customerPrice) : 0,
        }
      : draft;
    setUndo(rows);
    setRows((rs) => rs.map((r) => (r.id === saved.id ? saved : r)));
    setDraft(null);
  }
  return (
    <main className="stringing-root app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">SM</div>
          <div>
            <strong>Studio McLeod</strong>
            <span>Private tools</span>
          </div>
        </div>
        <nav>
          <a className="nav-item stringing-tools-link" href="/miro-converter">
            ← Studio tools
          </a>
          <p className="nav-heading">STRINGING</p>
          {(
            [
              ["summary", "Summary"],
              ["prostring", "ProString jobs"],
              ["private", "Private clients"],
              ["balances", "Private balances"],
              ["records", "All records"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={"nav-item " + (view === id ? "active" : "")}
            >
              {label}
            </button>
          ))}
          <p className="nav-heading second">ADMIN</p>
          <button
            onClick={() => setView("analytics")}
            className={"nav-item " + (view === "analytics" ? "active" : "")}
          >
            Analytics
          </button>
          <button
            onClick={() => setView("admin")}
            className={"nav-item " + (view === "admin" ? "active" : "")}
          >
            Reports
          </button>
          <button onClick={() => setView("expenses")} className={"nav-item " + (view === "expenses" ? "active" : "")}>Expenses</button>
          <p className="nav-heading second">REFERENCE</p>
          <button onClick={() => setView("strings")} className={"nav-item " + (view === "strings" ? "active" : "")}>String Prices</button>
        </nav>
        <div className={"sidebar-user storage-status " + saveStatus}>
          <span>
            {saveStatus === "loading"
              ? "Connecting…"
              : saveStatus === "saving"
                ? "Saving online…"
                : saveStatus === "saved"
                  ? "Saved online"
                  : "Storage error"}
          </span>
          <small>
            {rows.length} records · {email}
          </small>
          <button className="stringing-logout" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <section className="content">
        <header className="mobile-header">
          <div className="brand-mark small">SM</div>
          <strong>Stringing tracker</strong>
        </header>
        <div className="page-head">
          <div>
            <p className="eyebrow">STRINGING TRACKER</p>
            <h1>
              {
                {
                  summary: "Summary",
                  prostring: "ProString jobs",
                  private: "Private clients",
                  balances: "Private balances",
                  records: "All records",
                  analytics: "Monthly analytics",
                  admin: "Admin & reports",
                  expenses: "Expenses & break even",
                  strings: "String Prices",
                }[view]
              }
            </h1>
            <p>
              {view === "summary"
                ? "Your stringing business at a glance."
                : view === "analytics"
                ? "Compare monthly ProString and private-client performance."
                : view === "admin"
                  ? "Create, download and print private-client reports."
                  : view === "records"
                    ? "Your complete spreadsheet-style history in one place."
                    : view === "balances"
                      ? "See who owes you and who has money on account."
                      : view === "prostring"
                        ? "Track your fee and cash received; payments made directly to Ray need no follow-up."
                        : view === "private"
                          ? "Orders and payments made directly to you."
                          : "Only payments that need your attention."}
            </p>
          </div>
          <div className="head-actions">
            {undo && !["summary","admin","analytics","expenses","strings"].includes(view) ? (
              <button
                className="secondary"
                onClick={() => {
                  setRows(undo);
                  setUndo(null);
                }}
              >
                ↶ Undo
              </button>
            ) : null}
            {!["summary","admin","analytics","expenses","strings"].includes(view) ? (
              <NewOrderDialog
                rows={rows}
                strings={strings}
                onAdd={(row) => {
                  setUndo(rows);
                  setRows((current) => [...current, row as Row]);
                  setQuery("");
                  setView(row.source === "prostring" ? "prostring" : "private");
                }}
              />
            ) : null}
          </div>
        </div>
        {!["summary","admin","analytics","expenses","strings"].includes(view) ? (
          <div className="summary-grid">
            <article className="summary-card">
              <span>Due to you from ProString</span>
              <strong>{gbp(dueToMe)}</strong>
              <small>Fees less cash you already hold</small>
            </article>
            <article className="summary-card">
              <span>Private clients unpaid</span>
              <strong>{gbp(privateOutstanding)}</strong>
              <small>
                {
                  priv.filter(
                    (r) => String(r.payment).toLowerCase() === "unpaid",
                  ).length
                }{" "}
                orders
              </small>
            </article>
            <article className="summary-card">
              <span>Historical jobs</span>
              <strong>{rows.length}</strong>
              <small>
                {pro.length} ProString · {priv.length} private
              </small>
            </article>
          </div>
        ) : null}
        {view === "summary" ? <SummaryDashboard rows={rows} adjustments={adjustments} expenses={expenses} /> : null}
        {view === "analytics" ? <Analytics rows={rows} /> : null}
        {view === "expenses" ? <Expenses items={expenses} onChange={setExpenses} token={token} grossProfit={4558+rows.filter(r=>r.id.startsWith("new-")).reduce((s,r)=>s+(r.source==="prostring"?n(r.dueToMe):n(r.customerPrice)-n(r.stringCost)),0)} /> : null}
        {view === "strings" ? <StringCosts items={strings} onChange={setStrings} /> : null}
        {view === "balances" ? (
          <PrivateBalances
            rows={rows}
            onSelectClient={(name) => {
              setQuery(name);
              setView("private");
            }}
          />
        ) : view === "admin" ? (
          <AdminReports rows={rows} adjustments={adjustments} />
        ) : view === "summary" || view === "expenses" || view === "strings" || view === "analytics" ? (
          null
        ) : (
          <>
            <div className="toolbar">
              <div>
                <h2>{view === "records" ? "Complete history" : "Orders"}</h2>
                <p>Imported from your Google Sheet in its original order.</p>
              </div>
              <div className="table-tools">
                <input
                  className="search"
                  placeholder="Search client, racket or string…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <label>
                  Sort by{" "}
                  <select
                    value={String(sortKey)}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                  >
                    <option value="row">Job #</option>
                    <option value="date">Drop-off date</option>
                    <option value="collectionDate">Collection date</option>
                    <option value="name">Client</option>
                    <option value="payment">Paid / unpaid</option>
                    <option value="customerPrice">Customer price</option>
                    <option value="balance">Balance</option>
                  </select>
                </label>
                <button
                  className="sort-arrow"
                  title={sortDir === "asc" ? "Ascending" : "Descending"}
                  aria-label={
                    sortDir === "asc" ? "Sort ascending" : "Sort descending"
                  }
                  onClick={() =>
                    setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                  }
                >
                  {sortDir === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>
            <div className="records-wrap">
              <table>
                <thead>
                  <tr>
                    {view === "records" ? (
                      <th>Source</th>
                    ) : null}
                    <th>Job #</th>
                    <th>Drop-off</th>
                    <th>Collection</th>
                    <th>Client</th>
                    <th>Racket</th>
                    <th>String setup</th>
                    <th>Tension</th>
                    <th>Customer price</th>
                    {view === "private" ? (
                      <><th>String cost</th><th>Profit</th></>
                    ) : null}
                    <th>Payment</th>
                    <th>{view === "prostring" ? "Due to DM" : "Balance"}</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      {view === "records" ? (
                        <td>
                          <span className={"source " + r.source}>
                            {r.source === "prostring" ? "ProString" : "Private"}
                          </span>
                        </td>
                      ) : null}
                      <td>{jobNumber(r)}</td>
                      <td>{date(r.date)}</td>
                      <td className="collection-date">
                        {date(r.collectionDate)}
                      </td>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td>{r.racquet || "—"}</td>
                      <td>
                        {[r.main, r.cross].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td>
                        {String(
                          r.tension ??
                            ([r.tensionMain, r.tensionCross]
                              .filter(Boolean)
                              .join(" / ") ||
                              "—"),
                        )}
                      </td>
                      <td>{gbp(n(r.customerPrice))}</td>
                      {view === "private" ? (
                        <><td>{gbp(n(r.stringCost))}</td><td><strong>{gbp(n(r.customerPrice) - n(r.stringCost))}</strong></td></>
                      ) : null}
                      <td>
                        {r.source === "private" ? (
                          <select
                            value={r.payment || "Unknown"}
                            onChange={(e) => setPayment(r, e.target.value)}
                          >
                            <option>Paid</option>
                            <option>Unpaid</option>
                            <option>Unknown</option>
                          </select>
                        ) : (
                          <span
                            className={
                              "payment-status " +
                              (r.payment === "Paid to Ray"
                                ? "paid"
                                : r.payment === "Paid Cash"
                                  ? "over"
                                  : "unpaid")
                            }
                          >
                            {r.payment}
                          </span>
                        )}
                      </td>
                      <td>
                        {orderBalance(r) === 0 ? (
                          <span className="settled">—</span>
                        ) : r.source === "prostring" ? (
                          <span>{gbp(orderBalance(r))}</span>
                        ) : (
                          <span
                            className={
                              orderBalance(r) > 0 ? "owes-you" : "you-owe"
                            }
                          >
                            {gbp(Math.abs(orderBalance(r)))}{" "}
                            {orderBalance(r) > 0 ? "owed" : "credit"}
                          </span>
                        )}
                      </td>
                      <td className="notes">{r.notes || "—"}</td>
                      <td>
                        <button
                          className="edit-button"
                          onClick={() => setDraft({ ...r })}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {view === "private" ? (
                  <tfoot><tr className="records-total-row"><td><strong>Totals</strong><small>{priv.length} orders</small></td>{Array.from({length:6},(_,index)=><td key={`private-total-before-${index}`}></td>)}<td className="total-value"><span>Total income</span><strong>{gbp(privateIncome)}</strong></td><td></td><td className="total-value"><span>Total profit</span><strong>{gbp(privateProfit)}</strong></td>{Array.from({length:4},(_,index)=><td key={`private-total-after-${index}`}></td>)}</tr></tfoot>
                ) : view === "prostring" ? (
                  <tfoot><tr className="records-total-row"><td><strong>Totals</strong><small>{pro.length} orders</small></td>{Array.from({length:6},(_,index)=><td key={`pro-total-before-${index}`}></td>)}<td className="total-value"><span>Total income</span><strong>{gbp(proIncome)}</strong></td><td></td><td className="due-total"><div><span>Before adjustments</span><strong>{gbp(jobBalance)}</strong></div><div><span>After adjustments</span><strong>{gbp(dueToMe)}</strong></div></td><td></td><td></td></tr></tfoot>
                ) : null}
              </table>
            </div>
            {view === "prostring" ? (
              <ProStringAdjustments
                items={adjustments}
                onChange={setAdjustments}
                sundries={sundries}
                onSundriesChange={setSundries}
              />
            ) : null}
          </>
        )}
      </section>
      {draft ? (
        <div className="modal-backdrop" onMouseDown={() => setDraft(null)}>
          <form
            className="edit-modal"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              saveDraft();
            }}
          >
            <div className="edit-head">
              <div>
                <p className="eyebrow">EDIT RECORD</p>
                <h2>{draft.name}</h2>
                <small>
                  {draft.source === "prostring"
                    ? "ProString job"
                    : "Private client"}{" "}
                  · sheet row {draft.row}
                </small>
              </div>
              <button type="button" onClick={() => setDraft(null)}>
                ×
              </button>
            </div>
            <div className="edit-grid">
              {(
                [
                  ["Drop-off date", "date", "date"],
                  ["Collection date", "collectionDate", "date"],
                  ["Client", "name", "text"],
                  ["Racket", "racquet", "text"],
                  ["Main string", "main", "text"],
                  ["Cross string", "cross", "text"],
                  [
                    "Tension",
                    draft.source === "private" ? "tension" : "tensionMain",
                    "text",
                  ],
                  ["Customer price", "customerPrice", "number"],
                  ...(draft.source === "private"
                    ? [
                        ["String cost", "stringCost", "number"],
                        ["Amount received", "received", "number"],
                      ]
                    : [
                        ["Due to you", "dueToMe", "number"],
                        ["Cash held", "cashHeld", "number"],
                      ]),
                ] as [string, keyof Row, string][]
              ).map(([label, key, type]) => (
                <label key={String(key)}>
                  {label}
                  <input
                    type={type}
                    step={type === "number" ? "0.01" : undefined}
                    value={
                      type === "date"
                        ? String(draft[key] || "").slice(0, 10)
                        : String(draft[key] ?? "")
                    }
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [key]:
                          type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Payment
                <select
                  value={draft.payment || "Unknown"}
                  onChange={(e) =>
                    setDraft({ ...draft, payment: e.target.value })
                  }
                >
                  {draft.source === "prostring" ? (
                    <>
                      <option>Paid to Ray</option>
                      <option>Paid Cash</option>
                      <option>Unpaid</option>
                    </>
                  ) : (
                    <>
                      <option>Paid</option>
                      <option>Unpaid</option>
                      <option>Unknown</option>
                    </>
                  )}
                </select>
              </label>
              <label className="wide">
                Notes
                <textarea
                  value={draft.notes || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
              <button className="primary">Save changes</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
