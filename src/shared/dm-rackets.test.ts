import { describe, expect, it } from "vitest";
import { dmSavings, nextDmJobNumber, sortedDmJobs, type DmRacketJob } from "./dm-rackets.js";
import { isStringingState, wouldDiscardTrackerData } from "./stringing.js";
const job = (jobNumber: number): DmRacketJob => ({ id: String(jobNumber), jobNumber, date: "2026-09-08", racket: "Percept", mains: "Poly Tour Pro", crosses: "Rexis", tension: "52 / 50 lbs", notes: "Hybrid setup" });

describe("DM racket history", () => {
  it("starts with no savings and job number one", () => {
    expect(dmSavings([])).toBe(0);
    expect(nextDmJobNumber([])).toBe(1);
  });
  it("saves £25 per recorded restring and does not reuse gaps in job numbers", () => {
    const jobs = [job(1), job(3)];
    expect(dmSavings(jobs)).toBe(50);
    expect(nextDmJobNumber(jobs)).toBe(4);
  });
  it("shows the highest job number first without reordering stored records", () => {
    const jobs = [job(1), job(3), job(2)];
    expect(sortedDmJobs(jobs).map(row => row.jobNumber)).toEqual([3, 2, 1]);
    expect(jobs.map(row => row.jobNumber)).toEqual([1, 3, 2]);
  });
  it("validates DM jobs and protects them from saves by older pages", () => {
    const old = { rows: [], adjustments: [], sundries: [] };
    const current = { ...old, dmRackets: [job(1)] };
    expect(isStringingState(old)).toBe(true);
    expect(isStringingState(current)).toBe(true);
    expect(isStringingState({ ...current, dmRackets: [{ ...job(1), jobNumber: -1 }] })).toBe(false);
    expect(isStringingState({ ...current, dmRackets: [{ ...job(1), date: "invalid" }] })).toBe(false);
    expect(wouldDiscardTrackerData(current, old)).toBe(true);
    expect(wouldDiscardTrackerData(current, current)).toBe(false);
  });
});
