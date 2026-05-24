"use client";

import { useState } from "react";
import { FileSender } from "@/components/file-sender";
import { useRouter } from "next/navigation";

export default function SendPage() {
  const router = useRouter();
  
  return (
    <>
      {/* Structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://quicksharep2p.onrender.com" },
                  { "@type": "ListItem", "position": 2, "name": "Send Files", "item": "https://quicksharep2p.onrender.com/send" }
                ]
              },
              {
                "@type": "WebPage",
                "@id": "https://quicksharep2p.onrender.com/send#webpage",
                "url": "https://quicksharep2p.onrender.com/send",
                "name": "Send Files - Quick Share | Free P2P File Transfer",
                "description": "Send large files instantly and securely. Free peer-to-peer file sharing with no size limits using WebRTC.",
                "inLanguage": "en-US",
                "isPartOf": { "@id": "https://quicksharep2p.onrender.com/#website" },
                "breadcrumb": {
                  "@type": "BreadcrumbList",
                  "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://quicksharep2p.onrender.com" },
                    { "@type": "ListItem", "position": 2, "name": "Send Files", "item": "https://quicksharep2p.onrender.com/send" }
                  ]
                },
                "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2"] }
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "How do I send large files with Quick Share?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Click 'Send Files', select your file, and share the generated 6-digit code or QR code with the recipient. Files transfer directly browser-to-browser with no size limits." }
                  },
                  {
                    "@type": "Question",
                    "name": "Is there a file size limit when sending files?",
                    "acceptedAnswer": { "@type": "Answer", "text": "No! Quick Share has absolutely no file size limits. You can send files of any size - from small documents to large 4K videos or multi-gigabyte archives." }
                  },
                  {
                    "@type": "Question",
                    "name": "How long does it take to send a file?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Transfer speed depends on your internet connection. Since files transfer directly peer-to-peer without going through servers, you get maximum possible speed." }
                  },
                  {
                    "@type": "Question",
                    "name": "Can I send multiple files at once?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Yes, Quick Share supports sending multiple files simultaneously in a single session." }
                  }
                ]
              }
            ]
          })
        }}
      />
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <FileSender onBack={() => router.push("/")} />
      </div>
    </>
  );
}
