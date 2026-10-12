import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "OTT Release Radar",
  description: "New this week on Netflix, Prime Video and JioHotstar in India, picked for your taste by Gemini.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} antialiased`}>
      <body className="grain min-h-screen">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
