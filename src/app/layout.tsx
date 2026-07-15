import type { Metadata, Viewport } from "next";
import { Caveat, Instrument_Serif } from "next/font/google";
import "./globals.css";

/* Self-hosted at build time — no runtime font requests. */
const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
});
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});
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
  themeColor: "#f6f0e4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${instrument.variable} ${caveat.variable}`}>
      <body className="relative min-h-dvh">
        {/* Apply the saved wallpaper before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var w=localStorage.getItem('oh-wallpaper');if(w&&w!=='paper')document.body.dataset.wallpaper=w;}catch(e){}",
          }}
        />
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
