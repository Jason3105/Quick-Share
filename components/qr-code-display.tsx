"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  code: string;
}

export function QRCodeDisplay({ code }: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(10);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate time-based token that rotates every 10 seconds
  const generateToken = () => {
    const currentTime = Date.now();
    const roundedTime = Math.floor(currentTime / 10000) * 10000; // Round to 10s
    return `${code}:${roundedTime}`;
  };

  useEffect(() => {
    const updateQR = async () => {
      const token = generateToken();
      const url = `${window.location.origin}?join=${token}`;
      
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("QR code generation error:", err);
      }
    };

    // Initial update
    updateQR();

    // Calculate time until next rotation
    const getTimeUntilNextRotation = () => {
      const currentTime = Date.now();
      const elapsed = currentTime % 10000;
      return 10000 - elapsed;
    };

    // Update countdown every 100ms for smooth display
    const countdownInterval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime % 10000;
      const remaining = Math.ceil((10000 - elapsed) / 1000);
      setSecondsLeft(remaining);
    }, 100);

    // Set up QR rotation to happen at exact 10-second intervals
    const scheduleNextRotation = () => {
      const timeUntilNext = getTimeUntilNextRotation();
      return setTimeout(() => {
        updateQR();
        setSecondsLeft(10);
        // Schedule next rotation
        scheduleNextRotation();
      }, timeUntilNext);
    };

    const rotationTimeout = scheduleNextRotation();

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(rotationTimeout);
    };
  }, [code]);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="bg-white p-5 rounded-xl shadow-lg border-2 border-indigo-200 dark:border-indigo-800">
          {qrDataUrl && (
            <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
          )}
        </div>
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/50 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 font-medium">
            🔒 Auto-rotating for security
          </p>
          <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
            {secondsLeft}s
          </p>
        </div>
        <div className="h-1.5 bg-amber-200 dark:bg-amber-900 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500 dark:bg-amber-600 transition-all duration-100 ease-linear"
            style={{ width: `${(secondsLeft / 10) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
