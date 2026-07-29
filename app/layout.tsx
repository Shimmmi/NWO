import type { Metadata } from "next";
import { Cinzel_Decorative, Crimson_Text, Rajdhani } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import "./globals.css";

const cinzel = Cinzel_Decorative({
  subsets: ["latin", "latin-ext"],
  weight: ["700", "900"],
  variable: "--font-display",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const crimson = Crimson_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WORLD ORDER",
  description: "Card fighter — geopolitical strategy battle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`dark ${GeistSans.variable} ${GeistMono.variable} ${cinzel.variable} ${rajdhani.variable} ${crimson.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster richColors closeButton theme="dark" />
      </body>
    </html>
  );
}
