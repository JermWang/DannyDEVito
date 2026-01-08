import { Geist, Geist_Mono } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SolanaProviders from "@/components/SolanaProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.DannyDaDev.xyz";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: "Danny DEVito | The Trash Man of Crypto",
  description: "The Trash Man of Crypto",
  openGraph: {
    title: "Danny DEVito | The Trash Man of Crypto",
    description: "The Trash Man of Crypto",
    url: "/",
    type: "website",
    images: [
      {
        url: "/danny-DEVito-banner.png",
        width: 1024,
        height: 256,
        alt: "Danny DEVito banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Danny DEVito | The Trash Man of Crypto",
    description: "The Trash Man of Crypto",
    images: ["/danny-DEVito-banner.png"],
  },
  icons: {
    icon: "/danny-DEVito-pfp.png",
    shortcut: "/danny-DEVito-pfp.png",
    apple: "/danny-DEVito-pfp.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-full bg-[var(--tw-bg)] text-[var(--tw-text)] antialiased`}
      >
        <SolanaProviders>
          {children}
        </SolanaProviders>
      </body>
    </html>
  );
}
