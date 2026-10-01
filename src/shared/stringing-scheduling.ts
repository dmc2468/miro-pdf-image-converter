export type Handover = "In person" | "Reception" | "To house" | "Locker" | "With coach" | "From studio";
export const handoverTypes: Handover[] = ["In person", "Reception", "To house", "Locker", "With coach", "From studio"];
export type Stage = "Awaiting collection" | "Ready to string" | "Completed" | "Delivered";
export interface Logistics {
    completionDate?: string | null;
    collectionDate?: string | null;
    workflowStatus?: Stage;
    collectionType?: string;
    collectionFrom?: string;
    deliveryType?: string;
    deliveryTo?: string;
    pickupDate?: string;
    pickupPeriod?: Period;
    handoverNotes?: string;
    completedAt?: string;
    deliveredAt?: string;
    manualSlot?: string | null;
}
;
export interface PlannerRow extends Logistics {
    id: string;
    name: string;
    racquet?: string | null;
    source: string;
    status?: string;
    date?: string | null;
}
;
export type Period = "AM" | "PM" | "Evening";
export type Preference = "lunch" | "evening" | "morning" | "weekend";
export const defaultPreferences: Preference[] = ["lunch", "evening", "morning", "weekend"];
export const preferenceLabels: Record<Preference, string> = { lunch: "Weekday lunchtimes", evening: "Weekday evenings", morning: "Weekday mornings", weekend: "Weekends" };
export interface PlannerSettings {
    unavailable: string[];
    unavailableDays?: string[];
    availableSlots?: string[];
    visits: Record<string, boolean>;
    preferences?: Preference[];
    morningCapacity?: 1 | 2;
    assignments?: Record<string, string>;
    missedJobPolicy?: "next-morning" | "one-hour" | "manual";
    releasedSlots?: Record<string, string>;
}
;
export function preferenceOrder(settings: PlannerSettings): Preference[] {
    return [...new Set([...(settings.preferences || []).filter(p => defaultPreferences.includes(p)), ...defaultPreferences])];
}
export const emptyPlanner: PlannerSettings = { unavailable: [], visits: {} };
export const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const addDays = (day: string, n: number) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekday = (day: string) => new Date(day + "T12:00:00Z").getUTCDay();
export const prettyDay = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
export function migrateRow<T extends PlannerRow>(row: T): T { return { ...row, completionDate: row.completionDate ?? row.collectionDate ?? "", manualSlot: row.manualSlot ? normalizeSlotId(row.manualSlot) : row.manualSlot }; }
export function stage(row: PlannerRow): Stage { return row.workflowStatus ?? (/^(complete|completed|delivered)$/i.test(row.status || "") ? "Delivered" : "Ready to string"); }
export const isClub = (place?: string) => /david\s*lloyd|\bclub\b/i.test(place || "");
export interface Visit {
    id: string;
    date: string;
    period: Period;
    hour: number;
    label: string;
}
;
const periodHour: Record<Period, number> = { AM: 9, PM: 16, Evening: 19 };
export const slotDuration = 0.5;
export interface Slot {
    id: string;
    date: string;
    hour: number;
    label: string;
    rank: number;
    available: boolean;
    group: Preference;
}
;
export const formatTime = (hour: number) => `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;
export const slotTime = (slot: Slot) => `${formatTime(slot.hour)}–${formatTime(slot.hour + slotDuration)}`;
export const mondayOf = (day: string) => addDays(day, -((weekday(day) + 6) % 7));
export function calendarDaysFor(today: string): string[] {
    const start = mondayOf(today), last = addDays(mondayOf(addDays(today, 13)), 6);
    const result: string[] = [];
    for (let day = start; day <= last; day = addDays(day, 1))
        result.push(day);
    return result;
}
export function normalizeSlotId(id: string): string {
    const [date, raw] = id.split(":");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || raw === undefined)
        return id;
    if ([0, 6].includes(weekday(date)))
        return id;
    const replacement: Record<string, string> = { "9": "7.5", "10": "8", "12": "13.5" };
    return `${date}:${replacement[raw] || raw}`;
}
export function slotExpired(id: string, now: Date): boolean {
    const [date, raw] = normalizeSlotId(id).split(":");
    return date < dayKey(now) || (date === dayKey(now) && Number(raw) + slotDuration <= clockValue(now));
}
export function rescheduleDue(id: string, settings: PlannerSettings, now: Date): boolean {
    if (!slotExpired(id, now))
        return false;
    if (settings.missedJobPolicy === "manual")
        return false;
    const [date, raw] = normalizeSlotId(id).split(":");
    const today = dayKey(now);
    if (settings.missedJobPolicy === "one-hour")
        return today > date || (today === date && clockValue(now) >= Number(raw) + slotDuration + 1);
    const tomorrow = addDays(date, 1);
    return today > tomorrow || (today === tomorrow && clockValue(now) >= 6);
}
export function activeManualSlot(row: PlannerRow, now: Date, settings: PlannerSettings = emptyPlanner): string | undefined {
    return row.manualSlot && !rescheduleDue(row.manualSlot, settings, now) && settings.releasedSlots?.[row.id] !== normalizeSlotId(row.manualSlot) ? normalizeSlotId(row.manualSlot) : undefined;
}
export function clockValue(now: Date) { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":"); return +parts[0] + (+parts[1] / 60); }
export function slotsFor(date: string, settings: PlannerSettings): Slot[] {
    const ranks = preferenceOrder(settings);
    const dow = weekday(date);
    const items = dow === 0 || dow === 6
        ? [{ hour: 10, label: "Weekend \u00B7 racket 1", group: "weekend" as Preference }, { hour: 14, label: "Weekend \u00B7 racket 2", group: "weekend" as Preference }]
        : [{ hour: 7.5, label: "Morning \u00B7 racket 1", group: "morning" as Preference }, ...(settings.morningCapacity === 1 ? [] : [{ hour: 8, label: "Morning \u00B7 racket 2", group: "morning" as Preference }]), { hour: 13.5, label: "Lunchtime", group: "lunch" as Preference }, ...[{ hour: 18, label: "Evening \u00B7 racket 1", group: "evening" as Preference }, { hour: 18.5, label: "Evening \u00B7 racket 2", group: "evening" as Preference }]];
    return items.map(s => ({ ...s, rank: ranks.indexOf(s.group), date, id: `${date}:${s.hour}`, available: !settings.unavailable.map(normalizeSlotId).includes(`${date}:${s.hour}`) && (!!settings.availableSlots?.includes(`${date}:${s.hour}`) || (!settings.unavailableDays?.includes(date) && !(s.group === "evening" && [2, 3].includes(dow) && eveningTennis(date, settings)))) }));
}
export function visitEnabled(date: string, period: Period, settings: PlannerSettings) { return !settings.unavailableDays?.includes(date) && (settings.visits[`${date}:${period}`] ?? ([2, 3].includes(weekday(date)) && period === "Evening")); }
export function slotBlockReason(row: PlannerRow, slot: Slot, pickup: Visit | undefined, settings: PlannerSettings, now: Date, allowRunning = false): string | undefined {
    const today = dayKey(now);
    if (!allowRunning && (slot.date < today || (slot.date === today && slot.hour < clockValue(now))))
        return "This slot has already started.";
    if (!slot.available)
        return "This slot is marked unavailable.";
    if ((["AM", "PM", "Evening"] as Period[]).some(p => slot.hour < periodHour[p] + 1 && slot.hour + slotDuration > periodHour[p] && visitEnabled(slot.date, p, settings)))
        return "This slot overlaps your club visit.";
    if (row.date && slot.date < row.date.slice(0, 10))
        return "This is before the racket\u2019s drop-off date.";
    if (stage(row) === "Awaiting collection") {
        if (!pickup)
            return "Arrange collection before choosing a stringing slot.";
        if (slot.date < pickup.date || (slot.date === pickup.date && slot.hour < pickup.hour + 1))
            return "Collect the racket before stringing it.";
    }
}
export function makePlan(rows: PlannerRow[], settings: PlannerSettings, now = new Date()) {
    const today = dayKey(now), hour = clockValue(now), days = calendarDaysFor(today);
    const future = (date: string, h: number) => date > today || (date === today && h >= hour);
    const slots = days.flatMap(date => slotsFor(date, settings));
    const visits: Visit[] = days.flatMap(date => (["AM", "PM", "Evening"] as Period[]).filter(p => visitEnabled(date, p, settings) && future(date, periodHour[p])).map(period => ({ id: `${date}:${period}`, date, period, hour: periodHour[period], label: `${prettyDay(date)} · ${period}` })));
    const assignments: Record<string, Slot> = {}, pickups: Record<string, Visit> = {}, deliveries: Record<string, Visit> = {}, issues: Record<string, string> = {};
    const active = rows.filter(r => stage(r) !== "Delivered");
    for (const row of active.filter(r => stage(r) === "Awaiting collection")) {
        const place = row.collectionFrom;
        const requested = row.pickupDate?.slice(0, 10);
        const period = row.pickupPeriod || "Evening";
        const visit = isClub(place) ? visits.find(v => (!requested || v.date === requested) && (!requested || v.period === period) && (!row.date || v.date >= row.date.slice(0, 10))) : requested && !settings.unavailableDays?.includes(requested) && future(requested, periodHour[period]) ? { id: `${requested}:${period}`, date: requested, period, hour: periodHour[period], label: `${prettyDay(requested)} · ${period}` } : undefined;
        if (!place)
            issues[row.id] = "Choose where to collect this racket.";
        else if (visit)
            pickups[row.id] = visit;
        else
            issues[row.id] = isClub(place) ? "No matching club visit. Add a visit or change the collection date." : "Set a collection date and time before planning this racket.";
    }
    const jobs = active.filter(r => ["Awaiting collection", "Ready to string"].includes(stage(r))).sort((a, b) => (a.completionDate || "9999").localeCompare(b.completionDate || "9999") || a.id.localeCompare(b.id));
    const owners = new Map<string, string>();
    const options: Record<string, Slot[]> = {};
    const fixed = new Set<string>();
    const manualIds = new Set<string>();
    const rescheduled: string[] = [];
    const awaitingConfirmation = new Set<string>();
    for (const row of jobs.filter(r => r.manualSlot)) {
        const manual = activeManualSlot(row, now, settings);
        if (!manual) {
            rescheduled.push(row.id);
            continue;
        }
        fixed.add(row.id);
        manualIds.add(row.id);
        const slot = slots.find(s => s.id === manual) || slotsFor(manual.split(":")[0], settings).find(s => s.id === manual);
        if (!slot) {
            issues[row.id] = "Your manual slot is outside this fortnight or no longer enabled. Move the job or return it to auto scheduling.";
            continue;
        }
        if (owners.has(slot.id)) {
            issues[row.id] = "Two manual jobs use this slot. Move this job or return it to auto scheduling.";
            continue;
        }
        owners.set(slot.id, row.id);
        assignments[row.id] = slot;
        if (slotExpired(slot.id, now))
            awaitingConfirmation.add(row.id);
        const conflict = slotBlockReason(row, slot, pickups[row.id], settings, now, true);
        if (conflict)
            issues[row.id] = `Manual schedule: ${conflict}`;
        else if (row.completionDate && slot.date > row.completionDate.slice(0, 10))
            issues[row.id] = "Manual schedule is after the required completion date.";
        else if (!row.completionDate)
            issues[row.id] = "Manual schedule: add a completion date.";
    }
    for (const row of jobs) {
        if (fixed.has(row.id))
            continue;
        const previous = settings.assignments?.[row.id];
        if (!previous)
            continue;
        if (rescheduleDue(previous, settings, now) || settings.releasedSlots?.[row.id] === normalizeSlotId(previous)) {
            if (!rescheduled.includes(row.id))
                rescheduled.push(row.id);
            continue;
        }
        const slot = slots.find(s => s.id === normalizeSlotId(previous)) || slotsFor(previous.split(":")[0], settings).find(s => s.id === normalizeSlotId(previous));
        if (slot && (slot.date < today || (slot.date === today && slot.hour <= hour)) && !owners.has(slot.id) && !slotBlockReason(row, slot, pickups[row.id], settings, now, true)) {
            fixed.add(row.id);
            owners.set(slot.id, row.id);
            assignments[row.id] = slot;
            if (slotExpired(slot.id, now))
                awaitingConfirmation.add(row.id);
            if (row.completionDate && slot.date > row.completionDate.slice(0, 10))
                issues[row.id] = "Scheduled after the completion deadline. Review the date or make an earlier slot available.";
        }
    }
    function place(id: string, visited = new Set<string>()): boolean {
        const candidates = options[id] || [];
        const free = candidates.find(s => !owners.has(s.id) && !visited.has(s.id));
        if (free) {
            owners.set(free.id, id);
            assignments[id] = free;
            return true;
        }
        for (const slot of candidates) {
            if (visited.has(slot.id))
                continue;
            visited.add(slot.id);
            const owner = owners.get(slot.id);
            if (owner && !fixed.has(owner) && place(owner, visited)) {
                owners.set(slot.id, id);
                assignments[id] = slot;
                return true;
            }
        }
        return false;
    }
    const overdue: PlannerRow[] = [];
    for (const row of jobs) {
        if (fixed.has(row.id))
            continue;
        if (!row.completionDate) {
            issues[row.id] = "Add a completion date to plan this racket.";
            continue;
        }
        if (issues[row.id])
            continue;
        const pickup = pickups[row.id];
        const candidates = slots.filter(s => !slotBlockReason(row, s, pickup, settings, now) && s.date <= row.completionDate!.slice(0, 10)).sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date) || a.hour - b.hour);
        options[row.id] = candidates;
        if (!place(row.id))
            overdue.push(row);
    }
    for (const row of overdue) {
        options[row.id] = slots.filter(s => !slotBlockReason(row, s, pickups[row.id], settings, now)).sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
        if (place(row.id))
            issues[row.id] = "Scheduled after the completion deadline. Review the date or make an earlier slot available.";
        else
            issues[row.id] = "No available slot in this planning window. Enable a slot or arrange collection.";
    }
    for (const id of awaitingConfirmation) {
        if (!days.includes(assignments[id].date))
            issues[id] = "Awaiting completion confirmation from an earlier week. Mark completed or reschedule missed jobs.";
    }
    for (const row of active) {
        if (!isClub(row.deliveryTo))
            continue;
        const slot = assignments[row.id];
        if (!slot && stage(row) !== "Completed")
            continue;
        const next = visits.find(v => !slot || v.date > slot.date || (v.date === slot.date && v.hour >= slot.hour + slotDuration));
        if (next)
            deliveries[row.id] = next;
    }
    return { today, days, slots, visits, assignments, pickups, deliveries, issues, active, manualIds, rescheduled, awaitingConfirmation };
}
export function dueReminders(plan: ReturnType<typeof makePlan>, now: Date) {
    const today = dayKey(now), hour = clockValue(now);
    return plan.active.flatMap(row => ([
        { kind: "Collect", slot: plan.pickups[row.id], place: row.collectionFrom },
        { kind: "String", slot: plan.assignments[row.id], place: "" },
        { kind: "Drop off", slot: plan.deliveries[row.id], place: row.deliveryTo }
    ]).filter(({ slot }) => slot && slot.date === today && slot.hour - hour > 0 && slot.hour - hour <= 1).map(({ kind, slot, place }) => ({
        id: `${kind}:${row.id}:${slot!.date}:${slot!.hour}`,
        title: `${kind} at ${formatTime(slot!.hour)}`,
        body: `${row.name}${row.racquet ? " \u00B7 " + row.racquet : ""}${place ? " \u00B7 " + place : ""}`
    })));
}
export function workflowFields(workflowStatus: Stage): Pick<PlannerRow, "workflowStatus" | "status"> {
    return { workflowStatus, status: workflowStatus === "Completed" || workflowStatus === "Delivered" ? "Completed" : "To Do" };
}

export function eveningTennis(date: string, settings: PlannerSettings): boolean {
 return settings.visits[`${date}:Evening`] ?? [2, 3].includes(weekday(date));
}

export function toggleStringingSlot(id: string, settings: PlannerSettings): PlannerSettings {
 const normalId = normalizeSlotId(id);
 const enabled = slotsFor(normalId.split(":")[0], settings).find(slot => slot.id === normalId)?.available;
 const unavailable = settings.unavailable.map(normalizeSlotId).filter(slot => slot !== normalId);
 const availableSlots = (settings.availableSlots ?? []).filter(slot => slot !== normalId);
 return {...settings, unavailable: enabled ? [...unavailable, normalId] : unavailable, availableSlots: enabled ? availableSlots : [...availableSlots, normalId]};
}

export function toggleStringingDay(date: string, settings: PlannerSettings): PlannerSettings {
 const unavailableDays = settings.unavailableDays ?? [];
 return {...settings, unavailableDays: unavailableDays.includes(date) ? unavailableDays.filter(day => day !== date) : [...unavailableDays, date], availableSlots: (settings.availableSlots ?? []).filter(slot => !slot.startsWith(`${date}:`))};
}
