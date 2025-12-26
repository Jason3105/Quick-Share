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
      rooms.set(roomId, { creator: socket.id, peers: [socket.id] });
      socket.emit("room-joined", { roomId });
      console.log(`Room created: ${roomId}`);
    });

    socket.on("join-room", ({ roomId }) => {
      console.log(`📥 join-room event received. Socket: ${socket.id}, Room: ${roomId}`);
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        console.log(`   Room exists. Current peers:`, room.peers);
        
        // Check if this socket is already in the room to prevent duplicates
        if (!room.peers.includes(socket.id)) {
          socket.join(roomId);
          room.peers.push(socket.id);
          
          // Notify all peers in room about new peer (except the one joining)
          console.log(`   📤 Emitting peer-joined to room ${roomId}`);
          socket.to(roomId).emit("peer-joined", { peerId: socket.id });
          
          // Send current peer count to the joiner
          console.log(`   📤 Emitting room-joined to ${socket.id}. Peer count: ${room.peers.length}`);
          socket.emit("room-joined", { roomId, peerCount: room.peers.length });
          console.log(`   ✅ Client ${socket.id} joined room: ${roomId}. Total peers: ${room.peers.length}`);
        } else {
          // Already in room, just confirm
          socket.emit("room-joined", { roomId, peerCount: room.peers.length });
          console.log(`   ⚠️  Client ${socket.id} already in room: ${roomId}`);
        }
      } else {
        console.log(`   ❌ Room ${roomId} not found!`);
        socket.emit("error", { message: "Room not found" });
      }
    });

    socket.on("request-offer", ({ roomId }) => {
      console.log(`📥 request-offer received from ${socket.id} for room ${roomId}`);
      console.log(`   📤 Emitting offer-request to room ${roomId}`);
      socket.to(roomId).emit("offer-request");
    });

    socket.on("offer", ({ roomId, offer }) => {
      socket.to(roomId).emit("offer", { offer });
    });

    socket.on("answer", ({ roomId, answer }) => {
      socket.to(roomId).emit("answer", { answer });
    });

    socket.on("ice-candidate", ({ roomId, candidate }) => {
      socket.to(roomId).emit("ice-candidate", { candidate });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      
      // Clean up rooms
      for (const [roomId, room] of rooms.entries()) {
        const index = room.peers.indexOf(socket.id);
        if (index > -1) {
          room.peers.splice(index, 1);
          socket.to(roomId).emit("peer-left");
          
          if (room.peers.length === 0) {
            rooms.delete(roomId);
            console.log(`Room deleted: ${roomId}`);
          }
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
