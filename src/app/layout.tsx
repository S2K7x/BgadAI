import type { Metadata, Viewport } from "next";
import { Anybody, Geist, Rock_Salt } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

// One variable file covers both themes: stretched to 150% (editorial) or 62% (synth).
const anybody = Anybody({ variable: "--font-anybody", subsets: ["latin"], axes: ["wdth"] });

// Handwritten accent, only used by the dark "synth" theme — not preloaded, so it's
// fetched only when a synth page actually renders text in it.
const rockSalt = Rock_Salt({ variable: "--font-rock-salt", subsets: ["latin"], weight: "400", preload: false });

export const metadata: Metadata = {
  title: "BgadAI — your AI stylist",
  description: "Photograph your clothes, tell us your style, and get outfits built from what you already own.",
  applicationName: "BgadAI",
  appleWebApp: { capable: true, title: "BgadAI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0d10" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Runs before first paint: applies the saved theme ("light" | "dark" | "system")
 * so there is no flash of the wrong theme. See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("theme")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${anybody.variable} ${rockSalt.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
