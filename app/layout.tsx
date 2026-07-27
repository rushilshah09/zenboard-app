import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { AppearanceBoot } from "@/components/shell/appearance-boot";
import { Providers } from "@/components/shell/providers";

// Type system (Figma HIfi, 2026-07-16) = Geist (UI + body, variable weight)
// · Geist Mono (numerics/kbd/code) · Source Serif 4 (Documents reading-mode,
// opt-in only — never in chrome). No 700 sans; 600 is our bold.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zenboard — a quiet operating system for your work and life",
  description:
    "One calm place for your tasks, goals, focus, notes, and daily rhythm.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme / data-density are deliberately NOT rendered in JSX: the boot
    // script below stamps them before first paint (tokens.css :root is the light
    // default, so no-attribute === light). If React rendered them, any hydration
    // recovery would re-apply the JSX values and silently reset a dark user to
    // light — see node_modules/next/dist/docs/…/preventing-flash-before-hydration.md.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable}`}
    >
      <head>
        {/* Applies the saved theme/density/accent before paint — no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <AppearanceBoot />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
