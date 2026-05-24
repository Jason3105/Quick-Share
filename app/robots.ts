import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://quicksharep2p.onrender.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/send', '/receive'],
        disallow: ['/api/', '/_next/', '/static/'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/send', '/receive', '/og-image.png', '/logo.png'],
        disallow: ['/api/'],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/og-image.png', '/logo.png', '/apple-icon-180x180.png', '/android-icon-192x192.png'],
      },
      {
        userAgent: 'Bingbot',
        allow: ['/', '/send', '/receive'],
        disallow: ['/api/'],
      },
      {
        userAgent: 'DuckDuckBot',
        allow: ['/', '/send', '/receive'],
        disallow: ['/api/'],
      },
      {
        userAgent: 'YandexBot',
        allow: ['/', '/send', '/receive'],
        disallow: ['/api/'],
      },
      // Social crawlers — allow for rich link previews
      {
        userAgent: ['facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'WhatsApp', 'Slackbot'],
        allow: ['/'],
      },
      // Block AI training crawlers
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 'Claude-Web'],
        disallow: ['/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
