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
  title: "WavyFlow — Gerador de Layouts com IA",
  description:
    "Descreva o que você precisa e receba código HTML/CSS pronto para colar no Elementor, Webflow ou qualquer plataforma no-code.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WavyFlow",
  },
  icons: {
    icon: [
      { url: "/IconeAtual.png", type: "image/png" },
    ],
    apple: [
      { url: "/IconeAtual-PWA.png", sizes: "180x180", type: "image/png" },
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
