import { useEffect, useRef, useState } from "react";
import { slotsFor, prettyDay, slotBlockReason, stage, slotTime, activeManualSlot, type PlannerRow, type PlannerSettings, type Visit } from "../../shared/stringing-scheduling";
export function MoveRacketDialog({ row, rows, days, settings, pickup, now, initialDate, initialSlot, onCancel, onConfirm }: {
    row: PlannerRow;
    rows: PlannerRow[];
    days: string[];
    settings: PlannerSettings;
    pickup?: Visit;
    now: Date;
    initialDate: string;
    initialSlot?: string;
    onCancel: () => void;
    onConfirm: (id: string) => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [date, setDate] = useState(initialDate), [selected, setSelected] = useState(initialSlot || "");
    useEffect(() => { dialog.current?.showModal(); }, []);
    const slots = slotsFor(date, settings);
    const reason = (slot: typeof slots[number]) => slotBlockReason(row, slot, pickup, settings, now) || (rows.some(r => r.id !== row.id && activeManualSlot(r, now, settings) === slot.id && ["Ready to string", "Awaiting collection"].includes(stage(r))) ? "Another manually scheduled racket already uses this slot." : undefined);
    const slot = slots.find(s => s.id === selected);
    const error = slot ? reason(slot) : undefined;
    const late = slot && row.completionDate && slot.date > row.completionDate.slice(0, 10);
    return <dialog className="move-racket-dialog" ref={dialog} aria-labelledby="move-title" onCancel={onCancel} onClick={e => { if (e.target === e.currentTarget)
        onCancel(); }}>
  <form onSubmit={e => { e.preventDefault(); if (slot && !error)
        onConfirm(slot.id); }}>
   <p className="eyebrow">MANUAL SCHEDULE</p><h2 id="move-title">Do you want to override the auto sorting for this job?</h2>
   <p><strong>{row.name}</strong> · {row.racquet || "Racket"}</p>
   <label>Move to date<select value={date} onChange={e => { setDate(e.target.value); setSelected(""); }}>{days.map(day => <option key={day} value={day}>{prettyDay(day)}</option>)}</select></label>
   <label>Stringing slot<select required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a slot</option>{slots.map(s => <option key={s.id} value={s.id} disabled={!!reason(s)}>{s.label} · {slotTime(s)}{reason(s) ? ` — ${reason(s)}` : ""}</option>)}</select></label>
   {error && <p className="move-warning" role="alert">{error}</p>}
   {late && <p className="move-warning" role="alert">This is after the completion date of {prettyDay(row.completionDate!.slice(0, 10))}. Confirming keeps this later date and flags the job for your attention.</p>}
   <p className="move-explanation">This racket will stay in your chosen slot. If it is still unconfirmed after your missed-job grace period, it returns to automatic scheduling. You can also select “Use auto schedule” at any time. Other automatic jobs may move to make room.</p>
   <div className="modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" disabled={!slot || !!error}>Override for this job</button></div>
  </form>
 </dialog>;
}
