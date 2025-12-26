import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Send Files - Quick Share | Free P2P File Transfer',
  description: 'Send large files instantly and securely with Quick Share. Free peer-to-peer file sharing with no size limits. Share files directly from your browser using WebRTC. No registration required, end-to-end encrypted.',
  keywords: [
    'send large files',
    'send big files free',
    'p2p file sender',
    'share files online',
    'send files securely',
    'transfer large files',
    'send files no limit',
    'free file sender',
    'browser file transfer',
    'webrtc file sender',
    'qr code file sharing',
    'instant file transfer',
    'upload large files',
    'share files free',
  ],
  openGraph: {
    title: 'Send Files - Quick Share | Free P2P File Transfer',
    description: 'Send large files instantly and securely. Free peer-to-peer file sharing with no size limits. Share files directly from your browser.',
    url: 'https://quicksharep2p.onrender.com/send',
    type: 'website',
    siteName: 'Quick Share',
    images: [{
      url: 'https://quicksharep2p.onrender.com/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Quick Share - Send Files Securely',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Send Files - Quick Share',
    description: 'Send large files instantly and securely. Free peer-to-peer file sharing with no size limits.',
    images: ['https://quicksharep2p.onrender.com/og-image.png'],
  },
  alternates: {
    canonical: 'https://quicksharep2p.onrender.com/send',
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

export default function SendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
