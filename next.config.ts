import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // Performance optimization
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
