const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");

const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// ================= CREATE USER =================
router.post(
  "/",
  verifyToken,
  checkRole(["resepsionis"]),
  userController.createUser,
);

// ================= GET ALL USERS =================
router.get(
  "/",
  verifyToken,
  checkRole(["resepsionis"]),
  userController.getAllUsers,
);

// ================= GET DOKTER =================
router.get(
  "/dokter",
  verifyToken,
  checkRole(["resepsionis"]),
  userController.getDokter,
);

// ================= UPDATE OWN PROFILE =================
router.put("/profile", verifyToken, userController.updateOwnProfile);

// ================= UPDATE USER =================
router.put(
  "/:id",
  verifyToken,
  checkRole(["resepsionis"]),
  userController.updateUser,
);

// ================= DELETE USER =================
router.delete(
  "/:id",
  verifyToken,
  checkRole(["resepsionis"]),
  userController.deleteUser,
);

module.exports = router;
