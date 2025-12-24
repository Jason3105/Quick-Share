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

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.io server integrated`);
    });
});
