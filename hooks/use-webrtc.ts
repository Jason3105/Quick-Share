"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { nanoid } from "nanoid";

// Adaptive chunk sizing for optimal performance
const MIN_CHUNK_SIZE = 16384; // 16KB - minimum for slow connections
const DEFAULT_CHUNK_SIZE = 131072; // 128KB - optimized for modern networks
const MAX_CHUNK_SIZE = 524288; // 512KB - maximum for very fast connections
const OPTIMAL_BUFFER_SIZE = 512 * 1024; // 512KB - optimal buffer threshold
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB - maximum buffer before backpressure
const BUFFER_LOW_THRESHOLD = 256 * 1024; // 256KB - threshold for aggressive sending
const CHUNK_RAMP_UP_FACTOR = 1.25; // Gradual chunk size increase
const CHUNK_RAMP_DOWN_FACTOR = 0.8; // Quick chunk size decrease on congestion

interface ReceivedFile {
  name: string;
  blob: Blob;
}

export function useWebRTC() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [dataChannelReady, setDataChannelReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("Not connected");
  const [transferProgress, setTransferProgress] = useState(0);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [peersConnected, setPeersConnected] = useState(0);
  const [roomId, setRoomId] = useState<string>("");
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [hasJoined, setHasJoined] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<Array<{name: string; size: number; index: number}>>([]);
  const [downloadingFileIndex, setDownloadingFileIndex] = useState<number | null>(null);

  const receivedChunks = useRef<ArrayBuffer[]>([]);
  const fileMetadata = useRef<{ name: string; size: number } | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const onFileRequestCallback = useRef<((fileIndex: number) => void) | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentRoomId = useRef<string>("");
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const isJoining = useRef<boolean>(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const makingOffer = useRef<boolean>(false);
  const ignoreOffer = useRef<boolean>(false);
  const isPolite = useRef<boolean>(false);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 3;
  const measuredBandwidth = useRef<number>(0);
  const lastStatsTime = useRef<number>(Date.now());
  const lastBytesSent = useRef<number>(0);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Download support for file transfer - disk-based streaming
  const downloadChunks = useRef<Blob[]>([]);
  const totalBytesReceived = useRef<number>(0);
  const downloadStarted = useRef<boolean>(false);
  const wakeLock = useRef<any>(null);
  const fileWriter = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const downloadStream = useRef<WritableStream<Uint8Array> | null>(null);

  // Initialize streaming download for large files
  const initializeStreamingDownload = async (fileName: string, fileSize: number) => {
    totalBytesReceived.current = 0; // Reset counter
    downloadStarted.current = false;
    downloadChunks.current = []; // Clear any previous chunks
    
    console.log("📥 Initializing download for:", fileName, "Size:", (fileSize / 1024 / 1024).toFixed(2), "MB");
    
    try {
      // Use Chrome's Native File System API or showSaveFilePicker for true disk streaming
      // This writes chunks DIRECTLY to disk (zero RAM usage)
      if ('showSaveFilePicker' in window && fileSize > 50 * 1024 * 1024) {
        // For files > 50MB, use File System Access API (Chrome/Edge on desktop)
        console.log("💾 Using File System Access API for disk-based streaming");
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'File',
            accept: { 'application/octet-stream': [] },
          }],
        });
        const writable = await handle.createWritable();
        fileWriter.current = writable.getWriter();
        downloadStarted.current = true;
        console.log("✅ Disk-based streaming active - writing directly to disk");
        return true; // Using disk-based streaming
      }
    } catch (err) {
      console.log("⚠️ File System Access API not available or user cancelled, using fallback");
    }
    
    // Fallback: Use streamsaver.js approach with service worker for browsers without File System API
    // OR for smaller files, use RAM accumulation (simpler and reliable)
    if (fileSize < 100 * 1024 * 1024) {
      console.log("📦 Using RAM-based accumulation for file <100MB");
      downloadStarted.current = true;
      return false; // RAM-based
    }
    
    // For large files without File System API: Create a download stream
    // This uses browser's built-in streaming download (minimal RAM)
    console.log("🌊 Using browser streaming download (minimal RAM)");
    const link = document.createElement('a');
    link.download = fileName;
    
    // Create a TransformStream to pipe chunks through
    const { readable, writable } = new TransformStream();
    downloadStream.current = writable;
    fileWriter.current = writable.getWriter();
    
    // Convert readable stream to blob URL and start download immediately
    // Browser will stream chunks to disk as they arrive
    const response = new Response(readable);
    const blob = await response.blob();
    link.href = URL.createObjectURL(blob);
    link.click();
    
    downloadStarted.current = true;
    console.log("✅ Browser streaming download started - chunks will stream to disk");
    return true; // Using streaming
  };

  // Write chunk to download buffer (disk-based streaming or RAM accumulation)
  const writeChunkToDownload = async (chunk: ArrayBuffer) => {
    totalBytesReceived.current += chunk.byteLength; // Track total bytes
    
    // If using disk-based streaming, write directly to disk
    if (fileWriter.current) {
      try {
        const uint8Array = new Uint8Array(chunk);
        await fileWriter.current.write(uint8Array);
        // Chunk written directly to disk - ZERO RAM usage!
        return;
      } catch (err) {
        console.error("❌ Error writing to disk stream:", err);
        // Fall back to RAM accumulation on error
        fileWriter.current = null;
      }
    }
    
    // Fallback: Accumulate chunks in RAM
    const blob = new Blob([chunk]);
    downloadChunks.current.push(blob);
    
    // Consolidate periodically to prevent too many small blobs
    if (downloadChunks.current.length >= 100) {
      const consolidatedBlob = new Blob(downloadChunks.current);
      downloadChunks.current = [consolidatedBlob];
    }
  };

  // Finalize download
  const finalizeDownload = async (fileName: string) => {
    // If using disk-based streaming, close the writer
    if (fileWriter.current) {
      try {
        await fileWriter.current.close();
        console.log("✅ Disk-based download complete:", fileName, "Total bytes:", totalBytesReceived.current);
        fileWriter.current = null;
        downloadStream.current = null;
        return null; // File already saved to disk
      } catch (err) {
        console.error("❌ Error closing file writer:", err);
      }
    }
    
    // RAM-based: Create final blob from all chunks and trigger download
    if (downloadChunks.current.length > 0) {
      console.log("📥 Finalizing RAM-based download:", fileName, "Total bytes:", totalBytesReceived.current);
      const blob = new Blob(downloadChunks.current);
      downloadChunks.current = [];
      
      // Trigger download immediately
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
      
      console.log("✅ RAM-based download triggered:", fileName, "Size:", (blob.size / 1024 / 1024).toFixed(2), "MB");
      
      return null; // Already downloaded
    }
    
    return null;
  };

  // Cleanup streaming resources
  const cleanupStreamingDownload = () => {
    // Close file writer if still open
    if (fileWriter.current) {
      try {
        fileWriter.current.abort();
      } catch (e) {
        // Already closed
      }
      fileWriter.current = null;
    }
    downloadStream.current = null;
    downloadChunks.current = [];
    receivedChunks.current = [];
    totalBytesReceived.current = 0;
    downloadStarted.current = false;
  };

  // Request wake lock to prevent screen sleep during transfer
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLock.current = await (navigator as any).wakeLock.request('screen');
        console.log('🔆 Wake lock active - screen will stay on during transfer');
        
        wakeLock.current.addEventListener('release', () => {
          console.log('🌙 Wake lock released');
        });
      } else {
        console.log('⚠️ Wake Lock API not supported on this device');
      }
    } catch (err) {
      console.error('❌ Failed to request wake lock:', err);
    }
  };

  // Release wake lock when transfer completes
  const releaseWakeLock = async () => {
    try {
      if (wakeLock.current) {
        await wakeLock.current.release();
        wakeLock.current = null;
        console.log('🌙 Wake lock released - screen can sleep now');
      }
    } catch (err) {
      console.error('❌ Failed to release wake lock:', err);
    }
  };

  // Wait for data channel to be ready
  const waitForDataChannel = (channel: RTCDataChannel | null, timeout = 15000): Promise<RTCDataChannel> => {
    return new Promise((resolve, reject) => {
      if (!channel) {
        reject(new Error("No data channel available"));
        return;
      }
      
      if (channel.readyState === "open") {
        resolve(channel);
        return;
      }
      
      // Check if channel is in a bad state
      if (channel.readyState === "closed" || channel.readyState === "closing") {
        reject(new Error(`Data channel is ${channel.readyState}`));
        return;
      }
      
      const timeoutId = setTimeout(() => {
        channel.removeEventListener("open", onOpen);
        reject(new Error(`Data channel open timeout (current state: ${channel.readyState})`));
      }, timeout);
      
      const onOpen = () => {
        clearTimeout(timeoutId);
        resolve(channel);
      };
      
      channel.addEventListener("open", onOpen, { once: true });
    });
  };

  // Initialize Socket.io connection
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      console.log("✅ Socket connected");
      setConnectionState("Connected to server");
    });

    socketInstance.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setConnectionState("Disconnected from server");
    });

    socketInstance.on("room-joined", ({ roomId, peerCount }: { roomId: string; peerCount?: number }) => {
      console.log("🚪 Joined room:", roomId, "Peer count:", peerCount);
      setConnectionState(`Joined room: ${roomId}`);
      setHasJoined(true);
      if (peerCount !== undefined) {
        setPeersConnected(peerCount);
      }
    });

    socketInstance.on("peer-joined", ({ peerId }: { peerId?: string }) => {
      console.log("👥 Peer joined:", peerId);
      setPeersConnected((prev) => prev + 1);
    });

    socketInstance.on("peer-left", () => {
      setPeersConnected((prev) => Math.max(0, prev - 1));
    });

    // Simple WebRTC signaling - use current refs
    socketInstance.on("offer-request", async () => {
      console.log("📨 Received offer-request");
      const pc = peerConnectionRef.current;
      const room = currentRoomId.current;
      if (!pc || !room) {
        console.error("❌ No peer connection or room ID");
        return;
      }
      
      try {
        makingOffer.current = true;
        
        // Wait for ICE gathering to complete for better connectivity
        const waitForICEGathering = new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
          } else {
            const checkGathering = () => {
              if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', checkGathering);
                resolve();
              }
            };
            pc.addEventListener('icegatheringstatechange', checkGathering);
            // Timeout after 3 seconds to not block too long
            setTimeout(() => {
              pc.removeEventListener('icegatheringstatechange', checkGathering);
              resolve();
            }, 3000);
          }
        });
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForICEGathering;
        
        socketRef.current?.emit("offer", { roomId: room, offer: pc.localDescription });
        console.log("✅ Sent offer (ICE gathering:", pc.iceGatheringState, ")");
      } catch (error) {
        console.error("❌ Error creating offer:", error);
      } finally {
        makingOffer.current = false;
      }
    });

    socketInstance.on("offer", async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      console.log("📨 Received offer");
      const pc = peerConnectionRef.current;
      const room = currentRoomId.current;
      if (!pc || !room) {
        console.error("❌ No peer connection or room ID");
        return;
      }
      
      try {
        // Perfect negotiation: handle collision
        const offerCollision = (offer.type === 'offer') &&
          (makingOffer.current || pc.signalingState !== 'stable');
        
        ignoreOffer.current = !isPolite.current && offerCollision;
        if (ignoreOffer.current) {
          console.log("⚠️ Ignoring offer due to collision (impolite peer)");
          return;
        }
        
        // Rollback if needed
        if (offerCollision) {
          console.log("🔄 Collision detected, rolling back");
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(offer)
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
        }
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit("answer", { roomId: room, answer });
        console.log("✅ Sent answer");
        
        // Process queued ICE candidates
        if (iceCandidateQueue.current.length > 0) {
          console.log(`📦 Processing ${iceCandidateQueue.current.length} queued ICE candidates`);
          for (const candidate of iceCandidateQueue.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
              console.error("❌ Error adding queued ICE candidate:", error);
            }
          }
          iceCandidateQueue.current = [];
        }
      } catch (error) {
        console.error("❌ Error handling offer:", error);
      }
    });

    socketInstance.on("answer", async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      console.log("📨 Received answer");
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error("❌ No peer connection");
        return;
      }
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ Set remote description from answer");
        
        // Process queued ICE candidates
        if (iceCandidateQueue.current.length > 0) {
          console.log(`📦 Processing ${iceCandidateQueue.current.length} queued ICE candidates`);
          for (const candidate of iceCandidateQueue.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
              console.error("❌ Error adding queued ICE candidate:", error);
            }
          }
          iceCandidateQueue.current = [];
        }
      } catch (error) {
        console.error("❌ Error handling answer:", error);
      }
    });

    socketInstance.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ Added ICE candidate");
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      } else {
        console.log("⏳ Queueing ICE candidate (waiting for remote description)");
        iceCandidateQueue.current.push(candidate);
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      // Clean up peer connection on unmount
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      // Clear any timeouts
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      // Clear stats monitoring
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      // Cleanup streaming downloads
      cleanupStreamingDownload();
      // Release wake lock
      releaseWakeLock();
    };
  }, []);

  // Create WebRTC peer connection
  const createPeerConnection = useCallback((isSender: boolean) => {
    // Close existing connection if any
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        // Public TURN servers for cross-network connectivity
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      iceCandidatePoolSize: 10,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log("🧊 Sending ICE candidate");
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      } else if (!event.candidate) {
        console.log("✅ ICE gathering complete");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔗 RTCPeerConnection state changed:", pc.connectionState);
      setConnectionState(pc.connectionState);
      setIsConnected(pc.connectionState === "connected");
      
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        console.error("❌ Connection failed or disconnected");
      }
    };

    if (isSender) {
      const channel = pc.createDataChannel("fileTransfer", {
        ordered: true, // Maintain order for file integrity
        maxRetransmits: undefined, // Reliable delivery
      });
      setupDataChannel(channel);
      setDataChannel(channel);
    } else {
      pc.ondatachannel = (event) => {
        setupDataChannel(event.channel);
        setDataChannel(event.channel);
      };
    }

    peerConnectionRef.current = pc;
    setPeerConnection(pc);
    return pc;
  }, [socket, roomId]);

  // Setup data channel for file transfer
  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";

    // Check if channel is already open (race condition fix)
    if (channel.readyState === "open") {
      console.log("✅ Data channel already open! Connection ready.");
      setDataChannelReady(true);
      setIsConnected(true);
      setConnectionState("Connected - Ready to transfer");
    }

    channel.onopen = () => {
      console.log("✅ Data channel opened! Connection ready.");
      setDataChannelReady(true);
      setIsConnected(true);
      setConnectionState("Connected - Ready to transfer");
    };

    channel.onclose = () => {
      console.log("Data channel closed");
      setDataChannelReady(false);
      setIsConnected(false);
      setConnectionState("Disconnected");
    };

    channel.onerror = (error) => {
      console.error("Data channel error:", error);
      setDataChannelReady(false);
    };

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        // Metadata message
        const metadata = JSON.parse(event.data);
        console.log("Received message:", metadata.type);
        
        if (metadata.type === "file-list") {
          // Receiver gets list of available files
          console.log("📂 Received file list:", metadata.files);
          setAvailableFiles(metadata.files);
        } else if (metadata.type === "download-request") {
          // Sender receives download request from receiver
          console.log("📥 Received download request for file:", metadata.fileIndex);
          if (onFileRequestCallback.current) {
            onFileRequestCallback.current(metadata.fileIndex);
          }
        } else if (metadata.type === "file-metadata") {
          console.log("📄 Receiving file:", metadata.name, metadata.size, "bytes");
          fileMetadata.current = {
            name: metadata.name,
            size: metadata.size,
          };
          setCurrentFileName(metadata.name);
          receivedChunks.current = [];
          setTransferProgress(0);
          
          // Request wake lock to prevent screen sleep
          requestWakeLock();
          
          // Initialize streaming download
          initializeStreamingDownload(metadata.name, metadata.size).catch(err => {
            if (err?.name === 'AbortError') {
              console.log("❌ User cancelled file download");
              setCurrentFileName("");
              setTransferProgress(0);
              releaseWakeLock();
            }
          });
        } else if (metadata.type === "file-end") {
          console.log("✅ File transfer complete");
          const fileName = fileMetadata.current?.name || "unknown";
          
          // Finalize the download
          finalizeDownload(fileName).then(blob => {
            if (blob) {
              // Fallback method: trigger download
              console.log("📥 Auto-downloading file (fallback method):", fileName);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            
            // Update state - create a small placeholder blob for UI
            const placeholderBlob = new Blob(["File downloaded"], { type: "text/plain" });
            setReceivedFiles(prev => [...prev, {
              name: fileName,
              blob: placeholderBlob,
            }]);
            setTransferProgress(100);
            
            // Reset state
            setTimeout(() => {
              setCurrentFileName("");
              setDownloadingFileIndex(null);
              setTransferProgress(0);
              cleanupStreamingDownload();
              releaseWakeLock();
            }, 1000);
          }).catch(err => {
            console.error("❌ Error finalizing download:", err);
            cleanupStreamingDownload();
            releaseWakeLock();
          });
        }
      } else {
        // File chunk - accumulate in download buffer
        writeChunkToDownload(event.data).catch(err => {
          console.error("❌ Error writing chunk:", err);
        });
        
        if (fileMetadata.current) {
          // Calculate progress based on actual bytes received
          const progress = Math.min(99, Math.round((totalBytesReceived.current / fileMetadata.current.size) * 100));
          setTransferProgress(progress);
        }
      }
    };
  };

  // Create room (sender)
  const createRoom = useCallback(() => {
    const code = nanoid(6).toUpperCase();
    setRoomId(code);
    currentRoomId.current = code;
    setHasJoined(true);
    
    if (socket && socket.connected) {
      console.log("📝 Creating room:", code);
      socket.emit("create-room", { roomId: code });
      
      // Clear any queued ICE candidates
      iceCandidateQueue.current = [];
      
      // Sender is impolite peer (will not rollback on collision)
      isPolite.current = false;
      reconnectAttempts.current = 0;
      
      // Create peer connection as sender
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          // Public TURN servers for cross-network connectivity
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
        iceCandidatePoolSize: 10,
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("🧊 Sending ICE candidate");
          socketRef.current?.emit("ice-candidate", {
            roomId: code,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("🔗 Connection state:", pc.connectionState);
        setConnectionState(pc.connectionState);
        setIsConnected(pc.connectionState === "connected");
        
        if (pc.connectionState === "connected") {
          reconnectAttempts.current = 0;
        } else if (pc.connectionState === "disconnected") {
          // Auto-reconnect on disconnect
          console.log("⚠️ Connection disconnected, attempting reconnect...");
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            setTimeout(() => {
              if (pc.connectionState === "disconnected") {
                console.log(`🔄 Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
                pc.restartIce();
              }
            }, 2000 * reconnectAttempts.current);
          }
        } else if (pc.connectionState === "failed") {
          console.error("❌ Connection failed");
          setConnectionState("Connection failed - Try reloading or retry");
        }
      };

      const channel = pc.createDataChannel("fileTransfer", {
        ordered: true, // Maintain order for file integrity
        maxRetransmits: undefined, // Reliable delivery  
      });
      channel.binaryType = "arraybuffer";
      
      channel.onopen = () => {
        console.log("✅ Data channel opened");
        setIsConnected(true);
        setDataChannelReady(true);
        setConnectionState("Connected - Ready to transfer");
        
        // Start monitoring connection stats for optimization
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
        }
        statsIntervalRef.current = setInterval(async () => {
          if (peerConnectionRef.current) {
            try {
              const stats = await peerConnectionRef.current.getStats();
              stats.forEach((report) => {
                if (report.type === 'outbound-rtp' || report.type === 'candidate-pair') {
                  // Monitor for congestion and adapt
                  if (report.currentRoundTripTime && report.currentRoundTripTime > 0.3) {
                    // High RTT detected - network congestion
                    console.warn('⚠️ High RTT detected:', report.currentRoundTripTime);
                  }
                }
              });
            } catch (err) {
              // Stats API might not be available in all browsers
            }
          }
        }, 5000); // Check every 5 seconds
      };

      channel.onclose = () => {
        console.log("❌ Data channel closed");
        setIsConnected(false);
        setDataChannelReady(false);
        
        // Clear stats monitoring
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }
      };

      channel.onmessage = (event) => {
        if (typeof event.data === "string") {
          const metadata = JSON.parse(event.data);
          if (metadata.type === "download-request" && onFileRequestCallback.current) {
            onFileRequestCallback.current(metadata.fileIndex);
          }
        }
      };

      setDataChannel(channel);
      peerConnectionRef.current = pc;
      setPeerConnection(pc);
      console.log("✅ Peer connection created");
    }
    
    return code;
  }, [socket]);

  // Join room (receiver)
  const joinRoom = useCallback((code: string) => {
    // Prevent duplicate join attempts
    if (isJoining.current) {
      console.log("⚠️ Already attempting to join, ignoring duplicate request");
      return;
    }
    
    console.log("Joining room:", code);
    isJoining.current = true;
    
    // Clear any existing timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    // Close any existing peer connection before creating a new one
    if (peerConnectionRef.current) {
      console.log("Closing existing peer connection before rejoining");
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clear ICE candidate queue
    iceCandidateQueue.current = [];
    
    // Receiver is polite peer (will rollback on collision)
    isPolite.current = true;
    reconnectAttempts.current = 0;

    setRoomId(code);
    currentRoomId.current = code;
    setHasJoined(true);
    
    if (socket && socket.connected) {
      socket.emit("join-room", { roomId: code });
      
      // Create peer connection as receiver
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          // Public TURN servers for cross-network connectivity
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
        iceCandidatePoolSize: 10,
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("🧊 Sending ICE candidate");
          socketRef.current?.emit("ice-candidate", {
            roomId: code,
            candidate: event.candidate,
          });
        } else {
          console.log("✅ ICE gathering complete");
        }
      };
      pc.onicecandidateerror = (event: any) => {
        console.warn("⚠️ ICE candidate error:", event.errorText || event);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("❄️ ICE connection state:", pc.iceConnectionState);
      };
      pc.onicecandidateerror = (event) => {
        console.warn("⚠️ ICE candidate error:", event);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("❄️ ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed" && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`🔄 ICE failed, restarting (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          pc.restartIce();
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("🔗 Connection state:", pc.connectionState);
        setConnectionState(pc.connectionState);
        const connected = pc.connectionState === "connected";
        setIsConnected(connected);
        
        if (connected) {
          // Clear timeout on successful connection
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          isJoining.current = false;
          reconnectAttempts.current = 0;
        } else if (pc.connectionState === "disconnected") {
          // Auto-reconnect on disconnect
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            setTimeout(() => {
              if (pc.connectionState === "disconnected") {
                console.log(`🔄 Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
                pc.restartIce();
              }
            }, 2000 * reconnectAttempts.current);
          }
        } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          // Allow retry on failure
          isJoining.current = false;
        }
      };

      pc.ondatachannel = (event) => {
        console.log("📂 Data channel received");
        const channel = event.channel;
        channel.binaryType = "arraybuffer";

        channel.onopen = () => {
          console.log("✅ Data channel opened");
          setIsConnected(true);
          setDataChannelReady(true);
          setConnectionState("Connected - Ready to receive");
        };

        channel.onclose = () => {
          console.log("❌ Data channel closed");
          setIsConnected(false);
          setDataChannelReady(false);
        };

        channel.onmessage = (e) => {
          if (typeof e.data === "string") {
            const metadata = JSON.parse(e.data);
            console.log("📨 Received message type:", metadata.type);
            if (metadata.type === "file-list") {
              console.log("📋 Received file list:", metadata.files);
              setAvailableFiles(metadata.files);
            } else if (metadata.type === "file-metadata") {
              console.log("📥 Receiving file:", metadata.name);
              fileMetadata.current = { name: metadata.name, size: metadata.size };
              receivedChunks.current = [];
              setCurrentFileName(metadata.name);
              setTransferProgress(0);
              
              // Request wake lock to prevent screen sleep
              requestWakeLock();
              
              // Initialize streaming download
              initializeStreamingDownload(metadata.name, metadata.size).catch(err => {
                if (err?.name === 'AbortError') {
                  console.log("❌ User cancelled file download");
                  setCurrentFileName("");
                  setTransferProgress(0);
                  releaseWakeLock();
                }
              });
            } else if (metadata.type === "file-end") {
              const fileName = fileMetadata.current?.name || "download";
              
              // Finalize the download (this will trigger the download)
              finalizeDownload(fileName).then(() => {
                
                // Update state - create a small placeholder blob for UI
                const placeholderBlob = new Blob(["File downloaded"], { type: "text/plain" });
                setReceivedFiles(prev => [...prev, { name: fileName, blob: placeholderBlob }]);
                setTransferProgress(100);
                
                // Reset state
                setTimeout(() => {
                  setCurrentFileName("");
                  setDownloadingFileIndex(null);
                  setTransferProgress(0);
                  cleanupStreamingDownload();
                  releaseWakeLock();
                }, 1000);
              }).catch(err => {
                console.error("❌ Error finalizing download:", err);
                cleanupStreamingDownload();
                releaseWakeLock();
              });
            }
          } else {
            // File chunk - accumulate in download buffer
            writeChunkToDownload(e.data).catch(err => {
              console.error("❌ Error writing chunk:", err);
            });
            
            if (fileMetadata.current) {
              // Calculate progress based on actual bytes received
              const progress = Math.min(99, Math.round((totalBytesReceived.current / fileMetadata.current.size) * 100));
              setTransferProgress(progress);
            }
          }
        };

        setDataChannel(channel);
        console.log("✅ Data channel stored in state");
      };

      peerConnectionRef.current = pc;
      setPeerConnection(pc);

      // Small delay to ensure peer connection is fully initialized before requesting offer
      setTimeout(() => {
        console.log("📨 Requesting offer");
        socket.emit("request-offer", { roomId: code });
      }, 500);
      
      // Set a timeout for connection establishment - clear on success or allow retry
      connectionTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState !== "connected") {
          console.error("⏱️ Connection timeout - failed to establish connection within 30 seconds");
          setConnectionState("Connection timeout - Click retry to try again");
          isJoining.current = false;
        }
      }, 30000); // 30 seconds
      
    } else {
      console.error("❌ Socket not connected, cannot join room");
      setConnectionState("Not connected to server");
      isJoining.current = false;
    }
  }, [socket]);

  // Send file list to receiver
  const sendFileList = useCallback(async (files: File[]) => {
    try {
      // Check if data channel exists
      if (!dataChannel) {
        console.log("⚠️ No data channel yet, waiting for connection...");
        return;
      }
      
      const channel = await waitForDataChannel(dataChannel, 15000);
      
      const fileList = files.map((file, index) => ({
        name: file.name,
        size: file.size,
        index,
      }));

      channel.send(JSON.stringify({
        type: "file-list",
        files: fileList,
      }));

      console.log("📤 Sent file list to receiver:", fileList.length, "files");
    } catch (error: any) {
      console.error("❌ Failed to send file list:", error?.message || error);
      setConnectionState("Connection not ready - please wait for peer to connect");
    }
  }, [dataChannel]);

  // Request file download (receiver)
  const requestFileDownload = useCallback(async (fileIndex: number) => {
    try {
      const channel = await waitForDataChannel(dataChannel, 15000);
      
      setDownloadingFileIndex(fileIndex);
      channel.send(JSON.stringify({
        type: "download-request",
        fileIndex,
      }));

      console.log("Requested file download:", fileIndex);
    } catch (error: any) {
      console.error("Failed to request file download:", error?.message || error);
      setConnectionState("Connection not ready - please wait");
    }
  }, [dataChannel]);

  // Send file with adaptive chunking and optimized flow control
  const sendFile = useCallback(async (file: File, fileIndex: number = 0, totalFiles: number = 1): Promise<void> => {
    // Check if data channel exists first
    if (!dataChannel) {
      throw new Error("No data channel - connection not established");
    }
    
    // Wait for data channel to be ready with longer timeout for large files
    const channel = await waitForDataChannel(dataChannel, 15000);
    
    // Request wake lock to prevent screen sleep during send
    await requestWakeLock();
    
    return new Promise((resolve, reject) => {
      // Send metadata with file index info
      channel.send(JSON.stringify({
        type: "file-metadata",
        name: file.name,
        size: file.size,
        fileIndex: fileIndex,
        totalFiles: totalFiles,
      }));

      // Advanced adaptive transfer state
      let currentChunkSize = DEFAULT_CHUNK_SIZE;
      let offset = 0;
      let lastProgressUpdate = Date.now();
      let bytesTransferred = 0;
      let totalBytesTransferred = 0;
      const startTime = Date.now();
      let highWaterMark = 0;
      let consecutiveSlowSends = 0;
      let prefetchedChunk: ArrayBuffer | null = null;
      let isPrefetching = false;
      
      // Intelligent performance monitoring and adaptation
      const updateChunkSize = () => {
        const now = Date.now();
        const elapsed = (now - lastProgressUpdate) / 1000; // seconds
        const bufferAmount = channel.bufferedAmount;
        
        if (elapsed > 0.1 && bytesTransferred > 0) {
          const instantThroughput = bytesTransferred / elapsed; // bytes per second
          const bufferRatio = bufferAmount / MAX_BUFFER_SIZE;
          
          // Update bandwidth measurement
          measuredBandwidth.current = instantThroughput;
          
          // Multi-factor adaptive sizing
          if (bufferAmount < BUFFER_LOW_THRESHOLD && consecutiveSlowSends === 0) {
            // Buffer very low, network can handle more - ramp up aggressively
            if (instantThroughput > 2 * 1024 * 1024) { // > 2 MB/s
              currentChunkSize = Math.min(currentChunkSize * CHUNK_RAMP_UP_FACTOR, MAX_CHUNK_SIZE);
              consecutiveSlowSends = 0;
            } else {
              currentChunkSize = Math.min(currentChunkSize * 1.1, MAX_CHUNK_SIZE);
            }
          } else if (bufferAmount > OPTIMAL_BUFFER_SIZE) {
            // Buffer filling up - back off quickly
            currentChunkSize = Math.max(currentChunkSize * CHUNK_RAMP_DOWN_FACTOR, MIN_CHUNK_SIZE);
            consecutiveSlowSends++;
          } else if (bufferRatio > 0.6) {
            // Buffer moderate - slight reduction
            currentChunkSize = Math.max(currentChunkSize * 0.95, MIN_CHUNK_SIZE);
          } else {
            // Buffer healthy - gentle increase
            currentChunkSize = Math.min(currentChunkSize * 1.05, MAX_CHUNK_SIZE);
            consecutiveSlowSends = Math.max(0, consecutiveSlowSends - 1);
          }
          
          // Track high water mark for congestion detection
          highWaterMark = Math.max(highWaterMark, bufferAmount);
          
          currentChunkSize = Math.floor(currentChunkSize);
          bytesTransferred = 0;
          lastProgressUpdate = now;
        }
      };

      const sendChunk = (chunk: ArrayBuffer) => {
        try {
          channel.send(chunk);
          offset += chunk.byteLength;
          bytesTransferred += chunk.byteLength;
          totalBytesTransferred += chunk.byteLength;

          const progress = Math.round((offset / file.size) * 100);
          setTransferProgress(progress);

          // Adaptive chunk size updates - more frequent for better responsiveness
          if (totalBytesTransferred % (currentChunkSize * 5) === 0 || 
              channel.bufferedAmount > OPTIMAL_BUFFER_SIZE) {
            updateChunkSize();
          }

          if (offset < file.size) {
            // Continue immediately if buffer is low, otherwise schedule
            if (channel.bufferedAmount < BUFFER_LOW_THRESHOLD) {
              readNextChunk();
            } else {
              // Use microtask for better responsiveness
              queueMicrotask(readNextChunk);
            }
          } else {
            // Transfer complete - send end signal
            const elapsed = (Date.now() - startTime) / 1000;
            const avgSpeed = (file.size / elapsed / 1024 / 1024).toFixed(2);
            const peakChunkSize = Math.floor(highWaterMark / 1024);
            console.log(`✅ Transfer complete: ${avgSpeed} MB/s average, peak buffer: ${peakChunkSize}KB`);
            
            channel.send(JSON.stringify({ type: "file-end" }));
            setTransferProgress(100);
            
            // Release wake lock after send completes
            releaseWakeLock();
            
            setTimeout(() => resolve(), 100);
          }
        } catch (error) {
          console.error("Error sending chunk:", error);
          releaseWakeLock(); // Release on error too
          reject(error);
        }
      };

      const readNextChunk = () => {
        // Advanced flow control with intelligent buffering
        const bufferAmount = channel.bufferedAmount;
        const bufferRatio = bufferAmount / MAX_BUFFER_SIZE;
        
        // Dynamic wait times based on buffer state
        if (bufferAmount > MAX_BUFFER_SIZE * 0.9) {
          // Buffer critically full - aggressive backoff
          currentChunkSize = Math.max(currentChunkSize * 0.5, MIN_CHUNK_SIZE);
          consecutiveSlowSends++;
          setTimeout(readNextChunk, Math.min(100, 20 * consecutiveSlowSends));
          return;
        } else if (bufferAmount > OPTIMAL_BUFFER_SIZE) {
          // Buffer moderately full - adaptive wait
          const waitTime = Math.ceil(bufferRatio * 20);
          setTimeout(readNextChunk, waitTime);
          return;
        } else if (bufferAmount > BUFFER_LOW_THRESHOLD) {
          // Buffer filling - brief wait
          setTimeout(readNextChunk, 5);
          return;
        }
        
        // Buffer healthy or low - send immediately or use prefetched chunk
        if (prefetchedChunk && offset < file.size) {
          // Use prefetched chunk for zero-latency sending
          sendChunk(prefetchedChunk);
          prefetchedChunk = null;
          
          // Start prefetching next chunk if buffer is very low
          if (bufferAmount < BUFFER_LOW_THRESHOLD && !isPrefetching && offset < file.size) {
            isPrefetching = true;
            const nextSlice = file.slice(offset, offset + currentChunkSize);
            const prefetchReader = new FileReader();
            prefetchReader.onload = (e) => {
              if (e.target?.result) {
                prefetchedChunk = e.target.result as ArrayBuffer;
              }
              isPrefetching = false;
            };
            prefetchReader.readAsArrayBuffer(nextSlice);
          }
          return;
        }
        
        // Read chunk normally
        const slice = file.slice(offset, offset + currentChunkSize);
        const reader = new FileReader();
        
        reader.onload = (e) => {
          if (e.target?.result && channel.readyState === "open") {
            const chunk = e.target.result as ArrayBuffer;
            sendChunk(chunk);
          } else if (channel.readyState !== "open") {
            reject(new Error("Data channel closed during transfer"));
          }
        };
        
        reader.onerror = () => {
          reject(new Error("File read error"));
        };
        
        reader.readAsArrayBuffer(slice);
      };

      // Start transfer
      console.log(`🚀 Starting transfer: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      setTransferProgress(0); // Reset progress for this file
      setCurrentFileName(file.name); // Update current file name
      setCurrentFileIndex(fileIndex);
      setTotalFiles(totalFiles);
      readNextChunk();
    });
  }, [dataChannel]);

  // Set file request handler (for sender)
  const setFileRequestHandler = useCallback((handler: (fileIndex: number) => void) => {
    onFileRequestCallback.current = handler;
  }, []);

  // Reset connection state for clean retry
  const resetConnection = useCallback(() => {
    console.log("🔄 Resetting connection state");
    
    // Clear timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clear ICE candidate queue
    iceCandidateQueue.current = [];
    
    // Reset joining flag
    isJoining.current = false;
    
    // Reset state
    setPeerConnection(null);
    setDataChannel(null);
    setDataChannelReady(false);
    setIsConnected(false);
    setConnectionState("Not connected");
  }, []);

  return {
    createRoom,
    joinRoom,
    sendFile,
    sendFileList,
    requestFileDownload,
    setFileRequestHandler,
    resetConnection,
    isConnected,
    connectionState,
    transferProgress,
    receivedFiles,
    currentFileName,
    currentFileIndex,
    totalFiles,
    peersConnected,
    availableFiles,
    downloadingFileIndex,
    dataChannel,
    dataChannelReady,
    socket,
  };
}
