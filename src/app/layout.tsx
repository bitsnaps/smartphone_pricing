import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DZ Phone Value — Smartphone Price Estimator (Algeria)",
  description:
    "Estimate the market value of new and used smartphones in Algeria. XGBoost hedonic pricing model trained on Ouedkniss listings with conformal P10-P90 price bands.",
  keywords: ["smartphone price", "Algeria", "Ouedkniss", "DZD", "price estimator", "XGBoost"],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "DZ Phone Value",
    description: "Smartphone price estimator for the Algerian market",
    siteName: "DZ Phone Value",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DZ Phone Value",
    description: "Smartphone price estimator for the Algerian market",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
