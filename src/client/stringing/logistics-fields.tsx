import { handoverTypes, stage, type Logistics, type PlannerRow, type Period, type Stage } from "../../shared/stringing-scheduling";
export function LogisticsFields({ row, onChange }: {
    row: PlannerRow;
    onChange: (fields: Partial<Logistics>) => void;
}) {
    return <fieldset className="logistics-fields wide"><legend>Collection & delivery</legend><div className="edit-grid">
 <label>Racket progress<select value={stage(row)} onChange={e => onChange({ workflowStatus: e.target.value as Stage, ...(e.target.value === "Completed" ? { completedAt: new Date().toISOString() } : {}) })}>{["Awaiting collection", "Ready to string", "Completed", "Delivered"].map(s => <option key={s}>{s}</option>)}</select></label>
 <label>Collection type<select value={row.collectionType || ""} onChange={e => onChange({ collectionType: e.target.value })}><option value="">Choose how it is left</option>{handoverTypes.map(s => <option key={s}>{s}</option>)}</select></label>
 <label>Collect from<input list="handover-places" placeholder="e.g. David Lloyd" value={row.collectionFrom || ""} onChange={e => onChange({ collectionFrom: e.target.value })}/></label>
 <label>Collection date (optional at club)<input type="date" value={row.pickupDate || ""} onChange={e => onChange({ pickupDate: e.target.value })}/></label>
 <label>Collection time<select value={row.pickupPeriod || "Evening"} onChange={e => onChange({ pickupPeriod: e.target.value as Period })}>{["AM", "PM", "Evening"].map(s => <option key={s}>{s}</option>)}</select></label>
 <label>Return to<input list="handover-places" placeholder="e.g. David Lloyd" value={row.deliveryTo || ""} onChange={e => onChange({ deliveryTo: e.target.value })}/></label>
 <label>Delivery type<select value={row.deliveryType || ""} onChange={e => onChange({ deliveryType: e.target.value })}><option value="">Choose how to leave it</option>{handoverTypes.map(s => <option key={s}>{s}</option>)}</select></label>
 <label className="wide">Handover details<input placeholder="Locker number, coach name or address" value={row.handoverNotes || ""} onChange={e => onChange({ handoverNotes: e.target.value })}/></label>
 </div><datalist id="handover-places"><option>David Lloyd</option><option>Client’s house</option><option>Studio</option></datalist><small>Completion date is the stringing deadline. Club collections use your next visit unless you select a date. Returns use the next visit after stringing.</small></fieldset>;
}
