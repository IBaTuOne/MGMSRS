import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Manavgat Gençlik Merkezi",
  description: "Saha Randevu Sistemi MGMSRS",
  applicationName: "MGMSRS",
  openGraph: {
    title: "Manavgat Gençlik Merkezi",
    description: "Saha Randevu Sistemi MGMSRS",
    siteName: "MGMSRS",
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
