import React from "react";
import type { ChannelId } from "@/lib/integrations/types";

export type BrandChannel = "facebook" | "instagram" | "linkedin" | "whatsapp";

/* Simplified single-colour marks drawn in currentColor on a 24px grid. lucide-react has none of these. */
const PATHS: Record<BrandChannel, React.ReactNode> = {
  facebook: (
    <path
      fill="currentColor"
      d="M12 2a10 10 0 0 0-1.56 19.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 12 2Z"
    />
  ),
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </g>
  ),
  linkedin: (
    <path
      fill="currentColor"
      d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1.6 7.4V18h2.5v-7.6H6.6Zm1.25-3.9a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9ZM10.9 10.4V18h2.5v-4c0-1.1.4-2 1.6-2 1.1 0 1.4.9 1.4 2.1V18h2.5v-4.6c0-2.3-1.1-3.2-2.8-3.2-1.3 0-2.1.6-2.6 1.3v-1.1h-2.6Z"
    />
  ),
  whatsapp: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.3 20.7l4.4-1.1A8.8 8.8 0 1 0 12 3.2Z" />
      <path
        fill="currentColor"
        stroke="none"
        d="M9.2 7.6c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.7.9c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.8-.1-.3 0-.4.1-.5l.4-.5.3-.5c.1-.2 0-.3 0-.5l-.8-1.8Z"
      />
    </g>
  ),
};

const NAMES: Record<BrandChannel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

export function ChannelMark({
  channel,
  size = 16,
  className = "",
  title,
}: {
  channel: BrandChannel;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-channel={channel}
    >
      {title && <title>{title}</title>}
      {PATHS[channel]}
    </svg>
  );
}

export function channelMarkFor(id: ChannelId): BrandChannel {
  if (id === "facebook_page") return "facebook";
  if (id === "instagram") return "instagram";
  return "linkedin";
}

export function channelName(channel: BrandChannel): string {
  return NAMES[channel];
}
