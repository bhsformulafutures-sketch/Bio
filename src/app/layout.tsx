import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Two of Us",
  description:
    "A tiny, private world for two — playful photo games and shared moments, just the two of you.",
};

export const viewport: Viewport = {
  themeColor: "#fdf6f3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
