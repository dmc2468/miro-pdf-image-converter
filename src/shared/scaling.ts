import type { DrawingScale, Orientation, PaperSize } from "./types.js";

export const PAPER_SIZES = ["A1", "A2", "A3", "A4"] as const satisfies readonly PaperSize[];
export const ORIENTATIONS = ["Landscape", "Portrait"] as const satisfies readonly Orientation[];
export const DRAWING_SCALES = ["1:1000", "1:500", "1:250", "1:200", "1:100", "1:50", "1:25", "1:20"] as const satisfies readonly DrawingScale[];

export const PIXEL_WIDTHS: Record<PaperSize, Record<Orientation, Record<DrawingScale, number>>> = {
  A1: {
    Landscape: {
      "1:1000": 84100,
      "1:500": 42050,
      "1:250": 21025,
      "1:200": 16820,
      "1:100": 8410,
      "1:50": 4205,
      "1:25": 2103,
      "1:20": 1682,
    },
    Portrait: {
      "1:1000": 84100,
      "1:500": 42050,
      "1:250": 21025,
      "1:200": 16820,
      "1:100": 8410,
      "1:50": 2968,
      "1:25": 1484,
      "1:20": 1187,
    },
  },
  A2: {
    Landscape: {
      "1:1000": 59360,
      "1:500": 29680,
      "1:250": 14840,
      "1:200": 11872,
      "1:100": 5936,
      "1:50": 2968,
      "1:25": 1484,
      "1:20": 1187,
    },
    Portrait: {
      "1:1000": 59360,
      "1:500": 29680,
      "1:250": 14840,
      "1:200": 11872,
      "1:100": 5936,
      "1:50": 2090,
      "1:25": 1045,
      "1:20": 836,
    },
  },
  A3: {
    Landscape: {
      "1:1000": 41800,
      "1:500": 20900,
      "1:250": 10450,
      "1:200": 8360,
      "1:100": 4180,
      "1:50": 2090,
      "1:25": 1045,
      "1:20": 836,
    },
    Portrait: {
      "1:1000": 41800,
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
      "1:1000": 29680,
      "1:500": 14840,
      "1:250": 7420,
      "1:200": 5936,
      "1:100": 2968,
      "1:50": 1484,
      "1:25": 742,
      "1:20": 591,
    },
    Portrait: {
      "1:1000": 20980,
      "1:500": 10490,
      "1:250": 5245,
      "1:200": 4196,
      "1:100": 2098,
      "1:50": 1049,
      "1:25": 525,
      "1:20": 420,
    },
  },
};

export function getTargetPixelWidth(
  paperSize: PaperSize,
  orientation: Orientation,
  drawingScale: DrawingScale,
): number {
  return PIXEL_WIDTHS[paperSize][orientation][drawingScale];
}

export function isPaperSize(value: string): value is PaperSize {
  return PAPER_SIZES.includes(value as PaperSize);
}

export function isOrientation(value: string): value is Orientation {
  return ORIENTATIONS.includes(value as Orientation);
}

export function isDrawingScale(value: string): value is DrawingScale {
  return DRAWING_SCALES.includes(value as DrawingScale);
}
