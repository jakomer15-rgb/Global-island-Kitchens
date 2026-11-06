import { Amiri, Fraunces, IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

// English: Fraunces (display) and Inter (text). Arabic: Amiri (display) and IBM Plex Sans Arabic
// (text). The Latin fonts are preloaded because every page needs them (the wordmark is always
// Latin); arriving before first paint stops text re-wrapping when they swap in. The Arabic fonts
// aren't, so English pages don't download them. `display: swap` keeps text visible while fonts load.

export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
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

export const fontVariables = [fraunces, inter, amiri, plexArabic].map((f) => f.variable).join(" ");
