import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Send Files',
  description: 'Send large files securely using Quick Share. Upload files and share via QR code, link, or room code. No file size limits, end-to-end encrypted P2P transfer.',
  openGraph: {
    title: 'Send Files - Quick Share',
    description: 'Send large files securely using Quick Share. Upload files and share via QR code, link, or room code.',
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
