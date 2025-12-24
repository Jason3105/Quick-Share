import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/?room=*', '/*?room=*'],
      },
    ],
    sitemap: 'https://quicksharep2p.onrender.com/sitemap.xml',
  }
}
