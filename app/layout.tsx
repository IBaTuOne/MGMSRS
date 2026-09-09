import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.manavgatgm-srs.com.tr'),
  title: "Manavgat Gençlik Merkezi",
  description: "Saha Randevu Sistemi MGMSRS",
  applicationName: "MGMSRS",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Manavgat Gençlik Merkezi",
    description: "Saha Randevu Sistemi MGMSRS",
    siteName: "MGMSRS",
    url: 'https://www.manavgatgm-srs.com.tr',
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Manavgat Gençlik Merkezi",
    description: "Saha Randevu Sistemi MGMSRS",
  },
};

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={inter.className}>
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
