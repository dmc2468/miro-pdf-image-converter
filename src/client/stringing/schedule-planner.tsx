"use client";
import { useEffect, useMemo, useState, useRef, type PointerEvent } from "react";
import { SchedulePreferences } from "./schedule-preferences";
import { MoveRacketDialog } from "./move-racket-dialog";
import { StringingCalendar } from "./stringing-calendar";
import { makePlan, slotsFor, visitEnabled, prettyDay, stage, isClub, preferenceOrder, preferenceLabels, toggleStringingSlot, toggleStringingDay, eveningTennis, slotTime, type PlannerRow, type PlannerSettings, type Period, type Logistics } from "../../shared/stringing-scheduling";
export function Planner({ rows, settings, onSettings, onUpdate, onEdit, ready = true }: {
    ready?: boolean;
    rows: PlannerRow[];
    settings: PlannerSettings;
    onSettings: (s: PlannerSettings) => void;
    onUpdate: (id: string, fields: Partial<Logistics>) => void;
    onEdit: (id: string) => void;
}) {
    const [tab, setTab] = useState<"calendar" | "collections" | "deliveries" | "availability" | "preferences">("calendar"), [now, setNow] = useState(() => new Date()), [dragging, setDragging] = useState<string | null>(null), [dropTarget, setDropTarget] = useState<string | null>(null), [move, setMove] = useState<{
        id: string;
        date: string;
        slot?: string;
    } | null>(null);
    useEffect(() => {
        const refresh = () => { if (!dragging)
            setNow(new Date()); };
        const timer = setInterval(refresh, 15000);
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
    }, [dragging]);
    const plan = useMemo(() => makePlan(rows, settings, now), [rows, settings, now]);
    const pending = plan.active.filter(r => stage(r) === "Awaiting collection"), completed = plan.active.filter(r => stage(r) === "Completed");
    useEffect(() => {
        if (!ready || dragging)
            return;
        const assignments = Object.fromEntries(Object.entries(plan.assignments).map(([id, slot]) => [id, slot.id]));
        const old = settings.assignments || {};
        if (Object.keys(old).length !== Object.keys(assignments).length || Object.keys(assignments).some(id => old[id] !== assignments[id]))
            onSettings({ ...settings, assignments });
    }, [plan, settings, onSettings, ready, dragging]);
    const pointerDrag = useRef<{
        id: string;
        pointerId: number;
        x: number;
        y: number;
        moved: boolean;
    } | null>(null);
    function targetAt(x: number, y: number) {
        const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot-id], [data-calendar-day], [data-week-target]");
        if (!target)
            return null;
        if (target.dataset.weekTarget) {
            const date = plan.days.find(d => d >= target.dataset.weekTarget! && d >= plan.today);
            return date ? { key: `week:${target.dataset.weekTarget}`, date } : null;
        }
        const slot = target.dataset.slotId;
        return { key: slot || target.dataset.calendarDay!, date: slot ? slot.split(":")[0] : target.dataset.calendarDay!, slot };
    }
    function beginDrag(e: PointerEvent<HTMLElement>, row: PlannerRow) {
        if (e.button !== 0 || (e.target as HTMLElement).closest("button,input,select"))
            return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerDrag.current = { id: row.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    }
    function moveDrag(e: PointerEvent<HTMLElement>) {
        const drag = pointerDrag.current;
        if (!drag || drag.pointerId !== e.pointerId)
            return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5)
            return;
        drag.moved = true;
        setDragging(drag.id);
        setDropTarget(targetAt(e.clientX, e.clientY)?.key || null);
    }
    function endDrag(e: PointerEvent<HTMLElement>) {
        const drag = pointerDrag.current;
        if (!drag || drag.pointerId !== e.pointerId)
            return;
        const target = drag.moved ? targetAt(e.clientX, e.clientY) : null;
        pointerDrag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        setDragging(null);
        setDropTarget(null);
        if (target)
            requestMove(drag.id, target.date, target.slot);
    }
    const movingRow = move ? plan.active.find(r => r.id === move.id && ["Ready to string", "Awaiting collection"].includes(stage(r))) : undefined;
    function requestMove(id: string, date: string, slot?: string) { if (!plan.active.some(r => r.id === id && ["Ready to string", "Awaiting collection"].includes(stage(r))))
        return; setMove({ id, date, slot }); setDragging(null); setDropTarget(null); }
    const toggleSlot = (id: string) => onSettings(toggleStringingSlot(id, settings));
    function progress(row: PlannerRow) { setNow(new Date()); if (stage(row) === "Awaiting collection")
        onUpdate(row.id, { workflowStatus: "Ready to string" });
    else if (stage(row) === "Ready to string")
        onUpdate(row.id, { workflowStatus: "Completed", completedAt: new Date().toISOString(), manualSlot: null });
    else
        onUpdate(row.id, { workflowStatus: "Delivered", deliveredAt: new Date().toISOString() }); }
    function card(row: PlannerRow, kind: "string" | "collect" | "deliver") {
        return <article className={`racket-card ${kind} ${dragging === row.id ? "dragging" : ""}`} key={row.id} data-draggable-racket={kind === "string" ? "true" : undefined} onPointerDown={e => { if (kind === "string")
            beginDrag(e, row); }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { pointerDrag.current = null; setDragging(null); setDropTarget(null); }}><button className="racket-title" onClick={() => onEdit(row.id)}>{row.name}</button><span>{row.racquet || "Racket details to add"}</span>{kind === "string" ? <small>Complete by {row.completionDate ? prettyDay(row.completionDate.slice(0, 10)) : "date to add"}</small> : <><strong className="handover-place">{kind === "collect" ? row.collectionFrom || "Collection place needed" : row.deliveryTo || "Return destination needed"}</strong><small>{(kind === "collect" ? row.collectionType : row.deliveryType) || "Handover method to add"}</small>{row.handoverNotes && <small>{row.handoverNotes}</small>}</>}
   {kind === "string" && stage(row) === "Awaiting collection" ? <span className="awaiting-note">Collect first · {plan.pickups[row.id]?.label}</span> : <button className="racket-action" onClick={() => progress(row)}>{kind === "string" ? "\u2713 Mark completed" : kind === "collect" ? "Confirm collected" : "Confirm delivered"}</button>}
   {kind === "string" && <div className="racket-move-actions"><button aria-label={`Move ${row.name}`} onClick={() => requestMove(row.id, plan.assignments[row.id]?.date || plan.today, plan.assignments[row.id]?.id)}>Move</button>{plan.manualIds.has(row.id) && <button onClick={() => onUpdate(row.id, { manualSlot: null })}>Use auto schedule</button>}</div>}
  </article>;
    }
    return <div className="planner">
 <div className="planner-intro"><p>Your stringing schedule, planned around tennis.</p><span>30-minute slots · Monday-start weeks · London time</span></div>
 <div className="planner-metrics"><button onClick={() => setTab("calendar")}><strong>{Object.keys(plan.assignments).length}</strong><span>Rackets planned</span></button><button onClick={() => setTab("collections")}><strong>{pending.length}</strong><span>To collect</span></button><button onClick={() => setTab("deliveries")}><strong>{completed.length}</strong><span>Ready to return</span></button></div>
 <div className="planner-tabs" role="tablist" aria-label="Planner view">{([["calendar", "Stringing calendar"], ["collections", "Collections"], ["deliveries", "Deliveries"], ["availability", "Availability & club visits"], ["preferences", "Schedule preferences"]] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
 {tab === "calendar" ? <>
 <div className="planner-toolbar"><div><h2>Your calendar</h2><p>{preferenceOrder(settings).map(id => preferenceLabels[id]).join(" \u2192 ")}.</p><p>Updates every 15 seconds. Unconfirmed jobs stay in place {settings.missedJobPolicy === "manual" ? "until you reschedule them" : settings.missedJobPolicy === "one-hour" ? "for one hour after the slot ends" : "until 6am the next morning"}. Completing a racket frees its slot immediately.</p></div></div>
 {plan.awaitingConfirmation.size > 0 && <div className="awaiting-confirmation-note"><span>{plan.awaitingConfirmation.size} {plan.awaitingConfirmation.size === 1 ? "racket is" : "rackets are"} awaiting completion confirmation. Mark completed when ready.</span><button className="secondary" onClick={() => onSettings({ ...settings, releasedSlots: { ...settings.releasedSlots, ...Object.fromEntries([...plan.awaitingConfirmation].map(id => [id, plan.assignments[id].id])) } })}>Reschedule missed jobs</button></div>}
 <StringingCalendar plan={plan} settings={settings} now={now} dragging={dragging} dropTarget={dropTarget} onTarget={setDropTarget} onMove={requestMove} onToggle={toggleSlot} onToggleDay={day => onSettings(toggleStringingDay(day, settings))} onToggleTennis={day => onSettings({...settings, visits:{...settings.visits, [`${day}:Evening`]:!eveningTennis(day, settings)}})} card={card}/>

 {Object.keys(plan.issues).length > 0 && <section className="planner-attention"><h2>Needs a decision · {Object.keys(plan.issues).length}</h2>{plan.active.filter(r => plan.issues[r.id]).map(r => <div className="planner-issue-row" key={r.id}><button onClick={() => onEdit(r.id)}><strong>{r.name}</strong><span>{plan.issues[r.id]}</span><b>Edit →</b></button><div className="racket-move-actions"><button onClick={() => requestMove(r.id, plan.today)}>Move</button>{stage(r) === "Ready to string" && <button onClick={() => progress(r)}>✓ Mark completed</button>}{plan.manualIds.has(r.id) && <button onClick={() => onUpdate(r.id, { manualSlot: null })}>Use auto schedule</button>}</div></div>)}</section>}
 {!plan.active.length && <div className="planner-empty"><h2>No active rackets</h2><p>Add a new order to plan it. Historical completed jobs stay out of your schedule.</p></div>}
 </> : tab === "preferences" ? <SchedulePreferences settings={settings} onChange={onSettings}/> : tab === "availability" ? <>
 <div className="planner-toolbar"><div><h2>Make room for your week</h2><p>Tap a stringing slot to switch it off. Tap AM, PM or Evening to set a club visit. The calendar replans automatically.</p></div></div><div className="availability-list">{plan.days.filter(day => day >= plan.today).map(day => <section key={day}><h3>{prettyDay(day)}</h3><div><small>STRINGING</small><div className="availability-buttons">{slotsFor(day, settings).map(s => <button key={s.id} aria-pressed={s.available} className={(s.available ? "enabled " : "") + `availability-${s.group}`} onClick={() => toggleSlot(s.id)}>{s.available ? "\u2713" : "\u2212"} {s.label} · {slotTime(s)}</button>)}</div></div><div><small>DAVID LLOYD</small><div className="availability-buttons">{(["AM", "PM", "Evening"] as Period[]).map(period => <button key={period} aria-pressed={visitEnabled(day, period, settings)} className={visitEnabled(day, period, settings) ? "club-enabled" : ""} onClick={() => onSettings({ ...settings, visits: { ...settings.visits, [`${day}:${period}`]: !visitEnabled(day, period, settings) } })}>{period}</button>)}</div></div></section>)}</div></> : tab === "collections" ? <>
 <div className="planner-toolbar"><div><h2>Rackets to collect</h2><p>Confirm collection when the racket is with you. Its suggested stringing slot will update.</p></div></div>
 {pending.length ? <div className="handover-groups">{[...new Set(pending.map(r => plan.pickups[r.id]?.label || "Collection needs arranging"))].sort((a, b) => { const va = Object.values(plan.pickups).find(v => v.label === a), vb = Object.values(plan.pickups).find(v => v.label === b); return (va ? va.date + va.hour : "9999").localeCompare(vb ? vb.date + vb.hour : "9999"); }).map(label => <section key={label}><h3>{label}</h3><div className="handover-cards">{pending.filter(r => (plan.pickups[r.id]?.label || "Collection needs arranging") === label).map(r => card(r, "collect"))}</div></section>)}</div> : <div className="planner-empty">No rackets waiting for collection.</div>}
 </> : <>
 <div className="planner-toolbar"><div><h2>Ready to take back</h2><p>Rackets appear here as soon as you mark them completed.</p></div></div>
 {completed.length ? <div className="handover-groups">{[...new Set(completed.map(r => plan.deliveries[r.id]?.label || (isClub(r.deliveryTo) ? "Add a club visit" : r.deliveryTo ? "Arrange a direct return" : "Choose a return destination")))].map(label => <section key={label}><h3>{label}</h3><div className="handover-cards">{completed.filter(r => (plan.deliveries[r.id]?.label || (isClub(r.deliveryTo) ? "Add a club visit" : r.deliveryTo ? "Arrange a direct return" : "Choose a return destination")) === label).map(r => card(r, "deliver"))}</div></section>)}</div> : <div className="planner-empty">Nothing ready for delivery yet. Mark a racket completed in the calendar.</div>}
 <section className="planned-returns"><h2>Upcoming returns after stringing</h2>{plan.active.filter(r => plan.assignments[r.id]).map(r => <div key={r.id}><strong>{r.name}</strong><span>{plan.deliveries[r.id]?.label || "Return to arrange"} · {r.deliveryTo || "Destination to add"} · {r.deliveryType || "Method to add"}</span></div>)}</section>
 </>}
 {move && movingRow && <MoveRacketDialog row={movingRow} rows={plan.active} days={plan.days} settings={settings} pickup={plan.pickups[movingRow.id]} now={now} initialDate={move.date} initialSlot={move.slot} onCancel={() => setMove(null)} onConfirm={slot => { onUpdate(movingRow.id, { manualSlot: slot }); setMove(null); }}/>}
 <p className="planner-footnote">Suggestions use the completion dates, collection arrangements and availability entered here. Your external calendar is not connected.</p>
 </div>;
}
