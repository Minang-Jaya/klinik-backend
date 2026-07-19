const express = require("express");
const router = express.Router();

const pemeriksaanController = require("../controllers/pemeriksaanController");

const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// ================= CREATE PEMERIKSAAN =================
router.post(
  "/",
  verifyToken,
  checkRole(["dokter"]),
  pemeriksaanController.createPemeriksaan,
);

// ================= GET PEMERIKSAAN =================
router.get(
  "/",
  verifyToken,
  checkRole(["dokter", "pimpinan", "resepsionis", "karyawan"]),
  pemeriksaanController.getAllPemeriksaan,
);

// ================= UPDATE PEMERIKSAAN =================
router.put(
  "/:id",
  verifyToken,
  checkRole(["dokter"]),
  pemeriksaanController.updatePemeriksaan,
);

module.exports = router;
