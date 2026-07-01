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
    return [
      {
        source: '/warehouse/master/categories',
        destination: '/warehouse/master?tab=categories',
        permanent: true,
      },
      {
        source: '/warehouse/master/sizes',
        destination: '/warehouse/master?tab=sizes',
        permanent: true,
      },
      {
        source: '/warehouse/master/colors',
        destination: '/warehouse/master?tab=colors',
        permanent: true,
      },
      {
        source: '/warehouse/master/fabrics',
        destination: '/warehouse/master?tab=fabrics',
        permanent: true,
      },
      {
        source: '/warehouse/master/warehouses',
        destination: '/warehouse/master?tab=warehouses',
        permanent: true,
      },
      {
        source: '/warehouse/master/suppliers',
        destination: '/warehouse/master?tab=suppliers',
        permanent: true,
      },
      {
        source: '/warehouse/master/channels',
        destination: '/warehouse/master?tab=channels',
        permanent: true,
      },
    ];
  }
};

export default nextConfig;

