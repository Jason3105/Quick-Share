import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/?room=*', '/*?room=*', '/?join=*', '/*?join=*'],
        crawlDelay: 0,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/?room=*', '/*?room=*'],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: '/',
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/?room=*', '/*?room=*'],
      },
      // Social media crawlers for rich previews
      {
        userAgent: ['facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'WhatsApp'],
        allow: '/',
      },
    ],
    sitemap: 'https://quicksharep2p.onrender.com/sitemap.xml',
  }
}
