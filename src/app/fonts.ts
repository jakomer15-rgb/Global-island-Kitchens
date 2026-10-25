import { Amiri, Cormorant_Garamond, IBM_Plex_Sans_Arabic, Jost } from "next/font/google";

// English: Cormorant Garamond (display) and Jost (text). Arabic: Amiri (display) and
// IBM Plex Sans Arabic (text). Nothing is preloaded, so Arabic pages don't download English
// preloads and vice versa; `display: swap` keeps text visible while fonts load.

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
});

export const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
  preload: false,
});

export const amiri = Amiri({
  subsets: ["arabic"],
  weight: "400",
  variable: "--font-amiri",
  display: "swap",
  preload: false,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  // One weight only: each extra weight adds two files to the Arabic page's critical path.
  weight: "400",
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const fontVariables = [cormorant, jost, amiri, plexArabic].map((f) => f.variable).join(" ");
