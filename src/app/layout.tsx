import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Mudah Bikin Aplikasi - Generator Web App AI",
  description: "Platform web untuk membantu non-programmer membuat aplikasi web fungsional melalui percakapan AI, live preview mockup interaktif, dan backend Google Sheets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${outfit.variable} dark`} suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
