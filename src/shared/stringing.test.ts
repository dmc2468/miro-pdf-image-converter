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
