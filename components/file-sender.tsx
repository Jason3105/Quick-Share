"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Copy, Check, Link, FileCheck, Loader2, Send, Users, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { QRCodeDisplay } from "@/components/qr-code-display";

interface FileSenderProps {
  onBack: () => void;
}

export function FileSender({ onBack }: FileSenderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [roomCode, setRoomCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [filesSentMap, setFilesSentMap] = useState<{[key: number]: boolean}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    isConnected, 
    connectionState, 
    sendFile,
    sendFileList,
    setFileRequestHandler,
    transferProgress,
    createRoom,
    peersConnected,
    dataChannel
  } = useWebRTC();

  useEffect(() => {
    if (files.length > 0 && !roomCode) {
      const code = createRoom();
      setRoomCode(code);
    }
  }, [files, roomCode, createRoom]);

  // Send file list when connection is established AND data channel is open
  useEffect(() => {
    if (isConnected && files.length > 0 && dataChannel?.readyState === "open") {
      console.log("🔗 Connection ready - sending file list");
      sendFileList(files);
    }
  }, [isConnected, files, sendFileList, dataChannel]);

  // Handle download requests from receiver
  useEffect(() => {
    setFileRequestHandler(async (fileIndex: number) => {
      console.log("📤 Sending file at index:", fileIndex);
      if (files[fileIndex]) {
        await sendFile(files[fileIndex]);
        setFilesSentMap(prev => ({ ...prev, [fileIndex]: true }));
      }
    });
  }, [files, sendFile, setFileRequestHandler]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(Array.from(selectedFiles));
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getTotalSize = () => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  const handleSend = async () => {
    if (files.length > 0 && isConnected) {
      for (const file of files) {
        await sendFile(file);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyShareLink = () => {
    const shareLink = `${window.location.origin}/receive?room=${roomCode}`;
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Card className="border-2 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-b p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-white/50 dark:hover:bg-black/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-xl sm:text-3xl font-bold">Send Files</CardTitle>
            </div>
            <CardDescription className="text-sm sm:text-base">Share files securely with anyone, anywhere</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6 sm:p-8">
        {files.length === 0 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative group border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-12 sm:p-16 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="inline-block relative mb-6">
                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold mb-3">Choose a file to send</p>
              <p className="text-sm sm:text-base text-muted-foreground mb-4">Click here or drag and drop</p>
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Any file type • No size limits • Fully encrypted</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {files.length > 0 && !isConnected && (
          <div className="space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6 rounded-xl border-2 border-green-200 dark:border-green-800">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-12 w-12 rounded-lg bg-green-500 dark:bg-green-600 flex items-center justify-center shrink-0 shadow-lg">
                  <FileCheck className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base sm:text-lg mb-1">{files.length} {files.length === 1 ? 'file' : 'files'} selected</p>
                  <p className="text-sm text-muted-foreground">Total size: {formatFileSize(getTotalSize())}</p>
                </div>
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {files.map((file, index) => (
                  <div key={index} className="bg-white/60 dark:bg-black/30 p-4 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatFileSize(file.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="shrink-0 h-9 w-9 p-0 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600"
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/50 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">📤 {files.length === 1 ? 'File' : 'Files'} ready to share!</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">Share the code, link, or QR code below with the receiver</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">1</span>
                </div>
                <p className="text-sm sm:text-base font-semibold">Share this 6-digit code:</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-5 sm:p-6 rounded-xl font-mono text-2xl sm:text-3xl text-center font-bold tracking-wider border-2 border-slate-300 dark:border-slate-700 shadow-lg min-h-[80px] flex items-center justify-center">
                  {roomCode}
                </div>
                <Button 
                  onClick={copyToClipboard} 
                  variant="outline" 
                  size="icon" 
                  className="h-20 w-20 shrink-0 hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-500"
                >
                  {copied ? <Check className="h-6 w-6 text-green-600" /> : <Copy className="h-6 w-6" />}
                </Button>
              </div>
              {copied && (
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Code copied to clipboard!
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">2</span>
                </div>
                <p className="text-sm sm:text-base font-semibold">Or share this direct link:</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-5 sm:p-6 rounded-xl overflow-x-auto scrollbar-hide border-2 border-purple-200 dark:border-purple-800 shadow-lg min-h-[80px] flex items-center">
                  <code className="text-xs sm:text-sm font-mono whitespace-nowrap w-full text-center">
                    {typeof window !== 'undefined' && `${window.location.origin}/receive?room=${roomCode}`}
                  </code>
                </div>
                <Button 
                  onClick={copyShareLink} 
                  variant="outline" 
                  size="icon" 
                  className="h-20 w-20 shrink-0 hover:bg-purple-50 dark:hover:bg-purple-950 hover:border-purple-500"
                >
                  {linkCopied ? <Check className="h-6 w-6 text-green-600" /> : <Link className="h-6 w-6" />}
                </Button>
              </div>
              {linkCopied && (
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Link copied to clipboard!
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">3</span>
                </div>
                <p className="text-sm sm:text-base font-semibold">Or scan this QR code:</p>
              </div>
              {roomCode && <QRCodeDisplay code={roomCode} />}
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium">
                    {peersConnected > 1 ? `${peersConnected - 1}` : '0'} {peersConnected - 1 === 1 ? "receiver" : "receivers"} in room
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs">{connectionState}</span>
                    </div>
                  )}
                </div>
              </div>
              {peersConnected <= 1 && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Waiting for receiver to join...
                </p>
              )}
              {peersConnected > 1 && !isConnected && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Establishing connection...
                </p>
              )}
            </div>
          </div>
        )}

        {isConnected && (
          <div className="space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6 rounded-xl border-2 border-green-500 dark:border-green-600 shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-400 dark:bg-green-600 rounded-full blur-3xl opacity-20"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg sm:text-xl text-green-900 dark:text-green-100">
                      Receiver Connected!
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">Ready to transfer file</p>
                  </div>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <p className="text-xs sm:text-sm font-medium">Secure P2P connection established</p>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={handleSend} className="w-full shadow-lg hover:shadow-xl transition-all text-lg" size="lg">
              <Send className="mr-2 h-5 w-5" />
              Send File Now
            </Button>

            {transferProgress > 0 && (
              <div className="space-y-3 bg-blue-50 dark:bg-blue-950/50 p-5 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-sm sm:text-base">Transferring file...</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{transferProgress}%</span>
                </div>
                <div className="relative h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-green-500 dark:bg-green-600 transition-all duration-300 ease-out"
                    style={{ width: `${transferProgress}%` }}
                  />
                </div>
                {transferProgress === 100 && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm sm:text-base">Transfer complete!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
