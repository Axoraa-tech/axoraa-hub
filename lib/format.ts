export function formatInr(amount: number, opts: { compact?: boolean } = { compact: true }): string {
  const n = Number(amount) || 0;
  if (opts.compact !== false) {
    if (Math.abs(n) >= 1_00_00_000) return `₹${trim(n / 1_00_00_000, 2)} Cr`;
    if (Math.abs(n) >= 1_00_000) return `₹${trim(n / 1_00_000, 1)} L`;
    if (Math.abs(n) >= 1_000) return `₹${trim(n / 1_000, 1)}K`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}

function trim(n: number, digits: number) {
  return Number(n.toFixed(digits)).toString();
}

export function formatNumber(n: number, digits = 0): string {
  return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Parse "YYYY-MM-DD" as a local date (no timezone shift). */
export function parseDay(value: string | undefined | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toDayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatDay(value: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  const d = typeof value === "string" ? parseDay(value) : value;
  return d ? d.toLocaleDateString("en-GB", opts) : String(value || "—");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
