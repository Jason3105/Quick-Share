import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Send Files - Free P2P File Transfer | Quick Share',
  description: 'Send large files instantly for free. Share files of any size with secure peer-to-peer transfer. Get QR code, link, or room code to share. No registration, unlimited file size, end-to-end encrypted P2P transfer.',
  keywords: [
    'send files',
    'send large files',
    'file sender',
    'upload files',
    'share files',
    'p2p send',
    'free file upload',
    'send files free',
    'large file sender',
    'instant file share',
    'qr code sharing',
  ],
  openGraph: {
    title: 'Send Files Free - Quick Share P2P Transfer',
    description: 'Share files instantly with secure P2P transfer. No size limits, no registration required. Upload and share via QR code, link, or room code.',
    url: 'https://quicksharep2p.onrender.com/send',
  },
  alternates: {
    canonical: 'https://quicksharep2p.onrender.com/send',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
