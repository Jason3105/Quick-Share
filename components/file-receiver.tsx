"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, QrCode, Loader2, CheckCircle2, AlertCircle, Wifi, FileDown, Sparkles } from "lucide-react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { QRScanner } from "@/components/qr-scanner";

interface FileReceiverProps {
  onBack: () => void;
  initialRoomCode?: string;
}

export function FileReceiver({ onBack, initialRoomCode = "" }: FileReceiverProps) {
  const [code, setCode] = useState(initialRoomCode);
  const [showScanner, setShowScanner] = useState(false);
  const { 
    joinRoom, 
    isConnected, 
    receivedFiles, 
    currentFileName,
    transferProgress,
    connectionState 
  } = useWebRTC();

  // Auto-join if initial room code is provided
  useEffect(() => {
    if (initialRoomCode && initialRoomCode.trim()) {
      setCode(initialRoomCode);
      // Small delay to ensure everything is initialized
      setTimeout(() => {
        joinRoom(initialRoomCode.trim());
      }, 100);
    }
  }, [initialRoomCode, joinRoom]);

  const handleJoin = () => {
    if (code.trim()) {
      joinRoom(code.trim());
    }
  };

  const handleQRScan = (scannedCode: string) => {
    setCode(scannedCode);
    setShowScanner(false);
    // Auto-join after scanning
    setTimeout(() => {
      joinRoom(scannedCode);
    }, 100);
  };

  const handleDownload = (file: { name: string; blob: Blob }) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    receivedFiles.forEach((file) => {
      setTimeout(() => handleDownload(file), 100);
    });
  };

  const progress = transferProgress;

  return (
    <>
      <Card className="border-2 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-b p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-white/50 dark:hover:bg-black/50">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileDown className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-xl sm:text-3xl font-bold">Receive Files</CardTitle>
              </div>
              <CardDescription className="text-sm sm:text-base">Get files sent to you instantly and securely</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6 sm:p-8">
        {!isConnected && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm sm:text-base mb-1">Ready to receive!</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Enter the 6-digit code from the sender or scan their QR code</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                </div>
                Enter 6-Digit Room Code:
              </label>
              <div className="flex gap-3">
                <Input
                  placeholder="XXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="font-mono text-xl sm:text-2xl text-center tracking-widest font-bold h-14 sm:h-16 border-2"
                  maxLength={6}
                />
                <Button 
                  onClick={handleJoin} 
                  disabled={!code.trim()} 
                  className="shrink-0 h-14 sm:h-16 px-6 sm:px-8 text-base shadow-lg hover:shadow-xl transition-all"
                >
                  <Wifi className="mr-2 h-5 w-5" />
                  Join
                </Button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm text-muted-foreground font-medium">{connectionState}</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t-2" />
              </div>
              <div className="relative flex justify-center text-sm uppercase">
                <span className="bg-background px-4 text-muted-foreground font-semibold">
                  Or
                </span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-14 text-base border-2 hover:bg-purple-50 dark:hover:bg-purple-950 hover:border-purple-500 shadow-md hover:shadow-lg transition-all"
              onClick={() => setShowScanner(true)}
            >
              <QrCode className="h-5 w-5 mr-2" />
              Scan QR Code Instead
            </Button>

            <div className="bg-blue-50 dark:bg-blue-950/50 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                💡 <strong>Tip:</strong> Ask the sender for their room code, link, or QR code to get started
              </p>
            </div>
          </div>
        )}

        {isConnected && receivedFiles.length === 0 && (
          <div className="space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6 sm:p-8 rounded-xl border-2 border-green-500 dark:border-green-600 shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-400 dark:bg-green-600 rounded-full blur-3xl opacity-20"></div>
              <div className="relative text-center">
                <div className="inline-block mb-4">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center shadow-lg mx-auto">
                    <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </div>
                </div>
                <p className="font-bold text-xl sm:text-2xl text-green-900 dark:text-green-100 mb-2">
                  Connected to Sender!
                </p>
                <p className="text-sm sm:text-base text-green-700 dark:text-green-300 mb-4">
                  {currentFileName ? `Receiving: ${currentFileName}` : 'Waiting for file transfer to begin...'}
                </p>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 inline-flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-xs sm:text-sm font-medium">Secure P2P connection active</p>
                </div>
              </div>
            </div>

            {progress > 0 && (
              <div className="space-y-4 bg-blue-50 dark:bg-blue-950/50 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-sm sm:text-base">Receiving file...</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
                </div>
                <div className="relative">
                  <Progress value={progress} className="h-3" />
                </div>
                <p className="text-xs text-center text-muted-foreground">Transfer in progress • Do not close this page</p>
              </div>
            )}
          </div>
        )}

        {receivedFiles.length > 0 && (
          <div className="space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 p-6 sm:p-8 rounded-xl border-2 border-emerald-500 dark:border-emerald-600 shadow-xl">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400 dark:bg-emerald-600 rounded-full blur-3xl opacity-20"></div>
              <div className="relative">
                <div className="flex items-start gap-4 mb-4">
                  <div className="h-14 w-14 rounded-xl bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center shrink-0 shadow-lg">
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg sm:text-xl text-emerald-900 dark:text-emerald-100 mb-1">
                      ✓ {receivedFiles.length} {receivedFiles.length === 1 ? 'File' : 'Files'} Received Successfully!
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Total size: {(receivedFiles.reduce((acc, f) => acc + f.blob.size, 0) / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {receivedFiles.map((file, index) => (
                    <div key={index} className="bg-white/60 dark:bg-black/30 rounded-lg p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm break-all">{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(file.blob.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => handleDownload(file)} 
                        size="sm"
                        className="shrink-0"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={handleDownloadAll} className="w-full h-14 text-lg shadow-lg hover:shadow-xl transition-all" size="lg">
              <Download className="mr-2 h-6 w-6" />
              Download All Files ({receivedFiles.length})
            </Button>

            <div className="bg-amber-50 dark:bg-amber-950/50 p-5 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                ⚠️ <strong>Note:</strong> After downloading, you can safely close this page
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {showScanner && (
      <QRScanner 
        onScan={handleQRScan}
        onClose={() => setShowScanner(false)}
      />
    )}
    </>
  );
}
