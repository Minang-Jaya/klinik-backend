const express = require("express");
const router = express.Router();

const antrianController = require("../controllers/antrianController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// ================= RESEPSIONIS =================

// ➕ Masukkan ke antrian (dari approved → antrian)
router.post(
  "/",
  verifyToken,
  checkRole(["resepsionis"]),
  antrianController.createAntrian,
);

// 📋 Lihat antrian
router.get(
  "/",
  verifyToken,
  checkRole(["resepsionis", "dokter"]),
  antrianController.getAllAntrian,
);

// ================= RESEPSIONIS =================

// ubah ke "pemeriksaan"
router.put(
  "/:id/panggil",
  verifyToken,
  checkRole(["resepsionis"]),
  (req, res, next) => {
    req.body.status = "pemeriksaan";
    next();
  },
  antrianController.updateStatus,
);

// ================= DOKTER =================

// selesai pemeriksaan
router.put(
  "/:id/selesai",
  verifyToken,
  checkRole(["dokter"]),
  (req, res, next) => {
    req.body.status = "selesai";
    next();
  },
  antrianController.updateStatus,
);

module.exports = router;
