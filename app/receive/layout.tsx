import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Receive Files',
  description: 'Receive files securely using Quick Share. Enter room code, scan QR code, or use a shared link to download files. No registration required, 100% encrypted.',
  openGraph: {
    title: 'Receive Files - Quick Share',
    description: 'Receive files securely using Quick Share. Enter room code, scan QR code, or use a shared link to download files.',
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
