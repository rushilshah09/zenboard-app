import type { Metadata } from "next";
import { Geist, Geist_Mono, Rubik, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { AppearanceBoot } from "@/components/shell/appearance-boot";
import { InputModalityBoot } from "@/components/shell/input-modality-boot";
import { Providers } from "@/components/shell/providers";

// Type system (Figma HIfi, 2026-07-16, amended 2026-09-25) = Geist (UI + body,
// variable weight) · Geist Mono (numerics/kbd/code) · RUBIK (titles) · Source
// Serif 4 (Documents reading-mode, opt-in only — never in chrome). No 700 sans;
// 600 is our bold.
//
// TITLES ARE RUBIK (user directive 2026-09-25: "we only use serif fonts, use
// Rubik for titling fonts"). Every heading in the product was set in Source
// Serif — the greeting, the step titles, the sign-up h1 — and a serif is a
// voice, not a neutral: it reads as editorial where this product is a tool.
// Rubik is a geometric sans with a slightly softened terminal, which is the
// warmth the serif was carrying, without the literary register. The serif stays
// exactly where it was chosen deliberately: Documents' reading mode, and the
// Paper skin, which is a printed sheet.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
// Preloaded, unlike the serif: a title is on every screen, so the font is on the
// critical path whether or not it is asked for early.
const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  // Not preloaded. Reading mode is opt-in, yet a preloaded font is fetched at
  // high priority on EVERY page: this was the largest file in the preload list
  // (51 KB), competing with the page's own CSS and scripts. It still loads, on
  // demand, the moment reading mode actually renders serif text.
  preload: false,
});

export const metadata: Metadata = {
  title: "Zenboard. A quiet operating system for your work and life",
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
      className={`${geistSans.variable} ${geistMono.variable} ${rubik.variable} ${sourceSerif.variable}`}
    >
      <head>
        {/* Applies the saved theme/density/accent before paint — no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <AppearanceBoot />
        <InputModalityBoot />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
