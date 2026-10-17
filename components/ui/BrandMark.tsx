export function BrandMark({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <div className={`${className} rounded-full bg-ink flex items-center justify-center shrink-0 ring-1 ring-white/10`}>
      <svg viewBox="0 0 24 24" className="w-1/2 h-1/2" aria-hidden>
        <path d="M4 19 L12 5 L20 19" fill="none" stroke="#d4ff32" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="15" r="1.9" fill="#fff" />
      </svg>
    </div>
  );
}
