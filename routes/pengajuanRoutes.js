const express = require("express");

const router = express.Router();

const pengajuanController = require("../controllers/pengajuanController");

const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// =====================================================
// KARYAWAN
// =====================================================

// CREATE PENGAJUAN
router.post(
  "/",
  verifyToken,
  checkRole(["karyawan"]),
  pengajuanController.createPengajuan,
);

// =====================================================
// SEMUA ROLE
// =====================================================

// GET ALL PENGAJUAN
router.get(
  "/",
  verifyToken,
  checkRole(["karyawan", "pimpinan", "resepsionis", "dokter"]),
  pengajuanController.getAllPengajuan,
);

// =====================================================
// PIMPINAN & RESEPSIONIS
// =====================================================

// UPDATE STATUS
// UPDATE STATUS
router.put(
  "/:id",
  verifyToken,
  checkRole(["pimpinan", "resepsionis", "dokter"]),
  pengajuanController.updateStatus,
);
// =====================================================
// RESEPSIONIS
// =====================================================

// INGATKAN PASIEN
router.post(
  "/:id/remind-patient",
  verifyToken,
  checkRole(["resepsionis"]),
  pengajuanController.remindPatient,
);
module.exports = router;
