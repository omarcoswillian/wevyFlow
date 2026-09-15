import type { Metadata, Viewport } from "next";
import { Sora, Geist_Mono } from "next/font/google";
import { PWARegister } from "./components/PWARegister";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#a78bfa",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "WevyFlow — Criativos com IA",
  description:
    "Gere criativos, identidade de marca e campanhas com IA para os seus lançamentos.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WevyFlow",
  },
  icons: {
    icon: [
      { url: "/IconeAtual3.png", type: "image/png" },
    ],
    apple: [
      { url: "/IconeAtual-PWA1.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}

