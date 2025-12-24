const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
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
    if (rooms.has(roomId)) {
      socket.join(roomId);
      const room = rooms.get(roomId);
      room.peers.push(socket.id);
      socket.to(roomId).emit("peer-joined");
      socket.emit("room-joined", { roomId });
      console.log(`Client ${socket.id} joined room: ${roomId}`);
    } else {
      socket.emit("error", { message: "Room not found" });
    }
  });

  socket.on("request-offer", ({ roomId }) => {
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

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
  
  // Self-ping mechanism to keep Render server awake
  // Render free tier goes to sleep after 15 minutes of inactivity
  const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
  
  setInterval(() => {
    const timestamp = new Date().toISOString();
    console.log(`[Keep-Alive] Self-ping at ${timestamp}`);
    
    // Perform a simple operation to show activity
    const roomCount = rooms.size;
    const totalPeers = Array.from(rooms.values()).reduce((sum, room) => sum + room.peers.length, 0);
    console.log(`[Keep-Alive] Active rooms: ${roomCount}, Total peers: ${totalPeers}`);
  }, PING_INTERVAL);
  
  console.log('[Keep-Alive] Self-ping mechanism started (10-minute interval)');
});
