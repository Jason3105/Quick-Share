import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Receive Files - Free P2P File Download | Quick Share',
  description: 'Receive and download files instantly. Enter room code or scan QR code to receive files securely. Free peer-to-peer file transfer with no limits. 100% encrypted, no registration required.',
  keywords: [
    'receive files',
    'download files',
    'file receiver',
    'get files',
    'p2p receive',
    'free file download',
    'receive files free',
    'instant file receive',
    'qr code receive',
    'room code download',
  ],
  openGraph: {
    title: 'Receive Files - Quick Share P2P Transfer',
    description: 'Download files securely with P2P transfer. Enter code or scan QR to receive files instantly. No registration, 100% encrypted.',
    url: 'https://quicksharep2p.onrender.com/receive',
  },
  alternates: {
    canonical: 'https://quicksharep2p.onrender.com/receive',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ReceiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
