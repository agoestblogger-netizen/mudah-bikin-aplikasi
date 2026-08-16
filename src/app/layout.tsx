import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Mudah Bikin Aplikasi - Gem AI Studio",
  description: "Platform Generator Aplikasi, Analisis Visual DNA, Live Canvas Studio & Backend Google Apps Script.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${outfit.variable} dark`}>
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
