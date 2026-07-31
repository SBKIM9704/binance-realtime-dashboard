import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers";
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

// Apply the persisted (or default dark) theme before paint to avoid a flash.
const noFlashTheme = `(function(){try{var t=localStorage.getItem('theme');if(t?t==='dark':true){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={mono.variable} suppressHydrationWarning>
      <head>
        {/* Pretendard — modern Korean UI font (dynamic-subset via CDN). */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
