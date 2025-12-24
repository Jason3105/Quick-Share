"use client";

import { useState } from "react";
import { FileSender } from "@/components/file-sender";
import { useRouter } from "next/navigation";

export default function SendPage() {
  const router = useRouter();
  
  return <FileSender onBack={() => router.push("/")} />;
}
