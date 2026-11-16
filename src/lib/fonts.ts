import localFont from "next/font/local";

// Self-hosted from D:\INetwork\Hillal ahmr\fonts (same files the design uses).
export const inter = localFont({
  src: "../app/fonts/Inter-Variable.ttf",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const plexArabic = localFont({
  src: [
    { path: "../app/fonts/IBMPlexSansArabic-Regular.ttf", weight: "400" },
    { path: "../app/fonts/IBMPlexSansArabic-Medium.ttf", weight: "500" },
    { path: "../app/fonts/IBMPlexSansArabic-SemiBold.ttf", weight: "600" },
    { path: "../app/fonts/IBMPlexSansArabic-Bold.ttf", weight: "700" },
  ],
  variable: "--font-plex-ar",
  display: "swap",
});
