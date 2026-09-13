import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";

describe("figure calculations", () => {
  it.each([
    ["=20+15", 35],
    ["=20+15*2", 50],
    ["=(20+15)/2", 17.5],
    ["=0.1+0.2", 0.3],
    ["=-5+20", 15],
    ["35", 35],
  ])("calculates %s as %s", (input, expected) => {
    expect(calculate(String(input))).toBe(expected);
  });
  it.each(["=20+", "=1/0", "=alert(1)", "=2**3", "=()", "=(20+15"])("rejects invalid input %s", input => {
    expect(() => calculate(input)).toThrow();
  });
});
