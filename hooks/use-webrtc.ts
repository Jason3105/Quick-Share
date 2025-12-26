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
  const [isSender, setIsSender] = useState(false);

  // Multiple peer connections for sender (one per receiver)
  const peerConnectionsMap = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsMap = useRef<Map<string, RTCDataChannel>>(new Map());
  
  const receivedChunks = useRef<ArrayBuffer[]>([]);
  const fileMetadata = useRef<{ name: string; size: number } | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const onFileRequestCallback = useRef<((fileIndex: number) => void) | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentRoomId = useRef<string>("");
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const iceCandidateQueuesMap = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
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
  
  // Transfer state tracking for reconnection handling
  const activeTransferFile = useRef<File | null>(null);
  const activeTransferIndex = useRef<number>(0);
  const activeTotalFiles = useRef<number>(0);
  const wasTransferring = useRef<boolean>(false);
  const lastConnectionState = useRef<string>("");

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
  
  // Reset transfer state on disconnection
  const resetTransferState = () => {
    // Mark that we were transferring so we can resume
    if (currentFileName || activeTransferFile.current) {
      wasTransferring.current = true;
      console.log("🔄 Marked transfer as interrupted for restart on reconnection");
    }
    
    // Cleanup download resources
    cleanupStreamingDownload();
    
    // Reset file metadata
    fileMetadata.current = null;
    
    console.log("🔄 Transfer state reset due to disconnection");
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

    socketInstance.on("room-joined", ({ roomId, peerCount, role }: { roomId: string; peerCount?: number; role?: string }) => {
      console.log("🚪 Joined room:", roomId, "Role:", role, "Peer count:", peerCount);
      setConnectionState(`Joined room: ${roomId}`);
      setHasJoined(true);
      setIsSender(role === 'sender');
      if (peerCount !== undefined) {
        setPeersConnected(peerCount);
      }
    });

    socketInstance.on("peer-joined", ({ peerId, receiverCount }: { peerId?: string; receiverCount?: number }) => {
      console.log("👥 Peer joined:", peerId, "Total receivers:", receiverCount);
      if (receiverCount !== undefined) {
        setPeersConnected(receiverCount);
      } else {
        setPeersConnected((prev) => prev + 1);
      }
      
      // If we're the sender and a new receiver joined, we don't create connection yet
      // Wait for offer-request from the receiver
    });

    socketInstance.on("peer-left", ({ peerId, receiverCount }: { peerId?: string; receiverCount?: number }) => {
      console.log("👋 Peer left:", peerId, "Remaining receivers:", receiverCount);
      
      // Clean up peer connection for this receiver if we're sender
      if (peerId && peerConnectionsMap.current.has(peerId)) {
        const pc = peerConnectionsMap.current.get(peerId);
        pc?.close();
        peerConnectionsMap.current.delete(peerId);
        dataChannelsMap.current.delete(peerId);
        iceCandidateQueuesMap.current.delete(peerId);
        console.log("🧹 Cleaned up connection for peer:", peerId);
      }
      
      if (receiverCount !== undefined) {
        setPeersConnected(receiverCount);
      } else {
        setPeersConnected((prev) => Math.max(0, prev - 1));
      }
    });

    socketInstance.on("sender-left", () => {
      console.log("❌ Sender disconnected");
      setConnectionState("Sender disconnected");
      setIsConnected(false);
      setDataChannelReady(false);
    });

    // Simple WebRTC signaling - support for multiple receivers
    socketInstance.on("offer-request", async ({ receiverId }: { receiverId?: string }) => {
      console.log("📨 Received offer-request from receiver:", receiverId);
      const room = currentRoomId.current;
      if (!room || !receiverId) {
        console.error("❌ No room ID or receiver ID");
        return;
      }
      
      // Create a new peer connection for this receiver if it doesn't exist
      let pc = peerConnectionsMap.current.get(receiverId);
      if (!pc || pc.connectionState === 'closed') {
        console.log("📝 Creating new peer connection for receiver:", receiverId);
        pc = createPeerConnectionForReceiver(receiverId);
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
        
        socketRef.current?.emit("offer", { 
          roomId: room, 
          offer: pc.localDescription,
          targetId: receiverId 
        });
        console.log("✅ Sent offer to receiver:", receiverId, "(ICE gathering:", pc.iceGatheringState, ")");
      } catch (error) {
        console.error("❌ Error creating offer:", error);
      } finally {
        makingOffer.current = false;
      }
    });

    socketInstance.on("offer", async ({ offer, senderId }: { offer: RTCSessionDescriptionInit; senderId?: string }) => {
      console.log("📨 Received offer from sender:", senderId);
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
        socketRef.current?.emit("answer", { 
          roomId: room, 
          answer,
          targetId: senderId 
        });
        console.log("✅ Sent answer to sender:", senderId);
        
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

    socketInstance.on("answer", async ({ answer, receiverId }: { answer: RTCSessionDescriptionInit; receiverId?: string }) => {
      console.log("📨 Received answer from receiver:", receiverId);
      
      // Get the specific peer connection for this receiver
      const pc = receiverId ? peerConnectionsMap.current.get(receiverId) : peerConnectionRef.current;
      if (!pc) {
        console.error("❌ No peer connection for receiver:", receiverId);
        return;
      }
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ Set remote description from answer for receiver:", receiverId);
        
        // Process queued ICE candidates for this receiver
        if (receiverId) {
          const queue = iceCandidateQueuesMap.current.get(receiverId) || [];
          if (queue.length > 0) {
            console.log(`📦 Processing ${queue.length} queued ICE candidates for receiver:`, receiverId);
            for (const candidate of queue) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (error) {
                console.error("❌ Error adding queued ICE candidate:", error);
              }
            }
            iceCandidateQueuesMap.current.delete(receiverId);
          }
        } else {
          // Fallback for receiver side
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
        }
      } catch (error) {
        console.error("❌ Error handling answer:", error);
      }
    });

    socketInstance.on("ice-candidate", async ({ candidate, senderId }: { candidate: RTCIceCandidateInit; senderId?: string }) => {
      // Get the appropriate peer connection
      const pc = senderId ? peerConnectionsMap.current.get(senderId) : peerConnectionRef.current;
      
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ Added ICE candidate for peer:", senderId || "receiver");
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      } else {
        console.log("⏳ Queueing ICE candidate for peer:", senderId || "receiver", "(waiting for remote description)");
        if (senderId) {
          // Queue for specific sender (from receiver perspective)
          if (!iceCandidateQueuesMap.current.has(senderId)) {
            iceCandidateQueuesMap.current.set(senderId, []);
          }
          iceCandidateQueuesMap.current.get(senderId)!.push(candidate);
        } else {
          // Queue for receiver side
          iceCandidateQueue.current.push(candidate);
        }
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      // Clean up all peer connections on unmount
      peerConnectionsMap.current.forEach((pc) => pc.close());
      peerConnectionsMap.current.clear();
      dataChannelsMap.current.clear();
      iceCandidateQueuesMap.current.clear();
      
      // Clean up single peer connection (receiver)
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

  // Create WebRTC peer connection for a receiver (sender side)
  const createPeerConnectionForReceiver = useCallback((receiverId: string): RTCPeerConnection => {
    const room = currentRoomId.current;
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
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
        console.log("🧊 Sending ICE candidate to receiver:", receiverId);
        socketRef.current?.emit("ice-candidate", {
          roomId: room,
          candidate: event.candidate,
          targetId: receiverId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔗 Connection state for receiver ${receiverId}:`, pc.connectionState);
      
      // Update overall connection state (connected if ANY receiver is connected)
      const anyConnected = Array.from(peerConnectionsMap.current.values()).some(
        p => p.connectionState === "connected"
      );
      setIsConnected(anyConnected);
      
      if (pc.connectionState === "connected") {
        console.log(`✅ Connected to receiver: ${receiverId}`);
        setConnectionState(`Connected to ${peerConnectionsMap.current.size} receiver(s)`);
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        console.log(`❌ Connection to receiver ${receiverId}:`, pc.connectionState);
        // Clean up this specific connection
        peerConnectionsMap.current.delete(receiverId);
        dataChannelsMap.current.delete(receiverId);
        iceCandidateQueuesMap.current.delete(receiverId);
      }
    };

    // Create data channel for this receiver
    const channel = pc.createDataChannel("fileTransfer", {
      ordered: true,
      maxRetransmits: undefined,
    });
    channel.binaryType = "arraybuffer";
    
    channel.onopen = () => {
      console.log(`✅ Data channel opened for receiver: ${receiverId}`);
      dataChannelsMap.current.set(receiverId, channel);
      
      // Update overall ready state
      const anyReady = dataChannelsMap.current.size > 0;
      setDataChannelReady(anyReady);
      setConnectionState(`Connected to ${dataChannelsMap.current.size} receiver(s)`);
    };

    channel.onclose = () => {
      console.log(`❌ Data channel closed for receiver: ${receiverId}`);
      dataChannelsMap.current.delete(receiverId);
      
      // Update overall ready state
      const anyReady = dataChannelsMap.current.size > 0;
      setDataChannelReady(anyReady);
    };

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const metadata = JSON.parse(event.data);
        if (metadata.type === "download-request" && onFileRequestCallback.current) {
          onFileRequestCallback.current(metadata.fileIndex);
        }
      }
    };

    // Store the peer connection and data channel
    peerConnectionsMap.current.set(receiverId, pc);
    
    console.log(`✅ Created peer connection for receiver: ${receiverId}`);
    return pc;
  }, [socket]);

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
      
      // Reset transfer state on disconnect
      resetTransferState();
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
        } else if (metadata.type === "restart-transfer") {
          // Request to restart transfer after reconnection
          console.log("🔄 Received restart-transfer request for file:", metadata.fileIndex);
          if (onFileRequestCallback.current && metadata.fileIndex !== undefined) {
            // Reset UI state
            setCurrentFileName("");
            setTransferProgress(0);
            // Trigger the file request
            onFileRequestCallback.current(metadata.fileIndex);
          }
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
    setIsSender(true);
    
    if (socket && socket.connected) {
      console.log("📝 Creating room:", code);
      socket.emit("create-room", { roomId: code });
      
      // Clear any existing peer connections
      peerConnectionsMap.current.forEach((pc) => pc.close());
      peerConnectionsMap.current.clear();
      dataChannelsMap.current.clear();
      iceCandidateQueuesMap.current.clear();
      
      // Sender is impolite peer (will not rollback on collision)
      isPolite.current = false;
      reconnectAttempts.current = 0;
      
      console.log("✅ Room created, waiting for receivers to join");
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
        const previousState = lastConnectionState.current;
        lastConnectionState.current = pc.connectionState;
        
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
          
          // Check if we just reconnected - request transfer restart if needed
          if ((previousState === "disconnected" || previousState === "failed") && wasTransferring.current) {
            console.log("✅ Receiver reconnected - will wait for sender to restart or send signal");
            
            // Try to signal sender to restart
            setTimeout(() => {
              const dataChannelFromPC = Array.from((pc as any).sctp?.transport?.dataChannelStreams || []).find((ch: any) => ch?.label === "fileTransfer");
              if (dataChannelFromPC && (dataChannelFromPC as any).readyState === "open") {
                try {
                  (dataChannelFromPC as any).send(JSON.stringify({
                    type: "restart-transfer",
                    fileIndex: activeTransferIndex.current
                  }));
                  console.log("🔄 Sent restart signal to sender");
                } catch (err) {
                  console.error("❌ Error sending restart signal:", err);
                }
              }
            }, 1000);
            
            wasTransferring.current = false;
            setCurrentFileName("");
            setTransferProgress(0);
          }
        } else if (pc.connectionState === "disconnected") {
          // Auto-reconnect on disconnect
          console.log("⚠️ Receiver disconnected, resetting transfer state");
          resetTransferState();
          
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
          resetTransferState();
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
          
          // Reset transfer state
          resetTransferState();
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

  // Send file with adaptive chunking and optimized flow control - broadcasts to all receivers
  const sendFile = useCallback(async (file: File, fileIndex: number = 0, totalFiles: number = 1): Promise<void> => {
    // Track this transfer for reconnection handling
    activeTransferFile.current = file;
    activeTransferIndex.current = fileIndex;
    activeTotalFiles.current = totalFiles;
    wasTransferring.current = true;
    
    // Get all connected data channels
    const channels = Array.from(dataChannelsMap.current.values());
    
    if (channels.length === 0) {
      // Fallback to single channel for receiver
      if (!dataChannel) {
        throw new Error("No data channel - connection not established");
      }
      channels.push(dataChannel);
    }
    
    console.log(`📤 Broadcasting file to ${channels.length} receiver(s)`);
    
    // Wait for all channels to be ready
    await Promise.all(channels.map(ch => waitForDataChannel(ch, 15000)));
    
    // Request wake lock to prevent screen sleep during send
    await requestWakeLock();
    
    return new Promise((resolve, reject) => {
      // Send metadata to all receivers
      const metadata = JSON.stringify({
        type: "file-metadata",
        name: file.name,
        size: file.size,
        fileIndex: fileIndex,
        totalFiles: totalFiles,
      });
      
      channels.forEach(channel => {
        if (channel.readyState === "open") {
          channel.send(metadata);
        }
      });

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
        
        // Get max buffer amount across all channels
        const maxBufferAmount = Math.max(...channels.map(ch => ch.bufferedAmount));
        
        if (elapsed > 0.1 && bytesTransferred > 0) {
          const instantThroughput = bytesTransferred / elapsed; // bytes per second
          const bufferRatio = maxBufferAmount / MAX_BUFFER_SIZE;
          
          // Update bandwidth measurement
          measuredBandwidth.current = instantThroughput;
          
          // Multi-factor adaptive sizing
          if (maxBufferAmount < BUFFER_LOW_THRESHOLD && consecutiveSlowSends === 0) {
            // Buffer very low, network can handle more - ramp up aggressively
            if (instantThroughput > 2 * 1024 * 1024) { // > 2 MB/s
              currentChunkSize = Math.min(currentChunkSize * CHUNK_RAMP_UP_FACTOR, MAX_CHUNK_SIZE);
              consecutiveSlowSends = 0;
            } else {
              currentChunkSize = Math.min(currentChunkSize * 1.1, MAX_CHUNK_SIZE);
            }
          } else if (maxBufferAmount > OPTIMAL_BUFFER_SIZE) {
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
          highWaterMark = Math.max(highWaterMark, maxBufferAmount);
          
          currentChunkSize = Math.floor(currentChunkSize);
          bytesTransferred = 0;
          lastProgressUpdate = now;
        }
      };

      const sendChunk = (chunk: ArrayBuffer) => {
        try {
          // Send to all connected receivers
          channels.forEach(channel => {
            if (channel.readyState === "open") {
              channel.send(chunk);
            }
          });
          
          offset += chunk.byteLength;
          bytesTransferred += chunk.byteLength;
          totalBytesTransferred += chunk.byteLength;

          const progress = Math.round((offset / file.size) * 100);
          setTransferProgress(progress);

          // Adaptive chunk size updates - more frequent for better responsiveness
          if (totalBytesTransferred % (currentChunkSize * 5) === 0 || 
              Math.max(...channels.map(ch => ch.bufferedAmount)) > OPTIMAL_BUFFER_SIZE) {
            updateChunkSize();
          }

          if (offset < file.size) {
            // Continue immediately if buffer is low, otherwise schedule
            const maxBuffer = Math.max(...channels.map(ch => ch.bufferedAmount));
            if (maxBuffer < BUFFER_LOW_THRESHOLD) {
              readNextChunk();
            } else {
              // Use microtask for better responsiveness
              queueMicrotask(readNextChunk);
            }
          } else {
            // Transfer complete - send end signal to all receivers
            const elapsed = (Date.now() - startTime) / 1000;
            const avgSpeed = (file.size / elapsed / 1024 / 1024).toFixed(2);
            const peakChunkSize = Math.floor(highWaterMark / 1024);
            console.log(`✅ Transfer complete to ${channels.length} receiver(s): ${avgSpeed} MB/s average, peak buffer: ${peakChunkSize}KB`);
            
            const endSignal = JSON.stringify({ type: "file-end" });
            channels.forEach(channel => {
              if (channel.readyState === "open") {
                channel.send(endSignal);
              }
            });
            
            setTransferProgress(100);
            
            // Clear transfer tracking on successful completion
            wasTransferring.current = false;
            activeTransferFile.current = null;
            
            // Release wake lock after send completes
            releaseWakeLock();
            
            setTimeout(() => resolve(), 100);
          }
        } catch (error) {
          console.error("Error sending chunk:", error);
          wasTransferring.current = false;
          activeTransferFile.current = null;
          releaseWakeLock(); // Release on error too
          reject(error);
        }
      };

      const readNextChunk = () => {
        // Advanced flow control with intelligent buffering
        const maxBufferAmount = Math.max(...channels.map(ch => ch.bufferedAmount));
        const bufferRatio = maxBufferAmount / MAX_BUFFER_SIZE;
        
        // Dynamic wait times based on buffer state
        if (maxBufferAmount > MAX_BUFFER_SIZE * 0.9) {
          // Buffer critically full - aggressive backoff
          currentChunkSize = Math.max(currentChunkSize * 0.5, MIN_CHUNK_SIZE);
          consecutiveSlowSends++;
          setTimeout(readNextChunk, Math.min(100, 20 * consecutiveSlowSends));
          return;
        } else if (maxBufferAmount > OPTIMAL_BUFFER_SIZE) {
          // Buffer moderately full - adaptive wait
          const waitTime = Math.ceil(bufferRatio * 20);
          setTimeout(readNextChunk, waitTime);
          return;
        } else if (maxBufferAmount > BUFFER_LOW_THRESHOLD) {
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
          if (maxBufferAmount < BUFFER_LOW_THRESHOLD && !isPrefetching && offset < file.size) {
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
          if (e.target?.result) {
            const chunk = e.target.result as ArrayBuffer;
            // Check if all channels are still open
            const allOpen = channels.every(ch => ch.readyState === "open");
            if (allOpen) {
              sendChunk(chunk);
            } else {
              console.warn("⚠️ Some channels closed during transfer");
              // Continue with open channels only
              const openChannels = channels.filter(ch => ch.readyState === "open");
              if (openChannels.length > 0) {
                sendChunk(chunk);
              } else {
                reject(new Error("All data channels closed during transfer"));
              }
            }
          }
        };
        
        reader.onerror = () => {
          reject(new Error("File read error"));
        };
        
        reader.readAsArrayBuffer(slice);
      };

      // Start transfer
      console.log(`🚀 Starting transfer to ${channels.length} receiver(s): ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
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
