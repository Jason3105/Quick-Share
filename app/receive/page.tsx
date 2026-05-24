"use client";

import { Suspense } from "react";
import { FileReceiver } from "@/components/file-receiver";
import { useRouter, useSearchParams } from "next/navigation";

function ReceiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Handle both 'room' and 'join' parameters
  // 'join' parameter includes timestamp for QR code security
  let roomCode = searchParams?.get("room") || "";
  
  if (!roomCode) {
    const joinParam = searchParams?.get("join");
    if (joinParam) {
      // Extract room code from join parameter (format: CODE:timestamp)
      roomCode = joinParam.split(":")[0];
    }
  }
  
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
                  { "@type": "ListItem", "position": 2, "name": "Receive Files", "item": "https://quicksharep2p.onrender.com/receive" }
                ]
              },
              {
                "@type": "WebPage",
                "@id": "https://quicksharep2p.onrender.com/receive#webpage",
                "url": "https://quicksharep2p.onrender.com/receive",
                "name": "Receive Files - Quick Share | Free P2P File Download",
                "description": "Receive and download files instantly and securely. Enter room code or scan QR code to receive files via secure peer-to-peer connection.",
                "inLanguage": "en-US",
                "isPartOf": { "@id": "https://quicksharep2p.onrender.com/#website" },
                "breadcrumb": {
                  "@type": "BreadcrumbList",
                  "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://quicksharep2p.onrender.com" },
                    { "@type": "ListItem", "position": 2, "name": "Receive Files", "item": "https://quicksharep2p.onrender.com/receive" }
                  ]
                },
                "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2"] }
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "How do I receive files with Quick Share?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Go to quicksharep2p.onrender.com/receive and enter the 6-digit room code provided by the sender, or scan their QR code. The file will transfer directly to your device." }
                  },
                  {
                    "@type": "Question",
                    "name": "Do I need to install anything to receive files?",
                    "acceptedAnswer": { "@type": "Answer", "text": "No installation required. Quick Share works entirely in your web browser. Just open the receive page and enter the code." }
                  },
                  {
                    "@type": "Question",
                    "name": "Is it safe to receive files through Quick Share?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Yes. All transfers are end-to-end encrypted using WebRTC. Files transfer directly between browsers without passing through any servers." }
                  },
                  {
                    "@type": "Question",
                    "name": "How long is the room code valid?",
                    "acceptedAnswer": { "@type": "Answer", "text": "The room code is valid as long as the sender keeps their browser tab open. Once the sender closes the session, the code expires." }
                  }
                ]
              }
            ]
          })
        }}
      />
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <FileReceiver onBack={() => router.push("/")} initialRoomCode={roomCode} />
      </div>
    </>
  );
}

export default function ReceivePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <ReceiveContent />
    </Suspense>
  );
}
