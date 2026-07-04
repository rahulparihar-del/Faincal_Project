import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable dynamic route indicators in dev mode that overlap navigation
  devIndicators: false,

  // Gzip/Brotli compression for all responses
  compress: true,

  // Aggressive image optimization
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Compiler optimizations
  compiler: {
    // Remove console.logs in production
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  // Experimental: faster builds + better tree-shaking
  experimental: {
    optimizePackageImports: ["lucide-react", "gsap"],
  },

  async redirects() {
    return [];
  }
};

export default nextConfig;

