// Indian formats: lakh/crore grouping, IST dates, financial years. Isomorphic and deterministic
// (no Intl differences between server and browser for dates).

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

// ---------------------------------------------------------------- IST, dates and periods

const IST_OFFSET_MS = 5.5 * 3_600_000; // India has no daylight saving.
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fields of an instant as seen on an IST wall clock. */
function istParts(ms: number) {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    wd: d.getUTCDay(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes(),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM-DD' for today in Asia/Kolkata. Pass `now` (ms) to use a known instant. */
export function todayKeyIST(now?: number): string {
  const p = istParts(now ?? Date.now());
  return `${p.y}-${pad2(p.m + 1)}-${pad2(p.d)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Day key in IST for a day key, an ISO timestamp, a legacy 'YYYY-MM-DD HH:mm:ss' (UTC) value or a Date. */
export function dayKeyOf(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toDayKey(value);
  const v = value.trim();
  if (DAY_RE.test(v)) return v;
  const ms = parseInstant(v);
  return ms === null ? null : todayKeyIST(ms);
}

/** Milliseconds for an ISO timestamp or a legacy 'YYYY-MM-DD HH:mm:ss' UTC string. */
export function parseInstant(value: string | null | undefined): number | null {
  if (!value) return null;
  const v = value.trim();
  if (DAY_RE.test(v)) return Date.parse(`${v}T00:00:00+05:30`);
  const legacy = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/.exec(v);
  const ms = Date.parse(legacy ? `${legacy[1]}T${legacy[2]}Z` : v);
  return Number.isNaN(ms) ? null : ms;
}

function dayKeyToUtcMs(day: string): number | null {
  const m = DAY_RE.exec(day);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** '25 Nov', '25 Nov 2026' with year, 'Tue 18 Nov' with weekday. Accepts a day key or an ISO timestamp. */
export function formatDateIST(isoOrDay: string | null | undefined, opts: { year?: boolean; weekday?: boolean } = {}): string {
  const key = dayKeyOf(isoOrDay ?? "");
  const ms = key ? dayKeyToUtcMs(key) : null;
  if (ms === null) return isoOrDay ? String(isoOrDay) : "–";
  const d = new Date(ms);
  let out = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (opts.year) out += ` ${d.getUTCFullYear()}`;
  if (opts.weekday) out = `${WEEKDAYS[d.getUTCDay()]} ${out}`;
  return out;
}

/** '25 Nov, 4:30 pm' in IST. */
export function formatDateTimeIST(iso: string | null | undefined): string {
  const ms = parseInstant(iso ?? "");
  if (ms === null) return iso ? String(iso) : "–";
  const p = istParts(ms);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${p.d} ${MONTHS[p.m]}, ${h12}:${pad2(p.min)} ${p.h < 12 ? "am" : "pm"}`;
}

/**
 * '2 min ago', '3 hours ago', 'yesterday', '3 days ago', then a date.
 * `now` is required so callers pass useNow(); when it is 0 (server render) the absolute time is returned.
 */
export function relativeTime(iso: string | null | undefined, now: number): string {
  const ms = parseInstant(iso ?? "");
  if (ms === null) return iso ? String(iso) : "–";
  if (!now) return formatDateTimeIST(iso);
  const diff = now - ms;
  if (diff < 0) return formatDateTimeIST(iso);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  const days = daysBetween(todayKeyIST(ms), todayKeyIST(now));
  if (days === 0) {
    if (min < 60) return `${min} min ago`;
    const h = Math.floor(min / 60);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const sameYear = istParts(ms).y === istParts(now).y;
  return formatDateIST(todayKeyIST(ms), { year: !sameYear });
}

/** Whole days from a to b (b − a). Accepts day keys or timestamps; 0 when either is missing. */
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number {
  const ka = dayKeyOf(a ?? "");
  const kb = dayKeyOf(b ?? "");
  const ma = ka ? dayKeyToUtcMs(ka) : null;
  const mb = kb ? dayKeyToUtcMs(kb) : null;
  if (ma === null || mb === null) return 0;
  return Math.round((mb - ma) / DAY_MS);
}

/** Day key n days after `day` (n may be negative). */
export function addDaysKey(day: string, n: number): string {
  const ms = dayKeyToUtcMs(dayKeyOf(day) ?? "");
  if (ms === null) return day;
  const d = new Date(ms + Math.round(n) * DAY_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function yearMonthOf(date: string | Date): { y: number; m: number } | null {
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? null : { y: date.getFullYear(), m: date.getMonth() };
  const key = dayKeyOf(date);
  const m = key ? DAY_RE.exec(key) : null;
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1 } : null;
}

/** Indian financial year (April to March): Apr 2025 – Mar 2026 is { startYear: 2025, label: 'FY26' }. */
export function fyOf(date: string | Date): { startYear: number; label: string } {
  const ym = yearMonthOf(date) ?? yearMonthOf(todayKeyIST())!;
  const startYear = ym.m >= 3 ? ym.y : ym.y - 1;
  return { startYear, label: `FY${pad2((startYear + 1) % 100)}` };
}

/** 'Q3 FY26' — Q1 is April to June. */
export function quarterLabel(date: string | Date): string {
  const ym = yearMonthOf(date) ?? yearMonthOf(todayKeyIST())!;
  const q = Math.floor(((ym.m + 9) % 12) / 3) + 1;
  return `Q${q} ${fyOf(date).label}`;
}

// ---------------------------------------------------------------- Money and words

function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** Full rupee figure with Indian grouping: '₹1,25,000', '₹1,25,000.50'. */
export function formatInrFull(n: number): string {
  const v = Number(n) || 0;
  const neg = v < 0;
  const abs = Math.round(Math.abs(v) * 100) / 100;
  const whole = Math.floor(abs);
  const fraction = Math.round((abs - whole) * 100);
  const body = groupIndian(String(whole)) + (fraction ? `.${pad2(fraction)}` : "");
  return `${neg ? "-" : ""}₹${body}`;
}

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) parts.push(below100(r));
  return parts.join(" ");
}

function integerWords(n: number): string {
  if (n === 0) return "zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  let rest = n % 1_00_00_000;
  if (crore) parts.push(`${integerWords(crore)} crore`);
  const lakh = Math.floor(rest / 1_00_000);
  rest %= 1_00_000;
  if (lakh) parts.push(`${below100(lakh)} lakh`);
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (thousand) parts.push(`${below100(thousand)} thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

/** 125000 → 'One lakh twenty-five thousand'; paise are added as 'and fifty paise'. */
export function numberToIndianWords(n: number): string {
  const v = Math.abs(Number(n) || 0);
  const rounded = Math.round(v * 100) / 100;
  const whole = Math.floor(rounded);
  const paise = Math.round((rounded - whole) * 100);
  let out = integerWords(whole);
  if (paise) out += ` and ${below100(paise)} paise`;
  if (Number(n) < 0) out = `minus ${out}`;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** '91XXXXXXXXXX' for a valid Indian mobile number, otherwise null. */
export function normalizeIndianPhone(s: string | null | undefined): string | null {
  let d = String(s ?? "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("091")) d = d.slice(1);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return d.length === 10 && /^[6-9]/.test(d) ? `91${d}` : null;
}

// ---------------------------------------------------------------- Ids and CSV safety

/** `${prefix}_${uuid}`. Falls back to getRandomValues where randomUUID is missing (plain-http origins). */
export function newId(prefix: string): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return `${prefix}_${c.randomUUID()}`;
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Prefixes an apostrophe when a string would be read as a formula by Sheets or Excel. Other values pass through. */
export function csvSafe<T>(v: T): T | string {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
