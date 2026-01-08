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

export const metadata = {
  title: "Danny DEVito | The Trash Man of Crypto",
  description: "I'm the Trash Man! I come out, I throw coins all over the ring! Parody agent dropping magnum memecoins every 72 hours. Stakers get the good seats.",
  icons: {
    icon: "/3.png",
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
