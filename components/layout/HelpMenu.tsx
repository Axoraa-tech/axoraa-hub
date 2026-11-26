"use client";

import React from "react";
import { BookOpen, CircleHelp, Keyboard, Mail, MessageSquareWarning } from "lucide-react";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";

/** Mail to support with a short template the reader fills in. */
export function problemReportHref(viewerName: string, viewLabel: string): string {
  const page = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "";
  return supportMailto({
    subject: `Hub issue – ${viewerName} – ${viewLabel}`,
    body: `What happened:\n\n\nSteps:\n1. \n2. \n\nPage: ${page}`,
  });
}

export function HelpMenu({
  viewerName,
  viewLabel,
  onGuide,
  onShortcuts,
  className,
}: {
  viewerName: string;
  viewLabel: string;
  onGuide: () => void;
  onShortcuts: () => void;
  className?: string;
}) {
  const subject = `Hub issue – ${viewerName} – ${viewLabel}`;
  const items: MenuItem[] = [
    { label: "User guide", icon: <BookOpen />, onSelect: onGuide },
    { label: "Keyboard shortcuts", icon: <Keyboard />, shortcut: "?", onSelect: onShortcuts },
    { label: `Email ${COMPANY_EMAIL}`, icon: <Mail />, href: supportMailto({ subject }), separatorBefore: true },
    {
      label: "Report a problem",
      icon: <MessageSquareWarning />,
      // Built on click so the template carries the page the reader is on.
      onSelect: () => {
        window.location.href = problemReportHref(viewerName, viewLabel);
      },
    },
  ];
  return (
    <Menu
      label="Help"
      items={items}
      align="start"
      trigger={<CircleHelp aria-hidden />}
      triggerClassName={className ?? "icon-btn icon-btn-plain"}
    />
  );
}
