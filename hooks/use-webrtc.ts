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

  // Initialize Socket.io connection
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin, {
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

    socketInstance.on("room-joined", ({ roomId, peerCount }: { roomId: string; peerCount?: number }) => {
      console.log("Joined room:", roomId, "Peer count:", peerCount);
      setConnectionState(`Joined room: ${roomId}`);
      setHasJoined(true);
      if (peerCount !== undefined) {
        setPeersConnected(peerCount);
      }
    });

    socketInstance.on("peer-joined", ({ peerId }: { peerId?: string }) => {
      console.log("Peer joined:", peerId);
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

    peerConnectionRef.current = pc;
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
        
        if (metadata.type === "file-list") {
          // Receiver gets list of available files
          setAvailableFiles(metadata.files);
          console.log("Received file list:", metadata.files);
        } else if (metadata.type === "download-request") {
          // Sender receives download request from receiver
          if (onFileRequestCallback.current) {
            onFileRequestCallback.current(metadata.fileIndex);
          }
          console.log("Received download request for file:", metadata.fileIndex);
        } else if (metadata.type === "file-metadata") {
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
          const fileName = fileMetadata.current?.name || "unknown";
          
          setReceivedFiles(prev => [...prev, {
            name: fileName,
            blob,
          }]);
          
          // Automatically trigger download
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          setTransferProgress(100);
          setCurrentFileName("");
          setDownloadingFileIndex(null);
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
    setHasJoined(true);
    if (socket && socket.connected) {
      console.log("Creating room:", code);
      socket.emit("create-room", { roomId: code });
      
      // Remove old listeners to prevent duplicates
      socket.off("offer-request");
      socket.off("answer");
      socket.off("ice-candidate");
      
      socket.on("offer-request", async () => {
        try {
          console.log("Received offer request from receiver");
          const pc = createPeerConnection(true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { roomId: code, offer });
          console.log("Sent offer to receiver");
        } catch (error) {
          console.error("Error creating offer:", error);
        }
      });

      socket.on("answer", async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        try {
          console.log("Received answer from receiver");
          const currentPc = peerConnectionRef.current;
          if (currentPc) {
            await currentPc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log("Connection established with receiver");
          }
        } catch (error) {
          console.error("Error handling answer:", error);
        }
      });

      socket.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          const currentPc = peerConnectionRef.current;
          if (currentPc && currentPc.remoteDescription) {
            await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("Added ICE candidate");
          }
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      });
    }
    return code;
  }, [socket, createPeerConnection]);

  // Join room (receiver)
  const joinRoom = useCallback((code: string) => {
    console.log("Attempting to join room:", code, "Current roomId:", roomId, "hasJoined:", hasJoined);
    
    // Prevent duplicate joins to the same room
    if (hasJoined && roomId === code) {
      console.log("Already joined this room:", code);
      return;
    }

    setRoomId(code);
    setHasJoined(true);
    
    if (socket && socket.connected) {
      console.log("Emitting join-room event for:", code);
      socket.emit("join-room", { roomId: code });
      
      // Create peer connection for receiver
      console.log("Creating peer connection as receiver");
      const pc = createPeerConnection(false);

      // Request offer from sender
      console.log("Requesting offer from sender");
      socket.emit("request-offer", { roomId: code });

      // Remove old listeners to prevent duplicates
      socket.off("offer");
      socket.off("ice-candidate");

      socket.on("offer", async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        try {
          console.log("Received offer from sender");
          const currentPc = peerConnectionRef.current;
          if (currentPc) {
            await currentPc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await currentPc.createAnswer();
            await currentPc.setLocalDescription(answer);
            socket.emit("answer", { roomId: code, answer });
            console.log("Sent answer to sender");
          }
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      });

      socket.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          const currentPc = peerConnectionRef.current;
          if (currentPc && currentPc.remoteDescription) {
            await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("Added ICE candidate");
          } else if (currentPc) {
            console.log("Queuing ICE candidate - no remote description yet");
          }
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      });
    } else {
      console.error("Socket not connected! Cannot join room.");
    }
  }, [socket, createPeerConnection, hasJoined, roomId]);

  // Send file list to receiver
  const sendFileList = useCallback((files: File[]) => {
    if (!dataChannel || dataChannel.readyState !== "open") {
      console.error("Data channel not ready");
      return;
    }

    const fileList = files.map((file, index) => ({
      name: file.name,
      size: file.size,
      index,
    }));

    dataChannel.send(JSON.stringify({
      type: "file-list",
      files: fileList,
    }));

    console.log("Sent file list to receiver");
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
  };
}
