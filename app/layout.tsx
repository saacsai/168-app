import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeuDIA",
  description: "Organizado e priorizado. Todo dia.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#2A5F6B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="MeuDIA" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icone_meu_dia.png" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
