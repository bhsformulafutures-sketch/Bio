import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/Toast";
import { FloatingAccents } from "@/components/motion";

export const metadata: Metadata = {
  title: "The Other Half",
  description:
    "A private game for two: one of you shares half a photo, the other draws what they imagine is missing. Then the truth is revealed.",
};

export const viewport: Viewport = {
  themeColor: "#faf6f0",
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
        <FloatingAccents />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
