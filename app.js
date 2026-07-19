require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ================= IMPORT =================
const authRoutes = require("./routes/authRoutes");
const pengajuanRoutes = require("./routes/pengajuanRoutes");
const antrianRoutes = require("./routes/antrianRoutes");
const pemeriksaanRoutes = require("./routes/pemeriksaanRoutes");
const userRoutes = require("./routes/userRoutes");
const medicineRoutes = require("./routes/MedicineRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const { verifyToken, checkRole } = require("./middleware/authMiddleware");
const db = require("./config/db");
require("./config/firebase");

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// supaya bisa dipanggil dari controller
app.set("io", io);
global.io = io;
io.on("connection", (socket) => {
  console.log(" Client Connected :", socket.id);

  socket.on("join", (data) => {
    if (!data) return;

    const role = data.role?.toLowerCase();

    if (role) {
      socket.join(role);
      console.log(`Role ${role} join room`);
    }

    if (data.userId) {
      socket.join(`user_${data.userId}`);
      console.log(`User ${data.userId} join room user_${data.userId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(" Client Disconnected :", socket.id);
  });
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= TEST ROUTE =================
app.get("/", (req, res) => {
  res.send("API Klinik Jalan ");
});

// ================= TEST DB =================
app.get("/test-db", (req, res) => {
  db.query("SELECT 1 + 1 AS hasil", (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

// ================= AUTH =================
app.use("/api/auth", authRoutes);

// ================= PENGAJUAN =================
app.use("/api/pengajuan", pengajuanRoutes);

// ================= ANTRIAN =================
app.use("/api/antrian", antrianRoutes);

// ================= PEMERIKSAAN =================
app.use("/api/pemeriksaan", pemeriksaanRoutes);

// ================= USERS =================
app.use("/api/users", userRoutes);

// ================= MEDICINE =================
app.use("/api/medicines", medicineRoutes);

// ================= NOTIFICATION =================
app.use("/api/notifications", notificationRoutes);

// ================= PROTECTED TEST =================
app.get("/api/test-protected", verifyToken, (req, res) => {
  res.json({
    message: "Akses berhasil",
    user: req.user,
  });
});

app.get(
  "/api/test-pimpinan",
  verifyToken,
  checkRole(["pimpinan"]),
  (req, res) => {
    res.json({
      message: "Halo pimpinan!",
    });
  },
);

app.get("/api/test-dokter", verifyToken, checkRole(["dokter"]), (req, res) => {
  res.json({
    message: "Halo dokter!",
  });
});

app.get(
  "/api/test-resepsionis",
  verifyToken,
  checkRole(["resepsionis"]),
  (req, res) => {
    res.json({
      message: "Halo resepsionis!",
    });
  },
);

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
