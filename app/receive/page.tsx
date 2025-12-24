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
  
  return <FileReceiver onBack={() => router.push("/")} initialRoomCode={roomCode} />;
}

export default function ReceivePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <ReceiveContent />
    </Suspense>
  );
}
