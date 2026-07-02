import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Challenge photos are served straight from Supabase Storage public URLs.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
