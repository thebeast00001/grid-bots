import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "streamdown/styles.css";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Grid",
  description: "Your AI team, open source.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
