import { describe, expect, it } from "vitest";
import { DRAWING_SCALES, getTargetPixelWidth, ORIENTATIONS, PAPER_SIZES, PIXEL_WIDTHS } from "./scaling.js";

describe("PIXEL_WIDTHS", () => {
  it("preserves the scaling table exactly", () => {
    expect(PIXEL_WIDTHS).toEqual({
      A3: {
        Landscape: {
          "1:500": 20900,
          "1:250": 10450,
          "1:200": 8360,
          "1:100": 4180,
          "1:50": 2090,
          "1:25": 1045,
          "1:20": 836,
        },
        Portrait: {
          "1:500": 20900,
          "1:250": 10450,
          "1:200": 8360,
          "1:100": 4180,
          "1:50": 1484,
          "1:25": 742,
          "1:20": 594,
        },
      },
      A4: {
        Landscape: {
          "1:500": 14840,
          "1:250": 7420,
          "1:200": 5936,
          "1:100": 2968,
          "1:50": 1484,
          "1:25": 742,
          "1:20": 591,
        },
        Portrait: {
          "1:500": 10490,
          "1:250": 5245,
          "1:200": 4196,
          "1:100": 2098,
          "1:50": 1049,
          "1:25": 525,
          "1:20": 420,
        },
      },
    });
  });

  it("has a width for every selectable combination", () => {
    for (const paperSize of PAPER_SIZES) {
      for (const orientation of ORIENTATIONS) {
        for (const drawingScale of DRAWING_SCALES) {
          expect(getTargetPixelWidth(paperSize, orientation, drawingScale)).toBeGreaterThan(0);
        }
      }
    }
  });
});
