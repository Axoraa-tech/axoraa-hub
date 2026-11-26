/** The Axoraa mark: a lime open "A" with a white dot on a round ink badge. */
export function BrandMark({ className = "", size }: { className?: string; size?: number }) {
  const sized = size ? { width: size, height: size } : undefined;
  return (
    <span
      aria-hidden
      style={sized}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink-panel ring-1 ring-white/10 ${size ? className : className || "h-9 w-9"}`}
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none">
        <path d="M4 19 L12 5 L20 19" stroke="var(--color-lime)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="15" r="1.9" fill="var(--color-on-ink-panel)" />
      </svg>
    </span>
  );
}
