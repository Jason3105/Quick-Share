"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "./ui/button";
import { X, Camera } from "lucide-react";

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>("");
  const [isScanning, setIsScanning] = useState(true);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    readerRef.current = codeReader;

    const startScanning = async () => {
      try {
        // First, explicitly request camera permissions using getUserMedia
        // This ensures the permission prompt appears on all devices
        let permissionStream: MediaStream | null = null;
        try {
          permissionStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: "environment" } } 
          });
        } catch (permError: any) {
          console.error("Permission error:", permError);
          if (permError.name === "NotAllowedError" || permError.name === "PermissionDeniedError") {
            setError("Camera permission denied. Please grant camera access in your browser settings.");
          } else if (permError.name === "NotFoundError") {
            setError("No camera found on this device");
          } else {
            setError("Failed to access camera. Please grant camera permissions.");
          }
          return;
        }

        // Stop the permission stream as we'll use ZXing's stream
        if (permissionStream) {
          permissionStream.getTracks().forEach(track => track.stop());
        }

        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        
        if (videoInputDevices.length === 0) {
          setError("No camera found on this device");
          return;
        }

        // Prefer back camera on mobile devices
        const backCamera = videoInputDevices.find((device: MediaDeviceInfo) => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear')
        );
        const selectedDeviceId = backCamera?.deviceId || videoInputDevices[0].deviceId;

        if (videoRef.current) {
          const controls = await codeReader.decodeFromVideoDevice(
            selectedDeviceId,
            videoRef.current,
            (result, error) => {
              if (result && !hasScanned.current) {
                hasScanned.current = true;
                const text = result.getText();
                console.log("QR Code scanned:", text);
                
                // Extract room code from URL or direct code
                try {
                  const url = new URL(text);
                  const joinParam = url.searchParams.get("join");
                  if (joinParam) {
                    // Extract just the room code (first 6 characters before timestamp)
                    const roomCode = joinParam.split(":")[0];
                    
                    // Stop scanning and close scanner
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach(track => track.stop());
                    }
                    
                    onScan(roomCode);
                  }
                } catch {
                  // If not a URL, treat as direct code
                  if (text.length >= 6) {
                    // Stop scanning and close scanner
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach(track => track.stop());
                    }
                    onScan(text.substring(0, 6).toUpperCase());
                  }
                }
              }
              
              if (error && error.name !== "NotFoundException") {
                console.error("Scan error:", error);
              }
            }
          );
          
          // Store the stream for cleanup
          if (videoRef.current.srcObject) {
            streamRef.current = videoRef.current.srcObject as MediaStream;
          }
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Failed to access camera. Please grant camera permissions.");
      }
    };

    startScanning();

    return () => {
      // Stop all video tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan]);

  const handleClose = () => {
    // Stop all video tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[100] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-card border rounded-lg shadow-2xl max-w-md w-full relative">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            <h3 className="font-semibold">Scan QR Code</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-center">
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 border-2 border-foreground rounded-lg relative">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-foreground"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-foreground"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-foreground"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-foreground"></div>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                Position the QR code within the frame
              </p>
            </>
          )}
        </div>

        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
