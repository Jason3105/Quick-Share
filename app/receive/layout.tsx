import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Receive Files - Quick Share | Free P2P File Download',
  description: 'Receive and download files instantly and securely with Quick Share. Enter room code or scan QR code to receive files via secure peer-to-peer connection. No registration required, end-to-end encrypted.',
  keywords: [
    'receive files',
    'download files',
    'file receiver',
    'get files online',
    'p2p receive',
    'free file download',
    'receive large files',
    'instant file receive',
    'qr code receive',
    'room code download',
    'secure file download',
    'encrypted file receive',
  ],
  openGraph: {
    title: 'Receive Files - Quick Share | Free P2P File Download',
    description: 'Download files securely with P2P transfer. Enter code or scan QR to receive files instantly. No registration, 100% encrypted.',
    url: 'https://quicksharep2p.onrender.com/receive',
    type: 'website',
    siteName: 'Quick Share',
    images: [{
      url: 'https://quicksharep2p.onrender.com/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Quick Share - Receive Files Securely',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Receive Files - Quick Share',
    description: 'Download files securely. Enter code or scan QR to receive files instantly.',
    images: ['https://quicksharep2p.onrender.com/og-image.png'],
  },
  alternates: {
    canonical: 'https://quicksharep2p.onrender.com/receive',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function ReceiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
