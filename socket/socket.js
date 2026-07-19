let io;

const initSocket = (server) => {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(" Client Connected :", socket.id);

    // Join berdasarkan role
    socket.on("join", ({ role, userId }) => {
      if (role) {
        socket.join(role.toLowerCase());
        console.log(`${userId} join room ${role}`);
      }

      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(" Client Disconnected :", socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO belum diinisialisasi!");
  }
  return io;
};

module.exports = {
  initSocket,
  getIO,
};
