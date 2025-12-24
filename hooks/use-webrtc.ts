"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { nanoid } from "nanoid";

const CHUNK_SIZE = 16384; // 16KB chunks

interface ReceivedFile {
  name: string;
  blob: Blob;
}

export function useWebRTC() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("Not connected");
  const [transferProgress, setTransferProgress] = useState(0);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [peersConnected, setPeersConnected] = useState(0);
  const [roomId, setRoomId] = useState<string>("");
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [hasJoined, setHasJoined] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<Array<{name: string; size: number; index: number}>>([]);
  const [downloadingFileIndex, setDownloadingFileIndex] = useState<number | null>(null);

  const receivedChunks = useRef<ArrayBuffer[]>([]);
  const fileMetadata = useRef<{ name: string; size: number } | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const onFileRequestCallback = useRef<((fileIndex: number) => void) | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentRoomId = useRef<string>("");

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
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit("offer", { roomId: room, offer });
        console.log("✅ Sent offer");
      } catch (error) {
        console.error("❌ Error creating offer:", error);
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
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit("answer", { roomId: room, answer });
        console.log("✅ Sent answer");
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
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
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
      ],
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
      const channel = pc.createDataChannel("fileTransfer");
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

    channel.onopen = () => {
      console.log("✅ Data channel opened! Connection ready.");
      setIsConnected(true);
      setConnectionState("Connected - Ready to transfer");
    };

    channel.onclose = () => {
      console.log("Data channel closed");
      setIsConnected(false);
      setConnectionState("Disconnected");
    };

    channel.onerror = (error) => {
      console.error("Data channel error:", error);
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
        } else if (metadata.type === "file-end") {
          console.log("✅ File transfer complete");
          // Reconstruct file
          const blob = new Blob(receivedChunks.current);
          const fileName = fileMetadata.current?.name || "unknown";
          
          setReceivedFiles(prev => [...prev, {
            name: fileName,
            blob,
          }]);
          
          // Automatically trigger download
          console.log("📥 Auto-downloading file:", fileName);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          setTransferProgress(100);
          setTimeout(() => {
            setCurrentFileName("");
            setDownloadingFileIndex(null);
            setTransferProgress(0);
          }, 2000);
        }
      } else {
        // File chunk
        receivedChunks.current.push(event.data);
        if (fileMetadata.current) {
          const received = receivedChunks.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);
          const progress = Math.round((received / fileMetadata.current.size) * 100);
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
      
      // Create peer connection as sender
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
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
      };

      const channel = pc.createDataChannel("fileTransfer");
      channel.binaryType = "arraybuffer";
      
      channel.onopen = () => {
        console.log("✅ Data channel opened");
        setIsConnected(true);
      };

      channel.onclose = () => {
        console.log("❌ Data channel closed");
        setIsConnected(false);
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
    console.log("Joining room:", code);
    
    // Close any existing peer connection before creating a new one
    if (peerConnectionRef.current) {
      console.log("Closing existing peer connection before rejoining");
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

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
        ],
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
      };

      pc.ondatachannel = (event) => {
        console.log("📂 Data channel received");
        const channel = event.channel;
        channel.binaryType = "arraybuffer";

        channel.onopen = () => {
          console.log("✅ Data channel opened");
          setIsConnected(true);
          setConnectionState("Connected - Ready to receive");
        };

        channel.onclose = () => {
          console.log("❌ Data channel closed");
          setIsConnected(false);
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
            } else if (metadata.type === "file-end") {
              const fileName = fileMetadata.current?.name || "download";
              const blob = new Blob(receivedChunks.current);
              setReceivedFiles(prev => [...prev, { name: fileName, blob }]);
              
              // Auto-download
              console.log("📥 Auto-downloading file:", fileName);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              
              setTransferProgress(100);
              setTimeout(() => {
                setCurrentFileName("");
                setDownloadingFileIndex(null);
                setTransferProgress(0);
              }, 2000);
            }
          } else {
            receivedChunks.current.push(e.data);
            if (fileMetadata.current) {
              const received = receivedChunks.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);
              const progress = Math.round((received / fileMetadata.current.size) * 100);
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
      
      // Set a timeout for connection establishment
      const connectionTimeout = setTimeout(() => {
        if (pc.connectionState !== "connected") {
          console.error("⏱️ Connection timeout - failed to establish connection within 20 seconds");
          setConnectionState("Connection timeout - Please try again");
          // Don't close the peer connection, allow retry
        }
      }, 20000); // 20 seconds
      
      // Clear timeout if connection succeeds
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "connected") {
          clearTimeout(connectionTimeout);
        }
      }, { once: true });
    } else {
      console.error("❌ Socket not connected, cannot join room");
      setConnectionState("Not connected to server");
    }
  }, [socket]);

  // Send file list to receiver
  const sendFileList = useCallback((files: File[]) => {
    if (!dataChannel) {
      console.error("❌ Data channel not available");
      return;
    }
    
    if (dataChannel.readyState !== "open") {
      console.log("⏳ Data channel not open yet, state:", dataChannel.readyState);
      // Retry after channel opens
      const checkAndSend = () => {
        if (dataChannel.readyState === "open") {
          sendFileListNow();
        } else {
          console.log("Still waiting for data channel to open...");
        }
      };
      dataChannel.addEventListener("open", checkAndSend, { once: true });
      return;
    }

    const sendFileListNow = () => {
      const fileList = files.map((file, index) => ({
        name: file.name,
        size: file.size,
        index,
      }));

      dataChannel.send(JSON.stringify({
        type: "file-list",
        files: fileList,
      }));

      console.log("📤 Sent file list to receiver:", fileList.length, "files");
    };
    
    sendFileListNow();
  }, [dataChannel]);

  // Request file download (receiver)
  const requestFileDownload = useCallback((fileIndex: number) => {
    if (!dataChannel || dataChannel.readyState !== "open") {
      console.error("Data channel not ready");
      return;
    }

    setDownloadingFileIndex(fileIndex);
    dataChannel.send(JSON.stringify({
      type: "download-request",
      fileIndex,
    }));

    console.log("Requested file download:", fileIndex);
  }, [dataChannel]);

  // Send file
  const sendFile = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!dataChannel || dataChannel.readyState !== "open") {
        console.error("Data channel not ready");
        reject(new Error("Data channel not ready"));
        return;
      }

      // Send metadata
      dataChannel.send(JSON.stringify({
        type: "file-metadata",
        name: file.name,
        size: file.size,
      }));

      // Send file in chunks with improved flow control
      const reader = new FileReader();
      let offset = 0;
      const MAX_BUFFER_SIZE = 256 * 1024; // 256KB buffer threshold for better flow control

      const sendChunk = (chunk: ArrayBuffer) => {
        dataChannel.send(chunk);
        offset += chunk.byteLength;

        const progress = Math.round((offset / file.size) * 100);
        setTransferProgress(progress);

        if (offset < file.size) {
          readNextChunk();
        } else {
          // Send end signal
          dataChannel.send(JSON.stringify({ type: "file-end" }));
          setTransferProgress(100);
          setTimeout(() => resolve(), 100);
        }
      };

      const readNextChunk = () => {
        // Wait if buffer is too full
        if (dataChannel.bufferedAmount > MAX_BUFFER_SIZE) {
          // Schedule retry after a small delay
          setTimeout(readNextChunk, 10);
          return;
        }
        
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = (e) => {
        if (e.target?.result && dataChannel.readyState === "open") {
          const chunk = e.target.result as ArrayBuffer;
          sendChunk(chunk);
        }
      };

      reader.onerror = () => {
        reject(new Error("File read error"));
      };

      readNextChunk();
    });
  }, [dataChannel]);

  // Set file request handler (for sender)
  const setFileRequestHandler = useCallback((handler: (fileIndex: number) => void) => {
    onFileRequestCallback.current = handler;
  }, []);

  return {
    createRoom,
    joinRoom,
    sendFile,
    sendFileList,
    requestFileDownload,
    setFileRequestHandler,
    isConnected,
    connectionState,
    transferProgress,
    receivedFiles,
    currentFileName,
    peersConnected,
    availableFiles,
    downloadingFileIndex,
    dataChannel,
    socket,
  };
}
