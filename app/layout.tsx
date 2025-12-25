import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { KeepAlive } from "@/components/keep-alive";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://quicksharep2p.onrender.com'),
  verification: {
    google: '54be84ab9e525d21',
  },
  title: {
    default: 'Quick Share - Free P2P File Transfer | Send Large Files Instantly & Securely',
    template: '%s | Quick Share - Secure File Sharing'
  },
  description: 'Send large files instantly with Quick Share - 100% free, secure peer-to-peer file sharing using WebRTC. No file size limits, no registration, end-to-end encrypted. Share documents, videos, photos, and more directly browser-to-browser. Fast, private, and unlimited file transfers.',
  keywords: [
    // Core file sharing keywords
    'file sharing',
    'p2p file transfer',
    'peer to peer file sharing',
    'webrtc file sharing',
    'send large files',
    'send big files',
    'free file transfer',
    'secure file sharing',
    'encrypted file transfer',
    'instant file sharing',
    
    // File size and limits
    'no file size limit',
    'unlimited file sharing',
    'large file transfer',
    'send files up to 10gb',
    'send files up to 100gb',
    'transfer big files',
    
    // Security and privacy
    'end to end encryption',
    'private file sharing',
    'secure file transfer',
    'encrypted file sharing',
    'anonymous file sharing',
    'no cloud storage',
    'direct file transfer',
    
    // Use cases and file types
    'share videos online',
    'share photos online',
    'send documents online',
    'transfer files between computers',
    'share files between devices',
    'send files mobile to pc',
    'share pdf files',
    'transfer video files',
    'send compressed files',
    'share zip files',
    
    // Competitive keywords
    'wetransfer alternative',
    'dropbox alternative',
    'google drive alternative',
    'filesend alternative',
    'sendanywhere alternative',
    'airdrop alternative',
    'shareit alternative',
    
    // Browser and platform
    'browser file sharing',
    'online file transfer',
    'web based file sharing',
    'file sharing no download',
    'file sharing no installation',
    'cross platform file sharing',
    
    // Convenience features
    'no registration file sharing',
    'no account needed',
    'quick file transfer',
    'fast file sharing',
    'easy file sharing',
    'simple file transfer',
    'qr code file sharing',
    
    // Technology
    'webrtc',
    'peer to peer',
    'p2p transfer',
    'direct transfer',
    'browser to browser',
    
    // Brand
    'quick share',
    'quickshare',
    'quick share p2p',
    'quick file share'
  ],
  authors: [{ name: 'Quick Share Team', url: 'https://quicksharep2p.onrender.com' }],
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
    alternateLocale: ['es_ES', 'fr_FR', 'de_DE', 'ja_JP', 'zh_CN'],
    url: 'https://quicksharep2p.onrender.com',
    title: 'Quick Share - Free P2P File Transfer | Send Large Files Instantly & Securely',
    description: 'Send large files instantly with Quick Share. 100% free, secure peer-to-peer file sharing using WebRTC. No file size limits, no registration, end-to-end encrypted. Transfer files directly between browsers.',
    siteName: 'Quick Share',
    images: [{
      url: 'https://quicksharep2p.onrender.com/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Quick Share - Secure P2P File Transfer - Send Large Files Free',
      type: 'image/png',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quick Share - Free P2P File Transfer | Send Large Files',
    description: 'Send large files instantly. Free, secure, peer-to-peer file sharing using WebRTC. No limits, no registration, end-to-end encrypted.',
    images: ['https://quicksharep2p.onrender.com/og-image.png'],
    creator: '@quickshare',
    site: '@quickshare',
  },
  icons: {
    icon: [
      { url: 'https://quicksharep2p.onrender.com/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: 'https://quicksharep2p.onrender.com/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: 'https://quicksharep2p.onrender.com/android-icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: 'https://quicksharep2p.onrender.com/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://quicksharep2p.onrender.com',
  },
  category: 'technology',
  applicationName: 'Quick Share',
  referrer: 'origin-when-cross-origin',
  appLinks: {
    web: {
      url: 'https://quicksharep2p.onrender.com',
      should_fallback: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <KeepAlive />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
