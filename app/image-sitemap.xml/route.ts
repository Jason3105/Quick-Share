import { NextResponse } from 'next/server'

const baseUrl = 'https://quicksharep2p.onrender.com'

export function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}</loc>
    <image:image>
      <image:loc>${baseUrl}/og-image.png</image:loc>
      <image:title>Quick Share - Free P2P File Transfer</image:title>
      <image:caption>Send large files instantly with secure peer-to-peer file sharing using WebRTC</image:caption>
    </image:image>
    <image:image>
      <image:loc>${baseUrl}/logo.png</image:loc>
      <image:title>Quick Share Logo</image:title>
      <image:caption>Quick Share - Secure P2P File Transfer Application</image:caption>
    </image:image>
  </url>
  <url>
    <loc>${baseUrl}/send</loc>
    <image:image>
      <image:loc>${baseUrl}/og-image.png</image:loc>
      <image:title>Send Files - Quick Share</image:title>
      <image:caption>Send large files for free with no size limits using Quick Share</image:caption>
    </image:image>
  </url>
  <url>
    <loc>${baseUrl}/receive</loc>
    <image:image>
      <image:loc>${baseUrl}/og-image.png</image:loc>
      <image:title>Receive Files - Quick Share</image:title>
      <image:caption>Receive files securely via P2P connection with Quick Share</image:caption>
    </image:image>
  </url>
</urlset>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
