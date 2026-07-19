const express = require("express");

const router = express.Router();

const {
  getMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine,
} = require("../controllers/medicineController");

const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get(
  "/",
  verifyToken,
  checkRole(["resepsionis", "dokter"]),
  getMedicines,
);

router.post("/", verifyToken, checkRole(["resepsionis"]), createMedicine);

router.put("/:id", verifyToken, checkRole(["resepsionis"]), updateMedicine);

router.delete("/:id", verifyToken, checkRole(["resepsionis"]), deleteMedicine);

module.exports = router;
