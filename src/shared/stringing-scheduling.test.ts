import { test } from "vitest";
import type { PlannerRow, PlannerSettings } from "./stringing-scheduling.js";
import assert from "node:assert/strict";
import { toggleStringingSlot, toggleStringingDay, makePlan, emptyPlanner, stage, migrateRow, slotsFor, visitEnabled, preferenceOrder, slotBlockReason, slotTime, calendarDaysFor, mondayOf, weekday, normalizeSlotId, slotExpired, activeManualSlot, rescheduleDue } from "./stringing-scheduling.js";
const now = new Date("2026-09-21T05:00:00Z");
const job = (id: string, extra: Partial<PlannerRow> = {}): PlannerRow => ({ id, name: id, source: "private", workflowStatus: "Ready to string", date: "2026-09-21", completionDate: "2026-09-25", ...extra });
const snapshot = (p: ReturnType<typeof makePlan>) => Object.fromEntries(Object.entries(p.assignments).map(([id, s]) => [id, s.id]));
test("exact 30-minute weekday slots and chronological display", () => {
    assert.deepEqual(slotsFor("2026-09-21", emptyPlanner).map(slotTime), ["07:30\u201308:00", "08:00\u201308:30", "13:30\u201314:00", "18:00\u201318:30", "18:30\u201319:00"]);
    assert.deepEqual(slotsFor("2026-09-22", emptyPlanner).filter(slot => slot.available).map(slotTime), ["07:30\u201308:00", "08:00\u201308:30", "13:30\u201314:00"]);
    assert.deepEqual(slotsFor("2026-09-26", emptyPlanner).map(slotTime), ["10:00\u201310:30", "14:00\u201314:30"]);
});
test("prefers weekday lunch and earliest deadlines without duplicate slots", () => {
    const p = makePlan([job("late"), job("urgent", { completionDate: "2026-09-21" })], emptyPlanner, now);
    assert.equal(p.assignments.urgent.id, "2026-09-21:13.5");
    assert.equal(p.assignments.late.id, "2026-09-22:13.5");
});
test("daily fallback uses both evening slots before mornings", () => {
    const p = makePlan(Array.from({ length: 5 }, (_, i) => job(String(i), { completionDate: "2026-09-21" })), emptyPlanner, now);
    assert.deepEqual(Object.values(p.assignments).map(s => s.hour), [13.5, 18, 18.5, 7.5, 8]);
});
test("weekends retain a maximum of two jobs per day", () => {
    const unavailable = ["21", "22", "23", "24", "25"].flatMap(d => slotsFor(`2026-09-${d}`, emptyPlanner).map(s => s.id));
    const p = makePlan(["a", "b", "c"].map(id => job(id, { completionDate: "2026-09-27" })), { ...emptyPlanner, unavailable }, now);
    assert.deepEqual(Object.values(p.assignments).map(s => s.id), ["2026-09-26:10", "2026-09-26:14", "2026-09-27:10"]);
});
test("club pickup precedes stringing and delivery follows the 30-minute slot", () => {
    const p = makePlan([job("a", { workflowStatus: "Awaiting collection", collectionFrom: "David Lloyd", deliveryTo: "David Lloyd" })], emptyPlanner, now);
    assert.equal(p.pickups.a.id, "2026-09-22:Evening");
    assert.equal(p.assignments.a.id, "2026-09-23:13.5");
    assert.equal(p.deliveries.a.id, "2026-09-23:Evening");
    const q = makePlan([job("b", { manualSlot: "2026-09-24:18.5", deliveryTo: "David Lloyd" })], { ...emptyPlanner, visits: { "2026-09-24:Evening": true } }, now);
    assert.equal(q.deliveries.b.id, "2026-09-24:Evening");
});
test("club visit toggles affect collections", () => {
    const settings: PlannerSettings = { ...emptyPlanner, visits: { "2026-09-22:Evening": false, "2026-09-21:AM": true } };
    assert.equal(visitEnabled("2026-09-22", "Evening", settings), false);
    const p = makePlan([job("a", { workflowStatus: "Awaiting collection", collectionFrom: "David Lloyd" })], settings, now);
    assert.equal(p.pickups.a.id, "2026-09-21:AM");
    assert.equal(p.assignments.a.id, "2026-09-21:13.5");
});
test("missing deadlines and unarranged collections remain actionable", () => {
    const p = makePlan([job("a", { completionDate: "" }), job("b", { workflowStatus: "Awaiting collection", collectionFrom: "Studio" })], emptyPlanner, now);
    assert.equal(Object.keys(p.issues).length, 2);
    assert.equal(Object.keys(p.assignments).length, 0);
});
test("overdue jobs get catch-up slots with warnings instead of disappearing", () => {
    const p = makePlan([job("late", { completionDate: "2026-09-20" })], emptyPlanner, now);
    assert.equal(p.assignments.late.id, "2026-09-21:7.5");
    assert.match(p.issues.late, /after the completion deadline/);
});
test("new jobs cannot start partway through a 30-minute slot", () => {
    const p = makePlan([job("a", { completionDate: "2026-09-21" })], emptyPlanner, new Date("2026-09-21T12:45:00Z"));
    assert.equal(p.assignments.a.id, "2026-09-21:18");
});
test("running automatic jobs stay in their slot until its end, including after reload", () => {
    const initial = makePlan([job("a")], emptyPlanner, now);
    const settings = JSON.parse(JSON.stringify({ ...emptyPlanner, assignments: snapshot(initial) }));
    const p = makePlan([job("a")], settings, new Date("2026-09-21T12:45:00Z"));
    assert.equal(p.assignments.a.id, "2026-09-21:13.5");
});
test("unfinished automatic jobs wait until the next morning by default", () => {
    const settings: PlannerSettings = { ...emptyPlanner, assignments: { a: "2026-09-21:13.5" } };
    const p = makePlan([job("a")], settings, new Date("2026-09-21T13:00:00Z"));
    assert.equal(p.assignments.a.id, "2026-09-21:13.5");
    assert.ok(p.awaitingConfirmation.has("a"));
    const q = makePlan([job("a")], settings, new Date("2026-09-22T05:00:00Z"));
    assert.equal(q.assignments.a.id, "2026-09-22:13.5");
    assert.ok(q.rescheduled.includes("a"));
});
test("one-hour grace period waits until an hour after the slot ends", () => {
    const settings: PlannerSettings = { ...emptyPlanner, missedJobPolicy: "one-hour", assignments: { a: "2026-09-21:13.5" } };
    const before = makePlan([job("a", { completionDate: "2026-09-21" })], settings, new Date("2026-09-21T13:59:00Z"));
    assert.equal(before.assignments.a.id, "2026-09-21:13.5");
    const after = makePlan([job("a", { completionDate: "2026-09-21" })], settings, new Date("2026-09-21T14:00:00Z"));
    assert.equal(after.assignments.a.id, "2026-09-21:18");
});
test("manual placements also respect the grace period", () => {
    const row = job("a", { manualSlot: "2026-09-21:13.5" });
    const waiting = makePlan([row], emptyPlanner, new Date("2026-09-21T18:00:00Z"));
    assert.equal(waiting.assignments.a.id, "2026-09-21:13.5");
    assert.ok(waiting.manualIds.has("a"));
    assert.ok(waiting.awaitingConfirmation.has("a"));
    const missed = makePlan([row], emptyPlanner, new Date("2026-09-22T05:00:00Z"));
    assert.equal(missed.assignments.a.id, "2026-09-22:13.5");
    assert.ok(!missed.manualIds.has("a"));
    assert.equal(activeManualSlot(row, new Date("2026-09-22T05:00:00Z")), undefined);
});
test("manual-only policy waits indefinitely until explicit rescheduling", () => {
    const row = job("a", { manualSlot: "2026-09-21:13.5" });
    const settings: PlannerSettings = { ...emptyPlanner, missedJobPolicy: "manual" };
    const later = new Date("2026-09-23T08:00:00Z");
    const p = makePlan([row], settings, later);
    assert.equal(p.assignments.a.id, "2026-09-21:13.5");
    assert.ok(p.awaitingConfirmation.has("a"));
    const q = makePlan([row], { ...settings, releasedSlots: { a: "2026-09-21:13.5" } }, later);
    assert.equal(q.assignments.a.id, "2026-09-23:13.5");
});
test("explicit reschedule releases an automatic waiting job and remains released after reload", () => {
    const settings: PlannerSettings = { ...emptyPlanner, assignments: { a: "2026-09-21:13.5" }, releasedSlots: { a: "2026-09-21:13.5" } };
    const later = new Date("2026-09-21T13:10:00Z");
    const p = makePlan([job("a", { completionDate: "2026-09-21" })], JSON.parse(JSON.stringify(settings)), later);
    assert.equal(p.assignments.a.id, "2026-09-21:18");
});
test("late completion during the grace period still removes the job from the schedule", () => {
    const p = makePlan([job("a", { workflowStatus: "Completed", completedAt: "2026-09-21T16:00:00Z", deliveryTo: "David Lloyd" })], { ...emptyPlanner, assignments: { a: "2026-09-21:13.5" } }, new Date("2026-09-21T16:00:00Z"));
    assert.equal(p.assignments.a, undefined);
    assert.equal(p.awaitingConfirmation.size, 0);
    assert.ok(p.deliveries.a);
});
test("grace-period boundary is 6am local time in winter and summer", () => {
    assert.equal(rescheduleDue("2026-09-21:18", emptyPlanner, new Date("2026-09-22T04:59:00Z")), false);
    assert.equal(rescheduleDue("2026-09-21:18", emptyPlanner, new Date("2026-09-22T05:00:00Z")), true);
    assert.equal(rescheduleDue("2026-12-21:18", emptyPlanner, new Date("2026-12-22T05:59:00Z")), false);
    assert.equal(rescheduleDue("2026-12-21:18", emptyPlanner, new Date("2026-12-22T06:00:00Z")), true);
});
test("missed manual slots from a previous week no longer block scheduling", () => {
    const p = makePlan([job("a", { manualSlot: "2026-09-14:18" })], emptyPlanner, now);
    assert.equal(p.assignments.a.id, "2026-09-21:13.5");
    assert.equal(p.issues.a, undefined);
});
test("early completion immediately frees the planned slot for another automatic job", () => {
    const initial = makePlan([job("a"), job("b")], emptyPlanner, now);
    const p = makePlan([job("a", { workflowStatus: "Completed", completedAt: now.toISOString(), deliveryTo: "David Lloyd" }), job("b")], { ...emptyPlanner, assignments: snapshot(initial) }, now);
    assert.equal(p.assignments.a, undefined);
    assert.equal(p.assignments.b.id, "2026-09-21:13.5");
    assert.equal(p.deliveries.a.id, "2026-09-22:Evening");
});
test("early completion of a manual job also releases its reserved slot", () => {
    const rows = [job("a", { manualSlot: "2026-09-21:13.5" }), job("b")];
    assert.equal(makePlan(rows, emptyPlanner, now).assignments.b.id, "2026-09-22:13.5");
    rows[0].workflowStatus = "Completed";
    assert.equal(makePlan(rows, emptyPlanner, now).assignments.b.id, "2026-09-21:13.5");
});
test("Monday\u2013Sunday calendar covers at least the next 14 days including DST", () => {
    for (const day of ["2026-09-21", "2026-09-24", "2026-09-27", "2026-10-25", "2026-03-29"]) {
        const days = calendarDaysFor(day);
        assert.equal(weekday(days[0]), 1);
        assert.equal(weekday(days.at(-1)!), 0);
        assert.equal(days.length % 7, 0);
        assert.ok(days.filter(d => d >= day).length >= 14);
        assert.equal(new Set(days).size, days.length);
    }
    assert.equal(mondayOf("2026-09-27"), "2026-09-21");
});
test("next-week manual moves reserve a distinct date and preserve capacity", () => {
    const p = makePlan([job("a", { manualSlot: "2026-09-28:8", completionDate: "2026-09-30" }), job("b")], emptyPlanner, now);
    assert.equal(p.assignments.a.id, "2026-09-28:8");
    assert.ok(p.manualIds.has("a"));
    assert.notEqual(p.assignments.b.id, p.assignments.a.id);
});
test("legacy times migrate without losing manual overrides or unavailable slots", () => {
    assert.equal(normalizeSlotId("2026-09-21:9"), "2026-09-21:7.5");
    assert.equal(normalizeSlotId("2026-09-21:10"), "2026-09-21:8");
    assert.equal(normalizeSlotId("2026-09-21:12"), "2026-09-21:13.5");
    assert.equal(normalizeSlotId("2026-09-26:10"), "2026-09-26:10");
    assert.equal(migrateRow({ ...job("legacy"), manualSlot: "2026-09-21:12" }).manualSlot, "2026-09-21:13.5");
    const slots = slotsFor("2026-09-21", { ...emptyPlanner, unavailable: ["2026-09-21:9", "2026-09-21:12"] });
    assert.equal(slots[0].available, false);
    assert.equal(slots[2].available, false);
});
test("morning capacity and order preferences still work", () => {
    assert.deepEqual(preferenceOrder(emptyPlanner), ["lunch", "evening", "morning", "weekend"]);
    assert.equal(slotsFor("2026-09-21", { ...emptyPlanner, morningCapacity: 1 }).filter(s => s.group === "morning").length, 1);
    const settings: PlannerSettings = { ...emptyPlanner, preferences: ["morning", "morning", "lunch"] };
    assert.deepEqual(preferenceOrder(settings), ["morning", "lunch", "evening", "weekend"]);
    assert.equal(makePlan([job("a")], settings, now).assignments.a.id, "2026-09-21:7.5");
});
test("manual future placements remain fixed across preference changes", () => {
    const rows = [job("auto"), job("manual", { manualSlot: "2026-09-21:13.5" })];
    const p = makePlan(rows, { ...emptyPlanner, preferences: ["morning", "lunch", "evening", "weekend"] }, now);
    assert.equal(p.assignments.manual.id, "2026-09-21:13.5");
    assert.equal(p.assignments.auto.id, "2026-09-21:7.5");
});
test("manual late override remains visible with its warning", () => {
    const p = makePlan([job("a", { manualSlot: "2026-09-23:13.5", completionDate: "2026-09-21" })], emptyPlanner, now);
    assert.equal(p.assignments.a.id, "2026-09-23:13.5");
    assert.match(p.issues.a, /after the required completion/);
});
test("blocked, removed and duplicate future manual positions are flagged", () => {
    const p = makePlan([job("a", { manualSlot: "2026-09-21:13.5" }), job("b", { manualSlot: "2026-09-21:13.5" }), job("c", { manualSlot: "2026-09-21:8" })], { ...emptyPlanner, morningCapacity: 1, unavailable: ["2026-09-21:13.5"] }, now);
    assert.match(p.issues.a, /unavailable/);
    assert.match(p.issues.b, /Two manual/);
    assert.match(p.issues.c, /no longer enabled/);
});
test("deadline-constrained jobs keep their on-time slots before catch-up jobs", () => {
    const rows = Array.from({ length: 6 }, (_, i) => job(String(i), { completionDate: "2026-09-21" }));
    const p = makePlan(rows, emptyPlanner, now);
    assert.equal(Object.values(p.assignments).filter(s => s.date === "2026-09-21").length, 5);
    assert.equal(Object.keys(p.issues).length, 1);
    assert.equal(Object.keys(p.assignments).length, 6);
});
test("collection blocks morning stringing even with a morning-first preference", () => {
    const settings: PlannerSettings = { ...emptyPlanner, preferences: ["morning", "lunch", "evening", "weekend"], visits: { "2026-09-21:AM": true } };
    const row = job("a", { workflowStatus: "Awaiting collection", collectionFrom: "David Lloyd", completionDate: "2026-09-21" });
    const p = makePlan([row], settings, now);
    assert.equal(p.assignments.a.id, "2026-09-21:13.5");
    assert.match(slotBlockReason(row, slotsFor("2026-09-21", settings)[0], p.pickups.a, settings, now)!, /Collect the racket/);
});
test("slot expiry uses London time in winter and summer", () => {
    assert.equal(slotExpired("2026-09-21:13.5", new Date("2026-09-21T12:59:00Z")), false);
    assert.equal(slotExpired("2026-09-21:13.5", new Date("2026-09-21T13:00:00Z")), true);
    assert.equal(slotExpired("2026-12-21:13.5", new Date("2026-12-21T13:59:00Z")), false);
    assert.equal(slotExpired("2026-12-21:13.5", new Date("2026-12-21T14:00:00Z")), true);
});
test("legacy completed jobs and deadline migration remain compatible", () => {
    assert.equal(stage({ ...job("legacy"), workflowStatus: undefined, status: "Complete" }), "Delivered");
    assert.equal(migrateRow({ ...job("legacy"), completionDate: undefined, collectionDate: "2026-09-21" }).completionDate, "2026-09-21");
    assert.equal(migrateRow({ ...job("legacy"), collectionDate: "2026-09-21", completionDate: "" }).completionDate, "");
});
test("whole-day absence blocks stringing and club visits without losing individual preferences", () => {
    const settings: PlannerSettings = { ...emptyPlanner, unavailableDays: ["2026-09-22"], unavailable: ["2026-09-22:7.5"], visits: { "2026-09-22:AM": true } };
    assert.ok(slotsFor("2026-09-22", settings).every(s => !s.available));
    assert.equal(visitEnabled("2026-09-22", "Evening", settings), false);
    assert.equal(visitEnabled("2026-09-22", "AM", settings), false);
    const restored = { ...settings, unavailableDays: [] };
    assert.equal(slotsFor("2026-09-22", restored)[0].available, false);
    assert.equal(visitEnabled("2026-09-22", "AM", restored), true);
});
test("one-hour reminders use London time, include each action and exclude started slots", async () => {
    const { dueReminders } = await import("./stringing-scheduling.js");
    const row = job("reminder");
    const slot = slotsFor("2026-09-24", emptyPlanner)[2];
    const visit = { id: "visit", date: "2026-09-24", hour: 13.5, period: "PM" as const, label: "Visit" };
    const plan = { ...makePlan([], emptyPlanner, now), active: [row], pickups: { reminder: visit }, assignments: { reminder: slot }, deliveries: { reminder: visit } };
    assert.equal(dueReminders(plan, new Date("2026-09-24T11:29:00Z")).length, 0);
    assert.equal(dueReminders(plan, new Date("2026-09-24T11:30:00Z")).length, 3);
    assert.equal(dueReminders(plan, new Date("2026-09-24T12:30:00Z")).length, 0);
    const winter = { ...plan, assignments: { reminder: { ...slot, date: "2026-12-01", hour: 13.5 } } };
    assert.equal(dueReminders(winter, new Date("2026-12-01T12:30:00Z")).length, 1);
});

test("planner progress also updates the existing completed job status", async () => {
  const { workflowFields } = await import("./stringing-scheduling.js");
  for (const state of ["Completed", "Delivered"] as const) {
    const row = { ...job("progress"), ...workflowFields(state) };
    assert.equal(row.status, "Completed");
    assert.equal(makePlan([row], emptyPlanner, now).assignments.progress, undefined);
  }
  for (const state of ["Awaiting collection", "Ready to string"] as const) {
    assert.equal(workflowFields(state).status, "To Do");
  }
});

test("Tuesday and Wednesday evenings are visible but off until individually enabled", () => {
 for (const day of ["2026-09-22", "2026-09-23"]) {
  const evening = slotsFor(day, emptyPlanner).filter(slot => slot.group === "evening");
  assert.deepEqual(evening.map(slot => slot.hour), [18,18.5]);
  assert.ok(evening.every(slot => !slot.available));
  const enabled = toggleStringingSlot(`${day}:18`, emptyPlanner);
  assert.equal(slotsFor(day, enabled).find(slot => slot.hour === 18)?.available, true);
  assert.equal(slotsFor(day, enabled).find(slot => slot.hour === 18.5)?.available, false);
  assert.equal(slotBlockReason(job("one"), slotsFor(day, enabled).find(slot => slot.hour === 18)!, undefined, enabled, now), undefined);
  assert.equal(visitEnabled(day,"Evening",enabled),true);
  assert.equal(slotsFor(day,toggleStringingSlot(`${day}:18`,enabled)).find(slot => slot.hour === 18)?.available,false);
 }
});
test("removing tennis frees both evening slots and restores the default block when re-added", () => {
 const settings = {...emptyPlanner,visits:{"2026-09-22:Evening":false}};
 assert.ok(slotsFor("2026-09-22", settings).filter(slot=>slot.group==="evening").every(slot=>slot.available));
 assert.equal(visitEnabled("2026-09-22","Evening",settings),false);
 const plan = makePlan([job("evening",{date:"2026-09-22",completionDate:"2026-09-22"})],{...settings,preferences:["evening","lunch","morning","weekend"]},now);
 assert.equal(plan.assignments.evening.id,"2026-09-22:18");
 assert.ok(slotsFor("2026-09-22", {...settings,visits:{"2026-09-22:Evening":true}}).filter(slot=>slot.group==="evening").every(slot=>!slot.available));
});
test("one slot can reopen on a blocked day without reopening the day or club visits", () => {
 const day = "2026-09-22";
 const blocked = toggleStringingDay(day, emptyPlanner);
 const reopened = toggleStringingSlot(`${day}:18.5`,blocked);
 assert.deepEqual(slotsFor(day,reopened).filter(slot=>slot.available).map(slot=>slot.hour),[18.5]);
 assert.ok(reopened.unavailableDays?.includes(day));
 assert.equal(visitEnabled(day,"Evening",reopened),false);
 assert.ok(slotsFor(day,toggleStringingSlot(`${day}:18.5`,reopened)).every(slot=>!slot.available));
 const reset = toggleStringingDay(day,toggleStringingDay(day,reopened));
 assert.ok(slotsFor(day,reset).every(slot=>!slot.available));
 assert.deepEqual(reset.availableSlots,[]);
});
