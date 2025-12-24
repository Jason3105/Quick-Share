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

  const receivedChunks = useRef<ArrayBuffer[]>([]);
  const fileMetadata = useRef<{ name: string; size: number } | null>(null);

  // Initialize Socket.io connection
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("Socket connected");
      setConnectionState("Connected to server");
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnectionState("Disconnected from server");
    });

    socketInstance.on("room-joined", ({ roomId }: { roomId: string }) => {
      console.log("Joined room:", roomId);
      setConnectionState(`Joined room: ${roomId}`);
    });

    socketInstance.on("peer-joined", () => {
      setPeersConnected((prev) => prev + 1);
    });

    socketInstance.on("peer-left", () => {
      setPeersConnected((prev) => Math.max(0, prev - 1));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Create WebRTC peer connection
  const createPeerConnection = useCallback((isSender: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      setConnectionState(pc.connectionState);
      setIsConnected(pc.connectionState === "connected");
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

    setPeerConnection(pc);
    return pc;
  }, [socket, roomId]);

  // Setup data channel for file transfer
  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      console.log("Data channel opened");
      setIsConnected(true);
    };

    channel.onclose = () => {
      console.log("Data channel closed");
      setIsConnected(false);
    };

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        // Metadata message
        const metadata = JSON.parse(event.data);
        if (metadata.type === "file-metadata") {
          fileMetadata.current = {
            name: metadata.name,
            size: metadata.size,
          };
          setCurrentFileName(metadata.name);
          receivedChunks.current = [];
          setTransferProgress(0);
        } else if (metadata.type === "file-end") {
          // Reconstruct file
          const blob = new Blob(receivedChunks.current);
          setReceivedFiles(prev => [...prev, {
            name: fileMetadata.current?.name || "unknown",
            blob,
          }]);
          setTransferProgress(100);
          setCurrentFileName("");
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
    if (socket) {
      socket.emit("create-room", { roomId: code });
      
      socket.on("offer-request", async () => {
        const pc = createPeerConnection(true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { roomId: code, offer });
      });

      socket.on("answer", async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });
    }
    return code;
  }, [socket, createPeerConnection, peerConnection]);

  // Join room (receiver)
  const joinRoom = useCallback((code: string) => {
    setRoomId(code);
    if (socket) {
      socket.emit("join-room", { roomId: code });
      
      const pc = createPeerConnection(false);

      socket.emit("request-offer", { roomId: code });

      socket.on("offer", async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { roomId: code, answer });
      });

      socket.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
    }
  }, [socket, createPeerConnection]);

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

      // Send file in chunks
      const reader = new FileReader();
      let offset = 0;

      const readNextChunk = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = (e) => {
        if (e.target?.result && dataChannel.readyState === "open") {
          dataChannel.send(e.target.result as ArrayBuffer);
          offset += (e.target.result as ArrayBuffer).byteLength;

          const progress = Math.round((offset / file.size) * 100);
          setTransferProgress(progress);

          if (offset < file.size) {
            readNextChunk();
          } else {
            // Send end signal
            dataChannel.send(JSON.stringify({ type: "file-end" }));
            setTransferProgress(100);
            // Small delay before resolving to ensure end signal is sent
            setTimeout(() => resolve(), 100);
          }
        }
      };

      reader.onerror = () => {
        reject(new Error("File read error"));
      };

      readNextChunk();
    });
  }, [dataChannel]);

  return {
    createRoom,
    joinRoom,
    sendFile,
    isConnected,
    connectionState,
    transferProgress,
    receivedFiles,
    currentFileName,
    peersConnected,
  };
}
