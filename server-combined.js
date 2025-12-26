const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
    },
  });

  const rooms = new Map();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("create-room", ({ roomId }) => {
      socket.join(roomId);
      rooms.set(roomId, { 
        creator: socket.id, 
        sender: socket.id, 
        receivers: [] 
      });
      socket.emit("room-joined", { roomId, role: 'sender' });
      console.log(`Room created: ${roomId} by sender ${socket.id}`);
    });

    socket.on("join-room", ({ roomId }) => {
      console.log(`📥 join-room event received. Socket: ${socket.id}, Room: ${roomId}`);
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        console.log(`   Room exists. Sender: ${room.sender}, Current receivers:`, room.receivers);
        
        // Check if this socket is already in the room to prevent duplicates
        if (!room.receivers.includes(socket.id) && socket.id !== room.sender) {
          socket.join(roomId);
          room.receivers.push(socket.id);
          
          // Notify sender about new receiver (not all peers)
          console.log(`   📤 Notifying sender ${room.sender} about new receiver ${socket.id}`);
          io.to(room.sender).emit("peer-joined", { 
            peerId: socket.id,
            receiverCount: room.receivers.length 
          });
          
          // Send confirmation to the receiver
          console.log(`   📤 Emitting room-joined to receiver ${socket.id}. Total receivers: ${room.receivers.length}`);
          socket.emit("room-joined", { 
            roomId, 
            role: 'receiver',
            peerCount: room.receivers.length 
          });
          console.log(`   ✅ Receiver ${socket.id} joined room: ${roomId}. Total receivers: ${room.receivers.length}`);
        } else if (room.receivers.includes(socket.id)) {
          // Already in room as receiver, just confirm
          socket.emit("room-joined", { 
            roomId, 
            role: 'receiver',
            peerCount: room.receivers.length 
          });
          console.log(`   ⚠️  Receiver ${socket.id} already in room: ${roomId}`);
        } else if (socket.id === room.sender) {
          socket.emit("room-joined", { 
            roomId, 
            role: 'sender',
            peerCount: room.receivers.length 
          });
          console.log(`   ⚠️  Sender ${socket.id} confirming room: ${roomId}`);
        }
      } else {
        console.log(`   ❌ Room ${roomId} not found!`);
        socket.emit("error", { message: "Room not found" });
      }
    });

    socket.on("request-offer", ({ roomId }) => {
      console.log(`📥 request-offer received from receiver ${socket.id} for room ${roomId}`);
      const room = rooms.get(roomId);
      if (room) {
        // Send offer-request only to the sender, with receiver's ID
        console.log(`   📤 Sending offer-request to sender ${room.sender} for receiver ${socket.id}`);
        io.to(room.sender).emit("offer-request", { receiverId: socket.id });
      }
    });

    socket.on("offer", ({ roomId, offer, targetId }) => {
      console.log(`📥 Received offer from ${socket.id} for target ${targetId}`);
      // Send offer to specific receiver
      if (targetId) {
        io.to(targetId).emit("offer", { offer, senderId: socket.id });
      } else {
        // Fallback to broadcast (for backwards compatibility)
        socket.to(roomId).emit("offer", { offer, senderId: socket.id });
      }
    });

    socket.on("answer", ({ roomId, answer, targetId }) => {
      console.log(`📥 Received answer from ${socket.id} for target ${targetId}`);
      // Send answer to specific sender
      if (targetId) {
        io.to(targetId).emit("answer", { answer, receiverId: socket.id });
      } else {
        // Fallback to broadcast
        socket.to(roomId).emit("answer", { answer, receiverId: socket.id });
      }
    });

    socket.on("ice-candidate", ({ roomId, candidate, targetId }) => {
      // Send ICE candidate to specific peer
      if (targetId) {
        io.to(targetId).emit("ice-candidate", { candidate, senderId: socket.id });
      } else {
        // Fallback to broadcast
        socket.to(roomId).emit("ice-candidate", { candidate, senderId: socket.id });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      
      // Clean up rooms
      for (const [roomId, room] of rooms.entries()) {
        // Check if disconnected socket was a receiver
        const receiverIndex = room.receivers.indexOf(socket.id);
        if (receiverIndex > -1) {
          room.receivers.splice(receiverIndex, 1);
          console.log(`Receiver ${socket.id} left room ${roomId}. Remaining receivers: ${room.receivers.length}`);
          
          // Notify sender about receiver leaving
          io.to(room.sender).emit("peer-left", { 
            peerId: socket.id,
            receiverCount: room.receivers.length 
          });
        }
        
        // Check if disconnected socket was the sender
        if (room.sender === socket.id) {
          console.log(`Sender ${socket.id} left room ${roomId}. Notifying all receivers.`);
          
          // Notify all receivers that sender disconnected
          room.receivers.forEach(receiverId => {
            io.to(receiverId).emit("sender-left");
          });
          
          // Delete the room
          rooms.delete(roomId);
          console.log(`Room deleted: ${roomId}`);
        } else if (room.receivers.length === 0 && room.sender !== socket.id) {
          // Room has no receivers left (and sender didn't disconnect)
          console.log(`Room ${roomId} has no receivers left`);
        }
      }
    });
  });

  // Self-ping system to prevent Render from sleeping
  const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const HEALTH_URL = process.env.SELF_PING_URL || 'https://quicksharep2p.onrender.com/api/health';
  
  let selfPingInterval;
  
  const selfPing = async () => {
    try {
      const https = require('https');
      const http = require('http');
      const protocol = HEALTH_URL.startsWith('https') ? https : http;
      
      const startTime = Date.now();
      const req = protocol.get(HEALTH_URL, (res) => {
        const responseTime = Date.now() - startTime;
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`✅ Self-ping successful (${responseTime}ms):`, HEALTH_URL);
          } else {
            console.warn(`⚠️ Self-ping returned status ${res.statusCode}`);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('❌ Self-ping failed:', error.message);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        console.error('❌ Self-ping timed out after 10s');
      });
      
    } catch (error) {
      console.error('❌ Self-ping error:', error.message);
    }
  };

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.io server integrated`);
      
      // Start self-ping system only in production
      if (!dev && HEALTH_URL.includes('onrender.com')) {
        console.log(`🔄 Self-ping system starting - will ping ${HEALTH_URL} every 5 minutes`);
        
        // Initial ping after 2 minutes (give server time to fully start)
        setTimeout(() => {
          console.log('🚀 Running initial self-ping...');
          selfPing();
          
          // Then set up regular interval
          selfPingInterval = setInterval(selfPing, PING_INTERVAL);
        }, 2 * 60 * 1000);
      } else {
        console.log('ℹ️  Self-ping system disabled (development mode or not on Render)');
      }
    });
  
  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    if (selfPingInterval) {
      clearInterval(selfPingInterval);
    }
    httpServer.close(() => {
      console.log('👋 Server closed');
      process.exit(0);
    });
  });
});
