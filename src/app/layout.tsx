import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { ImpersonationBanner } from "@/components/shell/impersonation-banner";
import "./globals.css";

// AIGOS v3 Typography System — Journey Workspace redesign (2026-04-17)
// Var names kept as --font-dm-sans / --font-instrument-sans / --font-jetbrains-mono
// for backward compatibility; the fonts BEHIND them are now Geist / Instrument Serif /
// Geist Mono. Rename pass will happen in Phase 2.
const dmSans = Geist({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const instrumentSans = Instrument_Serif({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

const jetbrainsMono = Geist_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

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
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#365EFF',
          colorBackground: '#07090e',
          colorInputBackground: '#0e1017',
          colorInputText: '#fcfcfa',
          colorText: '#fcfcfa',
          colorTextSecondary: '#cdd0d5',
          colorDanger: '#ef4444',
          borderRadius: '0.75rem',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${dmSans.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}
          suppressHydrationWarning
        >
          <ThemeProvider>
            <ImpersonationBanner />
            <ErrorBoundary>{children}</ErrorBoundary>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
