"use client";
import { useMemo, useState } from "react";

export type OrderRow = {
  id: string;
  source: string;
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
  stringCost?: unknown;
  notes?: string | null;
};
const n = (value: unknown) => (typeof value === "number" ? value : 0);
const empty = (
  source: "private" | "prostring",
  rows: OrderRow[],
): OrderRow => ({
  id: `new-${Date.now()}`,
  source,
  row:
    Math.max(
      source === "private" ? 2 : 1,
      ...rows.filter((r) => r.source === source).map((r) => r.row),
    ) + 1,
  name: "",
  date: new Date().toISOString().slice(0, 10),
  collectionDate: "",
  racquet: "",
  main: "",
  cross: "",
  tension: "",
  tensionMain: "",
  customerPrice: 0,
  dueToMe: 0,
  cashHeld: 0,
  received: 0,
  status: "To Do",
  payment: source === "private" ? "Unpaid" : "Paid to Ray",
  notes: "",
});

export function NewOrderDialog({
  rows,
  strings,
  onAdd,
}: {
  rows: OrderRow[];
  strings: {id:string;brand:string;name:string;gauge:string;costPerRacket:number;priceToCustomer?:number;customerPriceOverride?:number|null}[];
  onAdd: (row: OrderRow) => void;
}) {
  const [draft, setDraft] = useState<OrderRow | null>(null),
    [repeat, setRepeat] = useState("");
  const source = (draft?.source === "prostring" ? "prostring" : "private") as
    | "private"
    | "prostring";
  const stringLabel = (item: (typeof strings)[number]) =>
    `${item.brand} ${item.name}${item.gauge ? ` · ${item.gauge} mm` : ""}`;
  const selectedStringValue = draft
    ? strings.find(
        (item) =>
          stringLabel(item) === draft.main ||
          `${item.brand} ${item.name}` === draft.main,
      )
    : undefined;
  const customers = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .filter((r) => r.source === source)
            .map((r) => r.name.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [rows, source],
  );
  const changeSource = (next: "private" | "prostring") => {
    setRepeat("");
    setDraft(empty(next, rows));
  };
  const chooseRepeat = (name: string) => {
    setRepeat(name);
    if (!name) {
      setDraft(empty(source, rows));
      return;
    }
    const previous = rows
      .filter((r) => r.source === source && r.name.trim() === name)
      .sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || "")),
      )[0];
    if (!previous) return;
    const fresh = empty(source, rows);
    setDraft({
      ...fresh,
      name: previous.name,
      racquet: previous.racquet,
      main: previous.main,
      cross: previous.cross,
      tension: previous.tension,
      tensionMain: previous.tensionMain,
      tensionCross: previous.tensionCross,
      customerPrice: previous.customerPrice,
      dueToMe: previous.dueToMe,
      stringCost: previous.stringCost,
      notes: "",
    });
  };
  const save = () => {
    if (!draft || !draft.name.trim() || !draft.date || !draft.collectionDate)
      return;
    const result =
      draft.source === "private"
        ? {
            ...draft,
            received:
              draft.payment === "Paid"
                ? n(draft.received) || n(draft.customerPrice)
                : n(draft.received),
          }
        : {
            ...draft,
            cashHeld:
              draft.payment === "Paid Cash" ? n(draft.customerPrice) : 0,
          };
    onAdd(result);
    setDraft(null);
    setRepeat("");
  };
  return (
    <>
      <button
        className="primary"
        onClick={() => setDraft(empty("private", rows))}
      >
        + New order
      </button>
      {draft ? (
        <div className="modal-backdrop" onMouseDown={() => setDraft(null)}>
          <form
            className="edit-modal new-order-modal"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="edit-head">
              <div>
                <p className="eyebrow">NEW ORDER</p>
                <h2>Add stringing job</h2>
                <small>Start fresh or reuse a previous customer’s setup.</small>
              </div>
              <button type="button" onClick={() => setDraft(null)}>
                ×
              </button>
            </div>
            <div className="new-order-start">
              <label>
                Order type
                <select
                  value={source}
                  onChange={(e) =>
                    changeSource(e.target.value as "private" | "prostring")
                  }
                >
                  <option value="private">Private client</option>
                  <option value="prostring">ProString</option>
                </select>
              </label>
              <label>
                Repeat customer
                <select
                  value={repeat}
                  onChange={(e) => chooseRepeat(e.target.value)}
                >
                  <option value="">New customer / blank form</option>
                  {customers.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
            </div>
            {repeat ? (
              <div className="repeat-note">
                Copied the most recent setup for <strong>{repeat}</strong>.
                Change anything needed below.
              </div>
            ) : null}
            <div className="edit-grid">
              <label>
                Drop-off date
                <input
                  required
                  type="date"
                  value={String(draft.date || "").slice(0, 10)}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <label>
                Collection date
                <input
                  required
                  type="date"
                  min={String(draft.date || "").slice(0, 10)}
                  value={String(draft.collectionDate || "").slice(0, 10)}
                  onChange={(e) =>
                    setDraft({ ...draft, collectionDate: e.target.value })
                  }
                />
              </label>
              <label>
                Client
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Racket
                <input
                  value={draft.racquet || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, racquet: e.target.value })
                  }
                />
              </label>
              <label>
                Main string
                <select value={selectedStringValue ? stringLabel(selectedStringValue) : draft.main || ""} onChange={(e) => {const selected=strings.find(x=>stringLabel(x)===e.target.value);setDraft({...draft,main:e.target.value,stringCost:selected?.costPerRacket??0,customerPrice:selected?.customerPriceOverride??selected?.priceToCustomer??draft.customerPrice})}}><option value="">Choose string and gauge</option>{draft.main&&!selectedStringValue?<option value={draft.main}>{draft.main} (existing)</option>:null}{strings.map(x=><option key={x.id} value={stringLabel(x)}>{stringLabel(x)}</option>)}</select>
              </label>
              <label>String cost<input readOnly type="number" value={n(draft.stringCost)} /></label>
              <label>
                Cross string
                <input
                  value={draft.cross || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, cross: e.target.value })
                  }
                />
              </label>
              <label>
                Tension
                <input
                  value={String(
                    source === "private"
                      ? (draft.tension ?? "")
                      : (draft.tensionMain ?? ""),
                  )}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [source === "private" ? "tension" : "tensionMain"]:
                        e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Customer price
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={n(draft.customerPrice)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      customerPrice: Number(e.target.value),
                    })
                  }
                />
              </label>
              {source === "private" ? (
                <label>
                  Amount received
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={n(draft.received)}
                    onChange={(e) =>
                      setDraft({ ...draft, received: Number(e.target.value) })
                    }
                  />
                </label>
              ) : (
                <label>
                  Due to DM
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={n(draft.dueToMe)}
                    onChange={(e) =>
                      setDraft({ ...draft, dueToMe: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <label>
                Job status
                <select
                  value={["complete", "completed"].includes(String(draft.status).toLowerCase()) ? "Completed" : "To Do"}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  <option>To Do</option>
                  <option>Completed</option>
                </select>
              </label>
              <label>
                Payment
                <select
                  value={draft.payment}
                  onChange={(e) =>
                    setDraft({ ...draft, payment: e.target.value })
                  }
                >
                  {source === "private" ? (
                    <>
                      <option>Unpaid</option>
                      <option>Paid</option>
                      <option>Unknown</option>
                    </>
                  ) : (
                    <>
                      <option>Paid to Ray</option>
                      <option>Paid Cash</option>
                      <option>Unpaid</option>
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
              <button className="primary">Add order</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
