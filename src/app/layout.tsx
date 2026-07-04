import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/Toast";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { AmbientBackground } from "@/components/motion/AmbientBackground";
import { AmbientDelight } from "@/components/motion/AmbientDelight";

export const metadata: Metadata = {
  title: "The Other Half",
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
      <body className="relative min-h-dvh">
        <MotionProvider>
          <AmbientBackground />
          <AmbientDelight />
          <div className="relative z-10 min-h-dvh">{children}</div>
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  );
}
