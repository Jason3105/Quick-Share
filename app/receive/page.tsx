"use client";

import { FileReceiver } from "@/components/file-receiver";
import { useRouter } from "next/navigation";

export default function ReceivePage() {
  const router = useRouter();
  
  return <FileReceiver onBack={() => router.push("/")} initialRoomCode="" />;
}
