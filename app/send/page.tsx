"use client";

import { useState } from "react";
import { FileSender } from "@/components/file-sender";
import { useRouter } from "next/navigation";

export default function SendPage() {
  const router = useRouter();
  
  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      <FileSender onBack={() => router.push("/")} />
    </div>
  );
}
