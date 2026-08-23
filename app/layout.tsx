import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "168",
  description: "Organização 24x7.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="168" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icone_168.png" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
