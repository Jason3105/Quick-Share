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
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    readerRef.current = codeReader;

    const checkCameraPermission = async () => {
      try {
        // Check if Permissions API is available
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setPermissionState(result.state as "prompt" | "granted" | "denied");
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setPermissionState(result.state as "prompt" | "granted" | "denied");
          });
          
          if (result.state === 'denied') {
            setError("Camera access denied. Please enable camera permissions in your browser settings and reload the page.");
            return false;
          }
        }
      } catch (err) {
        console.log("Permissions API not available, proceeding with getUserMedia");
      }
      return true;
    };

    const startScanning = async () => {
      try {
        // Check permission first
        const canProceed = await checkCameraPermission();
        if (!canProceed) return;

        // Request camera access with comprehensive constraints for mobile compatibility
        let permissionStream: MediaStream | null = null;
        try {
          // Enhanced constraints for better mobile support
          const constraints = {
            video: {
              facingMode: { ideal: "environment" }, // Prefer back camera
              width: { ideal: 1280 }, // HD resolution
              height: { ideal: 720 },
              aspectRatio: { ideal: 1.777778 }, // 16:9
            }
          };
          
          permissionStream = await navigator.mediaDevices.getUserMedia(constraints);
          setPermissionState("granted");
          console.log("✅ Camera permission granted");
        } catch (permError: any) {
          console.error("Permission error:", permError);
          
          // Provide specific error messages based on error type
          if (permError.name === "NotAllowedError" || permError.name === "PermissionDeniedError") {
            setError("📷 Camera permission denied. Please tap 'Allow' when prompted, or enable camera in your browser settings.");
            setPermissionState("denied");
          } else if (permError.name === "NotFoundError" || permError.name === "DevicesNotFoundError") {
            setError("📷 No camera found on this device. Please check your device settings.");
          } else if (permError.name === "NotReadableError" || permError.name === "TrackStartError") {
            setError("📷 Camera is already in use by another app. Please close other apps using the camera and try again.");
          } else if (permError.name === "OverconstrainedError") {
            // Try again with simpler constraints
            try {
              permissionStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
              });
              setPermissionState("granted");
            } catch (retryError) {
              setError("📷 Failed to access camera. Please grant camera permissions and try again.");
              return;
            }
          } else if (permError.name === "SecurityError") {
            setError("📷 Camera access blocked due to security policy. Please ensure you're using HTTPS or localhost.");
          } else {
            setError("📷 Failed to access camera. Please grant camera permissions in your browser settings.");
          }
          
          if (!permissionStream) return;
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
                    
                    // Call onScan first, then close
                    onScan(roomCode);
                    // Close the scanner modal
                    setTimeout(() => onClose(), 100);
                  }
                } catch {
                  // If not a URL, treat as direct code
                  if (text.length >= 6) {
                    // Stop scanning and close scanner
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach(track => track.stop());
                    }
                    onScan(text.substring(0, 6).toUpperCase());
                    // Close the scanner modal
                    setTimeout(() => onClose(), 100);
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
  }, [onScan, onClose]);

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
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-center space-y-3">
              <p className="text-sm">{error}</p>
              {permissionState === "denied" && (
                <div className="text-xs text-muted-foreground space-y-2">
                  <p className="font-semibold">How to enable camera:</p>
                  <ul className="text-left space-y-1 pl-4">
                    <li>• Chrome/Edge: Click the 🔒 icon in address bar → Site settings → Camera → Allow</li>
                    <li>• Safari iOS: Settings → Safari → Camera → Allow</li>
                    <li>• Firefox: Click the 🔒 icon → Clear permissions and retry</li>
                  </ul>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setError("");
                  window.location.reload();
                }}
                className="mt-2"
              >
                Reload Page
              </Button>
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
