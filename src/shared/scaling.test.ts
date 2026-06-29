import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { DRAWING_SCALES, getTargetPixelWidth, ORIENTATIONS, PAPER_SIZES, PIXEL_WIDTHS } from "./scaling.js";
import type { DrawingScale, Orientation, PaperSize } from "./types.js";

type FlatRule = {
  paperSize: PaperSize;
  orientation: Orientation;
  drawingScale: DrawingScale;
  width: number;
};

function flattenTypeScriptRules(): FlatRule[] {
  return sortRules(PAPER_SIZES.flatMap((paperSize) =>
    ORIENTATIONS.flatMap((orientation) =>
      DRAWING_SCALES.map((drawingScale) => ({
        paperSize,
        orientation,
        drawingScale,
        width: getTargetPixelWidth(paperSize, orientation, drawingScale),
      })),
    ),
  ));
}

function sortRules(rules: FlatRule[]): FlatRule[] {
  return [...rules].sort((left: FlatRule, right: FlatRule) => {
    return (
      left.paperSize.localeCompare(right.paperSize) ||
      left.orientation.localeCompare(right.orientation) ||
      left.drawingScale.localeCompare(right.drawingScale)
    );
  });
}

function readPythonScalingRules(): FlatRule[] {
  const script = String.raw`
import ast
import json
from pathlib import Path

source = Path("MIRO Converter/PDFtoJPEGscaler.py").read_text()
tree = ast.parse(source)

for node in tree.body:
    if isinstance(node, ast.Assign):
        names = [target.id for target in node.targets if isinstance(target, ast.Name)]
        if "PIXEL_WIDTHS" in names:
            value = ast.literal_eval(node.value)
            print(json.dumps([
                {
                    "paperSize": key[0],
                    "orientation": key[1],
                    "drawingScale": key[2],
                    "width": width,
                }
                for key, width in sorted(value.items())
            ]))
            break
else:
    raise SystemExit("PIXEL_WIDTHS not found")
`;

  return sortRules(JSON.parse(execFileSync("python3", ["-c", script], { encoding: "utf8" })) as FlatRule[]);
}

describe("PIXEL_WIDTHS", () => {
  it("preserves the desktop app scaling table exactly", () => {
    expect(PIXEL_WIDTHS).toEqual({
      A3: {
        Landscape: {
          "1:100": 4180,
          "1:50": 2090,
          "1:25": 1045,
          "1:20": 836,
        },
        Portrait: {
          "1:100": 4180,
          "1:50": 1484,
          "1:25": 742,
          "1:20": 594,
        },
      },
      A4: {
        Landscape: {
          "1:100": 2968,
          "1:50": 1484,
          "1:25": 742,
          "1:20": 591,
        },
        Portrait: {
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

  it("matches the Python desktop app scaling table", () => {
    expect(flattenTypeScriptRules()).toEqual(readPythonScalingRules());
  });
});
