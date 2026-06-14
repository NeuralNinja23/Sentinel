import type { Metadata } from "next";
import { Space_Grotesk, Orbitron, Exo_2 } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const exo2 = Exo_2({
  variable: "--font-exo-2",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sentinel | AI Core",
  description: "Next-generation spatial AI operating system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${orbitron.variable} ${exo2.variable}`}>
      <body className="antialiased font-space bg-black text-white overflow-hidden w-screen h-screen">
        {children}
      </body>
    </html>
  );
}
