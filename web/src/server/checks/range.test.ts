import { describe, expect, it } from "vitest";
import { parsePrintedRange, positionInRange } from "./range";

describe("parsePrintedRange", () => {
  it.each([
    ["3.5 - 5.2", { low: 3.5, high: 5.2, lowInclusive: true, highInclusive: true }],
    ["130-180", { low: 130, high: 180, lowInclusive: true, highInclusive: true }],
    ["0.5 – 4.0", { low: 0.5, high: 4, lowInclusive: true, highInclusive: true }],
    ["60 to 110", { low: 60, high: 110, lowInclusive: true, highInclusive: true }],
    ["> 59", { low: 59, high: null, lowInclusive: false, highInclusive: true }],
    [">=60", { low: 60, high: null, lowInclusive: true, highInclusive: true }],
    ["≥ 60", { low: 60, high: null, lowInclusive: true, highInclusive: true }],
    ["< 5.0", { low: null, high: 5, lowInclusive: true, highInclusive: false }],
    ["<= 42", { low: null, high: 42, lowInclusive: true, highInclusive: true }],
  ])("parses %s", (raw, expected) => {
    expect(parsePrintedRange(raw)).toEqual(expected);
  });

  it.each(["", "   ", "see comment", "5.2 - 3.5", "3.5 - 3.5", "3.5 - 5.2 mmol/L", "approx 4", "-1 - 3"])(
    "rejects %j",
    (raw) => {
      expect(parsePrintedRange(raw)).toBeNull();
    },
  );

  it("rejects null and undefined", () => {
    expect(parsePrintedRange(null)).toBeNull();
    expect(parsePrintedRange(undefined)).toBeNull();
  });
});

describe("positionInRange", () => {
  const twoSided = parsePrintedRange("3.5 - 5.2")!;

  it("treats values exactly on a two-sided limit as inside", () => {
    expect(positionInRange(3.5, twoSided)).toBe("inside");
    expect(positionInRange(5.2, twoSided)).toBe("inside");
  });

  it("detects values below and above", () => {
    expect(positionInRange(3.4, twoSided)).toBe("below");
    expect(positionInRange(5.3, twoSided)).toBe("above");
  });

  it("respects a strict one-sided limit as printed", () => {
    const strict = parsePrintedRange("> 59")!;
    expect(positionInRange(59, strict)).toBe("below");
    expect(positionInRange(60, strict)).toBe("inside");
  });

  it("respects an inclusive one-sided limit as printed", () => {
    const inclusive = parsePrintedRange("<= 42")!;
    expect(positionInRange(42, inclusive)).toBe("inside");
    expect(positionInRange(43, inclusive)).toBe("above");
  });
});
