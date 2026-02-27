import type { Metadata } from "next";
import { DM_Sans, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

// AI-GOS v2 Typography System
// Body font - DM Sans
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

// Heading font - Instrument Sans
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Mono font for data/code
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

// Note: Cabinet Grotesk (display font) requires self-hosting or purchase
// Using Instrument Sans as fallback for display text

export const metadata: Metadata = {
  title: "AIGOS | AI-Powered Marketing Platform",
  description: "Launch your SaaS with AI-powered marketing research, media planning, and strategic insights. Generate comprehensive blueprints in under 60 seconds.",
  keywords: ["SaaS", "marketing", "AI", "media planning", "go-to-market", "strategy", "AIGOS"],
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${dmSans.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}
          suppressHydrationWarning
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
