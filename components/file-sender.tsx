"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Upload, Copy, Check, Link, FileCheck, Loader2, Send,
  Users, Clock, CheckCircle2, AlertCircle, Folder, FolderOpen,
  File as FileIcon, ChevronDown, ChevronRight, Archive, AlertTriangle,
} from "lucide-react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { QRCodeDisplay } from "@/components/qr-code-display";
import { zipFolder, getFolderName, getTotalSize, buildFileTree, type ZipProgress, type TreeNode } from "@/lib/zip-utils";

interface FileSenderProps {
  onBack: () => void;
}

type ShareMode = "files" | "folder";

// ─── Small recursive tree renderer ───────────────────────────────────────────
function TreeNodeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-full text-left py-0.5"
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-blue-500" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-blue-500" />
          )}
          <FolderOpen className="h-3 w-3 shrink-0 text-amber-500" />
          <span className="font-medium truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child, i) => (
          <TreeNodeView key={i} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1 text-xs text-muted-foreground py-0.5 truncate"
      style={{ paddingLeft: `${depth * 14 + 14}px` }}
    >
      <FileIcon className="h-3 w-3 shrink-0" />
      <span className="truncate">{node.name}</span>
    </div>
  );
}

export function FileSender({ onBack }: FileSenderProps) {
  const [shareMode, setShareMode] = useState<ShareMode>("files");
  const [files, setFiles] = useState<File[]>([]);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [roomCode, setRoomCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [filesSentMap, setFilesSentMap] = useState<{ [key: number]: boolean }>({});
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
  const [showFolderTree, setShowFolderTree] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const hasSharedFileList = useRef(false);

  const {
    isConnected,
    connectionState,
    sendFile,
    sendFileList,
    setFileRequestHandler,
    transferProgress,
    currentFileName,
    currentFileIndex,
    totalFiles,
    createRoom,
    peersConnected,
    dataChannel,
    dataChannelReady,
  } = useWebRTC();

  // Active items depend on mode
  const activeFiles = shareMode === "files" ? files : folderFiles;
  const hasContent = activeFiles.length > 0;
  const folderName = folderFiles.length > 0 ? getFolderName(folderFiles) : "";
  const folderTree = folderFiles.length > 0 ? buildFileTree(folderFiles) : null;

  useEffect(() => {
    if (hasContent && !roomCode) {
      const code = createRoom();
      setRoomCode(code);
    }
  }, [hasContent, roomCode, createRoom]);

  useEffect(() => {
    hasSharedFileList.current = false;
  }, [files, folderFiles]);

  useEffect(() => {
    if (isConnected && dataChannelReady && hasContent && !hasSharedFileList.current) {
      hasSharedFileList.current = true;
    }
  }, [isConnected, dataChannelReady, hasContent]);

  // ── File input handler ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(Array.from(selectedFiles));
    }
  };

  // ── Folder input handler ──
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFolderFiles(Array.from(selectedFiles));
    }
  };

  // ── Drag-and-drop ──
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (shareMode === "files") {
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) setFiles(dropped);
    }
  }, [shareMode]);

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getTotalFilesSize = () =>
    shareMode === "files"
      ? files.reduce((t, f) => t + f.size, 0)
      : getTotalSize(folderFiles);

  // ── Send handler ──
  const handleSend = async () => {
    if (!isConnected || !dataChannelReady) return;

    try {
      if (shareMode === "files") {
        // Existing multi-file behaviour
        for (let i = 0; i < files.length; i++) {
          await sendFile(files[i], i + 1, files.length);
          setFilesSentMap((prev) => ({ ...prev, [i]: true }));
          if (i < files.length - 1) await new Promise((r) => setTimeout(r, 1000));
        }
      } else {
        // Folder mode: zip then send as one file
        setZipProgress({ phase: "reading", percent: 0 });
        const zipFile = await zipFolder(folderFiles, (p) => setZipProgress(p));
        setZipProgress(null);
        await sendFile(zipFile, 1, 1);
      }
    } catch (err) {
      console.error("❌ Send error:", err);
      setZipProgress(null);
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

  // ── Detect mobile (webkitdirectory not supported) ──
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // ─────────────────────────────────────────────────────────────────────────────
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
              <CardTitle className="text-xl sm:text-3xl font-bold">Send</CardTitle>
            </div>
            <CardDescription className="text-sm sm:text-base">Share files or folders securely with anyone, anywhere</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6 sm:p-8">
        {/* ── Mode Toggle ── */}
        {!hasContent && (
          <div className="flex rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900 p-1 gap-1">
            <button
              id="mode-files"
              onClick={() => setShareMode("files")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                shareMode === "files"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileIcon className="h-4 w-4" />
              Files
            </button>
            <button
              id="mode-folder"
              onClick={() => setShareMode("folder")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                shareMode === "folder"
                  ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Folder className="h-4 w-4" />
              Folder
            </button>
          </div>
        )}

        {/* ── Upload Zone (no content yet) ── */}
        {!hasContent && (
          <>
            {shareMode === "files" ? (
              /* Files drop zone */
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="relative group border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-12 sm:p-16 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="inline-block relative mb-6">
                    <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                    <div className="relative h-20 w-20 sm:h-24 sm:w-24 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold mb-3">Choose files to send</p>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4">Click here or drag and drop</p>
                  <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Any file type • No size limits • Fully encrypted</span>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept="*/*" />
              </div>
            ) : (
              /* Folder drop zone */
              isMobile ? (
                <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-12 text-center bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                  <p className="text-lg font-bold mb-2">Folder sharing not supported</p>
                  <p className="text-sm text-muted-foreground">
                    Your mobile browser doesn&apos;t support folder selection.<br />
                    Please use a desktop browser to share folders.
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => folderInputRef.current?.click()}
                  className="relative group border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-12 sm:p-16 text-center cursor-pointer hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="inline-block relative mb-6">
                      <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="relative h-20 w-20 sm:h-24 sm:w-24 mx-auto rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <FolderOpen className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold mb-3">Choose a folder to share</p>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4">Click to pick a folder — all contents included</p>
                    <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Archive className="h-4 w-4 text-amber-600" />
                      <span>Entire folder • Sub-folders included • Sent as ZIP</span>
                    </div>
                  </div>
                  {/* webkitdirectory lets browser pick a folder */}
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore – webkitdirectory is non-standard
                    webkitdirectory=""
                    multiple
                    onChange={handleFolderSelect}
                    className="hidden"
                  />
                </div>
              )
            )}
          </>
        )}

        {/* ── Content selected, waiting for connection ── */}
        {hasContent && !isConnected && (
          <div className="space-y-6">
            {/* Summary card */}
            <div className={`relative overflow-hidden p-6 rounded-xl border-2 ${
              shareMode === "folder"
                ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800"
                : "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800"
            }`}>
              <div className="flex items-start gap-4 mb-4">
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${
                  shareMode === "folder"
                    ? "bg-amber-500 dark:bg-amber-600"
                    : "bg-green-500 dark:bg-green-600"
                }`}>
                  {shareMode === "folder" ? (
                    <Folder className="h-6 w-6 text-white" />
                  ) : (
                    <FileCheck className="h-6 w-6 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {shareMode === "folder" ? (
                    <>
                      <p className="font-bold text-base sm:text-lg mb-0.5 truncate">📁 {folderName}</p>
                      <p className="text-sm text-muted-foreground">
                        {folderFiles.length} file{folderFiles.length !== 1 ? "s" : ""} • {formatFileSize(getTotalFilesSize())} • Will be sent as ZIP
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-base sm:text-lg mb-0.5">{files.length} {files.length === 1 ? "file" : "files"} selected</p>
                      <p className="text-sm text-muted-foreground">Total size: {formatFileSize(getTotalFilesSize())}</p>
                    </>
                  )}
                </div>
                <CheckCircle2 className={`h-6 w-6 shrink-0 ${shareMode === "folder" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`} />
              </div>

              {/* File list (files mode) */}
              {shareMode === "files" && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {files.map((file, index) => (
                    <div key={index} className="bg-white/60 dark:bg-black/30 p-3 rounded-lg flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(file.size)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="shrink-0 h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600">✕</Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Folder tree preview */}
              {shareMode === "folder" && folderTree && (
                <div>
                  <button
                    onClick={() => setShowFolderTree((s) => !s)}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline mb-2"
                  >
                    {showFolderTree ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {showFolderTree ? "Hide" : "Preview"} folder contents
                  </button>
                  {showFolderTree && (
                    <div className="bg-white/60 dark:bg-black/30 rounded-lg p-3 max-h-52 overflow-y-auto">
                      <TreeNodeView node={folderTree} depth={0} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Zip info banner (folder mode) */}
            {shareMode === "folder" && (
              <div className="bg-amber-50 dark:bg-amber-950/50 p-4 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">📦 Will be sent as a ZIP file</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    The folder will be zipped in your browser before sending. The receiver downloads &quot;{folderName}.zip&quot; and can extract it to restore the full folder structure.
                  </p>
                </div>
              </div>
            )}

            {/* Ready to share banner */}
            <div className="bg-blue-50 dark:bg-blue-950/50 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                📤 {shareMode === "folder" ? "Folder" : files.length === 1 ? "File" : "Files"} ready to share!
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">Share the code, link, or QR code below with the receiver</p>
            </div>

            {/* Room code */}
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
                <Button onClick={copyToClipboard} variant="outline" size="icon" className="h-20 w-20 shrink-0 hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-500">
                  {copied ? <Check className="h-6 w-6 text-green-600" /> : <Copy className="h-6 w-6" />}
                </Button>
              </div>
              {copied && (
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Code copied to clipboard!
                </p>
              )}
            </div>

            {/* Direct link */}
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
                    {typeof window !== "undefined" && `${window.location.origin}/receive?room=${roomCode}`}
                  </code>
                </div>
                <Button onClick={copyShareLink} variant="outline" size="icon" className="h-20 w-20 shrink-0 hover:bg-purple-50 dark:hover:bg-purple-950 hover:border-purple-500">
                  {linkCopied ? <Check className="h-6 w-6 text-green-600" /> : <Link className="h-6 w-6" />}
                </Button>
              </div>
              {linkCopied && (
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Link copied to clipboard!
                </p>
              )}
            </div>

            {/* QR code */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">3</span>
                </div>
                <p className="text-sm sm:text-base font-semibold">Or scan this QR code:</p>
              </div>
              {roomCode && <QRCodeDisplay code={roomCode} />}
            </div>

            {/* Peer status */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium">
                    {peersConnected > 1 ? `${peersConnected - 1}` : "0"}{" "}
                    {peersConnected - 1 === 1 ? "receiver" : "receivers"} in room
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
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
                  <AlertCircle className="h-3 w-3" /> Waiting for receiver to join...
                </p>
              )}
              {peersConnected > 1 && !isConnected && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Establishing connection...
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Connected — ready to send ── */}
        {isConnected && (
          <div className="space-y-6">
            {/* Connection badge */}
            <div className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6 rounded-xl border-2 border-green-500 dark:border-green-600 shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-400 dark:bg-green-600 rounded-full blur-3xl opacity-20" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg sm:text-xl text-green-900 dark:text-green-100">Receiver Connected!</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {shareMode === "folder"
                        ? `Ready to send "${folderName}" as ZIP`
                        : "Ready to send files"}
                    </p>
                  </div>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-xs sm:text-sm font-medium">Secure P2P connection established</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Zip progress bar (folder mode) */}
            {zipProgress && (
              <div className="space-y-3 bg-amber-50 dark:bg-amber-950/50 p-5 rounded-xl border-2 border-amber-200 dark:border-amber-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="font-semibold text-sm sm:text-base">
                        {zipProgress.phase === "reading"
                          ? "Reading files…"
                          : zipProgress.phase === "compressing"
                          ? "Compressing folder…"
                          : "Finalizing ZIP…"}
                      </span>
                      {zipProgress.currentFile && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{zipProgress.currentFile}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{zipProgress.percent}%</span>
                </div>
                <div className="relative h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-amber-500 dark:bg-amber-600 transition-all duration-300 ease-out"
                    style={{ width: `${zipProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={!dataChannelReady || !!zipProgress || (transferProgress > 0 && transferProgress < 100)}
              className="w-full shadow-lg hover:shadow-xl transition-all text-lg"
              size="lg"
            >
              {shareMode === "folder" ? (
                <Archive className="mr-2 h-5 w-5" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              {zipProgress
                ? "Zipping…"
                : transferProgress > 0 && transferProgress < 100
                ? "Sending…"
                : !dataChannelReady
                ? "Waiting for connection…"
                : shareMode === "folder"
                ? `Send Folder (${folderFiles.length} files)`
                : "Send Files Now"}
            </Button>

            {/* Transfer progress */}
            {transferProgress > 0 && !zipProgress && (
              <div className="space-y-3 bg-blue-50 dark:bg-blue-950/50 p-5 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                    <div>
                      <span className="font-semibold text-sm sm:text-base">
                        {shareMode === "folder" ? "Sending ZIP…" : "Transferring file…"}
                      </span>
                      {totalFiles > 1 && (
                        <p className="text-xs text-muted-foreground mt-0.5">File {currentFileIndex} of {totalFiles}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{transferProgress}%</span>
                </div>
                {currentFileName && (
                  <p className="text-xs text-muted-foreground truncate">{currentFileName}</p>
                )}
                <div className="relative h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-green-500 dark:bg-green-600 transition-all duration-300 ease-out"
                    style={{ width: `${transferProgress}%` }}
                  />
                </div>
                {transferProgress === 100 && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm sm:text-base">
                      {shareMode === "folder" ? "Folder sent successfully!" : "Transfer complete!"}
                    </span>
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
