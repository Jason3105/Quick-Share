import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://quicksharep2p.onrender.com'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/send', '/receive'],
        disallow: [
          '/api/*',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/send', '/receive'],
        disallow: [
          '/api/*',
        ],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/'],
        disallow: ['/api/*'],
      },
      {
        userAgent: 'Bingbot',
        allow: ['/', '/send', '/receive'],
        disallow: [
          '/api/*',
        ],
      },
      // Social media crawlers for rich previews - allow query params for dynamic previews
      {
        userAgent: ['facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'WhatsApp'],
        allow: ['/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
