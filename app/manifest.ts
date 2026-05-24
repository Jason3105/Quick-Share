import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quick Share - Free P2P File Transfer',
    short_name: 'Quick Share',
    description: 'Send large files instantly with secure peer-to-peer file sharing. No size limits, no registration, end-to-end encrypted.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    categories: ['utilities', 'productivity'],
    lang: 'en',
    dir: 'ltr',
    scope: '/',
    icons: [
      { src: '/android-icon-36x36.png', sizes: '36x36', type: 'image/png' },
      { src: '/android-icon-48x48.png', sizes: '48x48', type: 'image/png' },
      { src: '/android-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/ms-icon-310x310.png', sizes: '310x310', type: 'image/png' },
      { src: '/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcuts: [
      {
        name: 'Send Files',
        short_name: 'Send',
        description: 'Send files to another device',
        url: '/send',
        icons: [{ src: '/android-icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Receive Files',
        short_name: 'Receive',
        description: 'Receive files from another device',
        url: '/receive',
        icons: [{ src: '/android-icon-192x192.png', sizes: '192x192' }],
      },
    ],
  }
}
