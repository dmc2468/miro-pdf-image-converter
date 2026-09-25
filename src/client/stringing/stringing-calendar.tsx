import { useRef, type ReactNode } from "react";
import { slotsFor, slotTime, prettyDay, weekday, clockValue, slotDuration, type PlannerRow, type PlannerSettings, type Preference, type makePlan } from "../../shared/stringing-scheduling";
type Plan = ReturnType<typeof makePlan>;
export function StringingCalendar({ plan, settings, now, dragging, dropTarget, onTarget, onMove, onToggle, onToggleDay, card }: {
    plan: Plan;
    settings: PlannerSettings;
    now: Date;
    dragging: string | null;
    dropTarget: string | null;
    onTarget: (target: string | null) => void;
    onMove: (id: string, date: string, slot?: string) => void;
    onToggle: (id: string) => void;
    onToggleDay: (day: string) => void;
    card: (row: PlannerRow, kind: "string") => ReactNode;
}) {
    const refs = useRef<Record<string, HTMLElement | null>>({});
    const weeks = Array.from({ length: plan.days.length / 7 }, (_, i) => plan.days.slice(i * 7, i * 7 + 7));
    return <>
  <nav className={"week-drop-nav " + (dragging ? "is-dragging" : "")} aria-label="Calendar weeks">
   <span>{dragging ? "Drop on a week to choose a date" : "Jump to a week \u00B7 or drag a racket here"}</span>
   <div>{weeks.map((days, index) => <button key={days[0]} className={dropTarget === `week:${days[0]}` ? "drop-target" : ""} data-week-target={days[0]} onClick={() => refs.current[days[0]]?.scrollIntoView({ behavior: "smooth", block: "start" })} onDragOver={e => { if (!dragging && !e.dataTransfer.types.includes("text/plain"))
        return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; onTarget(`week:${days[0]}`); }} onDrop={e => { e.preventDefault(); const date = days.find(d => d >= plan.today); if (date)
        onMove(e.dataTransfer.getData("text/plain"), date); }}><strong>{index === 0 ? "This week" : index === 1 ? "Next week" : "Following week"}</strong><small>{prettyDay(days[0])} – {prettyDay(days[6])}</small></button>)}</div>
  </nav>
  {weeks.map(days => <section className="calendar-week" key={days[0]} ref={node => { refs.current[days[0]] = node; }} aria-label={`Week of ${prettyDay(days[0])}`}>
   <h2>Week of {prettyDay(days[0])}</h2>
   <div className="planner-calendar"><aside className="calendar-axis" aria-label="Time of day"><div /><strong>Morning</strong><strong>Lunch / afternoon</strong><strong>Evening</strong><span /></aside>{days.map(day => {
                const weekend = [0, 6].includes(weekday(day));
                const groups: Preference[] = ["morning", "lunch", "evening"];
                const slots = slotsFor(day, settings);
                return <section className={"calendar-day " + (weekend ? "weekend " : "") + (day === plan.today ? "today " : "") + (day < plan.today ? "past-day " : "") + (dropTarget === day ? "drop-target" : "")} key={day} data-calendar-day={day} onDragOver={e => { if (!dragging && !e.dataTransfer.types.includes("text/plain"))
                    return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; onTarget(day); }} onDrop={e => { e.preventDefault(); onMove(e.dataTransfer.getData("text/plain"), day); }}>
     <header><span>{new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/London" })}</span><strong>{day.slice(8)}</strong>{day === plan.today && <small>Today</small>}<button className="day-toggle" disabled={day < plan.today} aria-label={`${settings.unavailableDays?.includes(day) ? "Make available" : "Make unavailable"} all day ${prettyDay(day)}`} aria-pressed={!!settings.unavailableDays?.includes(day)} onClick={() => onToggleDay(day)}>{settings.unavailableDays?.includes(day) ? "+" : "\u2212"}</button></header>
     <div className="day-time-groups">{groups.map(group => <section className={`calendar-time-group ${group}`} key={group}>{slots.filter(s => weekend ? (group === "morning" ? s.hour < 12 : group === "lunch" ? s.hour >= 12 : false) : s.group === group).map(slot => {
                            const assigned = plan.active.find(r => plan.assignments[r.id]?.id === slot.id);
                            const passed = day < plan.today || (day === plan.today && slot.hour < clockValue(now));
                            const running = assigned && day === plan.today && slot.hour <= clockValue(now) && slot.hour + slotDuration > clockValue(now);
                            return <div className={"calendar-slot " + (!slot.available || passed ? "blocked " : "") + (dropTarget === slot.id ? "drop-target" : "")} key={slot.id} data-slot-id={slot.id} onDragOver={e => { if (!dragging && !e.dataTransfer.types.includes("text/plain"))
                                return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; onTarget(slot.id); }} onDrop={e => { e.preventDefault(); e.stopPropagation(); onMove(e.dataTransfer.getData("text/plain"), day, slot.id); }}>
       <div className="slot-head"><span>{slotTime(slot)}{running && <small>Current slot</small>}</span><button aria-label={`${slot.available ? "Make unavailable" : "Make available"} ${prettyDay(day)} ${slot.label} ${slotTime(slot)}`} title={slot.available ? "Make unavailable" : "Make available"} aria-pressed={!slot.available} disabled={day < plan.today} onClick={() => onToggle(slot.id)}>{slot.available ? "\u2212" : "+"}</button></div>
       {assigned ? card(assigned, "string") : <span className="slot-empty">{passed || !slot.available ? "" : "Available"}</span>}
      </div>;
                        })}{!settings.unavailableDays?.includes(day) && !weekend && group === "evening" && !slots.some(s => s.group === group) && <p className="no-session">Tennis at the club</p>}</section>)}</div>
     <div className="day-visits">{plan.visits.filter(v => v.date === day).map(v => <div className="club-visit" key={v.id}><strong>David Lloyd · {v.period}</strong><small>{plan.active.filter(r => plan.pickups[r.id]?.id === v.id).length} collect · {plan.active.filter(r => plan.deliveries[r.id]?.id === v.id).length} return</small></div>)}</div>
    </section>;
            })}</div>
  </section>)}
 </>;
}
