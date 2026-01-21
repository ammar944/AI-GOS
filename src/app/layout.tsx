import type { Metadata } from "next";
import { Inter, Instrument_Sans, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

// SaaSLaunch Typography System
// Body font - Inter
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Heading font - Instrument Sans
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Mono font for data/code
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
          className={`${inter.variable} ${instrumentSans.variable} ${geistMono.variable} font-sans antialiased`}
          suppressHydrationWarning
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
