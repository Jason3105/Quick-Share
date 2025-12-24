import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://quickshare.app'),
  title: {
    default: 'Quick Share - Free P2P File Transfer | Send Large Files Instantly',
    template: '%s | Quick Share'
  },
  description: 'Send large files instantly with Quick Share - Free, secure, peer-to-peer file sharing using WebRTC. No file size limits, no registration, 100% encrypted. Share documents, videos, photos directly browser-to-browser.',
  keywords: [
    'file sharing',
    'p2p file transfer',
    'send large files',
    'webrtc file sharing',
    'peer to peer',
    'free file transfer',
    'secure file sharing',
    'no file size limit',
    'encrypted file transfer',
    'instant file sharing',
    'browser file sharing',
    'send files online',
    'file transfer online',
    'share files free',
    'quick share',
    'fast file transfer',
    'private file sharing',
    'no registration file sharing',
    'direct file transfer',
    'share videos online',
    'share photos online',
    'send documents online'
  ],
  authors: [{ name: 'Quick Share Team' }],
  creator: 'Quick Share',
  publisher: 'Quick Share',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://quickshare.app',
    title: 'Quick Share - Free P2P File Transfer | Send Large Files Instantly',
    description: 'Send large files instantly with Quick Share. Free, secure, peer-to-peer file sharing using WebRTC. No file size limits, no registration, 100% encrypted.',
    siteName: 'Quick Share',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Quick Share - Secure P2P File Transfer',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quick Share - Free P2P File Transfer',
    description: 'Send large files instantly. Free, secure, peer-to-peer file sharing using WebRTC. No limits, no registration.',
    images: ['/og-image.png'],
    creator: '@quickshare',
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/android-icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
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
  alternates: {
    canonical: 'https://quickshare.app',
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
