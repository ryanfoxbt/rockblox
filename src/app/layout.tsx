import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ComplainButton } from "@/components/ComplainButton";
import { JsonLd } from "@/components/JsonLd";
import { ENTITY_DESCRIPTION, rootJsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "RockBlocks — Free Online Drum Machine & Beat Maker";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | RockBlocks",
  },
  description: ENTITY_DESCRIPTION,
  keywords: [
    "drum machine",
    "online drum machine",
    "free online drum machine",
    "beat maker",
    "free beat maker",
    "make a beat online",
    "drum sequencer",
    "step sequencer online",
    "drum pattern maker",
    "drum machine no download",
    "browser drum machine",
    "808 drum machine online",
    "odd time signature drum machine",
    "drum beat generator",
    "drum fill generator",
    "text to beat",
    "mp3 to drum pattern",
    "learn to play drums online",
    "how to make a drum beat",
    "drum machine for kids",
    "beat maker for kids",
    "music education beat sequencer",
  ],
  category: "music",
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: ENTITY_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: ENTITY_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <JsonLd data={rootJsonLd} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ComplainButton />
        <Analytics />
      </body>
    </html>
  );
}
