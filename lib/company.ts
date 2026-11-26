// Company profile and email helpers. Isomorphic: imported by server routes and client views.
// COMPANY_EMAIL is the only place the support address is written down.

export const COMPANY_EMAIL = "info@axoraa.com";

export interface CompanyProfile {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  addressLines: string[];
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan: string;
  paymentInstructions: string;
  services: string[];
  timezone: "Asia/Kolkata";
  currency: "INR";
  fyStartMonth: number;
}

// Never invent a GSTIN, address or phone number: blanks are filled in from Settings.
export const DEFAULT_COMPANY: CompanyProfile = {
  name: "Axoraa",
  legalName: "",
  email: COMPANY_EMAIL,
  phone: "",
  website: "axoraa.com",
  addressLines: [],
  city: "",
  state: "Karnataka",
  pincode: "",
  gstin: "",
  pan: "",
  paymentInstructions: "",
  services: [
    "Custom web applications",
    "Android and iOS apps",
    "Business software and integrations",
    "Website design and development",
    "Cloud and DevOps",
  ],
  timezone: "Asia/Kolkata",
  currency: "INR",
  fyStartMonth: 4,
};

const STRING_FIELDS = [
  "name",
  "legalName",
  "email",
  "phone",
  "website",
  "city",
  "state",
  "pincode",
  "gstin",
  "pan",
  "paymentInstructions",
] as const;

/** Fills every missing or malformed field from DEFAULT_COMPANY. Never throws. */
export function resolveCompany(p?: Partial<CompanyProfile> | null): CompanyProfile {
  const out: CompanyProfile = { ...DEFAULT_COMPANY, addressLines: [...DEFAULT_COMPANY.addressLines], services: [...DEFAULT_COMPANY.services] };
  if (!p || typeof p !== "object") return out;
  for (const key of STRING_FIELDS) {
    const v = (p as Record<string, unknown>)[key];
    if (typeof v === "string") out[key] = v.trim();
  }
  if (!out.name) out.name = DEFAULT_COMPANY.name;
  if (!out.state) out.state = DEFAULT_COMPANY.state;
  if (Array.isArray(p.addressLines)) out.addressLines = p.addressLines.filter((l): l is string => typeof l === "string" && l.trim() !== "").map((l) => l.trim());
  if (Array.isArray(p.services)) out.services = p.services.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim());
  const fy = Number(p.fyStartMonth);
  if (Number.isInteger(fy) && fy >= 1 && fy <= 12) out.fyStartMonth = fy;
  return out;
}

/** The address a client sees on documents and emails: the company email, or COMPANY_EMAIL when blank. */
export function clientFacingEmail(c?: Partial<CompanyProfile> | null): string {
  const email = typeof c?.email === "string" ? c.email.trim() : "";
  return email || COMPANY_EMAIL;
}

export interface EmailDraft {
  to?: string;
  cc?: string;
  subject: string;
  body: string;
}

export type ComposePref = "mailto" | "gmail" | "outlook";

export interface ComposeInput {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body?: string;
}

function addressList(v?: string | string[]): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;]/) : [];
  return list.map((s) => s.trim()).filter(Boolean);
}

// RFC 6068 keeps '@' readable in addresses; everything else is percent-encoded.
const encodeAddress = (a: string) => encodeURIComponent(a).replace(/%40/g, "@");

/** mailto: link per RFC 6068. Line breaks in the body are sent as CRLF. */
export function mailtoHref(o: ComposeInput): string {
  const to = addressList(o.to).map(encodeAddress).join(",");
  const params: string[] = [];
  const cc = addressList(o.cc);
  const bcc = addressList(o.bcc);
  if (cc.length) params.push(`cc=${cc.map(encodeAddress).join(",")}`);
  if (bcc.length) params.push(`bcc=${bcc.map(encodeAddress).join(",")}`);
  if (o.subject) params.push(`subject=${encodeURIComponent(o.subject)}`);
  if (o.body) params.push(`body=${encodeURIComponent(o.body.replace(/\r?\n/g, "\r\n"))}`);
  return `mailto:${to}${params.length ? `?${params.join("&")}` : ""}`;
}

/** A compose link for the viewer's preferred email app. */
export function composeHref(o: ComposeInput, pref: ComposePref): string {
  if (pref === "gmail") {
    const q = new URLSearchParams({ view: "cm", fs: "1" });
    q.set("to", addressList(o.to).join(","));
    const cc = addressList(o.cc);
    const bcc = addressList(o.bcc);
    if (cc.length) q.set("cc", cc.join(","));
    if (bcc.length) q.set("bcc", bcc.join(","));
    q.set("su", o.subject ?? "");
    q.set("body", o.body ?? "");
    return `https://mail.google.com/mail/?${q.toString().replace(/\+/g, "%20")}`;
  }
  if (pref === "outlook") {
    const q = new URLSearchParams();
    q.set("to", addressList(o.to).join(","));
    const cc = addressList(o.cc);
    if (cc.length) q.set("cc", cc.join(","));
    q.set("subject", o.subject ?? "");
    q.set("body", o.body ?? "");
    return `https://outlook.office.com/mail/deeplink/compose?${q.toString().replace(/\+/g, "%20")}`;
  }
  return mailtoHref(o);
}

/** mailto: link to the Axoraa support address. */
export function supportMailto(o: { subject: string; body?: string }): string {
  return mailtoHref({ to: COMPANY_EMAIL, subject: o.subject, body: o.body });
}

/** Plain-text email signature. */
export function signature(company: CompanyProfile, senderName?: string): string {
  const c = resolveCompany(company);
  const lines = ["Regards,"];
  if (senderName && senderName.trim()) lines.push(senderName.trim());
  lines.push(c.name || "Axoraa");
  lines.push(clientFacingEmail(c));
  let out = lines.join("\n");
  if (c.phone) out += `\n${c.phone}`;
  if (c.website) out += `\n${c.website}`;
  return out;
}
