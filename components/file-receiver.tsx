"use client";

import { useState, useEffect, useRef } from "react";
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
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const hasAttemptedJoin = useRef(false);
  const isProcessingQRScan = useRef(false);
  
  const { 
    joinRoom, 
    isConnected, 
    receivedFiles, 
    currentFileName,
    transferProgress,
    connectionState,
    availableFiles,
    requestFileDownload,
    downloadingFileIndex,
    socket,
    resetConnection
  } = useWebRTC();

  // Auto-join if initial room code is provided - wait for socket to connect
  useEffect(() => {
    if (initialRoomCode && initialRoomCode.trim() && !hasAttemptedJoin.current && socket) {
      console.log("Initial room code provided:", initialRoomCode);
      
      const attemptJoin = () => {
        if (socket.connected) {
          console.log("Socket connected - auto-joining room:", initialRoomCode);
          hasAttemptedJoin.current = true;
          setCode(initialRoomCode);
          setHasJoinedRoom(true);
          joinRoom(initialRoomCode.trim());
        } else {
          console.log("Socket not connected yet, waiting...");
          // Wait for socket to connect
          socket.once("connect", () => {
            console.log("Socket connected - now joining room:", initialRoomCode);
            hasAttemptedJoin.current = true;
            setCode(initialRoomCode);
            setHasJoinedRoom(true);
            joinRoom(initialRoomCode.trim());
          });
        }
      };
      
      // Small delay to ensure socket initialization is complete
      setTimeout(attemptJoin, 100);
    }
  }, [initialRoomCode, joinRoom, socket]);

  const handleJoin = () => {
    if (code.trim() && !hasJoinedRoom) {
      console.log("Manually joining room:", code.trim());
      joinRoom(code.trim());
      setHasJoinedRoom(true);
    }
  };

  const handleQRScan = (scannedCode: string) => {
    // Prevent processing multiple scans
    if (isProcessingQRScan.current || hasJoinedRoom) {
      console.log("Already processing a QR scan or joined room, ignoring");
      return;
    }
    
    isProcessingQRScan.current = true;
    console.log("Processing QR scan:", scannedCode);
    setCode(scannedCode);
    setShowScanner(false);
    setHasJoinedRoom(true);
    
    // Wait for socket to be connected before joining
    const attemptJoinAfterScan = () => {
      if (socket?.connected) {
        console.log("Socket connected - joining room after QR scan:", scannedCode);
        joinRoom(scannedCode);
      } else {
        console.log("Socket not connected yet, waiting...");
        // Wait for socket to connect
        socket?.once("connect", () => {
          console.log("Socket connected - now joining room:", scannedCode);
          joinRoom(scannedCode);
        });
      }
    };
    
    // Small delay to ensure scanner is fully closed and state is settled
    setTimeout(attemptJoinAfterScan, 300);
  };

  const handleDownload = (file: { name: string; blob: Blob }) => {
    // Check if this is a placeholder blob (file was already downloaded via streaming)
    if (file.blob.size < 100 && file.blob.type === "text/plain") {
      console.log("File was already downloaded via streaming");
      return;
    }
    
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
  
  // Reset state to allow retry if connection fails
  const handleRetry = () => {
    console.log("Retrying connection...");
    
    // Reset all connection state
    resetConnection();
    
    // Reset local state
    setHasJoinedRoom(false);
    hasAttemptedJoin.current = false;
    isProcessingQRScan.current = false;
    
    // Keep the code so user doesn't have to re-enter
    if (code.trim()) {
      // Small delay to ensure state is clean
      setTimeout(() => {
        setHasJoinedRoom(true);
        joinRoom(code.trim());
      }, 300);
    }
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
                  disabled={!code.trim() || hasJoinedRoom} 
                  className="shrink-0 h-14 sm:h-16 px-6 sm:px-8 text-base shadow-lg hover:shadow-xl transition-all"
                >
                  <Wifi className="mr-2 h-5 w-5" />
                  {hasJoinedRoom ? "Joined" : "Join"}
                </Button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border text-center">
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full animate-pulse ${
                    socket?.connected ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>
                  <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                    {socket?.connected ? connectionState : 'Connecting to server...'}
                  </span>
                </div>
                {hasJoinedRoom && !isConnected && socket?.connected && (
                  <>
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mt-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs font-medium">Establishing secure P2P connection...</span>
                    </div>
                    {(connectionState.includes("timeout") || connectionState.includes("failed") || connectionState.includes("disconnected")) && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRetry}
                        className="mt-2 text-xs"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Retry Connection
                      </Button>
                    )}
                  </>
                )}
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

        {isConnected && currentFileName === "" && receivedFiles.length === 0 && progress === 0 && (
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
                  Connected Successfully!
                </p>
                <p className="text-sm sm:text-base text-green-700 dark:text-green-300 mb-4">
                  Waiting for sender to share files...
                </p>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 inline-flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-xs sm:text-sm font-medium">Secure P2P connection active</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isConnected && (currentFileName !== "" || progress > 0) && progress < 100 && (
          <div className="space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 sm:p-8 rounded-xl border-2 border-blue-500 dark:border-blue-600 shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400 dark:bg-blue-600 rounded-full blur-3xl opacity-20"></div>
              <div className="relative text-center">
                <div className="inline-block mb-4">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center shadow-lg mx-auto">
                    <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 text-white animate-spin" />
                  </div>
                </div>
                <p className="font-bold text-xl sm:text-2xl text-blue-900 dark:text-blue-100 mb-2">
                  Receiving File...
                </p>
                <p className="text-sm sm:text-base text-blue-700 dark:text-blue-300 mb-4">
                  {currentFileName || 'Downloading...'}
                </p>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 inline-flex items-center gap-2">
                  <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <p className="text-xs sm:text-sm font-medium">Transfer in progress</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-blue-50 dark:bg-blue-950/50 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-sm sm:text-base">Receiving file...</span>
                </div>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
              </div>
              <div className="relative h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">Transfer in progress • Do not close this page</p>
            </div>
          </div>
        )}

        {isConnected && progress === 100 && receivedFiles.length > 0 && (
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
                  Download Complete!
                </p>
                <p className="text-sm sm:text-base text-green-700 dark:text-green-300 mb-4">
                  File downloaded successfully
                </p>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-xs sm:text-sm font-medium">Transfer complete</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {receivedFiles.length > 0 && (
          <div className="space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 p-6 sm:p-8 rounded-xl border-2 border-emerald-500 dark:border-emerald-600 shadow-xl">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400 dark:bg-emerald-600 rounded-full blur-3xl opacity-20"></div>
              <div className="relative">
                <div className="flex items-start gap-3 sm:gap-4 mb-4">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center shrink-0 shadow-lg">
                    <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base sm:text-lg lg:text-xl text-emerald-900 dark:text-emerald-100 mb-1 leading-tight">
                      ✓ {receivedFiles.length} {receivedFiles.length === 1 ? 'File' : 'Files'} Downloaded!
                    </p>
                    <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                      Saved to your device
                    </p>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3 max-h-64 overflow-y-auto pr-1">
                  {receivedFiles.map((file, index) => {
                    const isPlaceholder = file.blob.size < 100 && file.blob.type === "text/plain";
                    return (
                    <div key={index} className="bg-white/60 dark:bg-black/30 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
                        <FileDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm break-words">{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isPlaceholder ? "Saved to disk" : `${(file.blob.size / 1024 / 1024).toFixed(2)} MB`}
                          </p>
                        </div>
                      </div>
                      {!isPlaceholder && (
                      <Button 
                        onClick={() => handleDownload(file)} 
                        size="sm"
                        variant="outline"
                        className="shrink-0 w-full sm:w-auto h-9"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        <span className="hidden sm:inline">Download Again</span>
                        <span className="sm:hidden">Download</span>
                      </Button>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {receivedFiles.some(f => f.blob.size >= 100 || f.blob.type !== "text/plain") && (
            <Button onClick={handleDownloadAll} variant="outline" className="w-full h-12 sm:h-14 text-base sm:text-lg shadow-lg hover:shadow-xl transition-all" size="lg">
              <Download className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden xs:inline">Download All Again ({receivedFiles.filter(f => f.blob.size >= 100 || f.blob.type !== "text/plain").length})</span>
              <span className="xs:hidden">Download All ({receivedFiles.filter(f => f.blob.size >= 100 || f.blob.type !== "text/plain").length})</span>
            </Button>
            )}

            <div className="bg-green-50 dark:bg-green-950/50 p-5 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                ✓ <strong>Success:</strong> Files have been automatically saved to your Downloads folder. You can close this page now.
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
