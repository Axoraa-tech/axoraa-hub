import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { FeedbackProvider } from "@/components/ui/feedback";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

// latin-ext covers the currency block (U+20B9 ₹). Where Geist has no glyph, the stack in
// globals.css falls back to system-ui, which draws ₹ on every current OS.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { template: "%s – Axoraa Hub", default: "Axoraa Hub" },
  description: "Daily work, pipeline, delivery and collections for the Axoraa team.",
  applicationName: "Axoraa Hub",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EBEBE6" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C0D" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-IN"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-canvas text-ink font-sans">
        <FeedbackProvider>{children}</FeedbackProvider>
        <Analytics />
      </body>
    </html>
  );
}
