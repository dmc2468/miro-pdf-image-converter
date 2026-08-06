import { describe, expect, it } from "vitest";
import { DRAWING_SCALES, getTargetPixelWidth, ORIENTATIONS, PAPER_SIZES, PIXEL_WIDTHS } from "./scaling.js";

describe("PIXEL_WIDTHS", () => {
  it("preserves the scaling table exactly", () => {
    expect(PIXEL_WIDTHS).toEqual({
      A1: {
        Landscape: {
          "1:1000": 8410,
          "1:500": 42050,
          "1:250": 21025,
          "1:200": 16820,
          "1:100": 8410,
          "1:50": 4205,
          "1:25": 2103,
          "1:20": 16820,
        },
        Portrait: {
          "1:1000": 8410,
          "1:500": 42050,
          "1:250": 21025,
          "1:200": 16820,
          "1:100": 8410,
          "1:50": 2968,
          "1:25": 1484,
          "1:20": 16820,
        },
      },
      A2: {
        Landscape: {
          "1:1000": 5936,
          "1:500": 29680,
          "1:250": 14840,
          "1:200": 11872,
          "1:100": 5936,
          "1:50": 2968,
          "1:25": 1484,
          "1:20": 11872,
        },
        Portrait: {
          "1:1000": 5936,
          "1:500": 29680,
          "1:250": 14840,
          "1:200": 11872,
          "1:100": 5936,
          "1:50": 2090,
          "1:25": 1045,
          "1:20": 11872,
        },
      },
      A3: {
        Landscape: {
          "1:1000": 4200,
          "1:500": 21000,
          "1:250": 10500,
          "1:200": 8400,
          "1:100": 4200,
          "1:50": 2100,
          "1:25": 1050,
          "1:20": 8400,
        },
        Portrait: {
          "1:1000": 4180,
          "1:500": 20900,
          "1:250": 10450,
          "1:200": 8360,
          "1:100": 4180,
          "1:50": 1484,
          "1:25": 742,
          "1:20": 8360,
        },
      },
      A4: {
        Landscape: {
          "1:1000": 2968,
          "1:500": 14840,
          "1:250": 7420,
          "1:200": 5936,
          "1:100": 2968,
          "1:50": 1484,
          "1:25": 742,
          "1:20": 5936,
        },
        Portrait: {
          "1:1000": 2098,
          "1:500": 10490,
          "1:250": 5245,
          "1:200": 4196,
          "1:100": 2098,
          "1:50": 1049,
          "1:25": 525,
          "1:20": 4196,
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

  it("sets the A3 landscape 1:500 scale bar to 2000 pixels for 20 metres", () => {
    expect(getTargetPixelWidth("A3", "Landscape", "1:500") * 40 / 420).toBe(2000);
  });

  it("uses the matching 1:100 pixel width for 1:1000 drawings", () => {
    for (const paperSize of PAPER_SIZES) {
      for (const orientation of ORIENTATIONS) {
        expect(getTargetPixelWidth(paperSize, orientation, "1:1000")).toBe(getTargetPixelWidth(paperSize, orientation, "1:100"));
      }
    }
  });

  it("uses the matching 1:200 pixel width for 1:20 drawings", () => {
    for (const paperSize of PAPER_SIZES) {
      for (const orientation of ORIENTATIONS) {
        expect(getTargetPixelWidth(paperSize, orientation, "1:20")).toBe(getTargetPixelWidth(paperSize, orientation, "1:200"));
      }
    }
  });
});
