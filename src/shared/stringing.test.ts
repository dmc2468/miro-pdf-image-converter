import { describe, expect, it } from "vitest";
import { isStringingState, wouldDiscardTrackerData } from "./stringing.js";

describe("stringing referral persistence", () => {
  const oldState = { rows: [], adjustments: [], sundries: [] };
  const current = { ...oldState, referrers: [{id:"cam",name:"Cameron",referralsPerReward:1}] };
  it("rejects invalid reward ratios", () => {
    expect(isStringingState(current)).toBe(true);
    expect(isStringingState({...current, referrers:[{...current.referrers[0],referralsPerReward:0}]})).toBe(false);
  });
  it("detects old browser saves that would erase migrated referrals", () => {
    expect(wouldDiscardTrackerData(current, oldState)).toBe(true);
    expect(wouldDiscardTrackerData(current, current)).toBe(false);
    expect(wouldDiscardTrackerData(undefined, oldState)).toBe(false);
  });
});

describe("planner state protection", () => {
  const base = { rows: [], adjustments: [], sundries: [] };
  const planner = { unavailable: ["2026-09-25:18"], unavailableDays: ["2026-09-26"], visits: { "2026-09-29:Evening": true }, assignments: { job: "2026-09-25:13.5" } };
  it("accepts legacy data and valid persistent planner settings", () => {
    expect(isStringingState(base)).toBe(true);
    expect(isStringingState({ ...base, planner })).toBe(true);
  });
  it("rejects planner values that would break loading and scheduling", () => {
    for (const invalid of [null, {}, { ...planner, unavailable: "Friday" }, { ...planner, visits: [] }, { ...planner, assignments: { job: 42 } }, { ...planner, preferences: ["night"] }, { ...planner, morningCapacity: 3 }]) {
      expect(isStringingState({ ...base, planner: invalid })).toBe(false);
    }
  });
  it("prevents an older browser tab from erasing a saved schedule", () => {
    expect(wouldDiscardTrackerData({ ...base, planner }, base)).toBe(true);
    expect(wouldDiscardTrackerData({ ...base, planner }, { ...base, planner })).toBe(false);
    expect(wouldDiscardTrackerData(base, { ...base, planner })).toBe(false);
  });
});
