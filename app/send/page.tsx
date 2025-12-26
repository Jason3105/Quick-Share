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
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://quicksharep2p.onrender.com"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Send Files",
                "item": "https://quicksharep2p.onrender.com/send"
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
