// Parses reference ranges exactly as printed on a lab report.
// Two-sided ranges ("3.5 - 5.2") include their limits, as labs print them.
// One-sided ranges keep the operator the lab printed: "> 59" excludes 59,
// ">= 60" includes 60.

export interface PrintedRange {
  low: number | null;
  high: number | null;
  lowInclusive: boolean;
  highInclusive: boolean;
}

const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const TWO_SIDED = new RegExp(String.raw`^${NUM}\s*(?:-|–|—|to)\s*${NUM}$`, "i");
const ONE_SIDED = new RegExp(String.raw`^(<=|>=|≤|≥|<|>)\s*${NUM}$`);

export function parsePrintedRange(raw: string | null | undefined): PrintedRange | null {
  if (!raw) return null;
  const text = raw.trim();

  const two = TWO_SIDED.exec(text);
  if (two) {
    const low = Number(two[1]);
    const high = Number(two[2]);
    if (!(low < high)) return null;
    return { low, high, lowInclusive: true, highInclusive: true };
  }

  const one = ONE_SIDED.exec(text);
  if (one) {
    const limit = Number(one[2]);
    switch (one[1]) {
      case ">":
        return { low: limit, high: null, lowInclusive: false, highInclusive: true };
      case ">=":
      case "≥":
        return { low: limit, high: null, lowInclusive: true, highInclusive: true };
      case "<":
        return { low: null, high: limit, lowInclusive: true, highInclusive: false };
      default:
        return { low: null, high: limit, lowInclusive: true, highInclusive: true };
    }
  }

  return null;
}

export type RangePosition = "below" | "inside" | "above";

export function positionInRange(value: number, range: PrintedRange): RangePosition {
  if (range.low !== null && (range.lowInclusive ? value < range.low : value <= range.low)) return "below";
  if (range.high !== null && (range.highInclusive ? value > range.high : value >= range.high)) return "above";
  return "inside";
}
