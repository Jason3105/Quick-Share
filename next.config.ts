import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* SEO and Performance optimizations */
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // Enable static exports for better SEO
  trailingSlash: false,
  
  // Optimize images for better performance (affects SEO)
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Security headers that also help with SEO trust signals
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=(), geolocation=()'
          }
        ],
      },
    ]
  },
};

export default nextConfig;
