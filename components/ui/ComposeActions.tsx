"use client";

import React from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { composeHref, type EmailDraft } from "@/lib/company";
import { normalizeIndianPhone } from "@/lib/format";
import { useComposePref } from "@/lib/prefs";
import { useToast } from "./feedback";

/** Long bodies get cut off by mail apps when passed in a link, so Copy comes first past this. */
const LONG_BODY = 1500;

const OPEN_LABEL = { mailto: "Open in email", gmail: "Open in Gmail", outlook: "Open in Outlook" } as const;

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function emailAsText(d: EmailDraft): string {
  return d.subject ? `Subject: ${d.subject}\n\n${d.body}` : d.body;
}

export function ComposeActions({
  email,
  whatsapp,
  size = "md",
}: {
  email?: EmailDraft;
  whatsapp?: { phone?: string; text: string };
  size?: "sm" | "md";
}) {
  const [pref] = useComposePref();
  const toast = useToast();
  const sm = size === "sm" ? "btn-sm" : "";

  const copy = async (text: string) => {
    const ok = await copyText(text);
    toast(ok ? { message: "Copied" } : { message: "Couldn't copy. Select the text and copy it yourself.", tone: "negative" });
  };

  const buttons: React.ReactNode[] = [];

  if (email) {
    const long = email.body.length > LONG_BODY;
    const href = composeHref({ to: email.to, cc: email.cc, subject: email.subject, body: email.body }, pref);
    const web = pref !== "mailto";
    const open = (
      <a
        key="open-email"
        href={href}
        target={web ? "_blank" : undefined}
        rel={web ? "noopener noreferrer" : undefined}
        className={`btn ${long ? "btn-secondary" : "btn-primary"} ${sm}`}
      >
        <Mail aria-hidden />
        {OPEN_LABEL[pref]}
      </a>
    );
    const copyBtn = (
      <button key="copy-email" type="button" onClick={() => copy(emailAsText(email))} className={`btn ${long ? "btn-primary" : "btn-secondary"} ${sm}`}>
        <Copy aria-hidden />
        Copy email
      </button>
    );
    if (long) buttons.push(copyBtn, open);
    else buttons.push(open, copyBtn);
  }

  if (whatsapp) {
    const phone = whatsapp.phone ? normalizeIndianPhone(whatsapp.phone) : null;
    if (phone) {
      buttons.push(
        <a
          key="open-wa"
          href={`https://wa.me/${phone}?text=${encodeURIComponent(whatsapp.text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn ${email ? "btn-secondary" : "btn-primary"} ${sm}`}
        >
          <MessageCircle aria-hidden />
          Open WhatsApp
        </a>
      );
    }
    buttons.push(
      <button key="copy-wa" type="button" onClick={() => copy(whatsapp.text)} className={`btn ${!email && !phone ? "btn-primary" : "btn-secondary"} ${sm}`}>
        <Copy aria-hidden />
        Copy WhatsApp text
      </button>
    );
  }

  if (!buttons.length) return null;
  return <div className="flex flex-wrap items-center gap-2">{buttons}</div>;
}
