import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quick Share - P2P File Transfer',
    short_name: 'Quick Share',
    description: 'Send large files instantly with secure peer-to-peer file sharing',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    icons: [
      {
        src: '/android-icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/ms-icon-310x310.png',
        sizes: '310x310',
        type: 'image/png',
      },
    ],
  }
}
