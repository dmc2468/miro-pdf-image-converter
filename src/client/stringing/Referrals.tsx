"use client";
import { useRef, useState } from "react";
import { clientKey, referralTotals, referredClients, type Referrer, type ReferralOrder } from "./referral-rewards";
export function AddReferrer({ referrers, onSave }: {
    referrers: Referrer[];
    onSave: (referrer: Referrer) => void;
}) {
    const [open, setOpen] = useState(false), [name, setName] = useState(""), [ratio, setRatio] = useState("1"), [error, setError] = useState("");
    function add() {
        const count = Number(ratio);
        if (!name.trim() || !Number.isSafeInteger(count) || count < 1) {
            setError("Enter a name and a whole number of referrals (at least 1).");
            return;
        }
        if (referrers.some(r => clientKey(r.name) === clientKey(name))) {
            setError("That referrer already exists. Choose them from the list.");
            return;
        }
        onSave({ id: crypto.randomUUID(), name: name.trim(), referralsPerReward: count });
        setName("");
        setRatio("1");
        setError("");
        setOpen(false);
    }
    return <div className="add-referrer">{open ? <><label>Referrer name<input value={name} onChange={e => setName(e.target.value)}/></label><label>Referrals per free job<input type="number" min="1" step="1" value={ratio} onChange={e => setRatio(e.target.value)}/></label>{error ? <p role="alert">{error}</p> : null}<button type="button" className="secondary" onClick={add}>Save referrer</button> <button type="button" className="secondary" onClick={() => { setOpen(false); setError(""); }}>Cancel</button></> : <button type="button" className="secondary" onClick={() => setOpen(true)}>+ Add referrer</button>}</div>;
}
export function ReferralFields({ order, rows, referrers, onChange, onAdd }: {
    order: ReferralOrder;
    rows: ReferralOrder[];
    referrers: Referrer[];
    onChange: (fields: Partial<ReferralOrder>) => void;
    onAdd: (referrer: Referrer) => void;
}) {
    return <fieldset className="referral-fields wide"><legend>Referrals & free jobs</legend><label>Referred by<select value={order.referrerId || ""} onChange={e => onChange({ referrerId: e.target.value })}><option value="">No referrer</option>{referrers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><p>Counts this client once, across all their orders. Changes apply to all orders for the same client name.</p><AddReferrer referrers={referrers} onSave={r => { onAdd(r); onChange({ referrerId: r.id }); }}/>{order.referrerId ? <><label>Referral reward status<select value={order.referralRedeemed ? "redeemed" : "available"} onChange={e => onChange({ referralRedeemed: e.target.value === "redeemed", referralRewardOrderId: "", referralRedeemedOn: "" })}><option value="available">Not redeemed</option><option value="redeemed">Redeemed</option></select></label>{order.referralRedeemed ? <><label>Reward redemption date<input type="date" value={order.referralRedeemedOn || ""} onChange={e => onChange({ referralRedeemedOn: e.target.value })}/></label><label>Linked free job<select value={order.referralRewardOrderId || ""} onChange={e => onChange({ referralRewardOrderId: e.target.value })}><option value="">Earlier reward — no linked order</option>{rows.filter(r => r.source === "private" && r.rewardForId === order.referrerId).map(r => <option key={r.id} value={r.id}>Job #{(r.row ?? 2) - 2} · {r.name} · {r.date?.slice(0, 10)}</option>)}</select></label><p>A linked free job is counted once. An earlier reward records one used job without changing this client’s charges.</p></> : null}</> : null}<label>Use a free referral job for<select value={order.rewardForId || ""} onChange={e => onChange({ rewardForId: e.target.value })}><option value="">Not a free referral job</option>{referrers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><p>{order.rewardForId ? "Saving records one free job used and sets the price and amount received to \u00A30, marked Paid. Choose this only when providing the free job." : "When providing a referrer\u2019s free job, select them here to reduce the number owed."}</p></fieldset>;
}
function Deal({ referrer, onChange }: {
    referrer: Referrer;
    onChange: (referrer: Referrer) => void;
}) {
    const [editing, setEditing] = useState(false), [ratio, setRatio] = useState(String(referrer.referralsPerReward)), [used, setUsed] = useState(String(referrer.previouslyUsed ?? 0)), [note, setNote] = useState(referrer.historyNote ?? "");
    return editing ? <form className="deal-editor" onSubmit={e => { e.preventDefault(); const count = Number(ratio), previous = Number(used); if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(previous) || previous < 0)
        return; onChange({ ...referrer, referralsPerReward: count, previouslyUsed: previous, historyNote: note.trim() }); setEditing(false); }}><label>Referrals per free job<input required type="number" min="1" step="1" value={ratio} onChange={e => setRatio(e.target.value)}/></label><small>Recalculates rewards from all recorded referrals.</small><label>Previously used free jobs<input required type="number" min="0" step="1" value={used} onChange={e => setUsed(e.target.value)}/></label><small>Free jobs already provided that are not linked to an order as a referral reward. Do not count the same job twice.</small><label>Reward history notes<input value={note} onChange={e => setNote(e.target.value)}/></label><button className="secondary">Save deal</button><button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button></form> : <button type="button" className="edit-button" onClick={() => { setRatio(String(referrer.referralsPerReward)); setUsed(String(referrer.previouslyUsed ?? 0)); setNote(referrer.historyNote ?? ""); setEditing(true); }}>Edit deal</button>;
}
interface ReferralProps {
    onEditClient: (id: string) => void;
    rows: ReferralOrder[];
    referrers: Referrer[];
    onChange: (referrer: Referrer) => void;
    onAdd: (referrer: Referrer) => void;
}
;
function ReferrerSummary({ r, rows, onChange, onEditClient }: {
    r: Referrer;
} & Pick<ReferralProps, "rows" | "onChange" | "onEditClient">) {
    const dialog = useRef<HTMLDialogElement>(null);
    const t = referralTotals(rows, r);
    const [referralSort, setReferralSort] = useState("status");
    const clients = referredClients(rows, r).sort((a, b) => {
        if (referralSort === "client")
            return a.name.localeCompare(b.name);
        if (referralSort === "status" && !!a.referralRedeemed !== !!b.referralRedeemed)
            return Number(!!a.referralRedeemed) - Number(!!b.referralRedeemed);
        const ad = Date.parse(a.date || ""), bd = Date.parse(b.date || "");
        if (!Number.isFinite(ad))
            return Number.isFinite(bd) ? 1 : a.name.localeCompare(b.name);
        if (!Number.isFinite(bd))
            return -1;
        return (referralSort === "oldest" ? ad - bd : bd - ad) || a.name.localeCompare(b.name);
    });
    return <article className="referrer-summary"><div className="referrer-summary-line"><strong>{r.name}</strong><span>{t.referred} referrals</span><span>{t.earned} earned</span><span>{t.used} used</span><strong className="reward-available">{t.owed} free restrings available</strong><button type="button" className="secondary" onClick={() => dialog.current?.showModal()}>Details</button></div><dialog ref={dialog} className="referral-dialog" aria-label={`${r.name} referral details`} onClick={e => { if (e.target === e.currentTarget) {
        const b = e.currentTarget.getBoundingClientRect();
        if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)
            dialog.current?.close();
    } }}><div className="referrer-card"><div className="referral-dialog-head"><h2>{r.name} · Referral rewards</h2><button type="button" className="secondary" onClick={() => dialog.current?.close()}>Close</button></div><p>1 free stringing job per {r.referralsPerReward} referred client{r.referralsPerReward === 1 ? "" : "s"}</p><dl><div><dt>Clients referred</dt><dd>{t.referred}</dd></div><div><dt>Free jobs earned</dt><dd>{t.earned}</dd></div><div><dt>Free jobs used</dt><dd>{t.used}</dd></div><div className="referral-owed"><dt>Free jobs owed</dt><dd>{t.owed}</dd></div></dl><p>{t.untilNext} more referral{t.untilNext === 1 ? "" : "s"} until the next free job.{t.advance ? ` ${t.advance} free job${t.advance === 1 ? "" : "s"} used in advance.` : ""}</p><Deal referrer={r} onChange={onChange}/><details className="referral-client-list" open><summary>Referred clients ({t.referred})</summary><label className="referral-sort">Sort referrals<select value={referralSort} onChange={e => setReferralSort(e.target.value)}><option value="newest">Most recent first</option><option value="oldest">Oldest first</option><option value="client">Client name</option><option value="status">Available first, newest first</option></select></label><p>Referral order uses each client’s first recorded job date.</p><div className="referral-client-scroll"><table><thead><tr><th>Client</th><th>Reward</th><th>Redeemed on</th><th>Free job ref</th><th></th></tr></thead><tbody>{clients.map(client => { const linked = rows.find(job => job.id === client.referralRewardOrderId && job.rewardForId === r.id); return <tr key={client.id}><td>{client.name}</td><td>{client.referralRedeemed ? "Redeemed" : r.referralsPerReward === 1 ? "Available" : "Not redeemed"}</td><td>{client.referralRedeemedOn ? new Date(client.referralRedeemedOn + "T12:00:00").toLocaleDateString("en-GB") : "\u2014"}</td><td>{!client.referralRedeemed ? "-" : linked ? `#${(linked.row ?? 2) - 2}` : "unknown ref"}</td><td><button type="button" className="edit-button" onClick={() => { dialog.current?.close(); onEditClient(client.id); }}>Edit referral</button></td></tr>; })}</tbody></table></div></details></div></dialog></article>;
}
export function Referrals({ rows, referrers, onChange, onAdd, onEditClient }: ReferralProps) {
    return <section className="referrals-card"><div className="referrals-heading"><h2>Referral rewards</h2><AddReferrer referrers={referrers} onSave={onAdd}/></div><div className="referrer-summaries">{referrers.map(r => <ReferrerSummary key={r.id} r={r} rows={rows} onChange={onChange} onEditClient={onEditClient}/>)}</div></section>;
}
