// Compares the name printed on a report with the patient the report was
// filed against. Used only to warn; BloodLine never picks a patient by name.

const TITLES = new Set(["mr", "mrs", "ms", "miss", "mx", "dr", "prof"]);

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !TITLES.has(t));
}

/** true = same person's name, false = different name, null = no name on the report. */
export function namesMatch(onReport: string | null | undefined, filedAs: string): boolean | null {
  if (!onReport?.trim()) return null;
  const a = tokens(onReport);
  const b = tokens(filedAs);
  if (a.length === 0 || b.length === 0) return null;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const longerSet = new Set(longer);
  return shorter.length >= Math.min(2, longer.length) && shorter.every((t) => longerSet.has(t));
}
