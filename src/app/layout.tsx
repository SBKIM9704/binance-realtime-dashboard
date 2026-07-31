import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Mono } from "next/font/google";
import { AppProviders, type Theme } from "@/components/providers";
import type { Lang } from "@/lib/i18n";
import "./globals.css";

// Monospace for numeric/tabular data (prices, tables) — great tabular figures.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ARIA Desk — Binance Market Dashboard",
  description: "실시간 비트코인·이더리움 마켓 대시보드 (Binance)",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read persisted preferences from cookies so the very first render is correct
  // (no theme/language flash). Defaults: dark theme, Korean.
  const cookieStore = await cookies();
  const theme: Theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  const lang: Lang = cookieStore.get("lang")?.value === "en" ? "en" : "ko";

  return (
    <html lang={lang} className={`${mono.variable}${theme === "dark" ? " dark" : ""}`}>
      <head>
        {/* Pretendard — modern Korean UI font (dynamic-subset via CDN). */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <AppProviders initialTheme={theme} initialLang={lang}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
