import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ComplainButton } from "@/components/ComplainButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://rockblocks.app";
const SITE_NAME = "RockBlocks";
const DESCRIPTION =
  "RockBlocks is a free, browser-based drum machine — build a beat by dragging rhythmic values into a grid, no login or download required. Save it to your own page, turn a sentence into a groove, arrange beats into a full song, or transcribe an MP3's drums automatically.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RockBlocks — Free Online Drum Machine & Beat Maker",
    template: "%s | RockBlocks",
  },
  description: DESCRIPTION,
  keywords: [
    "drum machine",
    "beat maker",
    "online drum machine",
    "make a beat online",
    "drum sequencer",
    "step sequencer",
    "free drum machine",
    "drum pattern maker",
  ],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "RockBlocks — Free Online Drum Machine & Beat Maker",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "RockBlocks — Free Online Drum Machine & Beat Maker",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

// SoftwareApplication structured data — mainly for rich-result eligibility
// in traditional search, but the same clear, unambiguous facts (what this
// is, that it's free, that it runs in-browser) are exactly what an LLM-based
// answer engine crawling the page latches onto too, same intent as
// public/llms.txt.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any (runs in a web browser)",
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ComplainButton />
      </body>
    </html>
  );
}
